-- Disable user triggers on firm_agreements
ALTER TABLE firm_agreements DISABLE TRIGGER trg_log_agreement_status_change;
ALTER TABLE firm_agreements DISABLE TRIGGER trg_sync_agreement_status_from_booleans;
ALTER TABLE firm_agreements DISABLE TRIGGER trg_sync_fee_agreement_to_remarketing;

-- 1. Reset firm_agreements
UPDATE firm_agreements SET 
  nda_signed = false, nda_signed_at = NULL, nda_signed_by = NULL, nda_signed_by_name = NULL,
  nda_docuseal_status = NULL, nda_docuseal_submission_id = NULL, nda_signed_document_url = NULL,
  nda_email_sent = false, nda_email_sent_at = NULL, nda_email_sent_by = NULL, nda_sent_at = NULL,
  nda_status = NULL, nda_source = NULL, nda_document_url = NULL, nda_redline_notes = NULL,
  fee_agreement_signed = false, fee_agreement_signed_at = NULL, fee_agreement_signed_by = NULL, fee_agreement_signed_by_name = NULL,
  fee_docuseal_status = NULL, fee_docuseal_submission_id = NULL, fee_signed_document_url = NULL,
  fee_agreement_email_sent = false, fee_agreement_email_sent_at = NULL, fee_agreement_email_sent_by = NULL, fee_agreement_sent_at = NULL,
  fee_agreement_status = NULL, fee_agreement_source = NULL, fee_agreement_document_url = NULL, fee_agreement_redline_notes = NULL,
  updated_at = now()
WHERE id = '2bb41bf7-f962-4234-84ca-1e0e8300e9f6';

-- Re-enable triggers
ALTER TABLE firm_agreements ENABLE TRIGGER trg_log_agreement_status_change;
ALTER TABLE firm_agreements ENABLE TRIGGER trg_sync_agreement_status_from_booleans;
ALTER TABLE firm_agreements ENABLE TRIGGER trg_sync_fee_agreement_to_remarketing;

-- 2. Reset profiles
UPDATE profiles SET nda_signed = false, fee_agreement_signed = false WHERE id = 'ec0eb69b-7fda-4ee3-be9d-ef7684dbf3e4';

-- 3. Reset connection_requests
UPDATE connection_requests SET 
  lead_nda_signed = false, lead_nda_signed_at = NULL, lead_nda_signed_by = NULL,
  lead_nda_email_sent = false, lead_nda_email_sent_at = NULL, lead_nda_email_sent_by = NULL,
  lead_fee_agreement_signed = false, lead_fee_agreement_signed_at = NULL, lead_fee_agreement_signed_by = NULL,
  lead_fee_agreement_email_sent = false, lead_fee_agreement_email_sent_at = NULL, lead_fee_agreement_email_sent_by = NULL
WHERE user_id = 'ec0eb69b-7fda-4ee3-be9d-ef7684dbf3e4';

-- 4. Delete audit log
DELETE FROM agreement_audit_log WHERE firm_id = '2bb41bf7-f962-4234-84ca-1e0e8300e9f6';

-- 5. Delete system messages
DELETE FROM connection_messages 
WHERE connection_request_id IN (SELECT id FROM connection_requests WHERE user_id = 'ec0eb69b-7fda-4ee3-be9d-ef7684dbf3e4')
AND message_type = 'system';

-- 6. Delete notifications
DELETE FROM admin_notifications 
WHERE user_id = 'ec0eb69b-7fda-4ee3-be9d-ef7684dbf3e4'
AND (notification_type ILIKE '%agreement%' OR title ILIKE '%NDA%' OR title ILIKE '%Fee%');
