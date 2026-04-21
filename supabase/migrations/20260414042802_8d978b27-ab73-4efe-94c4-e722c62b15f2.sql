-- Add backfill progress tracking columns to email_connections
ALTER TABLE public.email_connections
  ADD COLUMN IF NOT EXISTS backfill_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS backfill_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS backfill_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS backfill_days_back integer,
  ADD COLUMN IF NOT EXISTS backfill_since timestamptz,
  ADD COLUMN IF NOT EXISTS backfill_next_link text,
  ADD COLUMN IF NOT EXISTS backfill_pages_processed integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_messages_synced integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_messages_skipped integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_messages_queued integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_earliest_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS backfill_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS backfill_error_message text;