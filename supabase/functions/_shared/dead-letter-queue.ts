/**
 * Dead letter queue helper for failed enrichment jobs.
 *
 * Logs failed jobs to the `dead_letter_queue` table for later retry or
 * investigation. This ensures that no work is silently lost when external
 * API calls, AI extraction, or database writes fail after all retries
 * have been exhausted.
 *
 * Usage:
 *   import { sendToDeadLetterQueue } from '../_shared/dead-letter-queue.ts';
 *
 *   catch (error) {
 *     await sendToDeadLetterQueue({
 *       functionName: 'enrich-buyer',
 *       payload: { buyerId },
 *       error: error.message,
 *       attemptCount: 3,
 *       lastAttemptAt: new Date().toISOString(),
 *     });
 *   }
 *
 * The helper uses the service-role Supabase client so it can always write,
 * even when the original caller's token has expired. Writes are non-blocking
 * by default (fire-and-forget) so they never break the primary error response.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface FailedJob {
  /** The edge function that failed (e.g. 'enrich-buyer', 'firecrawl-scrape') */
  functionName: string;
  /** Original request payload for replay */
  payload: unknown;
  /** Human-readable error message */
  error: string;
  /** How many times this job was attempted before giving up */
  attemptCount: number;
  /** ISO timestamp of the last attempt */
  lastAttemptAt: string;
  /** Optional: the entity type being processed (deal, buyer, etc.) */
  entityType?: string;
  /** Optional: the entity ID for easy lookup */
  entityId?: string;
}

/**
 * Create a Supabase admin client for dead letter queue operations.
 * Uses service role key to guarantee write access regardless of caller auth state.
 */
function getAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for dead letter queue');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Send a failed job to the dead letter queue.
 *
 * This is NON-BLOCKING by default — errors are caught and logged to console
 * so that DLQ failures never mask the original error.
 *
 * @param job - The failed job details to record
 * @param options.blocking - If true, awaits the insert and throws on failure. Default: false.
 */
export async function sendToDeadLetterQueue(
  job: FailedJob,
  options: { blocking?: boolean } = {},
): Promise<void> {
  const doInsert = async () => {
    try {
      const supabase = getAdminClient();

      const { error: insertError } = await supabase.from('dead_letter_queue').insert({
        function_name: job.functionName,
        payload: job.payload,
        error_message: job.error,
        attempt_count: job.attemptCount,
        last_attempt_at: job.lastAttemptAt,
        entity_type: job.entityType || null,
        entity_id: job.entityId || null,
        status: 'pending', // pending = needs investigation/retry
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error('[dead-letter-queue] Failed to insert:', insertError.message);

        // Fallback: if the table doesn't exist yet, log to console in a structured
        // format so the failure is still captured in edge function logs.
        console.error(
          '[dead-letter-queue] FALLBACK LOG:',
          JSON.stringify({
            function_name: job.functionName,
            payload: typeof job.payload === 'string' ? job.payload : JSON.stringify(job.payload),
            error: job.error,
            attempt_count: job.attemptCount,
            last_attempt_at: job.lastAttemptAt,
            entity_type: job.entityType,
            entity_id: job.entityId,
          }),
        );
      } else {
        console.log(
          `[dead-letter-queue] Recorded failed job from ${job.functionName} (${job.attemptCount} attempts)`,
        );
      }
    } catch (err) {
      // Last resort: log the failure so it's visible in edge function logs
      console.error('[dead-letter-queue] Exception during insert:', err);
      console.error(
        '[dead-letter-queue] FALLBACK LOG:',
        JSON.stringify({
          function_name: job.functionName,
          error: job.error,
          attempt_count: job.attemptCount,
          entity_id: job.entityId,
        }),
      );
    }
  };

  if (options.blocking) {
    await doInsert();
  } else {
    // Fire-and-forget — don't let DLQ writes block the response
    doInsert().catch(() => {});
  }
}

/**
 * Retrieve pending dead letter queue items for a specific function.
 * Useful for building retry/replay tooling.
 */
export async function getPendingDeadLetterItems(
  functionName?: string,
  limit = 50,
): Promise<FailedJob[]> {
  try {
    const supabase = getAdminClient();

    let query = supabase
      .from('dead_letter_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (functionName) {
      query = query.eq('function_name', functionName);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[dead-letter-queue] Failed to fetch items:', error.message);
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      functionName: row.function_name,
      payload: row.payload,
      error: row.error_message,
      attemptCount: row.attempt_count,
      lastAttemptAt: row.last_attempt_at,
      entityType: row.entity_type,
      entityId: row.entity_id,
    }));
  } catch (err) {
    console.error('[dead-letter-queue] Exception fetching items:', err);
    return [];
  }
}
