-- CapTarget Sheet Sync Cron Job
-- Runs daily at 05:00 UTC to sync data from Google Sheet
-- Uses pg_cron + pg_net to call the sync-captarget-sheet edge function

-- Ensure pg_cron is available (typically enabled by default on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the sync job to run at 05:00 UTC daily
SELECT cron.schedule(
  'sync-captarget-sheet',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/sync-captarget-sheet',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
