/**
 * Pure derivations for the Outlook backfill progress card.
 *
 * Lives in its own module (instead of inside BackfillProgressCard.tsx) so
 * Fast Refresh can hot-reload the component without invalidating the math
 * helpers, and so the unit tests can import the derivation without booting
 * React. Every function here is deterministic — no Date.now(), no imports
 * from the Supabase client, no side effects — which is what makes them
 * cheap to lock down in tests.
 */
import type { EmailConnection, OutlookBackfillStatus } from '@/types/email';

/** Treat a `running` row with a heartbeat older than this as frozen. */
export const STALL_THRESHOLD_MS = 3 * 60 * 1000;

export interface DerivedBackfillState {
  status: OutlookBackfillStatus;
  isStalled: boolean;
  /** Progress percentage in [0, 100], or null while indeterminate. */
  progressPct: number | null;
  elapsedMs: number;
  /** Estimated remaining time in ms, or null while the rate is too noisy. */
  etaMs: number | null;
  daysProcessed: number;
  daysBack: number;
}

/**
 * Compute all the derived progress numbers in one place so the render stays
 * readable. Exported for unit tests (see `BackfillProgressCard.test.tsx`).
 *
 * Progress percentage is derived from how far back in time the sync engine
 * has already processed (Microsoft Graph is walked newest-first). If the
 * engine hasn't checkpointed a single page yet (`earliest_seen_at` is null)
 * we return null so the render can show an indeterminate "preparing…" bar
 * instead of a fake 0%.
 *
 * ETA is intentionally null while progress is ≤5% — the early pages are
 * cheap (dense recent mail) and projecting that rate forward would lie to
 * the operator about how long the full pull takes.
 */
export function deriveBackfillState(
  connection: Partial<EmailConnection>,
  now: number = Date.now(),
): DerivedBackfillState {
  const status: OutlookBackfillStatus =
    (connection.backfill_status as OutlookBackfillStatus) || 'idle';
  const startedAt = connection.backfill_started_at
    ? new Date(connection.backfill_started_at).getTime()
    : now;
  const sinceTs = connection.backfill_since ? new Date(connection.backfill_since).getTime() : null;
  const earliestTs = connection.backfill_earliest_seen_at
    ? new Date(connection.backfill_earliest_seen_at).getTime()
    : null;
  const heartbeatTs = connection.backfill_heartbeat_at
    ? new Date(connection.backfill_heartbeat_at).getTime()
    : startedAt;
  const daysBack = connection.backfill_days_back || 0;

  // Percentage is derived from how far back in time we've reached:
  //   0% when earliest == startedAt (we've only processed "now")
  // 100% when earliest == since     (we've reached the cutoff)
  // The sync walks newest-first, so earliest monotonically decreases over time.
  let progressPct: number | null = null;
  if (earliestTs !== null && sinceTs !== null && startedAt > sinceTs) {
    const windowMs = startedAt - sinceTs;
    const coveredMs = startedAt - earliestTs;
    progressPct = Math.max(0, Math.min(1, coveredMs / windowMs)) * 100;
  }

  let daysProcessed = 0;
  if (earliestTs !== null) {
    daysProcessed = Math.max(0, Math.floor((startedAt - earliestTs) / (24 * 60 * 60 * 1000)));
  }

  const elapsedMs = now - startedAt;

  let etaMs: number | null = null;
  if (progressPct !== null && progressPct > 5) {
    const remainingPct = 100 - progressPct;
    etaMs = Math.round((elapsedMs * remainingPct) / progressPct);
  }

  const isStalled = status === 'running' && now - heartbeatTs > STALL_THRESHOLD_MS;

  return { status, isStalled, progressPct, elapsedMs, etaMs, daysProcessed, daysBack };
}

/** Human-readable duration (45s · 3m 12s · 1h 20m). Null/negative → "—". */
export function formatBackfillDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
