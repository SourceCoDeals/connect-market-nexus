
DO $$
DECLARE
  rec RECORD;
  v_firm_id UUID;
  v_domain TEXT;
  v_normalized TEXT;
  v_is_generic BOOLEAN;
  v_email TEXT;
  v_company TEXT;
BEGIN
  FOR rec IN
    SELECT cr.id AS cr_id, cr.user_id, cr.lead_email, cr.lead_company,
           p.email AS profile_email, p.company_name AS profile_company
    FROM connection_requests cr
    LEFT JOIN profiles p ON p.id = cr.user_id
    WHERE cr.firm_id IS NULL
  LOOP
    v_firm_id := NULL;
    v_email := COALESCE(rec.profile_email, rec.lead_email);
    v_company := COALESCE(rec.profile_company, rec.lead_company, 'Unknown Company');
    
    v_domain := lower(split_part(COALESCE(v_email, ''), '@', 2));
    
    v_is_generic := v_domain IN (
      'gmail.com','googlemail.com','yahoo.com','yahoo.com.au','hotmail.com','hotmail.se',
      'outlook.com','aol.com','icloud.com','me.com','mac.com','live.com','msn.com',
      'mail.com','zoho.com','yandex.com','gmx.com','gmx.net','inbox.com',
      'rocketmail.com','ymail.com','protonmail.com','proton.me','pm.me',
      'fastmail.com','tutanota.com','hey.com','comcast.net','att.net',
      'sbcglobal.net','verizon.net','cox.net','charter.net','earthlink.net',
      'optonline.net','frontier.com','windstream.net','mediacombb.net','bellsouth.net',
      'webxio.pro','leabro.com','coursora.com'
    ) OR v_domain = '' OR v_domain IS NULL;
    
    v_normalized := regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(trim(v_company)),
          '[^a-z0-9\s]', '', 'g'
        ),
        '\m(inc|llc|llp|ltd|corp|corporation|company|co|group|holdings|partners|lp|plc|pllc|pa|pc|sa|gmbh|ag|pty|srl|bv|nv)\M', '', 'gi'
      ),
      '\s+', ' ', 'g'
    );
    v_normalized := trim(v_normalized);
    
    IF NOT v_is_generic AND v_domain <> '' THEN
      SELECT id INTO v_firm_id FROM firm_agreements WHERE email_domain = v_domain LIMIT 1;
    END IF;
    
    IF v_firm_id IS NULL AND v_normalized <> '' AND v_normalized <> 'unknown' THEN
      SELECT id INTO v_firm_id FROM firm_agreements WHERE normalized_company_name = v_normalized LIMIT 1;
    END IF;
    
    IF v_firm_id IS NULL THEN
      INSERT INTO firm_agreements (
        primary_company_name, normalized_company_name, email_domain, nda_signed, fee_agreement_signed
      ) VALUES (
        v_company, v_normalized,
        CASE WHEN v_is_generic THEN NULL ELSE v_domain END,
        false, false
      ) RETURNING id INTO v_firm_id;
    END IF;
    
    IF rec.user_id IS NOT NULL THEN
      INSERT INTO firm_members (firm_id, user_id, member_type)
      VALUES (v_firm_id, rec.user_id, 'marketplace_user')
      ON CONFLICT DO NOTHING;
    END IF;
    
    UPDATE connection_requests SET firm_id = v_firm_id WHERE id = rec.cr_id;
  END LOOP;
END;
$$;
