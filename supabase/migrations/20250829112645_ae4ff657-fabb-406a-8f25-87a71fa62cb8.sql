-- Relax check constraint on connection_requests.source to include 'website' and other channels
ALTER TABLE public.connection_requests DROP CONSTRAINT IF EXISTS check_valid_source;
ALTER TABLE public.connection_requests
ADD CONSTRAINT check_valid_source
CHECK (
  source IN (
    'marketplace','webflow','manual','import','api','website','referral','cold_outreach','networking','linkedin','email'
  )
);

-- Update merge/create RPC to annotate channel merges
CREATE OR REPLACE FUNCTION public.merge_or_create_connection_request(
  p_listing_id uuid,
  p_user_message text,
  p_lead_name text DEFAULT NULL,
  p_lead_email text DEFAULT NULL,
  p_lead_company text DEFAULT NULL,
  p_lead_role text DEFAULT NULL,
  p_lead_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_user_profile record;
  v_existing_request_id uuid;
  v_existing_lead_request record;
  v_new_request_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;

  SELECT * INTO v_user_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User profile not found'; END IF;

  SELECT id INTO v_existing_request_id
  FROM public.connection_requests
  WHERE user_id = v_user_id AND listing_id = p_listing_id AND status != 'rejected';

  IF v_existing_request_id IS NOT NULL THEN
    RETURN v_existing_request_id;
  END IF;

  SELECT * INTO v_existing_lead_request
  FROM public.connection_requests
  WHERE user_id IS NULL AND lead_email = v_user_profile.email AND listing_id = p_listing_id AND status != 'rejected';

  IF v_existing_lead_request.id IS NOT NULL THEN
    UPDATE public.connection_requests
    SET 
      user_id = v_user_id,
      user_message = p_user_message,
      source = 'marketplace',
      source_metadata = COALESCE(source_metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'is_channel_duplicate', true,
          'channel_merge', 'website_to_marketplace',
          'merged_at', NOW(),
          'original_lead_email', v_existing_lead_request.lead_email
        ),
      updated_at = NOW()
    WHERE id = v_existing_lead_request.id;

    RETURN v_existing_lead_request.id;
  END IF;

  INSERT INTO public.connection_requests (
    user_id, listing_id, user_message,
    lead_name, lead_email, lead_company, lead_role, lead_phone,
    source, status, source_metadata
  ) VALUES (
    v_user_id,
    p_listing_id,
    p_user_message,
    COALESCE(p_lead_name, v_user_profile.first_name || ' ' || v_user_profile.last_name),
    COALESCE(p_lead_email, v_user_profile.email),
    COALESCE(p_lead_company, v_user_profile.company),
    COALESCE(p_lead_role, v_user_profile.job_title),
    p_lead_phone,
    'marketplace',
    'pending',
    jsonb_build_object('original_channel','marketplace')
  ) RETURNING id INTO v_new_request_id;

  RETURN v_new_request_id;
END;
$$;

-- Update conversion RPC to annotate channel merges
CREATE OR REPLACE FUNCTION public.convert_inbound_lead_to_request(
  p_lead_id uuid,
  p_listing_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid;
  v_lead record;
  v_existing_user record;
  v_existing_request_id uuid;
  v_new_request_id uuid;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
  IF NOT is_admin(v_admin_id) THEN RAISE EXCEPTION 'Only admins can convert leads'; END IF;

  SELECT * INTO v_lead FROM public.inbound_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;

  SELECT * INTO v_existing_user FROM public.profiles WHERE email = v_lead.email;

  IF v_existing_user.id IS NOT NULL THEN
    SELECT id INTO v_existing_request_id FROM public.connection_requests
    WHERE user_id = v_existing_user.id AND listing_id = p_listing_id AND status != 'rejected';

    IF v_existing_request_id IS NOT NULL THEN
      -- Link the lead and mark as channel duplicate
      UPDATE public.connection_requests
      SET source_metadata = COALESCE(source_metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'is_channel_duplicate', true,
          'channel_merge', 'marketplace_to_website',
          'linked_lead_id', p_lead_id,
          'merged_at', NOW()
        ),
          updated_at = NOW()
      WHERE id = v_existing_request_id;

      UPDATE public.inbound_leads SET
        status = 'converted',
        converted_to_request_id = v_existing_request_id,
        converted_at = NOW(),
        converted_by = v_admin_id,
        mapped_to_listing_id = p_listing_id,
        mapped_at = NOW(),
        mapped_by = v_admin_id
      WHERE id = p_lead_id;

      RETURN v_existing_request_id;
    END IF;

    INSERT INTO public.connection_requests (
      user_id, listing_id, user_message,
      lead_name, lead_email, lead_company, lead_role, lead_phone,
      source, source_lead_id, converted_by, converted_at, status, source_metadata
    ) VALUES (
      v_existing_user.id,
      p_listing_id,
      v_lead.message,
      v_lead.name,
      v_lead.email,
      v_lead.company_name,
      v_lead.role,
      v_lead.phone_number,
      'website',
      p_lead_id,
      v_admin_id,
      NOW(),
      'pending',
      jsonb_build_object('original_channel','website')
    ) RETURNING id INTO v_new_request_id;
  ELSE
    INSERT INTO public.connection_requests (
      user_id, listing_id, user_message,
      lead_name, lead_email, lead_company, lead_role, lead_phone,
      source, source_lead_id, converted_by, converted_at, status, source_metadata
    ) VALUES (
      NULL,
      p_listing_id,
      v_lead.message,
      v_lead.name,
      v_lead.email,
      v_lead.company_name,
      v_lead.role,
      v_lead.phone_number,
      'website',
      p_lead_id,
      v_admin_id,
      NOW(),
      'pending',
      jsonb_build_object('original_channel','website')
    ) RETURNING id INTO v_new_request_id;
  END IF;

  UPDATE public.inbound_leads SET
    status = 'converted',
    converted_to_request_id = v_new_request_id,
    converted_at = NOW(),
    converted_by = v_admin_id,
    mapped_to_listing_id = p_listing_id,
    mapped_at = NOW(),
    mapped_by = v_admin_id
  WHERE id = p_lead_id;

  RETURN v_new_request_id;
END;
$$;