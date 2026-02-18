import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { updateGlobalQueueProgress, completeGlobalQueueOperation, isOperationPaused, recoverStaleOperations } from "../_shared/global-activity-queue.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { checkProviderAvailability, reportRateLimit, waitForProviderSlot } from "../_shared/rate-limiter.ts";
import { logEnrichmentEvent } from "../_shared/enrichment-events.ts";

// Configuration
const MAX_ATTEMPTS = 3;
const PROCESSING_TIMEOUT_MS = 180000; // 3 minutes per buyer
const RATE_LIMIT_BACKOFF_MS = 60000; // 60s backoff on rate limit
const STALE_PROCESSING_MINUTES = 5; // Recovery timeout for stuck items
const MAX_FUNCTION_RUNTIME_MS = 140000; // 140s — stop looping before Deno 150s timeout
const INTER_BUYER_DELAY_MS = 200; // 200ms breathing room between buyers

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

    // Create enrichment job for observability tracking (non-blocking on failure)
    let enrichmentJobId: string | null = null;
    try {
      // Get count of pending buyers for total_records
      const { count: pendingCount } = await supabase
        .from('buyer_enrichment_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('attempts', MAX_ATTEMPTS);

      const { data: jobData } = await supabase.rpc('upsert_enrichment_job', {
        p_job_type: 'buyer_enrichment',
        p_total_records: pendingCount || 0,
        p_source: 'scheduled',
      });
      enrichmentJobId = jobData;
      if (enrichmentJobId) console.log(`[enrichment-jobs] Created job ${enrichmentJobId}`);
    } catch (err) {
      console.warn('[enrichment-jobs] Failed to create job (non-blocking):', err);
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

      // Freshness check: skip re-enrichment if buyer data was updated within the stale window.
      // This prevents wasted API calls when stale recovery resets a buyer that already succeeded.
      const { data: buyerData } = await supabase
        .from('remarketing_buyers')
        .select('data_last_updated')
        .eq('id', item.buyer_id)
        .single();

      if (buyerData?.data_last_updated) {
        const lastUpdatedMs = new Date(buyerData.data_last_updated).getTime();
        const freshnessWindowMs = STALE_PROCESSING_MINUTES * 60 * 1000;
        if (Date.now() - lastUpdatedMs < freshnessWindowMs) {
          console.log(`Skipping buyer ${item.buyer_id} — data_last_updated is recent (${buyerData.data_last_updated}), marking completed`);
          await supabase
            .from('buyer_enrichment_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              last_error: 'Skipped: buyer data already fresh',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          totalProcessed++;
          totalSucceeded++;
          await updateGlobalQueueProgress(supabase, 'buyer_enrichment', { completedDelta: 1 });
          continue;
        }
      }

      // Check rate limiter before dispatching — wait if Gemini is in cooldown
      const availability = await checkProviderAvailability(supabase, 'gemini');
      if (!availability.ok) {
        const waitMs = availability.retryAfterMs || RATE_LIMIT_BACKOFF_MS;
        if (waitMs > 30000) {
          console.log(`Gemini rate limited for ${Math.round(waitMs / 1000)}s — stopping queue processing`);
          totalRateLimited++;
          break;
        }
        console.log(`Gemini rate limited — waiting ${Math.round(waitMs / 1000)}s before processing buyer`);
        await new Promise(r => setTimeout(r, waitMs));
      }

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
          // Report to shared rate limiter so other functions/invocations know
          await reportRateLimit(supabase, 'gemini', RATE_LIMIT_BACKOFF_MS / 1000);
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

          // Track rate limit in enrichment job
          if (enrichmentJobId) {
            supabase.rpc('update_enrichment_job_progress', {
              p_job_id: enrichmentJobId, p_rate_limited: true,
            }).catch(() => {});
          }
          logEnrichmentEvent(supabase, {
            entityType: 'buyer', entityId: item.buyer_id, provider: 'gemini',
            functionName: 'process-buyer-enrichment-queue', stepName: 'enrich-buyer',
            status: 'rate_limited', jobId: enrichmentJobId || undefined,
          });

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

        // Enrichment job progress (non-blocking)
        if (enrichmentJobId) {
          supabase.rpc('update_enrichment_job_progress', {
            p_job_id: enrichmentJobId, p_succeeded_delta: 1, p_last_processed_id: item.buyer_id,
          }).catch(() => {});
        }
        logEnrichmentEvent(supabase, {
          entityType: 'buyer', entityId: item.buyer_id, provider: 'pipeline',
          functionName: 'process-buyer-enrichment-queue', stepName: 'enrich-buyer',
          status: 'success', jobId: enrichmentJobId || undefined,
        });

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

        // Enrichment job progress (non-blocking)
        if (enrichmentJobId) {
          supabase.rpc('update_enrichment_job_progress', {
            p_job_id: enrichmentJobId, p_failed_delta: 1,
            p_last_processed_id: item.buyer_id, p_error_message: errorMsg,
          }).catch(() => {});
        }
        logEnrichmentEvent(supabase, {
          entityType: 'buyer', entityId: item.buyer_id, provider: 'pipeline',
          functionName: 'process-buyer-enrichment-queue', stepName: 'enrich-buyer',
          status: 'failure', errorMessage: errorMsg, jobId: enrichmentJobId || undefined,
        });
      }

      totalProcessed++;

      // Brief delay between buyers to avoid overwhelming APIs
      if (Date.now() - functionStartTime < MAX_FUNCTION_RUNTIME_MS) {
        await new Promise(r => setTimeout(r, INTER_BUYER_DELAY_MS));
      }
    }

    // Complete enrichment job (non-blocking)
    if (enrichmentJobId) {
      const jobStatus = totalRateLimited > 0 ? 'paused' : totalFailed > 0 ? 'failed' : 'completed';
      supabase.rpc('complete_enrichment_job', { p_job_id: enrichmentJobId, p_status: jobStatus }).catch(() => {});
    }

    // If we processed some but queue isn't empty, trigger another invocation.
    // When rate limited, schedule a DELAYED continuation after the cooldown period
    // instead of stopping entirely (which left the queue permanently stalled).
    const { count: remaining } = await supabase
      .from('buyer_enrichment_queue')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending']);

    // Also check for rate-limited items that will become pending soon
    const { count: rateLimitedRemaining } = await supabase
      .from('buyer_enrichment_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'rate_limited');

    const totalRemaining = (remaining || 0) + (rateLimitedRemaining || 0);

    if (totalRemaining > 0) {
      // Determine delay: if rate limited, wait for cooldown + jitter before continuing
      const continuationDelayMs = totalRateLimited > 0 ? RATE_LIMIT_BACKOFF_MS + Math.random() * 5000 : 0;

      if (continuationDelayMs > 0) {
        console.log(`${totalRemaining} buyers remaining (${rateLimitedRemaining} rate-limited). Scheduling continuation in ${Math.round(continuationDelayMs / 1000)}s...`);
      } else {
        console.log(`${remaining} buyers still pending, triggering next batch...`);
      }

      // Self-continuation with optional delay for rate-limit recovery.
      // Retry up to 3 times with exponential backoff if the trigger itself fails.
      const triggerContinuation = async () => {
        if (continuationDelayMs > 0) {
          await new Promise(r => setTimeout(r, continuationDelayMs));
        }
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/process-buyer-enrichment-queue`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ continuation: true }),
              signal: AbortSignal.timeout(30_000),
            });
            return; // success
          } catch (err) {
            console.warn(`Self-continuation trigger attempt ${attempt + 1} failed:`, err);
            if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          }
        }
        console.error('Self-continuation failed after 3 attempts — queue may stall. Items will recover on next manual trigger.');
      };
      triggerContinuation().catch(() => {});
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
