-- OPTION A: Fix Bidirectional Sync - User → Firm → All Members

-- ============================================================================
-- 1. UPDATE: update_fee_agreement_status() to check firm membership
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_fee_agreement_status(
  target_user_id UUID,
  is_signed BOOLEAN,
  admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_firm_id UUID;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if user belongs to a firm
  SELECT firm_id INTO v_firm_id
  FROM public.firm_members
  WHERE user_id = target_user_id
  LIMIT 1;
  
  -- If user belongs to a firm, update the entire firm (which cascades to all members)
  IF v_firm_id IS NOT NULL THEN
    RETURN public.update_fee_agreement_firm_status(
      p_firm_id := v_firm_id,
      p_is_signed := is_signed,
      p_signed_by_user_id := target_user_id,
      p_signed_by_name := NULL,
      p_admin_notes := admin_notes
    );
  END IF;
  
  -- Otherwise, update just this individual user (no firm affiliation)
  UPDATE public.profiles
  SET 
    fee_agreement_signed = is_signed,
    fee_agreement_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Sync to connection_requests for this user
  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_signed = is_signed,
    lead_fee_agreement_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    lead_fee_agreement_signed_by = CASE WHEN is_signed THEN v_admin_id ELSE NULL END,
    updated_at = NOW()
  WHERE user_id = target_user_id;

  -- Sync to deals for this user
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
    v_admin_id,
    CASE WHEN is_signed THEN 'signed' ELSE 'revoked' END,
    admin_notes,
    jsonb_build_object('individual_user_update', true, 'no_firm_affiliation', true)
  );

  RETURN FOUND;
END;
$$;


-- ============================================================================
-- 2. UPDATE: update_nda_status() to check firm membership
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_nda_status(
  target_user_id UUID,
  is_signed BOOLEAN,
  admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_firm_id UUID;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if user belongs to a firm
  SELECT firm_id INTO v_firm_id
  FROM public.firm_members
  WHERE user_id = target_user_id
  LIMIT 1;
  
  -- If user belongs to a firm, update the entire firm (which cascades to all members)
  IF v_firm_id IS NOT NULL THEN
    RETURN public.update_nda_firm_status(
      p_firm_id := v_firm_id,
      p_is_signed := is_signed,
      p_signed_by_user_id := target_user_id,
      p_signed_by_name := NULL,
      p_admin_notes := admin_notes
    );
  END IF;
  
  -- Otherwise, update just this individual user (no firm affiliation)
  UPDATE public.profiles
  SET 
    nda_signed = is_signed,
    nda_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Sync to connection_requests for this user
  UPDATE public.connection_requests
  SET 
    lead_nda_signed = is_signed,
    lead_nda_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    lead_nda_signed_by = CASE WHEN is_signed THEN v_admin_id ELSE NULL END,
    updated_at = NOW()
  WHERE user_id = target_user_id;

  -- Sync to deals for this user
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
    v_admin_id,
    CASE WHEN is_signed THEN 'signed' ELSE 'revoked' END,
    admin_notes,
    jsonb_build_object('individual_user_update', true, 'no_firm_affiliation', true)
  );

  RETURN FOUND;
END;
$$;


-- ============================================================================
-- 3. UPDATE: update_fee_agreement_firm_status() to include firm_id in logs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_fee_agreement_firm_status(
  p_firm_id UUID,
  p_is_signed BOOLEAN,
  p_signed_by_user_id UUID DEFAULT NULL,
  p_signed_by_name TEXT DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_member_record RECORD;
BEGIN
  v_admin_id := auth.uid();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  IF NOT is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Only admins can update firm fee agreement status';
  END IF;
  
  -- Update firm_agreements table
  UPDATE public.firm_agreements
  SET 
    fee_agreement_signed = p_is_signed,
    fee_agreement_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
    fee_agreement_signed_by = CASE WHEN p_is_signed THEN COALESCE(p_signed_by_user_id, v_admin_id) ELSE NULL END,
    fee_agreement_signed_by_name = CASE WHEN p_is_signed THEN p_signed_by_name ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_firm_id;
  
  -- Cascade to all firm members' profiles
  FOR v_member_record IN 
    SELECT user_id FROM public.firm_members WHERE firm_id = p_firm_id
  LOOP
    UPDATE public.profiles
    SET 
      fee_agreement_signed = p_is_signed,
      fee_agreement_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_member_record.user_id;
    
    -- Cascade to all connection_requests for this user
    UPDATE public.connection_requests
    SET 
      lead_fee_agreement_signed = p_is_signed,
      lead_fee_agreement_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
      lead_fee_agreement_signed_by = CASE WHEN p_is_signed THEN COALESCE(p_signed_by_user_id, v_admin_id) ELSE NULL END,
      updated_at = NOW()
    WHERE user_id = v_member_record.user_id;
    
    -- Cascade to all deals for this user (via connection_requests)
    UPDATE public.deals
    SET 
      fee_agreement_status = CASE 
        WHEN p_is_signed THEN 'signed'::text
        ELSE 'not_sent'::text
      END,
      updated_at = NOW()
    WHERE connection_request_id IN (
      SELECT id FROM public.connection_requests WHERE user_id = v_member_record.user_id
    );
  END LOOP;
  
  -- Log the action WITH firm_id
  INSERT INTO public.fee_agreement_logs (
    user_id,
    admin_id,
    firm_id,
    action_type,
    notes,
    metadata
  )
  SELECT 
    v_member_record.user_id,
    v_admin_id,
    p_firm_id,
    CASE WHEN p_is_signed THEN 'signed' ELSE 'revoked' END,
    p_admin_notes,
    jsonb_build_object(
      'firm_update', true,
      'firm_id', p_firm_id,
      'signed_by_name', p_signed_by_name,
      'signed_by_user_id', p_signed_by_user_id
    )
  FROM public.firm_members v_member_record
  WHERE v_member_record.firm_id = p_firm_id;
  
  RETURN TRUE;
END;
$$;


-- ============================================================================
-- 4. UPDATE: update_nda_firm_status() to include firm_id in logs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_nda_firm_status(
  p_firm_id UUID,
  p_is_signed BOOLEAN,
  p_signed_by_user_id UUID DEFAULT NULL,
  p_signed_by_name TEXT DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_member_record RECORD;
BEGIN
  v_admin_id := auth.uid();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  IF NOT is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Only admins can update firm NDA status';
  END IF;
  
  -- Update firm_agreements table
  UPDATE public.firm_agreements
  SET 
    nda_signed = p_is_signed,
    nda_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
    nda_signed_by = CASE WHEN p_is_signed THEN COALESCE(p_signed_by_user_id, v_admin_id) ELSE NULL END,
    nda_signed_by_name = CASE WHEN p_is_signed THEN p_signed_by_name ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_firm_id;
  
  -- Cascade to all firm members' profiles
  FOR v_member_record IN 
    SELECT user_id FROM public.firm_members WHERE firm_id = p_firm_id
  LOOP
    UPDATE public.profiles
    SET 
      nda_signed = p_is_signed,
      nda_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_member_record.user_id;
    
    -- Cascade to all connection_requests for this user
    UPDATE public.connection_requests
    SET 
      lead_nda_signed = p_is_signed,
      lead_nda_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
      lead_nda_signed_by = CASE WHEN p_is_signed THEN COALESCE(p_signed_by_user_id, v_admin_id) ELSE NULL END,
      updated_at = NOW()
    WHERE user_id = v_member_record.user_id;
    
    -- Cascade to all deals for this user (via connection_requests)
    UPDATE public.deals
    SET 
      nda_status = CASE 
        WHEN p_is_signed THEN 'signed'::text
        ELSE 'not_sent'::text
      END,
      updated_at = NOW()
    WHERE connection_request_id IN (
      SELECT id FROM public.connection_requests WHERE user_id = v_member_record.user_id
    );
  END LOOP;
  
  -- Log the action WITH firm_id
  INSERT INTO public.nda_logs (
    user_id,
    admin_id,
    firm_id,
    action_type,
    notes,
    metadata
  )
  SELECT 
    v_member_record.user_id,
    v_admin_id,
    p_firm_id,
    CASE WHEN p_is_signed THEN 'signed' ELSE 'revoked' END,
    p_admin_notes,
    jsonb_build_object(
      'firm_update', true,
      'firm_id', p_firm_id,
      'signed_by_name', p_signed_by_name,
      'signed_by_user_id', p_signed_by_user_id
    )
  FROM public.firm_members v_member_record
  WHERE v_member_record.firm_id = p_firm_id;
  
  RETURN TRUE;
END;
$$;