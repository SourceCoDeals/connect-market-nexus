-- Remove duplicate/broken cron jobs
SELECT cron.unschedule('process-enrichment-queue');

-- Create new cron job to run every 2 minutes for faster processing
SELECT cron.schedule(
  'process-enrichment-queue',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/process-enrichment-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemlwcWFya21tZnVxYWRlZmVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjYxNzExMywiZXhwIjoyMDYyMTkzMTEzfQ.VkHWUIHpILCuNZWDwXfB_j2LN2Ki5NT_RN4n-OuFVxM',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemlwcWFya21tZnVxYWRlZmVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjYxNzExMywiZXhwIjoyMDYyMTkzMTEzfQ.VkHWUIHpILCuNZWDwXfB_j2LN2Ki5NT_RN4n-OuFVxM'
    ),
    body := jsonb_build_object('time', now()::text)
  ) AS request_id;
  $$
);