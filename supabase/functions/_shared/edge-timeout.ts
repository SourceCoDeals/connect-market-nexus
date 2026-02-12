/**
 * Edge Function Timeout Guard
 * 
 * Supabase edge functions are hard-killed at ~60s wall time.
 * This utility allows wrapping an async operation so it returns
 * partial results before the function is killed.
 */

const EDGE_FUNCTION_LIMIT_MS = 58_000; // Return 2s before the hard limit

/**
 * Returns a promise that rejects after the edge function time limit.
 * Use with Promise.race() to wrap long-running operations.
 */
export function createEdgeTimeoutSignal(startTime: number = Date.now()) {
  const remaining = EDGE_FUNCTION_LIMIT_MS - (Date.now() - startTime);
  
  return {
    /** True when we're within 2s of the hard kill limit */
    isTimedOut: () => Date.now() - startTime > EDGE_FUNCTION_LIMIT_MS,
    
    /** Remaining ms before we should stop */
    remainingMs: () => Math.max(0, EDGE_FUNCTION_LIMIT_MS - (Date.now() - startTime)),
    
    /** A promise that rejects when time is up — use with Promise.race() */
    timeoutPromise: new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('EDGE_TIMEOUT')), Math.max(remaining, 0));
    }),
  };
}

/**
 * Wraps an async function with an edge-function-safe timeout.
 * Returns { result, timedOut } — if timedOut is true, result is undefined.
 */
export async function withEdgeTimeout<T>(
  fn: () => Promise<T>,
  startTime: number = Date.now(),
): Promise<{ result?: T; timedOut: boolean }> {
  const signal = createEdgeTimeoutSignal(startTime);
  
  try {
    const result = await Promise.race([fn(), signal.timeoutPromise]);
    return { result, timedOut: false };
  } catch (err) {
    if (err instanceof Error && err.message === 'EDGE_TIMEOUT') {
      return { timedOut: true };
    }
    throw err;
  }
}
