-- ============================================================================
-- MIGRATION: Backfill for 20260625000005_create_contact_events
-- ============================================================================
-- Like 20260625000004, the original 20260625000005 was marked applied in
-- supabase_migrations.schema_migrations on prod without its SQL ever
-- running. The contact_events table never existed.
--
-- `contacts_upsert` (shipped by 20260729000000) inserts into
-- public.contact_events on every contact write — in other words, without
-- this table in place every contact upsert would fail at runtime with
-- "relation contact_events does not exist". Caught during the 2026-04-20
-- sync's post-push audit. This migration recreates the table + indexes +
-- RLS policies exactly as the original specified.
--
-- SKIPPED vs the original: the enriched_contacts backfill in section 4 of
-- the original migration (historical rows into contact_events). That
-- section had a broken FROM-clause reference and is also pre-empted by
-- later contact consolidation work — tracked as a follow-up.
-- ============================================================================


-- ─── 1. Create contact_events ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which contact this event belongs to. NULL allowed only during backfill
  -- for enriched_contacts rows that never resolved to a canonical contact.
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,

  -- Event classification
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'enrichment',
      'create',
      'update',
      'merge',
      'unmerge',
      'soft_delete',
      'restore',
      'verify_email',
      'bounce'
    )),

  -- Provenance
  provider TEXT,
  confidence TEXT CHECK (confidence IN ('verified', 'likely', 'guessed', 'unverified')),
  source_query TEXT,

  -- Payload
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],

  -- Actor
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Request context (optional)
  request_id TEXT,
  ip_address INET,
  user_agent TEXT
);


-- ─── 2. Indexes ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_contact_events_contact_id
  ON public.contact_events(contact_id, performed_at DESC)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_events_type_time
  ON public.contact_events(event_type, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_events_provider
  ON public.contact_events(provider, performed_at DESC)
  WHERE provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_events_enrichment_cache
  ON public.contact_events(contact_id, performed_at DESC)
  WHERE event_type = 'enrichment';


-- ─── 3. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.contact_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_events_admin_read" ON public.contact_events;
CREATE POLICY "contact_events_admin_read" ON public.contact_events
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "contact_events_service_write" ON public.contact_events;
CREATE POLICY "contact_events_service_write" ON public.contact_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
