
-- Create the global_activity_queue table
CREATE TABLE public.global_activity_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_type TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'major',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  error_log JSONB DEFAULT '[]'::jsonb,
  context_json JSONB DEFAULT '{}'::jsonb,
  queued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.global_activity_queue ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all queue items
CREATE POLICY "Authenticated users can view global activity queue"
ON public.global_activity_queue
FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert
CREATE POLICY "Authenticated users can insert into global activity queue"
ON public.global_activity_queue
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update (for pause/resume/cancel)
CREATE POLICY "Authenticated users can update global activity queue"
ON public.global_activity_queue
FOR UPDATE
USING (auth.role() = 'authenticated');

-- Index for fast lookups by status and type
CREATE INDEX idx_global_activity_queue_status ON public.global_activity_queue(status);
CREATE INDEX idx_global_activity_queue_operation_type_status ON public.global_activity_queue(operation_type, status);

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_activity_queue;
