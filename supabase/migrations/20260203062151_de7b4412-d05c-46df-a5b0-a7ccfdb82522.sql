-- Enable RLS on cron_job_logs table
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read logs
CREATE POLICY "Authenticated users can view cron logs" 
ON public.cron_job_logs 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow service role to insert logs (for the cron job itself)
CREATE POLICY "Service role can insert cron logs" 
ON public.cron_job_logs 
FOR INSERT 
WITH CHECK (true);