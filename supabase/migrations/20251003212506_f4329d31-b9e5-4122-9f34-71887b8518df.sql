-- Add new task statuses and reviewers support

-- Update task status enum to include new statuses
ALTER TABLE public.deal_tasks 
  DROP CONSTRAINT IF EXISTS deal_tasks_status_check;

ALTER TABLE public.deal_tasks
  ADD CONSTRAINT deal_tasks_status_check 
  CHECK (status IN ('open', 'in_progress', 'reopened', 'na', 'resolved', 'pending', 'completed'));

-- Update existing 'pending' tasks to 'open'
UPDATE public.deal_tasks
SET status = 'open'
WHERE status = 'pending';

-- Update existing 'completed' tasks to 'resolved'
UPDATE public.deal_tasks
SET status = 'resolved'
WHERE status = 'completed';

-- Create task_reviewers table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.deal_task_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.deal_tasks(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  added_by UUID,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, admin_id)
);

-- Enable RLS on task_reviewers
ALTER TABLE public.deal_task_reviewers ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for admins to manage task reviewers
CREATE POLICY "Admins can manage task reviewers"
  ON public.deal_task_reviewers
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_task_reviewers_task_id ON public.deal_task_reviewers(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reviewers_admin_id ON public.deal_task_reviewers(admin_id);