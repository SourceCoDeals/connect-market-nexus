
-- Reset firm_agreements for tommughan@gmail.com firm
UPDATE firm_agreements
SET nda_signed = false, nda_signed_at = NULL, nda_signed_by = NULL, nda_signed_by_name = NULL,
    nda_docuseal_submission_id = NULL, nda_docuseal_status = 'not_sent', nda_signed_document_url = NULL,
    nda_status = 'not_started', nda_source = NULL, nda_sent_at = NULL,
    fee_agreement_signed = false, fee_agreement_signed_at = NULL, fee_agreement_signed_by = NULL, fee_agreement_signed_by_name = NULL,
    fee_docuseal_submission_id = NULL, fee_docuseal_status = 'not_sent', fee_signed_document_url = NULL,
    fee_agreement_status = 'not_started', fee_agreement_source = NULL, fee_agreement_sent_at = NULL,
    updated_at = now()
WHERE id = '2bb41bf7-f962-4234-84ca-1e0e8300e9f6';

-- Reset profile nda_signed
UPDATE profiles
SET nda_signed = false, nda_signed_at = NULL
WHERE id = 'ec0eb69b-7fda-4ee3-be9d-ef7684dbf3e4';

-- Clear agreement audit log for this firm
DELETE FROM agreement_audit_log
WHERE firm_id = '2bb41bf7-f962-4234-84ca-1e0e8300e9f6';

-- Clear related user notifications
DELETE FROM user_notifications
WHERE user_id = 'ec0eb69b-7fda-4ee3-be9d-ef7684dbf3e4'
  AND notification_type IN ('agreement_signed', 'agreement_pending');
