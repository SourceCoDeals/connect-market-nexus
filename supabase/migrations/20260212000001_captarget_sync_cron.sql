-- CapTarget Sheet Sync Cron Job
-- Runs daily at 05:00 UTC to sync data from Google Sheet
-- Uses pg_cron + pg_net to call the sync-captarget-sheet edge function

-- Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the sync job to run at 05:00 UTC daily
-- Uses supabase_url() helper and service_role key from vault/config
-- NOTE: You must set these in Supabase Dashboard > Settings > Database > App Settings:
--   app.settings.supabase_url = https://<project-ref>.supabase.co
--   app.settings.service_role_key = <your-service-role-key>
SELECT cron.schedule(
  'sync-captarget-sheet',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := concat(
      COALESCE(
        current_setting('app.settings.supabase_url', true),
        'https://vhzipqarkmmfuqadefep.supabase.co'
      ),
      '/functions/v1/sync-captarget-sheet'
    ),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || COALESCE(
        current_setting('app.settings.service_role_key', true),
        ''
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
