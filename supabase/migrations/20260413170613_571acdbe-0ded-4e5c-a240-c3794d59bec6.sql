
-- Reset connection_requests tracking fields for Adam Haile
UPDATE public.connection_requests
SET
  lead_agreement_email_sent_at = NULL,
  lead_agreement_email_status = NULL,
  lead_agreement_sender_email = NULL,
  lead_agreement_outbound_id = NULL,
  lead_fee_agreement_email_sent = NULL,
  lead_fee_agreement_email_sent_at = NULL,
  lead_nda_email_sent = NULL,
  lead_nda_email_sent_at = NULL
WHERE id = '34227836-e1b3-455a-a11b-f9a05773a0b6';

-- Delete email_events for the outbound email
DELETE FROM public.email_events
WHERE outbound_email_id = '9e406e27-1f80-400b-955c-a497a56d0ce0';

-- Delete the outbound_emails record
DELETE FROM public.outbound_emails
WHERE id = '9e406e27-1f80-400b-955c-a497a56d0ce0';

-- Delete document_requests linked to the CR
DELETE FROM public.document_requests
WHERE user_id = '34227836-e1b3-455a-a11b-f9a05773a0b6';

-- Reset firm_agreements for the firm
UPDATE public.firm_agreements
SET
  fee_agreement_status = 'not_started',
  nda_status = 'not_started',
  fee_agreement_sent_at = NULL,
  nda_sent_at = NULL,
  fee_agreement_signed_at = NULL,
  nda_signed_at = NULL,
  fee_agreement_email_sent_at = NULL,
  nda_email_sent_at = NULL,
  updated_at = now()
WHERE id = '05bc6e43-bfa6-423c-abdf-b0083e35e302';
