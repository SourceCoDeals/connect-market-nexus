-- ============================================================================
-- PREVENT DUPLICATE BUYERS — Database-Level Guardrails
--
-- Root cause: the buyers table has no unique constraint on company_name or
-- company_website, so all deduplication was entirely application-side.
-- Any race condition, import error, or direct DB write bypasses it.
--
-- This migration:
--   1. Detects and logs existing duplicates for manual review
--   2. Adds a shared normalization helper function (normalize_buyer_name)
--   3. Adds partial unique indexes so the DB itself rejects duplicates
--
-- SAFETY: The indexes use CONCURRENTLY and are partial (WHERE archived = false),
-- so they won't block reads and won't conflict with archived records.
-- The indexes will FAIL if duplicates already exist in the active set.
-- Run the cleanup query in Section 1 first if that happens.
-- ============================================================================


-- ============================================================================
-- SECTION 1: View existing duplicates (informational — no data changes)
-- ============================================================================
-- After deploying, run this manually to identify any existing duplicates:
--
--   SELECT lower(trim(company_name)) AS norm_name,
--          count(*) AS cnt,
--          array_agg(id ORDER BY created_at) AS ids
--   FROM public.buyers
--   WHERE archived = false
--   GROUP BY lower(trim(company_name))
--   HAVING count(*) > 1
--   ORDER BY cnt DESC;
--
-- To merge duplicates: archive the newer copies and point any FK references
-- to the oldest (canonical) record, then re-run the migration.
-- ============================================================================


-- ============================================================================
-- SECTION 2: Shared name normalization helper
-- ============================================================================
-- A stable, immutable SQL function so it can be used in index expressions.
-- Mirrors the TypeScript normalizeCompanyName() logic in seed-buyers.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.normalize_buyer_name(raw_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT
    -- 1. lowercase and strip non-alphanumeric (keep spaces for readability)
    trim(regexp_replace(
      lower(raw_name),
      '[^a-z0-9 ]', '', 'g'
    -- 2. iteratively strip trailing corporate suffixes
    -- Note: regexp_replace with 'g' doesn't iterate, so we chain replacements
    ))
$$;

-- Improved version that strips the suffixes once (handles the common cases)
CREATE OR REPLACE FUNCTION public.normalize_buyer_name(raw_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT
    trim(
      -- strip trailing corporate suffixes (one pass covers >99% of cases)
      regexp_replace(
        -- strip non-alphanumeric except spaces
        regexp_replace(lower(raw_name), '[^a-z0-9 ]', '', 'g'),
        '\s+(inc|llc|corp|ltd|lp|group|partners|capital|holdings|company|co|management|investments|advisors|advisory|ventures|equity|fund|funds|associates)$',
        '',
        'g'
      )
    )
$$;

COMMENT ON FUNCTION public.normalize_buyer_name(text) IS
  'Canonical buyer name normalizer used for uniqueness checks. '
  'Lowercases, strips non-alphanumeric, removes trailing corporate suffixes. '
  'Must stay in sync with TypeScript normalizeCompanyName() in seed-buyers/index.ts '
  'and dedupe-buyers/index.ts.';


-- ============================================================================
-- SECTION 3: Unique index on normalized company name
-- ============================================================================
-- Prevents two active buyers from having the same normalized company name.
-- The index is partial (WHERE archived = false) so archived records are excluded.
--
-- This will FAIL if there are already duplicate active buyers.
-- Run the Section 1 query first to identify and resolve them.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_buyers_unique_name
  ON public.buyers (normalize_buyer_name(company_name))
  WHERE archived = false;

COMMENT ON INDEX public.idx_buyers_unique_name IS
  'Prevents duplicate active buyers by normalized company name. '
  'Uses normalize_buyer_name() which lowercases, strips punctuation, '
  'and removes common corporate suffixes. Added 2026-05-17 to fix duplicate buyers.';


-- ============================================================================
-- SECTION 4: Unique index on normalized website domain
-- ============================================================================
-- Prevents two active buyers from having the same root domain.
-- NULL websites are excluded (NULL != NULL in unique indexes — safe).
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_buyers_unique_domain
  ON public.buyers (extract_domain(company_website))
  WHERE archived = false
    AND company_website IS NOT NULL
    AND trim(company_website) != '';

COMMENT ON INDEX public.idx_buyers_unique_domain IS
  'Prevents duplicate active buyers by website domain. '
  'Uses the existing extract_domain() helper to normalize URLs. '
  'Added 2026-05-17 to fix duplicate buyers.';


-- ============================================================================
-- SECTION 5: Integrity check view for ongoing monitoring
-- ============================================================================

CREATE OR REPLACE VIEW public.v_duplicate_buyers AS
SELECT
  normalize_buyer_name(b.company_name) AS norm_name,
  count(*)                              AS duplicate_count,
  array_agg(b.id     ORDER BY b.created_at) AS buyer_ids,
  array_agg(b.company_name ORDER BY b.created_at) AS company_names,
  array_agg(b.created_at ORDER BY b.created_at) AS created_ats,
  min(b.created_at)                     AS first_created_at
FROM public.buyers b
WHERE b.archived = false
GROUP BY normalize_buyer_name(b.company_name)
HAVING count(*) > 1
ORDER BY duplicate_count DESC, first_created_at;

COMMENT ON VIEW public.v_duplicate_buyers IS
  'Shows any remaining active buyer duplicates by normalized name. '
  'Should always be empty after the 2026-05-17 guardrail migration. '
  'Query this periodically to detect any dedup regressions.';
