-- =============================================================================
-- Manual-entry flag on email_messages and heyreach_messages
-- =============================================================================
-- The new LogManualTouchDialog (Phase 4 of the deal-activity-tracker rebuild)
-- can record an Email or LinkedIn message that wasn't captured by the
-- automated sync pipelines. To distinguish those rows from sync-captured rows
-- (and to relax provider-side constraints that don't apply to manual data),
-- add a `manual_entry` boolean and weaken the integration-id NOT NULL
-- constraints behind a CHECK that only manual entries can carry NULLs.
--
-- ── Drift-aware rewrite (2026-04-27) ─────────────────────────────────────────
-- Verified against 20260427000000_remote_schema_snapshot_2026-04-27.sql:
--   - email_messages.microsoft_message_id is still NOT NULL on live → kept the
--     ALTER ... DROP NOT NULL.
--   - heyreach_messages.heyreach_message_id is ALREADY NULLABLE on live (one
--     of the 172 out-of-band remote migrations relaxed it) → DROPPED the
--     redundant ALTER from this migration.
--   - heyreach_messages.heyreach_campaign_id is still NOT NULL on live → kept
--     the ALTER ... DROP NOT NULL.
--
-- Behavior preserved for sync-captured rows:
--   - Existing INSERT paths from the sync pipelines populate every NOT-NULL-
--     before column. The new CHECK only relaxes when manual_entry = true.
--
-- New behavior unlocked for manual rows:
--   - email_messages may have microsoft_message_id NULL.
--   - heyreach_messages may have heyreach_campaign_id NULL.
-- =============================================================================

-- ── email_messages ─────────────────────────────────────────────────────────

ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS manual_entry BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.email_messages
  ALTER COLUMN microsoft_message_id DROP NOT NULL;

ALTER TABLE public.email_messages
  DROP CONSTRAINT IF EXISTS email_messages_manual_entry_id_check;

ALTER TABLE public.email_messages
  ADD CONSTRAINT email_messages_manual_entry_id_check
  CHECK (
    manual_entry = true
    OR microsoft_message_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_email_messages_manual
  ON public.email_messages (manual_entry, sent_at DESC)
  WHERE manual_entry = true;

COMMENT ON COLUMN public.email_messages.manual_entry IS
  'True if this row was inserted by the LogManualTouchDialog rather than the Outlook sync pipeline. Manual rows may have microsoft_message_id NULL; synced rows always have it set.';

-- ── heyreach_messages ──────────────────────────────────────────────────────
-- NOTE: ALTER ... DROP NOT NULL on heyreach_message_id is intentionally
-- omitted — verified already nullable on live (2026-04-27 snapshot).

ALTER TABLE public.heyreach_messages
  ADD COLUMN IF NOT EXISTS manual_entry BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.heyreach_messages
  ALTER COLUMN heyreach_campaign_id DROP NOT NULL;

ALTER TABLE public.heyreach_messages
  DROP CONSTRAINT IF EXISTS heyreach_messages_manual_entry_check;

ALTER TABLE public.heyreach_messages
  ADD CONSTRAINT heyreach_messages_manual_entry_check
  CHECK (
    manual_entry = true
    OR (heyreach_message_id IS NOT NULL AND heyreach_campaign_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_heyreach_messages_manual
  ON public.heyreach_messages (manual_entry, sent_at DESC)
  WHERE manual_entry = true;

COMMENT ON COLUMN public.heyreach_messages.manual_entry IS
  'True if this row was inserted by the LogManualTouchDialog rather than the HeyReach sync pipeline. Manual rows may have heyreach_message_id and heyreach_campaign_id NULL; synced rows always have both set.';
