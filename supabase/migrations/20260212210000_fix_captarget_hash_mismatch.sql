-- Fix CapTarget hash mismatch: the hash formula changed across deploys
-- (originally 3 fields → then 7 fields with tabName → now 6 fields without tabName).
-- Existing rows have stale hashes that don't match the current formula.
--
-- This migration:
-- 1. Clears all captarget_row_hash values so the next sync recomputes them
-- 2. Normalizes existing website values for captarget rows to match normalize_domain()
--    so the duplicate-key fallback lookup can find the existing row

-- Step 1: Clear stale hashes — forces the edge function to re-match by website
UPDATE public.listings
SET captarget_row_hash = NULL
WHERE deal_source = 'captarget'
  AND captarget_row_hash IS NOT NULL;

-- Step 2: Normalize website URLs for captarget rows using the same
-- normalize_domain() function the unique index uses
UPDATE public.listings
SET website = normalize_domain(website)
WHERE deal_source = 'captarget'
  AND website IS NOT NULL
  AND website != ''
  AND normalize_domain(website) IS NOT NULL
  AND normalize_domain(website) != website;
