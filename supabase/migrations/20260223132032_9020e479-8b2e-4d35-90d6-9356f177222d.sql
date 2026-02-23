
-- Sync profiles to match firm_agreements signed status
-- This fixes the historical desync where firm_agreements says signed but profiles doesn't
UPDATE profiles p
SET 
  nda_signed = fa.nda_signed,
  nda_signed_at = COALESCE(p.nda_signed_at, fa.nda_signed_at),
  fee_agreement_signed = fa.fee_agreement_signed,
  fee_agreement_signed_at = COALESCE(p.fee_agreement_signed_at, fa.fee_agreement_signed_at),
  updated_at = now()
FROM firm_members fm
JOIN firm_agreements fa ON fa.id = fm.firm_id
WHERE fm.user_id = p.id
  AND (
    p.nda_signed IS DISTINCT FROM fa.nda_signed
    OR p.fee_agreement_signed IS DISTINCT FROM fa.fee_agreement_signed
  );
