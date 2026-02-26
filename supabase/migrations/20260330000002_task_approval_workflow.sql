-- ============================================================
-- Task Approval Workflow
-- Adds pending_approval status and approval tracking columns
-- ============================================================

-- 1. Expand status constraint to include pending_approval
ALTER TABLE daily_standup_tasks DROP CONSTRAINT IF EXISTS daily_standup_tasks_status_check;
ALTER TABLE daily_standup_tasks ADD CONSTRAINT daily_standup_tasks_status_check
  CHECK (status IN ('pending_approval', 'pending', 'completed', 'overdue'));

-- 2. Add approval tracking columns
ALTER TABLE daily_standup_tasks
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- 3. Default new tasks to pending_approval (tasks need leadership sign-off)
ALTER TABLE daily_standup_tasks ALTER COLUMN status SET DEFAULT 'pending_approval';

-- 4. Update overdue trigger — only mark approved (pending) tasks as overdue, not unapproved ones
CREATE OR REPLACE FUNCTION mark_overdue_standup_tasks()
RETURNS integer AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE daily_standup_tasks
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Index for fast approval queries
CREATE INDEX IF NOT EXISTS idx_standup_tasks_approval
  ON daily_standup_tasks(status) WHERE status = 'pending_approval';
