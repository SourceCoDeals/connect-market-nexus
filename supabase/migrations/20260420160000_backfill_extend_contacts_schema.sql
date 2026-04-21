-- ============================================================================
-- MIGRATION: Backfill for 20260625000004_extend_contacts_schema
-- ============================================================================
-- The original 20260625000004 migration was marked as applied in
-- supabase_migrations.schema_migrations on prod, but its SQL never actually
-- ran — all eight new columns on public.contacts were missing. Later
-- migrations (20260728..20260729) depended on those columns and failed.
--
-- This migration re-adds the same columns (and their non-unique indexes),
-- idempotently. It deliberately SKIPS:
--   * the unique index idx_contacts_linkedin_url_unique (prod has duplicate
--     linkedin_urls, e.g. rishisharma13 — needs dedupe first)
--   * the contacts_contact_type_check extension to include 'portal_user'
--     (low-impact, defer to a dedicated migration that can also verify no
--     existing rows violate the widened CHECK)
-- Both deferred pieces are tracked as follow-ups after the 2026-04-20 sync.
-- ============================================================================

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS confidence TEXT
    CHECK (confidence IN ('verified', 'likely', 'guessed', 'unverified'))
    DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_enrichment_source TEXT,
  ADD COLUMN IF NOT EXISTS merged_into_id UUID
    REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS role_category TEXT,
  ADD COLUMN IF NOT EXISTS priority_level SMALLINT
    CHECK (priority_level IS NULL OR priority_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_last_enriched_at
  ON public.contacts(last_enriched_at DESC)
  WHERE last_enriched_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_live
  ON public.contacts(contact_type)
  WHERE deleted_at IS NULL AND merged_into_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_merged_into_id
  ON public.contacts(merged_into_id)
  WHERE merged_into_id IS NOT NULL;
