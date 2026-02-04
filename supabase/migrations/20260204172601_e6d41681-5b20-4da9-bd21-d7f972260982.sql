-- Create tracker activity logs table
CREATE TABLE IF NOT EXISTS public.tracker_activity_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tracker_id uuid NOT NULL REFERENCES public.industry_trackers(id) ON DELETE CASCADE,
  type text NOT NULL,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  entity_id uuid,
  entity_name text,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_tracker_activity_logs_tracker_id ON public.tracker_activity_logs(tracker_id);
CREATE INDEX idx_tracker_activity_logs_created_at ON public.tracker_activity_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.tracker_activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all activity logs
CREATE POLICY "Admins can view all activity logs"
ON public.tracker_activity_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Allow admins to insert activity logs
CREATE POLICY "Admins can insert activity logs"
ON public.tracker_activity_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role can manage activity logs"
ON public.tracker_activity_logs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');