/**
 * BackfillProgressCard
 *
 * Live progress display for an Outlook historical backfill. Consumes the
 * persisted `email_connections.backfill_*` columns via the parent query and
 * renders a determinate progress bar, counters, and elapsed / ETA chips that
 * update every 2.5s while the edge-function-driven sync is running in the
 * background.
 *
 * Progress percentage is derived from how far back in time the sync engine
 * has already processed (Microsoft Graph is walked newest-first). If the
 * engine hasn't checkpointed a single page yet (`earliest_seen_at` is null)
 * we fall back to an indeterminate "preparing…" state instead of showing a
 * fake 0% bar.
 *
 * Resume / stall semantics:
 *   - `status === 'failed'` → red panel + Resume button; the edge function
 *     left `backfill_next_link` in place so the next invocation picks up
 *     exactly where it stopped.
 *   - `status === 'running'` but `heartbeat_at` is >3 minutes old → yellow
 *     "stalled" panel + Resume button. The run probably got killed by the
 *     150s edge-function ceiling; hit Resume to continue from the last
 *     checkpoint.
 *   - `status === 'completed'` → green panel with the final counts, which
 *     the user can dismiss by clearing the row (the Resume button is hidden
 *     for this state).
 *
 * The underlying upserts are idempotent on `(microsoft_message_id, contact_id)`,
 * so even if the cursor is lost entirely a fresh start never double-inserts —
 * the worst case is wall-clock time wasted re-walking the inbox.
 */

import type { EmailConnection } from '@/types/email';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, History, Loader2, RotateCcw, Clock } from 'lucide-react';
import { deriveBackfillState, formatBackfillDuration } from './backfill-progress-math';

interface BackfillProgressCardProps {
  connection: EmailConnection;
  /** Called when the operator clicks Resume on a failed / stalled run. */
  onResume: () => void;
  /** True while the Resume HTTP call is in flight so we can disable the button. */
  isResuming: boolean;
}

export function BackfillProgressCard({
  connection,
  onResume,
  isResuming,
}: BackfillProgressCardProps) {
  const derived = deriveBackfillState(connection);
  const { status, isStalled, progressPct, elapsedMs, etaMs, daysProcessed, daysBack } = derived;

  // Nothing to render unless we have a real state row. An "idle" status with
  // no started_at means the mailbox has never kicked off a deep backfill.
  if (status === 'idle' || !connection.backfill_started_at) return null;

  const messagesSynced = connection.backfill_messages_synced ?? 0;
  const messagesSkipped = connection.backfill_messages_skipped ?? 0;
  const messagesQueued = connection.backfill_messages_queued ?? 0;
  const pagesProcessed = connection.backfill_pages_processed ?? 0;

  // Pick the visual skin based on the effective state. Stalled takes priority
  // over "running" so the operator doesn't stare at a spinner forever.
  const effective: 'running' | 'stalled' | 'failed' | 'completed' =
    status === 'completed'
      ? 'completed'
      : status === 'failed'
        ? 'failed'
        : isStalled
          ? 'stalled'
          : 'running';

  const containerClass = {
    running: 'border-primary/30 bg-primary/5',
    stalled: 'border-yellow-500/40 bg-yellow-50/60 dark:bg-yellow-900/10',
    failed: 'border-destructive/40 bg-destructive/5',
    completed: 'border-green-500/40 bg-green-50/60 dark:bg-green-900/10',
  }[effective];

  const Icon = {
    running: Loader2,
    stalled: AlertTriangle,
    failed: AlertTriangle,
    completed: CheckCircle2,
  }[effective];

  const title = {
    running: 'Backfill in progress',
    stalled: 'Backfill stalled',
    failed: 'Backfill failed',
    completed: 'Backfill complete',
  }[effective];

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${containerClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon
            className={`h-4 w-4 ${effective === 'running' ? 'animate-spin text-primary' : ''} ${
              effective === 'stalled' || effective === 'failed' ? 'text-yellow-600' : ''
            } ${effective === 'completed' ? 'text-green-600' : ''}`}
          />
          {title}
        </div>
        {(effective === 'failed' || effective === 'stalled') && (
          <Button size="sm" variant="outline" onClick={onResume} disabled={isResuming}>
            {isResuming ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isResuming ? 'Resuming…' : 'Resume from checkpoint'}
          </Button>
        )}
      </div>

      {/* Progress bar (determinate once the engine has checkpointed ≥1 page) */}
      {progressPct === null ? (
        <div className="space-y-1">
          <Progress value={0} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Preparing — waiting for the first page of history to land…
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <Progress value={progressPct} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {Math.round(progressPct)}% · {daysProcessed.toLocaleString()} /{' '}
              {daysBack.toLocaleString()} days
            </span>
            <span>Page {pagesProcessed}</span>
          </div>
        </div>
      )}

      {/* Live counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="rounded-md bg-background/50 p-2">
          <p className="text-muted-foreground">Synced</p>
          <p className="font-semibold text-sm text-foreground">{messagesSynced.toLocaleString()}</p>
        </div>
        <div className="rounded-md bg-background/50 p-2">
          <p className="text-muted-foreground">Skipped</p>
          <p className="font-semibold text-sm text-foreground">
            {messagesSkipped.toLocaleString()}
          </p>
        </div>
        <div className="rounded-md bg-background/50 p-2">
          <p className="text-muted-foreground">Queued</p>
          <p className="font-semibold text-sm text-foreground">{messagesQueued.toLocaleString()}</p>
        </div>
        <div className="rounded-md bg-background/50 p-2">
          <p className="text-muted-foreground">Elapsed</p>
          <p className="font-semibold text-sm text-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatBackfillDuration(elapsedMs)}
          </p>
        </div>
      </div>

      {/* ETA — only shown while running and once we have enough signal */}
      {effective === 'running' && etaMs !== null && (
        <p className="text-xs text-muted-foreground">
          Estimated time remaining:{' '}
          <span className="font-medium text-foreground">{formatBackfillDuration(etaMs)}</span>
        </p>
      )}
      {effective === 'running' && etaMs === null && progressPct !== null && progressPct <= 5 && (
        <p className="text-xs text-muted-foreground">Estimating time remaining…</p>
      )}

      {/* Failed state — show the error message so the operator knows what to fix */}
      {effective === 'failed' && connection.backfill_error_message && (
        <Alert variant="destructive" className="mt-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sync error</AlertTitle>
          <AlertDescription className="text-xs">
            {connection.backfill_error_message}. Click Resume to pick up from the last checkpoint —
            the synced emails so far are already in your inbox view.
          </AlertDescription>
        </Alert>
      )}

      {/* Stalled state — same channel, different language */}
      {effective === 'stalled' && (
        <Alert className="mt-2 border-yellow-500/40">
          <History className="h-4 w-4" />
          <AlertTitle>No progress in the last few minutes</AlertTitle>
          <AlertDescription className="text-xs">
            The background worker may have hit the 150-second edge-function ceiling. Click Resume to
            continue from the last checkpoint — already-synced emails are preserved.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
