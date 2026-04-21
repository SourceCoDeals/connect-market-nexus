
-- Step 1: Merge duplicate non-generic email domain firms
DO $$
DECLARE
  v_domain TEXT;
  v_canonical_id UUID;
  v_dup_id UUID;
  v_generic TEXT[] := ARRAY[
    'gmail.com','googlemail.com','yahoo.com','yahoo.com.au','hotmail.com','hotmail.se',
    'outlook.com','aol.com','icloud.com','me.com','mac.com','live.com','msn.com',
    'mail.com','zoho.com','yandex.com','gmx.com','gmx.net','inbox.com',
    'rocketmail.com','ymail.com','protonmail.com','proton.me','pm.me',
    'fastmail.com','tutanota.com','hey.com','comcast.net','att.net',
    'sbcglobal.net','verizon.net','cox.net','charter.net','earthlink.net',
    'optonline.net','frontier.com','windstream.net','mediacombb.net','bellsouth.net',
    'webxio.pro','leabro.com','coursora.com','example.com'
  ];
BEGIN
  -- For each duplicated non-generic domain, pick canonical (signed > oldest) and merge
  FOR v_domain IN
    SELECT email_domain FROM firm_agreements
    WHERE email_domain IS NOT NULL AND email_domain <> ALL(v_generic)
    GROUP BY email_domain HAVING count(*) > 1
  LOOP
    -- Pick canonical: prefer signed fee_agreement, then signed nda, then oldest
    SELECT id INTO v_canonical_id FROM firm_agreements
    WHERE email_domain = v_domain
    ORDER BY
      CASE WHEN fee_agreement_signed = true OR fee_agreement_status = 'signed' THEN 0 ELSE 1 END,
      CASE WHEN nda_signed = true OR nda_status = 'signed' THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT 1;

    -- Reassign all duplicates' members and CRs to canonical
    FOR v_dup_id IN
      SELECT id FROM firm_agreements WHERE email_domain = v_domain AND id <> v_canonical_id
    LOOP
      -- Move firm_members (skip if user already exists on canonical)
      UPDATE firm_members SET firm_id = v_canonical_id
      WHERE firm_id = v_dup_id
        AND (user_id IS NULL OR user_id NOT IN (SELECT user_id FROM firm_members WHERE firm_id = v_canonical_id AND user_id IS NOT NULL));
      -- Delete remaining duplicate members
      DELETE FROM firm_members WHERE firm_id = v_dup_id;
      -- Move connection_requests
      UPDATE connection_requests SET firm_id = v_canonical_id WHERE firm_id = v_dup_id;
      -- Move audit log entries
      UPDATE agreement_audit_log SET firm_id = v_canonical_id WHERE firm_id = v_dup_id;
      -- Delete the duplicate firm
      DELETE FROM firm_agreements WHERE id = v_dup_id;
    END LOOP;
  END LOOP;
END;
$$;

-- Step 2: Nullify generic email_domain values (they cause false grouping)
UPDATE firm_agreements SET email_domain = NULL
WHERE email_domain IN (
  'gmail.com','googlemail.com','yahoo.com','yahoo.com.au','hotmail.com','hotmail.se',
  'outlook.com','aol.com','icloud.com','me.com','mac.com','live.com','msn.com',
  'mail.com','zoho.com','yandex.com','gmx.com','gmx.net','inbox.com',
  'rocketmail.com','ymail.com','protonmail.com','proton.me','pm.me',
  'fastmail.com','tutanota.com','hey.com','comcast.net','att.net',
  'sbcglobal.net','verizon.net','cox.net','charter.net','earthlink.net',
  'optonline.net','frontier.com','windstream.net','mediacombb.net','bellsouth.net',
  'webxio.pro','leabro.com','coursora.com','example.com'
);

-- Step 3: Add partial unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_firm_agreements_email_domain_unique
  ON firm_agreements (email_domain)
  WHERE email_domain IS NOT NULL;

-- Step 4: Update the trigger to prioritize domain match over company name
CREATE OR REPLACE FUNCTION public.sync_connection_request_firm_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_firm_id UUID;
  v_firm_record RECORD;
  v_email_domain TEXT;
  v_normalized_company TEXT;
  v_generic_domains TEXT[] := ARRAY[
    'gmail.com','googlemail.com','yahoo.com','yahoo.com.au','hotmail.com','hotmail.se',
    'outlook.com','aol.com','icloud.com','me.com','mac.com','live.com','msn.com',
    'mail.com','zoho.com','yandex.com','gmx.com','gmx.net','inbox.com',
    'rocketmail.com','ymail.com','protonmail.com','proton.me','pm.me',
    'fastmail.com','tutanota.com','hey.com','comcast.net','att.net',
    'sbcglobal.net','verizon.net','cox.net','charter.net','earthlink.net',
    'optonline.net','frontier.com','windstream.net','mediacombb.net','bellsouth.net',
    'webxio.pro','leabro.com','coursora.com'
  ];
BEGIN
  -- If firm_id already set, skip resolution
  IF NEW.firm_id IS NOT NULL THEN
    v_firm_id := NEW.firm_id;
  ELSIF NEW.user_id IS NOT NULL THEN
    v_firm_id := resolve_user_firm_id(NEW.user_id);
    NEW.firm_id := v_firm_id;
  ELSIF NEW.source_lead_id IS NOT NULL THEN
    SELECT firm_id INTO v_firm_id FROM inbound_leads WHERE id = NEW.source_lead_id;
    NEW.firm_id := v_firm_id;
  ELSIF NEW.lead_company IS NOT NULL OR NEW.lead_email IS NOT NULL THEN
    -- Extract domain
    IF NEW.lead_email IS NOT NULL THEN
      v_email_domain := extract_domain(NEW.lead_email);
    END IF;
    IF NEW.lead_company IS NOT NULL THEN
      v_normalized_company := normalize_company_name(NEW.lead_company);
    END IF;

    -- PRIORITY 1: Domain match (non-generic only)
    IF v_email_domain IS NOT NULL AND v_email_domain <> '' AND v_email_domain <> ALL(v_generic_domains) THEN
      SELECT id INTO v_firm_id FROM firm_agreements
      WHERE email_domain = v_email_domain
      LIMIT 1;
    END IF;

    -- PRIORITY 2: Normalized company name match (only if domain didn't match)
    IF v_firm_id IS NULL AND v_normalized_company IS NOT NULL AND v_normalized_company <> '' THEN
      SELECT id INTO v_firm_id FROM firm_agreements
      WHERE normalized_company_name = v_normalized_company
      LIMIT 1;
    END IF;

    -- PRIORITY 3: Create new firm if no match found
    IF v_firm_id IS NULL AND (v_normalized_company IS NOT NULL OR v_email_domain IS NOT NULL) THEN
      INSERT INTO firm_agreements (
        primary_company_name, normalized_company_name, email_domain,
        member_count, created_at, updated_at
      ) VALUES (
        COALESCE(NEW.lead_company, v_email_domain),
        COALESCE(v_normalized_company, v_email_domain),
        CASE WHEN v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains) THEN v_email_domain ELSE NULL END,
        0, NOW(), NOW()
      )
      RETURNING id INTO v_firm_id;
    END IF;

    NEW.firm_id := v_firm_id;
  END IF;

  -- Inherit agreement status from firm
  IF NEW.firm_id IS NOT NULL THEN
    SELECT * INTO v_firm_record FROM firm_agreements WHERE id = NEW.firm_id;
    IF v_firm_record.fee_agreement_signed AND NOT COALESCE(NEW.lead_fee_agreement_signed, FALSE) THEN
      NEW.lead_fee_agreement_signed := TRUE;
      NEW.lead_fee_agreement_signed_at := v_firm_record.fee_agreement_signed_at;
    END IF;
    IF v_firm_record.nda_signed AND NOT COALESCE(NEW.lead_nda_signed, FALSE) THEN
      NEW.lead_nda_signed := TRUE;
      NEW.lead_nda_signed_at := v_firm_record.nda_signed_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
