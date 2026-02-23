-- Reset NDA and Fee Agreement for tommughan@gmail.com to allow re-testing

-- Reset profile flags
UPDATE profiles 
SET nda_signed = false, fee_agreement_signed = false 
WHERE id = 'ec0eb69b-7fda-4ee3-be9d-ef7684dbf3e4';

-- Reset firm agreement statuses (using valid enum values)
UPDATE firm_agreements 
SET nda_status = 'not_started', 
    fee_agreement_status = 'not_started', 
    nda_signed_at = NULL, 
    fee_agreement_signed_at = NULL
WHERE id = '2bb41bf7-f962-4234-84ca-1e0e8300e9f6';

-- Reset connection request agreement flags
UPDATE connection_requests 
SET lead_nda_signed = false, 
    lead_nda_signed_at = NULL, 
    lead_nda_email_sent = false, 
    lead_nda_email_sent_at = NULL, 
    lead_fee_agreement_signed = false, 
    lead_fee_agreement_signed_at = NULL, 
    lead_fee_agreement_email_sent = false, 
    lead_fee_agreement_email_sent_at = NULL 
WHERE lead_email = 'tommughan@gmail.com';