-- Phase 2: Update cron job from daily to hourly

-- First, remove the existing daily cron job
SELECT cron.unschedule('sync-missing-profiles-daily');

-- Create new hourly cron job (runs every hour at :00)
SELECT cron.schedule(
  'sync-missing-profiles-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/sync-missing-profiles',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemlwcWFya21tZnVxYWRlZmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTcxMTMsImV4cCI6MjA2MjE5MzExM30.M653TuQcthJx8vZW4jPkUTdB67D_Dm48ItLcu_XBh2g"}'::jsonb,
    body := '{"source": "hourly-cron"}'::jsonb
  ) AS request_id;
  $$
);