-- Update Case 6: Fee signed, NDA not → already_covered (Fee Agreement alone is sufficient)
UPDATE connection_requests
SET lead_agreement_email_status = 'already_covered'
WHERE lead_name = 'Case 6: Fee Signed Only'
  AND lead_agreement_email_status = 'sent';
