-- Add missing lead_phone column to connection_requests
ALTER TABLE public.connection_requests 
ADD COLUMN IF NOT EXISTS lead_phone text;

-- Create unique indexes to prevent duplicate requests per listing/person
-- Index 1: One request per user per listing (for authenticated marketplace requests)
CREATE UNIQUE INDEX IF NOT EXISTS idx_connection_requests_user_listing 
ON public.connection_requests (user_id, listing_id) 
WHERE user_id IS NOT NULL AND status != 'rejected';

-- Index 2: One request per email per listing (for lead-only requests from website)
CREATE UNIQUE INDEX IF NOT EXISTS idx_connection_requests_email_listing 
ON public.connection_requests (lead_email, listing_id) 
WHERE user_id IS NULL AND lead_email IS NOT NULL AND status != 'rejected';

-- Create RPC function to merge or create connection requests
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
  -- Get authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Get user profile
  SELECT * INTO v_user_profile FROM public.profiles WHERE id = v_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  -- Check if user already has a request for this listing
  SELECT id INTO v_existing_request_id 
  FROM public.connection_requests 
  WHERE user_id = v_user_id 
    AND listing_id = p_listing_id 
    AND status != 'rejected';
  
  IF v_existing_request_id IS NOT NULL THEN
    -- User already has a request, just return it
    RETURN v_existing_request_id;
  END IF;
  
  -- Check if there's a lead-only request with the same email for this listing
  SELECT * INTO v_existing_lead_request 
  FROM public.connection_requests 
  WHERE user_id IS NULL 
    AND lead_email = v_user_profile.email 
    AND listing_id = p_listing_id 
    AND status != 'rejected';
  
  IF v_existing_lead_request.id IS NOT NULL THEN
    -- Merge: Update the lead-only request to link to the authenticated user
    UPDATE public.connection_requests 
    SET 
      user_id = v_user_id,
      user_message = p_user_message,
      source = 'marketplace',
      updated_at = NOW()
    WHERE id = v_existing_lead_request.id;
    
    RETURN v_existing_lead_request.id;
  END IF;
  
  -- No existing request, create a new one
  INSERT INTO public.connection_requests (
    user_id,
    listing_id,
    user_message,
    lead_name,
    lead_email,
    lead_company,
    lead_role,
    lead_phone,
    source,
    status
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
    'pending'
  ) RETURNING id INTO v_new_request_id;
  
  RETURN v_new_request_id;
END;
$$;

-- Create RPC function for converting inbound leads to connection requests
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
  -- Auth check
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Admin check
  IF NOT is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Only admins can convert leads';
  END IF;
  
  -- Get the lead
  SELECT * INTO v_lead FROM public.inbound_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  
  -- Check if user exists with this email
  SELECT * INTO v_existing_user FROM public.profiles WHERE email = v_lead.email;
  
  IF v_existing_user.id IS NOT NULL THEN
    -- User exists, check if they already have a request for this listing
    SELECT id INTO v_existing_request_id 
    FROM public.connection_requests 
    WHERE user_id = v_existing_user.id 
      AND listing_id = p_listing_id 
      AND status != 'rejected';
    
    IF v_existing_request_id IS NOT NULL THEN
      -- Link the lead to the existing request
      UPDATE public.inbound_leads 
      SET 
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
    
    -- User exists but no request, create one and link it
    INSERT INTO public.connection_requests (
      user_id,
      listing_id,
      user_message,
      lead_name,
      lead_email,
      lead_company,
      lead_role,
      lead_phone,
      source,
      source_lead_id,
      converted_by,
      converted_at,
      status
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
      'pending'
    ) RETURNING id INTO v_new_request_id;
  ELSE
    -- No user exists, create lead-only request
    INSERT INTO public.connection_requests (
      user_id,
      listing_id,
      user_message,
      lead_name,
      lead_email,
      lead_company,
      lead_role,
      lead_phone,
      source,
      source_lead_id,
      converted_by,
      converted_at,
      status
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
      'pending'
    ) RETURNING id INTO v_new_request_id;
  END IF;
  
  -- Update the lead status
  UPDATE public.inbound_leads 
  SET 
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