
-- Sync profiles to match firm_agreements (source of truth) for desynced users
UPDATE profiles p
SET 
  nda_signed = fa.nda_signed,
  fee_agreement_signed = fa.fee_agreement_signed,
  updated_at = now()
FROM firm_members fm
JOIN firm_agreements fa ON fa.id = fm.firm_id
WHERE fm.user_id = p.id
  AND (
    p.nda_signed IS DISTINCT FROM fa.nda_signed
    OR p.fee_agreement_signed IS DISTINCT FROM fa.fee_agreement_signed
  );
