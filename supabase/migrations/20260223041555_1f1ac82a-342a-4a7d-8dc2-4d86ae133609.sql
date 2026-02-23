
-- Create a unified function that resolves user → firm and updates the firm-level agreement
-- This replaces profile-level updates with firm-level updates

CREATE OR REPLACE FUNCTION public.update_agreement_via_user(
  p_user_id uuid,
  p_agreement_type text,  -- 'nda' or 'fee_agreement'
  p_action text,           -- 'sign', 'unsign', 'email_sent', 'email_unsent'
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_firm_id uuid;
  v_firm_name text;
  v_user_email text;
  v_user_name text;
  v_user_company text;
  v_email_domain text;
  v_admin_id uuid;
BEGIN
  -- Verify caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  v_admin_id := auth.uid();

  -- Get user info
  SELECT email, 
         COALESCE(first_name || ' ' || last_name, first_name, last_name, email),
         company
  INTO v_user_email, v_user_name, v_user_company
  FROM profiles
  WHERE id = p_user_id;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- Extract email domain
  v_email_domain := split_part(v_user_email, '@', 2);

  -- 1. Try to find firm via firm_members
  SELECT fm.firm_id, fa.primary_company_name
  INTO v_firm_id, v_firm_name
  FROM firm_members fm
  JOIN firm_agreements fa ON fa.id = fm.firm_id
  WHERE fm.user_id = p_user_id
  LIMIT 1;

  -- 2. If not found, try email domain match
  IF v_firm_id IS NULL AND v_email_domain IS NOT NULL THEN
    SELECT fa.id, fa.primary_company_name
    INTO v_firm_id, v_firm_name
    FROM firm_agreements fa
    WHERE fa.email_domain = v_email_domain
       OR fa.website_domain = v_email_domain
    LIMIT 1;
    
    -- Also check firm_domain_aliases
    IF v_firm_id IS NULL THEN
      SELECT fa.id, fa.primary_company_name
      INTO v_firm_id, v_firm_name
      FROM firm_domain_aliases fda
      JOIN firm_agreements fa ON fa.id = fda.firm_id
      WHERE fda.domain = v_email_domain
      LIMIT 1;
    END IF;

    -- If found by domain, create firm_members link
    IF v_firm_id IS NOT NULL THEN
      INSERT INTO firm_members (firm_id, user_id, member_type, added_by)
      VALUES (v_firm_id, p_user_id, 'auto_domain_match', v_admin_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- 3. If still no firm, create one from user's company name
  IF v_firm_id IS NULL THEN
    v_firm_name := COALESCE(v_user_company, v_email_domain, 'Unknown Firm');
    
    INSERT INTO firm_agreements (
      primary_company_name,
      normalized_company_name,
      email_domain
    ) VALUES (
      v_firm_name,
      lower(trim(regexp_replace(v_firm_name, '[^a-zA-Z0-9]', '', 'g'))),
      v_email_domain
    )
    RETURNING id INTO v_firm_id;

    -- Link user to new firm
    INSERT INTO firm_members (firm_id, user_id, member_type, is_primary_contact, added_by)
    VALUES (v_firm_id, p_user_id, 'auto_created', true, v_admin_id);
  END IF;

  -- Now update the firm_agreements record based on action + type
  IF p_agreement_type = 'nda' THEN
    CASE p_action
      WHEN 'sign' THEN
        UPDATE firm_agreements SET
          nda_signed = true,
          nda_signed_at = now(),
          nda_signed_by = p_user_id,
          nda_signed_by_name = v_user_name,
          nda_status = 'signed',
          updated_at = now()
        WHERE id = v_firm_id;
      WHEN 'unsign' THEN
        UPDATE firm_agreements SET
          nda_signed = false,
          nda_signed_at = NULL,
          nda_signed_by = NULL,
          nda_signed_by_name = NULL,
          nda_status = 'not_started',
          updated_at = now()
        WHERE id = v_firm_id;
      WHEN 'email_sent' THEN
        UPDATE firm_agreements SET
          nda_email_sent = true,
          nda_email_sent_at = now(),
          nda_email_sent_by = v_admin_id,
          nda_status = CASE WHEN nda_status IS NULL OR nda_status = 'not_started' THEN 'sent' ELSE nda_status END,
          updated_at = now()
        WHERE id = v_firm_id;
      WHEN 'email_unsent' THEN
        UPDATE firm_agreements SET
          nda_email_sent = false,
          nda_email_sent_at = NULL,
          nda_email_sent_by = NULL,
          updated_at = now()
        WHERE id = v_firm_id;
    END CASE;
  ELSIF p_agreement_type = 'fee_agreement' THEN
    CASE p_action
      WHEN 'sign' THEN
        UPDATE firm_agreements SET
          fee_agreement_signed = true,
          fee_agreement_signed_at = now(),
          fee_agreement_signed_by = p_user_id,
          fee_agreement_signed_by_name = v_user_name,
          fee_agreement_status = 'signed',
          updated_at = now()
        WHERE id = v_firm_id;
      WHEN 'unsign' THEN
        UPDATE firm_agreements SET
          fee_agreement_signed = false,
          fee_agreement_signed_at = NULL,
          fee_agreement_signed_by = NULL,
          fee_agreement_signed_by_name = NULL,
          fee_agreement_status = 'not_started',
          updated_at = now()
        WHERE id = v_firm_id;
      WHEN 'email_sent' THEN
        UPDATE firm_agreements SET
          fee_agreement_email_sent = true,
          fee_agreement_email_sent_at = now(),
          fee_agreement_email_sent_by = v_admin_id,
          fee_agreement_status = CASE WHEN fee_agreement_status IS NULL OR fee_agreement_status = 'not_started' THEN 'sent' ELSE fee_agreement_status END,
          updated_at = now()
        WHERE id = v_firm_id;
      WHEN 'email_unsent' THEN
        UPDATE firm_agreements SET
          fee_agreement_email_sent = false,
          fee_agreement_email_sent_at = NULL,
          fee_agreement_email_sent_by = NULL,
          updated_at = now()
        WHERE id = v_firm_id;
    END CASE;
  END IF;

  -- Also keep profile in sync for backward compatibility
  IF p_agreement_type = 'nda' THEN
    IF p_action = 'sign' THEN
      UPDATE profiles SET nda_signed = true, nda_signed_at = now() WHERE id = p_user_id;
    ELSIF p_action = 'unsign' THEN
      UPDATE profiles SET nda_signed = false, nda_signed_at = NULL WHERE id = p_user_id;
    ELSIF p_action = 'email_sent' THEN
      UPDATE profiles SET nda_email_sent = true, nda_email_sent_at = now() WHERE id = p_user_id;
    ELSIF p_action = 'email_unsent' THEN
      UPDATE profiles SET nda_email_sent = false, nda_email_sent_at = NULL WHERE id = p_user_id;
    END IF;
  ELSIF p_agreement_type = 'fee_agreement' THEN
    IF p_action = 'sign' THEN
      UPDATE profiles SET fee_agreement_signed = true, fee_agreement_signed_at = now() WHERE id = p_user_id;
    ELSIF p_action = 'unsign' THEN
      UPDATE profiles SET fee_agreement_signed = false, fee_agreement_signed_at = NULL WHERE id = p_user_id;
    ELSIF p_action = 'email_sent' THEN
      UPDATE profiles SET fee_agreement_email_sent = true, fee_agreement_email_sent_at = now() WHERE id = p_user_id;
    ELSIF p_action = 'email_unsent' THEN
      UPDATE profiles SET fee_agreement_email_sent = false, fee_agreement_email_sent_at = NULL WHERE id = p_user_id;
    END IF;
  END IF;

  -- Log to audit
  INSERT INTO agreement_audit_log (
    firm_id, agreement_type, new_status, old_status, 
    changed_by, notes
  ) VALUES (
    v_firm_id,
    p_agreement_type,
    p_action,
    NULL,
    v_admin_id,
    COALESCE(p_admin_notes, 'Updated via user toggle for ' || v_user_name)
  );

  RETURN jsonb_build_object(
    'success', true,
    'firm_id', v_firm_id,
    'firm_name', v_firm_name,
    'action', p_action,
    'agreement_type', p_agreement_type,
    'user_name', v_user_name
  );
END;
$$;
