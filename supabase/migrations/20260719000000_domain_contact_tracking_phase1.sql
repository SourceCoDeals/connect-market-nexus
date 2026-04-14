-- ============================================================================
-- DOMAIN-BASED CONTACT TRACKING — PHASE 1
--
-- Adds email_domain to contacts so we can query all contacts at a firm's
-- domain without parsing email strings at runtime. Auto-populated via
-- trigger that strips out generic/free email providers. Mirrors the
-- existing email_domain columns on firm_agreements and remarketing_buyers.
--
-- Also backfills remarketing_buyers.email_domain for any rows that are
-- currently NULL, using the most common corporate domain across linked
-- contacts. Only fills corporate (non-generic) domains.
--
-- Related:
--   - firm_domain_aliases (20260225000000) — multi-domain firm mapping
--   - generic_email_domains (20260225000000) — consumer/free domain blocklist
--   - src/lib/generic-email-domains.ts — client-side mirror of the blocklist
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Add email_domain column to contacts
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS email_domain TEXT;

-- Partial index: only non-null rows are useful for domain lookups.
CREATE INDEX IF NOT EXISTS idx_contacts_email_domain
  ON public.contacts(email_domain)
  WHERE email_domain IS NOT NULL;

COMMENT ON COLUMN public.contacts.email_domain IS
  'Lowercased domain extracted from email, or NULL if the domain is a generic/free provider (gmail, yahoo, etc.). Auto-populated by set_contact_email_domain trigger. Used for firm-level activity matching via firm_domain_aliases.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Trigger: auto-populate email_domain from email on INSERT/UPDATE
-- ────────────────────────────────────────────────────────────────────────────
--
-- Fires BEFORE INSERT OR UPDATE OF email so the new value is written in the
-- same row operation (no extra UPDATE needed). Looks up the extracted
-- domain in generic_email_domains — if it matches, email_domain is set to
-- NULL so downstream firm-matching queries skip the row cleanly.

CREATE OR REPLACE FUNCTION public.set_contact_email_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_domain TEXT;
BEGIN
  -- Fast path: no email, nothing to do.
  IF NEW.email IS NULL OR NEW.email = '' THEN
    NEW.email_domain := NULL;
    RETURN NEW;
  END IF;

  v_domain := lower(trim(split_part(NEW.email, '@', 2)));

  IF v_domain IS NULL OR v_domain = '' THEN
    NEW.email_domain := NULL;
    RETURN NEW;
  END IF;

  -- Strip generic providers. If the table doesn't exist (extremely early
  -- migration ordering), fall through with the raw domain — the later
  -- cleanup in check_agreement_coverage() handles the missing-table case.
  IF EXISTS (
    SELECT 1 FROM public.generic_email_domains WHERE domain = v_domain
  ) THEN
    NEW.email_domain := NULL;
  ELSE
    NEW.email_domain := v_domain;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_contact_email_domain ON public.contacts;

CREATE TRIGGER trg_set_contact_email_domain
  BEFORE INSERT OR UPDATE OF email ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contact_email_domain();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Backfill contacts.email_domain for existing rows
-- ────────────────────────────────────────────────────────────────────────────
--
-- One-time update. Uses the same generic-domain exclusion the trigger
-- applies going forward. Only touches rows where email_domain is still
-- NULL so reruns are idempotent.

UPDATE public.contacts
SET email_domain = lower(trim(split_part(email, '@', 2)))
WHERE email IS NOT NULL
  AND email <> ''
  AND email_domain IS NULL
  AND lower(trim(split_part(email, '@', 2))) NOT IN (
    SELECT domain FROM public.generic_email_domains
  )
  AND lower(trim(split_part(email, '@', 2))) <> '';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Backfill buyers.email_domain from linked contacts
-- ────────────────────────────────────────────────────────────────────────────
--
-- For any buyer row that still has a NULL email_domain, look up the most
-- common corporate domain across its contacts and use that. Ties broken
-- deterministically (ORDER BY count DESC, domain ASC).
--
-- NOTE: The table was renamed from `remarketing_buyers` → `buyers` in
-- migration 20260514000000. A view `remarketing_buyers` still exists for
-- backward compatibility, but we update the real table directly. The FK
-- column on contacts is still named `remarketing_buyer_id` and was
-- intentionally left alone by that rename migration.
--
-- Exclude already-generic domains by filtering on contacts.email_domain —
-- the trigger above already NULLs those out.

WITH domain_counts AS (
  SELECT
    c.remarketing_buyer_id,
    c.email_domain,
    count(*) AS n
  FROM public.contacts c
  WHERE c.remarketing_buyer_id IS NOT NULL
    AND c.email_domain IS NOT NULL
    AND c.archived = false
  GROUP BY c.remarketing_buyer_id, c.email_domain
),
best_domain AS (
  SELECT DISTINCT ON (remarketing_buyer_id)
    remarketing_buyer_id,
    email_domain
  FROM domain_counts
  ORDER BY remarketing_buyer_id, n DESC, email_domain ASC
)
UPDATE public.buyers b
SET email_domain = bd.email_domain
FROM best_domain bd
WHERE b.id = bd.remarketing_buyer_id
  AND (b.email_domain IS NULL OR b.email_domain = '');
