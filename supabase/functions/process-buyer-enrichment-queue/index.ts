import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { updateGlobalQueueProgress, completeGlobalQueueOperation, isOperationPaused, recoverStaleOperations } from "../_shared/global-activity-queue.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

// Configuration
// Self-looping: process buyers back-to-back within a single invocation,
// up to MAX_BUYERS_PER_INVOCATION or INVOCATION_BUDGET_MS, whichever comes first.
const MAX_BUYERS_PER_INVOCATION = 8;       // Process up to 8 buyers per invocation
const INVOCATION_BUDGET_MS = 140_000;      // Stop picking up new items at 140s (Deno limit ~150s)
const PROCESSING_TIMEOUT_MS = 120_000;     // 2 min timeout per individual buyer
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_BACKOFF_MS = 60_000;
const STALE_PROCESSING_MINUTES = 5;
const INTER_BUYER_DELAY_MS = 500;          // Small breathing room between buyers

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const invocationStart = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing buyer enrichment queue (self-looping)...');

    // Auto-recover any stale global operations (prevents deadlocks)
    const recovered = await recoverStaleOperations(supabase);
    if (recovered > 0) {
      console.log(`Recovered ${recovered} stale global operations`);
    }

    // Recovery: reset stale processing items (stuck for 5+ minutes)
    const staleCutoffIso = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000).toISOString();
    const { data: staleItems } = await supabase
      .from('buyer_enrichment_queue')
      .update({
        status: 'pending',
        started_at: null,
        updated_at: new Date().toISOString(),
        last_error: 'Recovered from stale processing state',
      })
      .eq('status', 'processing')
      .lt('started_at', staleCutoffIso)
      .select('id');

    if (staleItems && staleItems.length > 0) {
      console.log(`Recovered ${staleItems.length} stale processing items`);
    }

    // GUARD: If anything is currently processing (and not stale), skip this run.
    // Another invocation is already self-looping.
    const { data: activeItems } = await supabase
      .from('buyer_enrichment_queue')
      .select('id')
      .eq('status', 'processing')
      .limit(1);

    if (activeItems && activeItems.length > 0) {
      console.log('Another processor is active, skipping this run');
      return new Response(
        JSON.stringify({ success: true, message: 'Skipped - another processor active', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resume rate-limited items whose reset time has passed
    const now = new Date().toISOString();
    await supabase
      .from('buyer_enrichment_queue')
      .update({
        status: 'pending',
        rate_limit_reset_at: null,
        updated_at: now,
      })
      .eq('status', 'rate_limited')
      .lt('rate_limit_reset_at', now);

    // Mark items that have exhausted attempts as failed
    const { data: exhaustedItems } = await supabase
      .from('buyer_enrichment_queue')
      .update({
        status: 'failed',
        last_error: 'Max attempts reached',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'pending')
      .gte('attempts', MAX_ATTEMPTS)
      .select('id');

    if (exhaustedItems && exhaustedItems.length > 0) {
      console.log(`Marked ${exhaustedItems.length} exhausted items as failed`);
    }

    // =========================================================================
    // SELF-LOOPING: Process buyers back-to-back until budget exhausted
    // =========================================================================

    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    let rateLimitHit = false;

    for (let i = 0; i < MAX_BUYERS_PER_INVOCATION; i++) {
      // Budget check: stop if we don't have enough time for another buyer
      const elapsed = Date.now() - invocationStart;
      if (elapsed > INVOCATION_BUDGET_MS) {
        console.log(`Budget exhausted (${elapsed}ms), stopping after ${totalProcessed} buyers`);
        break;
      }

      // Check if operation was paused by user
      if (await isOperationPaused(supabase, 'buyer_enrichment')) {
        console.log('Buyer enrichment paused by user — stopping');
        break;
      }

      // Fetch next pending item
      const { data: queueItems, error: fetchError } = await supabase
        .from('buyer_enrichment_queue')
        .select('id, buyer_id, universe_id, status, attempts, queued_at')
        .eq('status', 'pending')
        .lt('attempts', MAX_ATTEMPTS)
        .order('queued_at', { ascending: true })
        .limit(1);

      if (fetchError) {
        console.error('Error fetching queue items:', fetchError);
        break;
      }

      if (!queueItems || queueItems.length === 0) {
        console.log('No more pending items in queue');
        // All done — complete the global queue operation
        await completeGlobalQueueOperation(supabase, 'buyer_enrichment');
        break;
      }

      const item = queueItems[0];
      console.log(`[${i + 1}/${MAX_BUYERS_PER_INVOCATION}] Processing buyer ${item.buyer_id} (attempt ${item.attempts + 1})`);

      // Mark as processing
      await supabase
        .from('buyer_enrichment_queue')
        .update({
          status: 'processing',
          attempts: item.attempts + 1,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .eq('status', 'pending');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PROCESSING_TIMEOUT_MS);

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/enrich-buyer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ buyerId: item.buyer_id, skipLock: true }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await response.json().catch(() => ({}));

        if (response.status === 429 || data.error_code === 'rate_limited') {
          const resetAt = data.resetTime || new Date(Date.now() + RATE_LIMIT_BACKOFF_MS).toISOString();

          await supabase
            .from('buyer_enrichment_queue')
            .update({
              status: 'rate_limited',
              rate_limit_reset_at: resetAt,
              last_error: 'Rate limited - will retry after reset',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          console.log(`Buyer ${item.buyer_id} rate limited, stopping loop to cool down`);
          rateLimitHit = true;
          totalProcessed++;
          break; // Stop processing more buyers — wait for rate limit to clear
        }

        if (!response.ok || !data.success) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        // Check for partial enrichment
        const wasPartial = data.extractionDetails?.rateLimited === true;

        if (wasPartial && item.attempts < MAX_ATTEMPTS - 1) {
          await supabase
            .from('buyer_enrichment_queue')
            .update({
              status: 'pending',
              started_at: null,
              last_error: `Partial: ${data.extractionDetails?.promptsSuccessful}/${data.extractionDetails?.promptsRun} prompts completed`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          console.log(`Buyer ${item.buyer_id} partially enriched, re-queued`);
        } else {
          await supabase
            .from('buyer_enrichment_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              last_error: wasPartial ? `Partial: ${data.extractionDetails?.promptsSuccessful}/${data.extractionDetails?.promptsRun} prompts` : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          console.log(`Successfully enriched buyer ${item.buyer_id}: ${data.fieldsUpdated} fields`);
        }

        await updateGlobalQueueProgress(supabase, 'buyer_enrichment', { completedDelta: 1 });
        totalProcessed++;
        totalSucceeded++;

      } catch (error) {
        clearTimeout(timeoutId);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const currentAttempts = item.attempts + 1;
        const newStatus = currentAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';

        await supabase
          .from('buyer_enrichment_queue')
          .update({
            status: newStatus,
            last_error: errorMsg,
            started_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        console.error(`Failed to enrich buyer ${item.buyer_id}:`, errorMsg);
        await updateGlobalQueueProgress(supabase, 'buyer_enrichment', {
          failedDelta: 1,
          errorEntry: { itemId: item.buyer_id, error: errorMsg },
        });
        totalProcessed++;
        totalFailed++;
      }

      // Small delay between buyers to avoid hammering APIs
      if (i < MAX_BUYERS_PER_INVOCATION - 1) {
        await new Promise(r => setTimeout(r, INTER_BUYER_DELAY_MS));
      }
    }

    const elapsed = Date.now() - invocationStart;
    console.log(`Processed ${totalProcessed} buyers in ${(elapsed / 1000).toFixed(1)}s (${totalSucceeded} ok, ${totalFailed} failed${rateLimitHit ? ', rate limited' : ''})`);

    // Self-chain: if there are likely more items, trigger ourselves again
    // This ensures continuous processing without waiting for the frontend 45s interval
    if (totalProcessed > 0 && !rateLimitHit) {
      const { count } = await supabase
        .from('buyer_enrichment_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('attempts', MAX_ATTEMPTS);

      if ((count || 0) > 0) {
        console.log(`${count} items remaining — self-chaining next invocation`);
        // Fire-and-forget: trigger ourselves after a small delay
        setTimeout(() => {
          fetch(`${supabaseUrl}/functions/v1/process-buyer-enrichment-queue`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ selfChained: true }),
          }).catch(err => {
            console.log('Self-chain trigger failed, frontend interval will handle:', err.message);
          });
        }, 1000);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        succeeded: totalSucceeded,
        failed: totalFailed,
        rateLimited: rateLimitHit,
        elapsedMs: elapsed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-buyer-enrichment-queue:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
