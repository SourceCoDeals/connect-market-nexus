import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { updateGlobalQueueProgress, completeGlobalQueueOperation, isOperationPaused, recoverStaleOperations } from "../_shared/global-activity-queue.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

// Configuration
const MAX_ATTEMPTS = 3;
const PROCESSING_TIMEOUT_MS = 180000; // 3 minutes per buyer
const RATE_LIMIT_BACKOFF_MS = 60000; // 60s backoff on rate limit
const STALE_PROCESSING_MINUTES = 5; // Recovery timeout for stuck items
const MAX_FUNCTION_RUNTIME_MS = 140000; // 140s — stop looping before Deno 150s timeout
const INTER_BUYER_DELAY_MS = 1000; // 1s breathing room between buyers

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

    // LOOP: Process buyers continuously until queue is empty or time runs out
    const functionStartTime = Date.now();
    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    let totalRateLimited = 0;

    while (true) {
      // Time guard: stop before Deno's execution limit
      if (Date.now() - functionStartTime > MAX_FUNCTION_RUNTIME_MS) {
        console.log(`Time limit reached after ${totalProcessed} buyers, will continue on next invocation`);
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
        console.log(`No more pending items. Processed ${totalProcessed} buyers this run.`);
        await completeGlobalQueueOperation(supabase, 'buyer_enrichment');
        break;
      }

      const item = queueItems[0];
      console.log(`Processing buyer ${item.buyer_id} (attempt ${item.attempts + 1}) [#${totalProcessed + 1} this run]`);

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
          console.log(`Rate limited at buyer ${item.buyer_id}, stopping loop`);
          totalRateLimited++;
          totalProcessed++;
          break; // Stop processing on rate limit
        }

        if (!response.ok || !data.success) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

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
        }
        
        await updateGlobalQueueProgress(supabase, 'buyer_enrichment', { completedDelta: 1 });
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
        totalFailed++;
      }

      totalProcessed++;

      // Brief delay between buyers to avoid overwhelming APIs
      if (Date.now() - functionStartTime < MAX_FUNCTION_RUNTIME_MS) {
        await new Promise(r => setTimeout(r, INTER_BUYER_DELAY_MS));
      }
    }

    // If we processed some but queue isn't empty, trigger another invocation
    const { count: remaining } = await supabase
      .from('buyer_enrichment_queue')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending']);

    if (remaining && remaining > 0) {
      console.log(`${remaining} buyers still pending, triggering next batch...`);
      // Fire-and-forget next invocation
      fetch(`${supabaseUrl}/functions/v1/process-buyer-enrichment-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ continuation: true }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ success: true, processed: totalProcessed, succeeded: totalSucceeded, failed: totalFailed, rateLimited: totalRateLimited, remaining: remaining || 0 }),
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
