-- De-overload RPC functions by renaming 5-parameter versions to unique names

-- Rename the 5-parameter fee agreement function
ALTER FUNCTION public.update_fee_agreement_firm_status(uuid, boolean, uuid, text, text)
  RENAME TO update_fee_agreement_firm_status_with_notes;

-- Rename the 5-parameter NDA function
ALTER FUNCTION public.update_nda_firm_status(uuid, boolean, uuid, text, text)
  RENAME TO update_nda_firm_status_with_notes;

-- Update update_fee_agreement_status to call the renamed function
CREATE OR REPLACE FUNCTION public.update_fee_agreement_status(
  target_user_id uuid,
  is_signed boolean,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_firm_id uuid;
BEGIN
  -- Check if user belongs to a firm
  SELECT firm_id INTO v_firm_id
  FROM public.firm_members
  WHERE user_id = target_user_id
  LIMIT 1;

  -- If user belongs to a firm, update the entire firm
  IF v_firm_id IS NOT NULL THEN
    PERFORM public.update_fee_agreement_firm_status_with_notes(
      p_firm_id := v_firm_id,
      p_is_signed := is_signed,
      p_signed_by_user_id := target_user_id,
      p_signed_by_name := NULL,
      p_admin_notes := admin_notes
    );
    RETURN TRUE;
  END IF;

  -- Update individual user profile
  UPDATE public.profiles
  SET 
    fee_agreement_signed = is_signed,
    fee_agreement_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Sync to ALL connection_requests for this user
  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_signed = is_signed,
    lead_fee_agreement_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    lead_fee_agreement_signed_by = CASE WHEN is_signed THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE user_id = target_user_id;

  -- Sync to ALL deals for this user (via connection_requests)
  UPDATE public.deals
  SET 
    fee_agreement_status = CASE 
      WHEN is_signed THEN 'signed'::text
      ELSE 'not_sent'::text
    END,
    updated_at = NOW()
  WHERE connection_request_id IN (
    SELECT id FROM public.connection_requests WHERE user_id = target_user_id
  );

  -- Log the action
  INSERT INTO public.fee_agreement_logs (
    user_id,
    admin_id,
    action_type,
    notes,
    metadata
  ) VALUES (
    target_user_id,
    auth.uid(),
    CASE WHEN is_signed THEN 'signed' ELSE 'unsigned' END,
    admin_notes,
    jsonb_build_object('manual_update', true, 'is_signed', is_signed)
  );

  RETURN TRUE;
END;
$$;

-- Update update_nda_status to call the renamed function
CREATE OR REPLACE FUNCTION public.update_nda_status(
  target_user_id uuid,
  is_signed boolean,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_firm_id uuid;
BEGIN
  -- Check if user belongs to a firm
  SELECT firm_id INTO v_firm_id
  FROM public.firm_members
  WHERE user_id = target_user_id
  LIMIT 1;

  -- If user belongs to a firm, update the entire firm
  IF v_firm_id IS NOT NULL THEN
    PERFORM public.update_nda_firm_status_with_notes(
      p_firm_id := v_firm_id,
      p_is_signed := is_signed,
      p_signed_by_user_id := target_user_id,
      p_signed_by_name := NULL,
      p_admin_notes := admin_notes
    );
    RETURN TRUE;
  END IF;

  -- Update individual user profile
  UPDATE public.profiles
  SET 
    nda_signed = is_signed,
    nda_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Sync to ALL connection_requests for this user
  UPDATE public.connection_requests
  SET 
    lead_nda_signed = is_signed,
    lead_nda_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    lead_nda_signed_by = CASE WHEN is_signed THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE user_id = target_user_id;

  -- Sync to ALL deals for this user (via connection_requests)
  UPDATE public.deals
  SET 
    nda_status = CASE 
      WHEN is_signed THEN 'signed'::text
      ELSE 'not_sent'::text
    END,
    updated_at = NOW()
  WHERE connection_request_id IN (
    SELECT id FROM public.connection_requests WHERE user_id = target_user_id
  );

  -- Log the action
  INSERT INTO public.nda_logs (
    user_id,
    admin_id,
    action_type,
    notes,
    metadata
  ) VALUES (
    target_user_id,
    auth.uid(),
    CASE WHEN is_signed THEN 'signed' ELSE 'unsigned' END,
    admin_notes,
    jsonb_build_object('manual_update', true, 'is_signed', is_signed)
  );

  RETURN TRUE;
END;
$$;