-- =============================================================================
-- Outreach Sync Cron Schedules
-- =============================================================================
-- Schedules forward-sync workers for SmartLead and HeyReach outreach messages.
--
-- Both workers run every 20 minutes on a staggered cadence to avoid overlapping
-- with the other one (SmartLead at :00, :20, :40; HeyReach at :10, :30, :50).
--
-- Backfill functions (backfill-smartlead-messages, backfill-heyreach-messages)
-- are NOT scheduled — they're one-shot manual invocations run once after this
-- migration lands, and then as-needed for resumable re-runs.
--
-- Auth: uses service_role key from Supabase app settings, matching the pattern
-- established by sync-captarget-sheet. Set these in Supabase Dashboard:
--   app.settings.supabase_url    = https://<project-ref>.supabase.co
--   app.settings.service_role_key = <service-role-key>
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- Unschedule any pre-existing versions of these jobs (idempotency)
DO $$
BEGIN
  PERFORM cron.unschedule('sync-smartlead-messages');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('sync-heyreach-messages');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;


-- -----------------------------------------------------------------------------
-- sync-smartlead-messages: every 20 min at :00, :20, :40
-- -----------------------------------------------------------------------------
SELECT cron.schedule(
  'sync-smartlead-messages',
  '0,20,40 * * * *',
  $$
  SELECT net.http_post(
    url := concat(
      COALESCE(
        current_setting('app.settings.supabase_url', true),
        'https://vhzipqarkmmfuqadefep.supabase.co'
      ),
      '/functions/v1/sync-smartlead-messages'
    ),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || COALESCE(
        current_setting('app.settings.service_role_key', true),
        ''
      ),
      'Content-Type', 'application/json'
    ),
    body := '{"source": "cron"}'::jsonb
  );
  $$
);


-- -----------------------------------------------------------------------------
-- sync-heyreach-messages: every 20 min at :10, :30, :50 (staggered)
-- -----------------------------------------------------------------------------
SELECT cron.schedule(
  'sync-heyreach-messages',
  '10,30,50 * * * *',
  $$
  SELECT net.http_post(
    url := concat(
      COALESCE(
        current_setting('app.settings.supabase_url', true),
        'https://vhzipqarkmmfuqadefep.supabase.co'
      ),
      '/functions/v1/sync-heyreach-messages'
    ),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || COALESCE(
        current_setting('app.settings.service_role_key', true),
        ''
      ),
      'Content-Type', 'application/json'
    ),
    body := '{"source": "cron"}'::jsonb
  );
  $$
);


-- Confirm both jobs were scheduled (no-op select for migration logs)
COMMENT ON EXTENSION pg_cron IS
  'pg_cron: outreach sync workers scheduled at 0,20,40/10,30,50 * * * * (UTC)';
