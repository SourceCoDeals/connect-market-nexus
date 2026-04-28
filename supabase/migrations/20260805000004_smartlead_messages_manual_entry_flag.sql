-- =============================================================================
-- smartlead_messages: manual_entry flag (parity with email_messages + heyreach_messages)
-- =============================================================================
-- Audit finding UC #18 fix: when a user manually links an unmatched Smartlead
-- record to a deal on /admin/unmatched-activities, the linker should insert
-- into the canonical `smartlead_messages` table (in addition to writing a
-- `deal_activities` log) so the row flows through `unified_contact_timeline`
-- and reaches buyer-/firm-scoped views.
--
-- Symmetric with `email_messages.manual_entry` and `heyreach_messages.manual_entry`
-- added by 20260805000002.
--
-- Manual rows may carry NULL provider IDs because the linker may not always
-- have them (the unmatched row sometimes loses the `smartlead_message_id`
-- if the original payload was malformed). The CHECK enforces:
--   - sync rows must have smartlead_message_id and smartlead_campaign_id
--   - manual rows may have either or both NULL
-- =============================================================================

ALTER TABLE public.smartlead_messages
  ADD COLUMN IF NOT EXISTS manual_entry BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.smartlead_messages
  ALTER COLUMN smartlead_message_id DROP NOT NULL;

ALTER TABLE public.smartlead_messages
  ALTER COLUMN smartlead_campaign_id DROP NOT NULL;

ALTER TABLE public.smartlead_messages
  DROP CONSTRAINT IF EXISTS smartlead_messages_manual_entry_check;

ALTER TABLE public.smartlead_messages
  ADD CONSTRAINT smartlead_messages_manual_entry_check
  CHECK (
    manual_entry = true
    OR (smartlead_message_id IS NOT NULL AND smartlead_campaign_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_smartlead_messages_manual
  ON public.smartlead_messages (manual_entry, sent_at DESC)
  WHERE manual_entry = true;

COMMENT ON COLUMN public.smartlead_messages.manual_entry IS
  'True if this row was inserted by the manual unmatched-recovery path on /admin/unmatched-activities rather than the Smartlead sync pipeline. Manual rows may have smartlead_message_id and smartlead_campaign_id NULL; synced rows always have both set.';
