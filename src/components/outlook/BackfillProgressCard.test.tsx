/**
 * Unit tests for `deriveBackfillState` — the pure function that turns
 * `email_connections.backfill_*` columns into the progress bar's
 * visible percentage + ETA + stall flag.
 *
 * The React render is not tested here because the visual output is a thin
 * projection of these numbers — locking down the math is what prevents a
 * "backfill says 340% complete" regression.
 */
import { describe, it, expect } from 'vitest';
import { deriveBackfillState } from './backfill-progress-math';
import type { EmailConnection, OutlookBackfillStatus } from '@/types/email';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Builds a minimally-populated EmailConnection for the math. */
function conn(
  overrides: Partial<EmailConnection> & { backfill_status: OutlookBackfillStatus },
): Partial<EmailConnection> {
  return {
    backfill_pages_processed: 0,
    backfill_messages_synced: 0,
    backfill_messages_skipped: 0,
    backfill_messages_queued: 0,
    ...overrides,
  };
}

describe('deriveBackfillState — progress percentage', () => {
  it('returns null progress before the first checkpoint (earliest_seen_at is null)', () => {
    const now = Date.parse('2026-04-14T12:00:00Z');
    const d = deriveBackfillState(
      conn({
        backfill_status: 'running',
        backfill_started_at: '2026-04-14T11:59:30Z',
        backfill_since: '2025-04-14T11:59:30Z',
        backfill_days_back: 365,
        backfill_earliest_seen_at: null,
      }),
      now,
    );
    expect(d.progressPct).toBeNull();
    expect(d.etaMs).toBeNull();
    expect(d.status).toBe('running');
  });

  it('reports 0% when earliest_seen == started_at (nothing processed yet)', () => {
    const started = Date.parse('2026-04-14T11:59:30Z');
    const d = deriveBackfillState(
      conn({
        backfill_status: 'running',
        backfill_started_at: new Date(started).toISOString(),
        backfill_since: new Date(started - 365 * DAY_MS).toISOString(),
        backfill_days_back: 365,
        backfill_earliest_seen_at: new Date(started).toISOString(),
      }),
      started + 1000,
    );
    expect(d.progressPct).toBe(0);
  });

  it('reports 100% when earliest_seen has reached the since cutoff', () => {
    const started = Date.parse('2026-04-14T11:59:30Z');
    const since = started - 365 * DAY_MS;
    const d = deriveBackfillState(
      conn({
        backfill_status: 'running',
        backfill_started_at: new Date(started).toISOString(),
        backfill_since: new Date(since).toISOString(),
        backfill_days_back: 365,
        backfill_earliest_seen_at: new Date(since).toISOString(),
      }),
      started + 60_000,
    );
    expect(d.progressPct).toBe(100);
  });

  it('reports ~50% when earliest_seen is halfway through the window', () => {
    const started = Date.parse('2026-04-14T12:00:00Z');
    const since = started - 365 * DAY_MS;
    const halfway = started - 180 * DAY_MS; // roughly the midpoint
    const d = deriveBackfillState(
      conn({
        backfill_status: 'running',
        backfill_started_at: new Date(started).toISOString(),
        backfill_since: new Date(since).toISOString(),
        backfill_days_back: 365,
        backfill_earliest_seen_at: new Date(halfway).toISOString(),
      }),
      started + 5 * 60 * 1000,
    );
    expect(d.progressPct).not.toBeNull();
    expect(d.progressPct!).toBeGreaterThan(48);
    expect(d.progressPct!).toBeLessThan(52);
  });

  it('forces progress to 100% on completed status even with null earliest_seen', () => {
    // Regression: on a completed backfill with a mailbox that had zero
    // messages in the lookback window, `earliest_seen_at` is never written
    // (the sync engine only updates the watermark when it sees messages).
    // Without the terminal-state override the UI would stay stuck on the
    // "Preparing…" indeterminate state forever.
    const started = Date.parse('2026-04-14T12:00:00Z');
    const since = started - 365 * DAY_MS;
    const d = deriveBackfillState(
      conn({
        backfill_status: 'completed',
        backfill_started_at: new Date(started).toISOString(),
        backfill_completed_at: new Date(started + 5000).toISOString(),
        backfill_since: new Date(since).toISOString(),
        backfill_days_back: 365,
        backfill_earliest_seen_at: null, // sync never saw a single message
      }),
      started + 10_000,
    );
    expect(d.progressPct).toBe(100);
    expect(d.status).toBe('completed');
    expect(d.isStalled).toBe(false);
  });

  it('leaves progress null on failed status with no earliest_seen (first-page crash)', () => {
    // If the very first Graph fetch crashed before writing a checkpoint,
    // `earliest_seen_at` stays null and the row transitions to `failed`. We
    // intentionally do NOT force progress to 0/100 for failed — the UI
    // renders the red panel with the error message and the Resume button
    // regardless of the progress bar state.
    const started = Date.parse('2026-04-14T12:00:00Z');
    const since = started - 365 * DAY_MS;
    const d = deriveBackfillState(
      conn({
        backfill_status: 'failed',
        backfill_started_at: new Date(started).toISOString(),
        backfill_since: new Date(since).toISOString(),
        backfill_days_back: 365,
        backfill_earliest_seen_at: null,
        backfill_error_message: 'Graph API returned 500',
      }),
      started + 60_000,
    );
    expect(d.progressPct).toBeNull();
    expect(d.status).toBe('failed');
  });

  it('clamps runaway earliest_seen values to [0, 100]', () => {
    const started = Date.parse('2026-04-14T12:00:00Z');
    const since = started - 365 * DAY_MS;
    // Bug scenario: the sync engine accidentally writes an earliest_seen
    // that is older than the since cutoff (clock skew, timezone bug, etc).
    const wayTooOld = since - 200 * DAY_MS;
    const d = deriveBackfillState(
      conn({
        backfill_status: 'running',
        backfill_started_at: new Date(started).toISOString(),
        backfill_since: new Date(since).toISOString(),
        backfill_days_back: 365,
        backfill_earliest_seen_at: new Date(wayTooOld).toISOString(),
      }),
      started + 1000,
    );
    expect(d.progressPct).toBe(100);
  });

  it('counts daysProcessed correctly once earliest_seen drops below started_at', () => {
    const started = Date.parse('2026-04-14T12:00:00Z');
    const since = started - 365 * DAY_MS;
    const d = deriveBackfillState(
      conn({
        backfill_status: 'running',
        backfill_started_at: new Date(started).toISOString(),
        backfill_since: new Date(since).toISOString(),
        backfill_days_back: 365,
        backfill_earliest_seen_at: new Date(started - 42 * DAY_MS).toISOString(),
      }),
      started + 5 * 60 * 1000,
    );
    expect(d.daysProcessed).toBe(42);
    expect(d.daysBack).toBe(365);
  });
});

describe('deriveBackfillState — ETA', () => {
  it('is null while progress is ≤5% (rate is too noisy to extrapolate)', () => {
    const started = Date.parse('2026-04-14T12:00:00Z');
    const since = started - 365 * DAY_MS;
    // Processed 2% of the window in 30 seconds — projecting that forward would
    // give an unreliable ETA, so we show "estimating…" instead.
    const d = deriveBackfillState(
      conn({
        backfill_status: 'running',
        backfill_started_at: new Date(started).toISOString(),
        backfill_since: new Date(since).toISOString(),
        backfill_days_back: 365,
        backfill_earliest_seen_at: new Date(started - 7 * DAY_MS).toISOString(),
      }),
      started + 30_000,
    );
    expect(d.progressPct).not.toBeNull();
    expect(d.progressPct!).toBeLessThan(5);
    expect(d.etaMs).toBeNull();
  });

  it('projects ETA from elapsed/remaining once progress is >5%', () => {
    const started = Date.parse('2026-04-14T12:00:00Z');
    const since = started - 100 * DAY_MS;
    // 25% done in 60 seconds → remaining work = 3×elapsed = 180_000 ms.
    const d = deriveBackfillState(
      conn({
        backfill_status: 'running',
        backfill_started_at: new Date(started).toISOString(),
        backfill_since: new Date(since).toISOString(),
        backfill_days_back: 100,
        backfill_earliest_seen_at: new Date(started - 25 * DAY_MS).toISOString(),
      }),
      started + 60_000,
    );
    expect(d.progressPct).toBe(25);
    expect(d.etaMs).toBe(180_000);
  });
});

describe('deriveBackfillState — stall detection', () => {
  it('is not stalled when heartbeat is fresh', () => {
    const started = Date.parse('2026-04-14T12:00:00Z');
    const d = deriveBackfillState(
      conn({
        backfill_status: 'running',
        backfill_started_at: new Date(started).toISOString(),
        backfill_heartbeat_at: new Date(started + 30_000).toISOString(),
        backfill_since: new Date(started - 365 * DAY_MS).toISOString(),
        backfill_days_back: 365,
        backfill_earliest_seen_at: new Date(started - 50 * DAY_MS).toISOString(),
      }),
      started + 60_000,
    );
    expect(d.isStalled).toBe(false);
  });

  it('is flagged stalled when heartbeat is older than 3 minutes', () => {
    const started = Date.parse('2026-04-14T12:00:00Z');
    const d = deriveBackfillState(
      conn({
        backfill_status: 'running',
        backfill_started_at: new Date(started).toISOString(),
        backfill_heartbeat_at: new Date(started + 60_000).toISOString(),
        backfill_since: new Date(started - 365 * DAY_MS).toISOString(),
        backfill_days_back: 365,
        backfill_earliest_seen_at: new Date(started - 10 * DAY_MS).toISOString(),
      }),
      // 4 minutes after the last heartbeat → over the 3-minute stall threshold.
      started + 60_000 + 4 * 60 * 1000,
    );
    expect(d.isStalled).toBe(true);
  });

  it('is not flagged stalled when status is already completed or failed', () => {
    const started = Date.parse('2026-04-14T12:00:00Z');
    const failed = deriveBackfillState(
      conn({
        backfill_status: 'failed',
        backfill_started_at: new Date(started).toISOString(),
        backfill_heartbeat_at: new Date(started + 60_000).toISOString(),
        backfill_since: new Date(started - 365 * DAY_MS).toISOString(),
        backfill_days_back: 365,
      }),
      started + 24 * 60 * 60 * 1000, // one day later
    );
    expect(failed.isStalled).toBe(false);

    const completed = deriveBackfillState(
      conn({
        backfill_status: 'completed',
        backfill_started_at: new Date(started).toISOString(),
        backfill_heartbeat_at: new Date(started + 60_000).toISOString(),
        backfill_since: new Date(started - 365 * DAY_MS).toISOString(),
        backfill_days_back: 365,
      }),
      started + 24 * 60 * 60 * 1000,
    );
    expect(completed.isStalled).toBe(false);
  });
});

describe('deriveBackfillState — elapsed', () => {
  it('reports elapsed time relative to started_at', () => {
    const started = Date.parse('2026-04-14T12:00:00Z');
    const d = deriveBackfillState(
      conn({
        backfill_status: 'running',
        backfill_started_at: new Date(started).toISOString(),
        backfill_since: new Date(started - 30 * DAY_MS).toISOString(),
        backfill_days_back: 30,
      }),
      started + 45 * 60 * 1000, // 45 minutes in
    );
    expect(d.elapsedMs).toBe(45 * 60 * 1000);
  });
});
