-- G5 FIX: Replace sell-side DD checklist with buy-side check-in tasks.
-- SourceCo makes introductions — the buyer runs their own DD.
-- SourceCo's job during DD is to check in with both sides and track progress.

UPDATE public.task_templates
SET
  name = 'Due Diligence Check-ins',
  description = 'Buy-side advisory: periodic check-ins during buyer-led due diligence',
  tasks = '[
    {"title": "Check in with buyer on DD progress", "task_type": "follow_up_with_buyer", "priority": "high", "due_offset_days": 7},
    {"title": "Check in with seller — any concerns?", "task_type": "contact_owner", "priority": "medium", "due_offset_days": 7},
    {"title": "Update pipeline status and probability", "task_type": "update_pipeline", "priority": "medium", "due_offset_days": 7},
    {"title": "Schedule next check-in", "task_type": "schedule_call", "priority": "medium", "due_offset_days": 14}
  ]'::jsonb
WHERE name = 'Due Diligence Checklist'
  AND stage_trigger = 'Due Diligence';

-- Also fix the "Closing Checklist" template from 20260627000000 — same issue.
-- SourceCo doesn't coordinate escrow or prepare closing docs. They track the outcome.
UPDATE public.task_templates
SET
  name = 'Under Contract Tracking',
  description = 'Buy-side advisory: track closing progress and confirm fee collection',
  tasks = '[
    {"title": "Confirm both parties signed purchase agreement", "task_type": "follow_up_with_buyer", "priority": "high", "due_offset_days": 3},
    {"title": "Check in with buyer on closing timeline", "task_type": "follow_up_with_buyer", "priority": "medium", "due_offset_days": 7},
    {"title": "Confirm closing date with seller", "task_type": "contact_owner", "priority": "medium", "due_offset_days": 10},
    {"title": "Send commission invoice", "task_type": "other", "priority": "high", "due_offset_days": 3},
    {"title": "Confirm fee payment received", "task_type": "other", "priority": "high", "due_offset_days": 30}
  ]'::jsonb
WHERE name = 'Closing Checklist'
  AND stage_trigger = 'Under Contract';
