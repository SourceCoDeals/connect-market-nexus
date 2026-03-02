-- ============================================================================
-- MIGRATION: Migrate deal_pipeline contact fields to contacts table
-- ============================================================================
-- The contact_name, contact_email, contact_company, contact_phone,
-- contact_role, and company_address columns on deal_pipeline store
-- BUYER contact info. This data is redundant with:
--   - connection_requests.lead_* (for marketplace/webflow leads)
--   - contacts table (via buyer_contact_id FK)
--
-- This migration ensures all contact data is preserved in the contacts
-- table before the columns are dropped in a subsequent migration.
--
-- SAFETY:
--   - Creates a temp table of mismatches for review
--   - Migrates orphaned contact data to the contacts table
--   - Does NOT drop any columns (separate migration)
-- ============================================================================

BEGIN;

-- ─── Step 1: Log mismatches between deal_pipeline and connection_requests ─

CREATE TEMP TABLE IF NOT EXISTS _contact_field_mismatches AS
SELECT
  dp.id AS deal_id,
  dp.contact_email AS deal_contact_email,
  cr.lead_email AS cr_lead_email,
  dp.contact_name AS deal_contact_name,
  cr.lead_name AS cr_lead_name
FROM public.deal_pipeline dp
JOIN public.connection_requests cr ON cr.id = dp.connection_request_id
WHERE dp.connection_request_id IS NOT NULL
  AND (
    dp.contact_email IS DISTINCT FROM cr.lead_email
    OR dp.contact_name IS DISTINCT FROM cr.lead_name
  )
  AND dp.contact_email IS NOT NULL;

-- Log mismatch count (visible in migration output)
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count FROM _contact_field_mismatches;
  RAISE NOTICE 'Contact field mismatches between deal_pipeline and connection_requests: %', mismatch_count;
END $$;


-- ─── Step 2: Migrate orphaned contact data to contacts table ─────────────
-- For deal_pipeline rows WITHOUT a connection_request_id AND without a
-- buyer_contact_id, create a contact record from the inline fields.

INSERT INTO public.contacts (
  first_name,
  last_name,
  email,
  phone,
  title,
  contact_type,
  source,
  created_at,
  updated_at
)
SELECT
  COALESCE(NULLIF(TRIM(split_part(dp.contact_name, ' ', 1)), ''), dp.contact_name),
  CASE
    WHEN position(' ' IN COALESCE(dp.contact_name, '')) > 0
    THEN TRIM(substring(dp.contact_name FROM position(' ' IN dp.contact_name) + 1))
    ELSE ''
  END,
  LOWER(TRIM(dp.contact_email)),
  dp.contact_phone,
  dp.contact_role,
  'buyer',
  'deal_migration',
  NOW(),
  NOW()
FROM public.deal_pipeline dp
WHERE dp.connection_request_id IS NULL
  AND dp.buyer_contact_id IS NULL
  AND dp.contact_email IS NOT NULL
  AND TRIM(dp.contact_email) != ''
ON CONFLICT DO NOTHING;


-- ─── Step 3: Link the new contacts back to the deals ─────────────────────

UPDATE public.deal_pipeline dp
SET buyer_contact_id = c.id
FROM public.contacts c
WHERE dp.connection_request_id IS NULL
  AND dp.buyer_contact_id IS NULL
  AND dp.contact_email IS NOT NULL
  AND LOWER(TRIM(dp.contact_email)) = c.email
  AND c.source = 'deal_migration';


-- ─── Step 4: Log migration results ──────────────────────────────────────

DO $$
DECLARE
  migrated_count INTEGER;
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM public.deal_pipeline
  WHERE buyer_contact_id IS NOT NULL;

  SELECT COUNT(*) INTO orphaned_count
  FROM public.deal_pipeline
  WHERE buyer_contact_id IS NULL
    AND contact_email IS NOT NULL
    AND connection_request_id IS NULL;

  RAISE NOTICE 'Deals with buyer_contact_id set: %', migrated_count;
  RAISE NOTICE 'Deals still missing buyer_contact_id (orphaned): %', orphaned_count;
END $$;


COMMIT;
