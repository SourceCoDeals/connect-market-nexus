-- =============================================================================
-- Outlook backfill progress + resumability
--
-- Adds per-connection backfill state columns to `email_connections` so we can:
--   1. Show a live progress bar + ETA in the Outlook settings UI (the frontend
--      polls this row while `backfill_status = 'running'`).
--   2. Resume a crashed/frozen backfill from the exact Microsoft Graph
--      `@odata.nextLink` cursor where it stopped, instead of restarting the
--      whole pull. Because `email_messages.upsert(..., ignoreDuplicates: true)`
--      is already idempotent against the `(microsoft_message_id, contact_id)`
--      unique index (see 20260617000001), a resumed run cannot double-insert
--      — but without this migration it used to re-fetch every page from
--      Microsoft Graph, re-check every message against the dedup index, and
--      waste minutes of wall-clock time. With these columns the resume path
--      skips straight to the stored cursor.
--
-- Progress semantics:
--   - `backfill_since` is the cutoff the backfill was started against (e.g.
--     365 days ago). It's stored so we never re-derive the window on resume
--     and drift it forward.
--   - `backfill_earliest_seen_at` is the oldest `sentDateTime` the sync engine
--     has processed so far. Progress% is computed client-side as
--     `(started_at - earliest_seen_at) / (started_at - since)` because we
--     iterate newest-first. It's bounded to [0, 1] in the UI.
--   - `backfill_next_link` is the Microsoft Graph `@odata.nextLink` URL at the
--     last successful checkpoint. NULL means either "not started" or "finished
--     walking the pages". Paired with `backfill_status` for disambiguation.
--   - `backfill_heartbeat_at` is updated every checkpoint (every page). The UI
--     uses it to flag a run as "stalled" when it's older than ~3 minutes while
--     status is still `running` — that's the hint to operators to hit Resume.
-- =============================================================================

ALTER TABLE public.email_connections
  ADD COLUMN IF NOT EXISTS backfill_status         TEXT        NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS backfill_started_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS backfill_completed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS backfill_days_back      INTEGER,
  ADD COLUMN IF NOT EXISTS backfill_since          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS backfill_next_link      TEXT,
  ADD COLUMN IF NOT EXISTS backfill_pages_processed  INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_messages_synced  INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_messages_skipped INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_messages_queued  INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_earliest_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS backfill_heartbeat_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS backfill_error_message  TEXT;

-- Status enum is soft-enforced via a CHECK constraint — cheaper than a real
-- PG enum for a 4-value column and avoids a second migration if we ever add
-- a new state (just drop the constraint and re-add).
ALTER TABLE public.email_connections
  DROP CONSTRAINT IF EXISTS email_connections_backfill_status_check;

ALTER TABLE public.email_connections
  ADD CONSTRAINT email_connections_backfill_status_check
  CHECK (backfill_status IN ('idle', 'running', 'completed', 'failed'));

-- Partial index on currently-running backfills. The polling admin dashboard
-- reads this to show a rolled-up "N mailboxes backfilling" counter without
-- scanning the whole table. It stays cheap because the cardinality is at most
-- the active mailbox count.
CREATE INDEX IF NOT EXISTS idx_email_connections_backfill_running
  ON public.email_connections(backfill_heartbeat_at)
  WHERE backfill_status = 'running';

COMMENT ON COLUMN public.email_connections.backfill_status IS
  'idle|running|completed|failed — current backfill state, polled by Outlook settings UI';
COMMENT ON COLUMN public.email_connections.backfill_next_link IS
  'Microsoft Graph @odata.nextLink checkpoint — set after every page, NULL on completion';
COMMENT ON COLUMN public.email_connections.backfill_earliest_seen_at IS
  'Oldest message sentDateTime processed so far — drives the progress-bar percentage';
COMMENT ON COLUMN public.email_connections.backfill_heartbeat_at IS
  'Timestamp of last progress write — stale heartbeat signals a frozen run';
