-- ═══════════════════════════════════════════════════════════════
-- Migration: captarget_scheduled_sync
-- Date: 2026-02-27
-- Purpose: Schedules automatic CapTarget Google Sheet sync via
--          pg_cron, calling the sync-captarget-sheet edge function
--          daily at 6 AM ET (11:00 UTC). Includes a wrapper function
--          that handles pagination (the sync function may need
--          multiple passes for large sheets).
-- Tables affected: captarget_sync_log (write), listings (write)
-- ═══════════════════════════════════════════════════════════════

-- Ensure pg_net is available for HTTP calls from within the database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─── Wrapper function that invokes the edge function ────────────
-- The sync-captarget-sheet function supports pagination via
-- { startTab, startRow } body params. This wrapper does a single
-- invocation; if the sheet is very large, the edge function will
-- log partial results and the next cron run picks up where it left off.

CREATE OR REPLACE FUNCTION invoke_captarget_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  -- Read config from Supabase vault / settings
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _service_key  := current_setting('app.settings.service_role_key', true);

  -- Fallback: try environment-style settings
  IF _supabase_url IS NULL THEN
    _supabase_url := current_setting('supabase.url', true);
  END IF;
  IF _service_key IS NULL THEN
    _service_key := current_setting('supabase.service_role_key', true);
  END IF;

  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RAISE WARNING 'captarget_sync: Missing supabase_url or service_role_key settings — skipping';
    RETURN;
  END IF;

  -- Fire-and-forget HTTP POST to the edge function
  PERFORM net.http_post(
    url     := _supabase_url || '/functions/v1/sync-captarget-sheet',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;

-- ─── Schedule the cron job ──────────────────────────────────────
-- Runs daily at 11:00 UTC (6:00 AM Eastern).
-- The job name allows easy unscheduling later:
--   SELECT cron.unschedule('captarget-daily-sync');

DO $$
BEGIN
  -- Remove existing job if it exists (idempotent)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'captarget-daily-sync') THEN
    PERFORM cron.unschedule('captarget-daily-sync');
  END IF;

  -- Schedule: daily at 11:00 UTC (6 AM ET / 5 AM CT)
  PERFORM cron.schedule(
    'captarget-daily-sync',
    '0 11 * * *',
    'SELECT invoke_captarget_sync()'
  );
END;
$$;

-- ─── Verification ───────────────────────────────────────────────
-- After running this migration, verify with:
--   SELECT * FROM cron.job WHERE jobname = 'captarget-daily-sync';
