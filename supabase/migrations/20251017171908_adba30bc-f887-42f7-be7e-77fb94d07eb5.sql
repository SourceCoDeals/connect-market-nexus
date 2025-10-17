-- Fix Issue #1: Sync firm status from existing user signatures
-- This migration inherits fee agreement and NDA status from users who have already signed

-- Update firms where ANY member has signed the fee agreement
UPDATE firm_agreements fa
SET 
  fee_agreement_signed = true,
  fee_agreement_signed_at = fm.earliest_signed_at,
  fee_agreement_signed_by = fm.first_signer,
  fee_agreement_signed_by_name = fm.signer_name
FROM (
  SELECT 
    fm.firm_id,
    MIN(p.fee_agreement_signed_at) as earliest_signed_at,
    (ARRAY_AGG(p.id ORDER BY p.fee_agreement_signed_at))[1] as first_signer,
    (ARRAY_AGG(p.first_name || ' ' || p.last_name ORDER BY p.fee_agreement_signed_at))[1] as signer_name
  FROM firm_members fm
  JOIN profiles p ON fm.user_id = p.id
  WHERE p.fee_agreement_signed = true
  GROUP BY fm.firm_id
) fm
WHERE fa.id = fm.firm_id
  AND fa.fee_agreement_signed = false;

-- Update firms where ANY member has signed the NDA
UPDATE firm_agreements fa
SET 
  nda_signed = true,
  nda_signed_at = fm.earliest_signed_at,
  nda_signed_by = fm.first_signer,
  nda_signed_by_name = fm.signer_name
FROM (
  SELECT 
    fm.firm_id,
    MIN(p.nda_signed_at) as earliest_signed_at,
    (ARRAY_AGG(p.id ORDER BY p.nda_signed_at))[1] as first_signer,
    (ARRAY_AGG(p.first_name || ' ' || p.last_name ORDER BY p.nda_signed_at))[1] as signer_name
  FROM firm_members fm
  JOIN profiles p ON fm.user_id = p.id
  WHERE p.nda_signed = true
  GROUP BY fm.firm_id
) fm
WHERE fa.id = fm.firm_id
  AND fa.nda_signed = false;

-- Update firms where ANY member has been sent the fee agreement email
UPDATE firm_agreements fa
SET 
  fee_agreement_email_sent = true,
  fee_agreement_email_sent_at = fm.earliest_sent_at
FROM (
  SELECT 
    fm.firm_id,
    MIN(p.fee_agreement_email_sent_at) as earliest_sent_at
  FROM firm_members fm
  JOIN profiles p ON fm.user_id = p.id
  WHERE p.fee_agreement_email_sent = true
  GROUP BY fm.firm_id
) fm
WHERE fa.id = fm.firm_id
  AND fa.fee_agreement_email_sent = false;

-- Update firms where ANY member has been sent the NDA email
UPDATE firm_agreements fa
SET 
  nda_email_sent = true,
  nda_email_sent_at = fm.earliest_sent_at
FROM (
  SELECT 
    fm.firm_id,
    MIN(p.nda_email_sent_at) as earliest_sent_at
  FROM firm_members fm
  JOIN profiles p ON fm.user_id = p.id
  WHERE p.nda_email_sent = true
  GROUP BY fm.firm_id
) fm
WHERE fa.id = fm.firm_id
  AND fa.nda_email_sent = false;