
DO $$
DECLARE
  rec RECORD;
  v_domain TEXT;
  v_firm_id UUID;
  v_generic_domains TEXT[] := ARRAY['gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com','protonmail.com','mail.com','yandex.com','zoho.com','live.com','msn.com','me.com','comcast.net','att.net','verizon.net','sbcglobal.net','cox.net','charter.net'];
BEGIN
  FOR rec IN
    SELECT DISTINCT ON (recipient_email)
      recipient_email,
      recipient_name,
      template_name,
      created_at
    FROM outbound_emails
    WHERE template_name IN ('agreement_nda', 'agreement_fee_agreement', 'lead_agreement_combined')
      AND recipient_email IS NOT NULL
      AND created_at > now() - interval '30 days'
      AND recipient_email != 'dedup-test-delete@example.com'
    ORDER BY recipient_email, created_at DESC
  LOOP
    -- Skip if already has a connection_requests row
    IF EXISTS (SELECT 1 FROM connection_requests WHERE lead_email = rec.recipient_email) THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM connection_requests cr
      JOIN profiles p ON p.id = cr.user_id
      WHERE p.email = rec.recipient_email
    ) THEN
      CONTINUE;
    END IF;

    -- Resolve firm_id from email domain
    v_domain := split_part(rec.recipient_email, '@', 2);
    v_firm_id := NULL;

    IF v_domain IS NOT NULL AND v_domain != '' AND NOT (v_domain = ANY(v_generic_domains)) THEN
      SELECT id INTO v_firm_id
      FROM firm_agreements
      WHERE email_domain = v_domain
      LIMIT 1;
    END IF;

    BEGIN
      INSERT INTO connection_requests (
        id, listing_id, status, source,
        lead_email, lead_name, firm_id,
        lead_nda_email_sent, lead_nda_email_sent_at,
        lead_fee_agreement_email_sent, lead_fee_agreement_email_sent_at,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        NULL,
        'pending',
        'email',
        rec.recipient_email,
        rec.recipient_name,
        v_firm_id,
        CASE WHEN rec.template_name IN ('agreement_nda', 'lead_agreement_combined') THEN true ELSE false END,
        CASE WHEN rec.template_name IN ('agreement_nda', 'lead_agreement_combined') THEN rec.created_at ELSE NULL END,
        CASE WHEN rec.template_name IN ('agreement_fee_agreement', 'lead_agreement_combined') THEN true ELSE false END,
        CASE WHEN rec.template_name IN ('agreement_fee_agreement', 'lead_agreement_combined') THEN rec.created_at ELSE NULL END,
        rec.created_at,
        now()
      );
      RAISE NOTICE 'Created CR for %', rec.recipient_email;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped % due to: %', rec.recipient_email, SQLERRM;
    END;
  END LOOP;
END;
$$;
