-- =============================================================================
-- daily_standup_tasks: add metadata jsonb column
-- =============================================================================
-- Audit finding UC #12 fix: when LogManualTouchDialog auto-creates a
-- follow-up task on voicemail / no_answer / callback outcome, repeated
-- voicemails should DEDUPE into the existing task (bump due_date + counter)
-- rather than spawning N parallel tasks. Callback / connected outcomes
-- should SUPERSEDE prior open voicemail-follow-up tasks since the call
-- was successfully connected.
--
-- Both behaviors need a place to record:
--   - voicemail_count   — how many voicemails this task has absorbed
--   - superseded_by_task_id — link from a superseded task to its
--     successor (so audit/UI can show the chain)
--   - superseded_reason — short text marker for why
--
-- Add a free-form jsonb metadata column. Cheap, additive, default empty
-- object so existing rows don't churn.
-- =============================================================================

ALTER TABLE public.daily_standup_tasks
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_daily_standup_tasks_metadata_superseded_by
  ON public.daily_standup_tasks ((metadata->>'superseded_by_task_id'))
  WHERE metadata ? 'superseded_by_task_id';

COMMENT ON COLUMN public.daily_standup_tasks.metadata IS
  'Free-form JSON for auto-task lifecycle tracking. Known keys: voicemail_count (int), superseded_by_task_id (uuid), superseded_reason (text), generated_from (text).';
