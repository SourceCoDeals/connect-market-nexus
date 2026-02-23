CREATE OR REPLACE FUNCTION public.reset_firm_agreement_data(p_firm_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Disable audit triggers
  ALTER TABLE firm_agreements DISABLE TRIGGER trg_log_agreement_status_change;
  ALTER TABLE firm_agreements DISABLE TRIGGER trg_sync_agreement_status_from_booleans;
  ALTER TABLE firm_agreements DISABLE TRIGGER trg_sync_fee_agreement_to_remarketing;

  -- Reset all agreement fields
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
  WHERE id = p_firm_id;

  -- Re-enable triggers
  ALTER TABLE firm_agreements ENABLE TRIGGER trg_log_agreement_status_change;
  ALTER TABLE firm_agreements ENABLE TRIGGER trg_sync_agreement_status_from_booleans;
  ALTER TABLE firm_agreements ENABLE TRIGGER trg_sync_fee_agreement_to_remarketing;
END;
$$;
