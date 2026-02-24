-- ============================================================================
-- Fix deal_activities activity_type CHECK constraint
-- ============================================================================
-- The AI Command Center tools (add_deal_note, log_deal_activity) were sending
-- short-form values ("note", "call", "email", "meeting", "outreach", "scoring")
-- that do not match the constraint's expected verbose forms.
--
-- This migration:
--   1. Expands the CHECK constraint to include "outreach" and "scoring"
--      (no verbose equivalent exists for these two)
--   2. The code fix (action-tools.ts) maps the remaining four short-forms
--      to their existing verbose equivalents at the application layer:
--        note      → note_added
--        call      → call_logged
--        email     → email_sent
--        meeting   → meeting_scheduled
-- ============================================================================

ALTER TABLE public.deal_activities
  DROP CONSTRAINT IF EXISTS deal_activities_activity_type_check;

ALTER TABLE public.deal_activities
  ADD CONSTRAINT deal_activities_activity_type_check
  CHECK (activity_type IN (
    -- Core pipeline events
    'stage_change',
    -- Task lifecycle
    'task_created',
    'task_completed',
    'task_updated',
    'task_deleted',
    'task_assigned',
    'task_reassigned',
    -- Notes & communication
    'note_added',
    'document_uploaded',
    'email_sent',
    'call_logged',
    'call_made',
    'meeting_scheduled',
    -- Deal lifecycle
    'deal_created',
    'deal_updated',
    'deal_deleted',
    'deal_restored',
    -- Agreement events
    'nda_status_changed',
    'fee_agreement_status_changed',
    'nda_email_sent',
    'fee_agreement_email_sent',
    -- Misc pipeline events
    'assignment_changed',
    'follow_up',
    'contacts_added',
    'status_change',
    'data_room',
    -- AI Command Center — outreach & scoring events (no verbose equivalent)
    'outreach',
    'scoring'
  ));

-- ============================================================================
-- Summary
-- ============================================================================
-- 2 new activity types added to CHECK constraint: outreach, scoring
-- 4 short-form values (note, call, email, meeting) are normalized in code,
--   not added to the constraint, to maintain consistent naming convention.
-- ============================================================================
