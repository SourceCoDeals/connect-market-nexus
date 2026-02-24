-- ============================================================================
-- Self-heal NDA sync mismatch between firm_agreements and profiles
-- ============================================================================
-- Audit found 2 users where firm_agreements.nda_signed = true but
-- profiles.nda_signed = false (RC Renberg, Bill Tabino).
--
-- Root cause: The cascade in update_agreement_status() syncs profiles only
-- when called via that stored procedure. Direct writes to firm_agreements
-- (e.g. DocuSeal webhook handler) bypass the cascade, leaving profiles stale.
--
-- Fix 1: Backfill — sync any profiles that are currently out of date.
-- Fix 2: Add a DB trigger on firm_agreements so future direct writes also
--        cascade to firm_members → profiles automatically.
-- ============================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- Fix 1: Backfill mismatched profiles
-- -----------------------------------------------------------------------

-- NDA: firm_agreements.nda_signed=true but profiles.nda_signed=false
UPDATE public.profiles p
SET
  nda_signed     = true,
  nda_signed_at  = COALESCE(p.nda_signed_at, fa.nda_signed_at, NOW()),
  updated_at     = NOW()
FROM public.firm_agreements fa
JOIN public.firm_members fm ON fm.firm_id = fa.id
WHERE fm.user_id  = p.id
  AND fa.nda_signed = true
  AND (p.nda_signed IS NULL OR p.nda_signed = false);

-- Fee agreement: firm_agreements.fee_agreement_signed=true but profiles.fee_agreement_signed=false
UPDATE public.profiles p
SET
  fee_agreement_signed    = true,
  fee_agreement_signed_at = COALESCE(p.fee_agreement_signed_at, fa.fee_agreement_signed_at, NOW()),
  updated_at              = NOW()
FROM public.firm_agreements fa
JOIN public.firm_members fm ON fm.firm_id = fa.id
WHERE fm.user_id = p.id
  AND fa.fee_agreement_signed = true
  AND (p.fee_agreement_signed IS NULL OR p.fee_agreement_signed = false);

-- -----------------------------------------------------------------------
-- Fix 2: Add trigger so future direct writes cascade automatically
-- -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_sync_firm_agreement_to_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- NDA signed
  IF NEW.nda_signed = true AND (OLD.nda_signed IS NULL OR OLD.nda_signed = false) THEN
    UPDATE public.profiles p
    SET
      nda_signed    = true,
      nda_signed_at = COALESCE(p.nda_signed_at, NEW.nda_signed_at, NOW()),
      updated_at    = NOW()
    FROM public.firm_members fm
    WHERE fm.firm_id  = NEW.id
      AND fm.user_id  = p.id
      AND (p.nda_signed IS NULL OR p.nda_signed = false);
  END IF;

  -- NDA un-signed
  IF (NEW.nda_signed IS NULL OR NEW.nda_signed = false)
     AND OLD.nda_signed = true THEN
    UPDATE public.profiles p
    SET
      nda_signed    = false,
      nda_signed_at = NULL,
      updated_at    = NOW()
    FROM public.firm_members fm
    WHERE fm.firm_id = NEW.id
      AND fm.user_id = p.id
      AND p.nda_signed = true;
  END IF;

  -- Fee agreement signed
  IF NEW.fee_agreement_signed = true
     AND (OLD.fee_agreement_signed IS NULL OR OLD.fee_agreement_signed = false) THEN
    UPDATE public.profiles p
    SET
      fee_agreement_signed    = true,
      fee_agreement_signed_at = COALESCE(p.fee_agreement_signed_at, NEW.fee_agreement_signed_at, NOW()),
      updated_at              = NOW()
    FROM public.firm_members fm
    WHERE fm.firm_id = NEW.id
      AND fm.user_id = p.id
      AND (p.fee_agreement_signed IS NULL OR p.fee_agreement_signed = false);
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists (idempotent re-run)
DROP TRIGGER IF EXISTS trg_sync_firm_agreement_to_profiles
  ON public.firm_agreements;

CREATE TRIGGER trg_sync_firm_agreement_to_profiles
  AFTER UPDATE OF nda_signed, fee_agreement_signed
  ON public.firm_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_firm_agreement_to_profiles();

COMMIT;

-- ============================================================================
-- Verification query
-- ============================================================================
-- Run after migration — should return 0 rows for each:
--
-- SELECT p.id, p.full_name, p.nda_signed, fa.nda_signed AS fa_nda_signed
-- FROM profiles p
-- JOIN firm_members fm ON fm.user_id = p.id
-- JOIN firm_agreements fa ON fa.id = fm.firm_id
-- WHERE fa.nda_signed = true AND (p.nda_signed IS NULL OR p.nda_signed = false);
--
-- SELECT p.id, p.full_name, p.fee_agreement_signed, fa.fee_agreement_signed AS fa_fee
-- FROM profiles p
-- JOIN firm_members fm ON fm.user_id = p.id
-- JOIN firm_agreements fa ON fa.id = fm.firm_id
-- WHERE fa.fee_agreement_signed = true AND (p.fee_agreement_signed IS NULL OR p.fee_agreement_signed = false);
-- ============================================================================
