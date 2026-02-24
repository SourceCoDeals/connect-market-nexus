-- ============================================================================
-- AI Command Center Tools - Schema Fixes
-- ============================================================================
-- Adds missing columns and expands constraints needed by AI tool operations:
--   1. contacts.company_name — company the contact works at (separate from firm)
--   2. contacts.created_by   — tracks which admin/user added the contact
--   3. deal_activities activity_type CHECK — adds new types used by AI tools
-- ============================================================================


-- 1. Add company_name to contacts (needed by save_contacts_to_crm)
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS company_name TEXT;

COMMENT ON COLUMN public.contacts.company_name IS
  'Company the contact works at. May differ from the linked firm name.';


-- 2. Add created_by to contacts (tracks who added the contact)
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_created_by
  ON public.contacts(created_by)
  WHERE created_by IS NOT NULL;


-- 3. Expand deal_activities activity_type CHECK constraint
--    Adds types used by AI Command Center tools:
--      contacts_added, status_change, data_room, task_reassigned
ALTER TABLE public.deal_activities
  DROP CONSTRAINT IF EXISTS deal_activities_activity_type_check;

ALTER TABLE public.deal_activities
  ADD CONSTRAINT deal_activities_activity_type_check
  CHECK (activity_type IN (
    -- Original types
    'stage_change',
    'task_created',
    'task_completed',
    'task_updated',
    'task_deleted',
    'task_assigned',
    'note_added',
    'document_uploaded',
    'email_sent',
    'call_logged',
    'call_made',
    'meeting_scheduled',
    'deal_created',
    'deal_updated',
    'deal_deleted',
    'deal_restored',
    'nda_status_changed',
    'fee_agreement_status_changed',
    'nda_email_sent',
    'fee_agreement_email_sent',
    'assignment_changed',
    'follow_up',
    -- New types for AI Command Center
    'contacts_added',
    'status_change',
    'data_room',
    'task_reassigned'
  ));


-- ============================================================================
-- Summary
-- ============================================================================
-- 2 new columns on contacts: company_name, created_by
-- 1 expanded CHECK constraint on deal_activities (4 new activity types)
-- No existing data affected.
-- ============================================================================
