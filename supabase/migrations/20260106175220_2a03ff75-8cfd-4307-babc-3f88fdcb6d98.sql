
-- Fix the auto_link_user_to_firm trigger to not create firms for generic email domains
CREATE OR REPLACE FUNCTION public.auto_link_user_to_firm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_firm_id UUID;
  v_email_domain TEXT;
  v_website_domain TEXT;
  v_normalized_company TEXT;
  v_existing_lead_member_id UUID;
  v_generic_domains TEXT[] := ARRAY['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'mail.com', 'protonmail.com'];
BEGIN
  -- Extract domains
  IF NEW.email IS NOT NULL THEN
    v_email_domain := extract_domain(NEW.email);
  END IF;
  
  IF NEW.website IS NOT NULL THEN
    v_website_domain := extract_domain(NEW.website);
  END IF;
  
  -- Normalize company name
  IF NEW.company_name IS NOT NULL AND NEW.company_name <> '' THEN
    v_normalized_company := normalize_company_name(NEW.company_name);
  END IF;
  
  -- Try to find existing firm (avoid generic email domains)
  IF v_normalized_company IS NOT NULL OR (v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains)) OR v_website_domain IS NOT NULL THEN
    SELECT id INTO v_firm_id
    FROM firm_agreements
    WHERE 
      (normalized_company_name = v_normalized_company AND v_normalized_company IS NOT NULL)
      OR (email_domain = v_email_domain AND v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains))
      OR (website_domain = v_website_domain AND v_website_domain IS NOT NULL)
    LIMIT 1;
    
    -- If no firm found, create one - but ONLY if we have a real company name or non-generic email domain
    -- CRITICAL FIX: Don't fall back to email domain if it's a generic domain
    IF v_firm_id IS NULL THEN
      IF v_normalized_company IS NOT NULL THEN
        -- Has a company name - use it
        INSERT INTO firm_agreements (
          primary_company_name,
          normalized_company_name,
          email_domain,
          website_domain,
          member_count,
          created_at,
          updated_at
        ) VALUES (
          NEW.company_name,
          v_normalized_company,
          CASE WHEN v_email_domain <> ALL(v_generic_domains) THEN v_email_domain ELSE NULL END,
          v_website_domain,
          0,
          NOW(),
          NOW()
        )
        RETURNING id INTO v_firm_id;
      ELSIF v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains) THEN
        -- Has a non-generic email domain - use it
        INSERT INTO firm_agreements (
          primary_company_name,
          normalized_company_name,
          email_domain,
          website_domain,
          member_count,
          created_at,
          updated_at
        ) VALUES (
          v_email_domain,
          v_email_domain,
          v_email_domain,
          v_website_domain,
          0,
          NOW(),
          NOW()
        )
        RETURNING id INTO v_firm_id;
      END IF;
      -- If neither condition is met (generic email, no company), don't create a firm
    END IF;
    
    -- If firm was found/created, check if this user was previously a lead member
    IF v_firm_id IS NOT NULL THEN
      SELECT id INTO v_existing_lead_member_id
      FROM firm_members
      WHERE firm_id = v_firm_id
        AND member_type = 'lead'
        AND LOWER(lead_email) = LOWER(NEW.email);
      
      IF v_existing_lead_member_id IS NOT NULL THEN
        DELETE FROM firm_members WHERE id = v_existing_lead_member_id;
        
        INSERT INTO firm_members (firm_id, user_id, member_type, added_at)
        VALUES (v_firm_id, NEW.id, 'marketplace_user', NOW())
        ON CONFLICT (firm_id, user_id) WHERE member_type = 'marketplace_user' DO NOTHING;
      ELSE
        INSERT INTO firm_members (firm_id, user_id, member_type, added_at)
        VALUES (v_firm_id, NEW.id, 'marketplace_user', NOW())
        ON CONFLICT (firm_id, user_id) WHERE member_type = 'marketplace_user' DO NOTHING;
      END IF;
      
      UPDATE firm_agreements
      SET 
        member_count = (SELECT COUNT(*) FROM firm_members WHERE firm_id = v_firm_id),
        updated_at = NOW()
      WHERE id = v_firm_id;
      
      UPDATE profiles
      SET 
        fee_agreement_signed = CASE 
          WHEN (SELECT fee_agreement_signed FROM firm_agreements WHERE id = v_firm_id) THEN TRUE
          ELSE fee_agreement_signed
        END,
        fee_agreement_signed_at = CASE 
          WHEN (SELECT fee_agreement_signed FROM firm_agreements WHERE id = v_firm_id) AND NOT COALESCE(fee_agreement_signed, FALSE)
          THEN (SELECT fee_agreement_signed_at FROM firm_agreements WHERE id = v_firm_id)
          ELSE fee_agreement_signed_at
        END,
        nda_signed = CASE 
          WHEN (SELECT nda_signed FROM firm_agreements WHERE id = v_firm_id) THEN TRUE
          ELSE nda_signed
        END,
        nda_signed_at = CASE 
          WHEN (SELECT nda_signed FROM firm_agreements WHERE id = v_firm_id) AND NOT COALESCE(nda_signed, FALSE)
          THEN (SELECT nda_signed_at FROM firm_agreements WHERE id = v_firm_id)
          ELSE nda_signed_at
        END,
        updated_at = NOW()
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
