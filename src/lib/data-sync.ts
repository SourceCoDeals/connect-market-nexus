/**
 * Offline / sync-awareness utilities.
 *
 * Provides:
 * - `isOnline()` — synchronous connectivity check.
 * - `onReconnect(cb)` — register a callback that fires once the browser
 *    regains network access.
 * - `queueOfflineAction()` / `flushOfflineQueue()` — a minimal queue that
 *    stores mutations performed while offline and replays them once the
 *    connection is restored.
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Connectivity helpers
// ---------------------------------------------------------------------------

/** Returns `true` when the browser reports an active network connection. */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true; // SSR / tests
  return navigator.onLine;
}

/**
 * Register a callback that will be invoked the next time (or every time)
 * the browser transitions from offline to online.
 *
 * @param callback - Invoked with no arguments on reconnection.
 * @param options.once - If `true` (default) the listener auto-removes after
 *   the first invocation.
 * @returns A cleanup function that removes the listener.
 */
export function onReconnect(
  callback: () => void,
  options: { once?: boolean } = {},
): () => void {
  const { once = true } = options;

  if (typeof window === 'undefined') {
    // No-op in non-browser environments
    return () => {};
  }

  const handler = () => {
    logger.info('Network reconnected — executing callback', 'data-sync');
    callback();
    if (once) {
      window.removeEventListener('online', handler);
    }
  };

  window.addEventListener('online', handler);

  return () => {
    window.removeEventListener('online', handler);
  };
}

// ---------------------------------------------------------------------------
// Offline action queue
// ---------------------------------------------------------------------------

export interface OfflineAction {
  id: string;
  /** Human-readable label, e.g. "saveConnectionRequest". */
  type: string;
  /** Serialisable payload that will be passed back to the executor. */
  payload: unknown;
  /** ISO-8601 timestamp of when the action was queued. */
  createdAt: string;
}

type ActionExecutor = (action: OfflineAction) => Promise<void>;

const STORAGE_KEY = 'cmn_offline_queue';

/** Read the current queue from `localStorage`. */
function readQueue(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OfflineAction[]) : [];
  } catch {
    return [];
  }
}

/** Persist the queue to `localStorage`. */
function writeQueue(queue: OfflineAction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    logger.warn('Failed to write offline queue to localStorage', 'data-sync');
  }
}

let _nextId = 0;

/**
 * Add a mutation to the offline queue.  The action will be stored in
 * `localStorage` so it survives page reloads.
 *
 * @returns The generated action ID.
 */
export function queueOfflineAction(
  type: string,
  payload: unknown,
): string {
  const id = `offline_${Date.now()}_${_nextId++}`;
  const action: OfflineAction = {
    id,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };

  const queue = readQueue();
  queue.push(action);
  writeQueue(queue);

  logger.info(
    `Queued offline action "${type}" (${id}) — queue depth: ${queue.length}`,
    'data-sync',
  );

  return id;
}

/**
 * Replay all queued actions using the supplied `executor`. Successfully
 * processed actions are removed from the queue; failed ones are kept for
 * the next flush attempt.
 *
 * @returns The number of actions that were successfully processed.
 */
export async function flushOfflineQueue(
  executor: ActionExecutor,
): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;

  logger.info(
    `Flushing offline queue — ${queue.length} action(s) pending`,
    'data-sync',
  );

  const remaining: OfflineAction[] = [];
  let processed = 0;

  for (const action of queue) {
    try {
      await executor(action);
      processed++;
      logger.info(
        `Offline action "${action.type}" (${action.id}) processed`,
        'data-sync',
      );
    } catch (error) {
      logger.warn(
        `Offline action "${action.type}" (${action.id}) failed — will retry later`,
        'data-sync',
        { error },
      );
      remaining.push(action);
    }
  }

  writeQueue(remaining);

  logger.info(
    `Offline queue flush complete: ${processed} processed, ${remaining.length} remaining`,
    'data-sync',
  );

  return processed;
}

/**
 * Returns the current number of actions waiting in the offline queue.
 */
export function getOfflineQueueSize(): number {
  return readQueue().length;
}

/**
 * Clear the entire offline queue (useful for logout / test teardown).
 */
export function clearOfflineQueue(): void {
  writeQueue([]);
}

// ---------------------------------------------------------------------------
// Auto-flush on reconnect (singleton)
// ---------------------------------------------------------------------------

let _autoFlushCleanup: (() => void) | null = null;

/**
 * Start listening for reconnect events and automatically flush the offline
 * queue using the provided executor.
 *
 * Call the returned cleanup function to stop auto-flushing.
 */
export function startAutoFlush(executor: ActionExecutor): () => void {
  // Prevent duplicate listeners
  _autoFlushCleanup?.();

  _autoFlushCleanup = onReconnect(
    () => {
      flushOfflineQueue(executor).catch((err) => {
        logger.error('Auto-flush failed', 'data-sync', { err });
      });
    },
    { once: false },
  );

  return () => {
    _autoFlushCleanup?.();
    _autoFlushCleanup = null;
  };
}
