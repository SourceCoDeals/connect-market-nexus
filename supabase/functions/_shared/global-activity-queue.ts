/**
 * Shared utility for edge functions to interact with the global_activity_queue.
 * Import from "../_shared/global-activity-queue.ts" in any edge function.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type OperationType =
  | 'deal_enrichment'
  | 'buyer_enrichment'
  | 'guide_generation'
  | 'buyer_scoring'
  | 'criteria_extraction';

/**
 * Update progress on a global_activity_queue item.
 * Called after each item completes in a queue processor.
 */
export async function updateGlobalQueueProgress(
  supabase: SupabaseClient,
  operationType: OperationType,
  update: {
    completedDelta?: number;
    failedDelta?: number;
    errorEntry?: { itemId: string; error: string };
  }
): Promise<void> {
  try {
    // Find the running queue item for this operation type
    const { data: item } = await supabase
      .from('global_activity_queue')
      .select('id, completed_items, failed_items, error_log')
      .eq('operation_type', operationType)
      .eq('status', 'running')
      .limit(1)
      .maybeSingle();

    if (!item) return; // No tracked operation — minor op or not yet integrated

    const updates: Record<string, unknown> = {};
    if (update.completedDelta) {
      updates.completed_items = (item.completed_items || 0) + update.completedDelta;
    }
    if (update.failedDelta) {
      updates.failed_items = (item.failed_items || 0) + update.failedDelta;
    }
    if (update.errorEntry) {
      const log = Array.isArray(item.error_log) ? item.error_log : [];
      log.push({ ...update.errorEntry, timestamp: new Date().toISOString() });
      updates.error_log = log;
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('global_activity_queue')
        .update(updates)
        .eq('id', item.id);
    }
  } catch (err) {
    // Non-blocking — don't let global queue tracking break the actual processing
    console.warn('[global-activity-queue] Failed to update progress:', err);
  }
}

/**
 * Auto-recover stale "running" operations with 0 progress after 10 minutes.
 * Prevents platform-wide deadlocks when queue items fail to insert.
 */
export async function recoverStaleOperations(
  supabase: SupabaseClient,
): Promise<number> {
  try {
    const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

    const { data: stale } = await supabase
      .from('global_activity_queue')
      .select('id, operation_type, started_at, created_at, error_log')
      .eq('status', 'running')
      .eq('completed_items', 0)
      .lt('started_at', cutoff);

    if (!stale || stale.length === 0) return 0;

    for (const item of stale) {
      const log = Array.isArray(item.error_log) ? item.error_log : [];
      log.push(`Auto-failed by server: 0 items completed, stale since ${item.started_at}`);
      await supabase
        .from('global_activity_queue')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_log: log,
        })
        .eq('id', item.id);
      console.log(`[global-activity-queue] Auto-failed stale operation: ${item.operation_type} (${item.id})`);
    }

    // After clearing stale ops, drain any queued work
    await drainNextQueuedOperation(supabase);
    return stale.length;
  } catch (err) {
    console.warn('[global-activity-queue] Failed to recover stale operations:', err);
    return 0;
  }
}

/**
 * Mark the running operation for this type as completed.
 * Then check if there's a queued operation to auto-start next.
 */
export async function completeGlobalQueueOperation(
  supabase: SupabaseClient,
  operationType: OperationType,
  finalStatus: 'completed' | 'failed' = 'completed'
): Promise<void> {
  try {
    // Also recover any stale operations from other types
    await recoverStaleOperations(supabase);

    // Complete the current operation
    const { data: completed } = await supabase
      .from('global_activity_queue')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
      })
      .eq('operation_type', operationType)
      .eq('status', 'running')
      .select('id')
      .maybeSingle();

    if (!completed) return;

    console.log(`[global-activity-queue] Marked ${operationType} as ${finalStatus}`);

    // DRAIN: Check if there's a queued major operation to auto-start
    await drainNextQueuedOperation(supabase);
  } catch (err) {
    console.warn('[global-activity-queue] Failed to complete operation:', err);
  }
}

/**
 * Check if the current operation is paused (user clicked Pause).
 * Queue processors should call this between items and skip processing if paused.
 */
export async function isOperationPaused(
  supabase: SupabaseClient,
  operationType: OperationType,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('global_activity_queue')
      .select('id')
      .eq('operation_type', operationType)
      .eq('status', 'paused')
      .limit(1)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Drain: Find the next queued MAJOR operation and mark it as 'running'.
 * The queue processor for that type will pick it up on the next cron invocation,
 * or we can invoke it directly via fetch.
 */
async function drainNextQueuedOperation(supabase: SupabaseClient): Promise<void> {
  const { data: nextOp } = await supabase
    .from('global_activity_queue')
    .select('id, operation_type, context_json')
    .eq('status', 'queued')
    .eq('classification', 'major')
    .order('queued_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextOp) {
    console.log('[global-activity-queue] No queued operations to drain');
    return;
  }

  // Mark it as running — the cron/poller for that processor type will see it
  await supabase
    .from('global_activity_queue')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .eq('id', nextOp.id);

  console.log(`[global-activity-queue] Auto-started queued operation: ${nextOp.operation_type} (${nextOp.id})`);

  // Try to invoke the appropriate processor edge function to kick it off immediately
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (supabaseUrl && supabaseAnonKey) {
    const processorMap: Record<string, string> = {
      deal_enrichment: 'process-enrichment-queue',
      buyer_enrichment: 'process-buyer-enrichment-queue',
      guide_generation: 'process-ma-guide-queue',
      buyer_scoring: 'score-buyer-deal',
    };
    const functionName = processorMap[nextOp.operation_type];
    if (functionName) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fromGlobalQueue: true, globalQueueId: nextOp.id, ...nextOp.context_json }),
          signal: AbortSignal.timeout(5000), // Fire-and-forget, don't wait
        }).catch(() => {}); // Swallow — processor will be invoked by cron anyway
      } catch {
        // Non-blocking
      }
    }
  }
}
