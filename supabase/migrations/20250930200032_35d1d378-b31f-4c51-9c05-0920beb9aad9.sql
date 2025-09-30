-- Add 'assignment_changed' and include all existing activity types
ALTER TABLE public.deal_activities 
DROP CONSTRAINT IF EXISTS deal_activities_activity_type_check;

ALTER TABLE public.deal_activities
ADD CONSTRAINT deal_activities_activity_type_check 
CHECK (activity_type IN (
  'stage_change',
  'task_created',
  'task_completed',
  'task_updated',
  'task_deleted',
  'note_added',
  'document_uploaded',
  'email_sent',
  'call_logged',
  'call_made',
  'meeting_scheduled',
  'deal_created',
  'deal_updated',
  'nda_status_changed',
  'fee_agreement_status_changed',
  'nda_email_sent',
  'fee_agreement_email_sent',
  'assignment_changed'
));