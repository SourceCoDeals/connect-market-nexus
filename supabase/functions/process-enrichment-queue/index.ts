import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runListingEnrichmentPipeline } from "./enrichmentPipeline.ts";
import { updateGlobalQueueProgress, completeGlobalQueueOperation, isOperationPaused } from "../_shared/global-activity-queue.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { checkProviderAvailability } from "../_shared/rate-limiter.ts";

// Configuration - RELIABILITY-FIRST
// Moderate parallelism to avoid rate limits across concurrent queue processors.
// Each deal enrichment makes 1 Firecrawl + 1 Gemini + optional LinkedIn/Google calls.
const BATCH_SIZE = 10; // Fetch 10 items per run
const CONCURRENCY_LIMIT = 5; // Process 5 items in parallel (LinkedIn/Google removed — only enrich-deal now)
const MAX_ATTEMPTS = 3; // Maximum retry attempts
const PROCESSING_TIMEOUT_MS = 90000; // 90 seconds per item
const INTER_CHUNK_DELAY_MS = 1000; // 1s between parallel chunks

// Stop early to avoid the platform killing the function mid-item.
const MAX_FUNCTION_RUNTIME_MS = 140000; // ~140s

// Helper to chunk array into smaller arrays
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const startedAt = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role for background processing
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing enrichment queue (PARALLEL MODE)...');

    // Recovery: reset any items that were left in `processing` due to timeouts/crashes.
    // This prevents the UI from showing a stuck "processing" count forever.
    const staleCutoffIso = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min
    const { error: staleResetError } = await supabase
      .from('enrichment_queue')
      .update({
        status: 'pending',
        started_at: null,
        updated_at: new Date().toISOString(),
        last_error: 'Recovered from stale processing state',
      })
      .eq('status', 'processing')
      .lt('started_at', staleCutoffIso);

    if (staleResetError) {
      console.warn('Failed to reset stale processing items:', staleResetError);
    }

    // Use RPC to atomically claim items (prevents race conditions)
    const { data: claimedItems, error: claimError } = await supabase.rpc(
      'claim_enrichment_queue_items',
      { batch_size: BATCH_SIZE, max_attempts: MAX_ATTEMPTS }
    );

    // Define type for queue items
    type QueueItem = { id: string; listing_id: string; status: string; attempts: number; queued_at: string };
    
    // Fallback to regular query if RPC doesn't exist yet
    let queueItems: QueueItem[] = claimedItems as QueueItem[] || [];
    if (claimError?.code === 'PGRST202') {
      console.log('Using fallback queue fetch (RPC not available)');

      const { data: pendingItems, error: fetchError } = await supabase
        .from('enrichment_queue')
        .select(`id, listing_id, status, attempts, queued_at`)
        .eq('status', 'pending')
        .lt('attempts', MAX_ATTEMPTS)
        .order('queued_at', { ascending: true })
        .limit(BATCH_SIZE);

      if (fetchError) {
        console.error('Error fetching queue items:', fetchError);
        throw fetchError;
      }

      // Atomically claim these items to prevent race conditions with concurrent workers.
      // Mark them as 'processing' immediately; items that were already claimed by another
      // worker will fail the status='pending' check and be filtered out.
      if (pendingItems && pendingItems.length > 0) {
        const claimed: QueueItem[] = [];
        await Promise.all(pendingItems.map(async (item) => {
          const { data: updated } = await supabase
            .from('enrichment_queue')
            .update({
              status: 'processing',
              attempts: item.attempts + 1,
              started_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)
            .eq('status', 'pending') // Only succeeds if still pending (atomic check)
            .select('id, listing_id, status, attempts, queued_at')
            .maybeSingle();

          if (updated) {
            claimed.push(updated as QueueItem);
          }
        }));
        queueItems = claimed;
        console.log(`Fallback: claimed ${claimed.length} of ${pendingItems.length} items atomically`);
      } else {
        queueItems = [];
      }
    } else if (claimError) {
      console.error('Error claiming queue items:', claimError);
      throw claimError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending enrichment items in queue');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending items', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${queueItems.length} items to process`);

    // PRE-CHECK: Mark batch items as completed if their listings are FULLY enriched
    // (website AI + LinkedIn data + Google data). Deals with only enriched_at but missing
    // LinkedIn/Google still need to run through the pipeline to get external data.
    const listingIds = queueItems.map((item: { listing_id: string }) => item.listing_id);
    const { data: enrichedListings } = await supabase
      .from('listings')
      .select('id, enriched_at, linkedin_employee_count, linkedin_employee_range, google_review_count')
      .in('id', listingIds)
      .not('enriched_at', 'is', null);

    const alreadyFullyEnrichedIds = new Set(
      (enrichedListings || [])
        .filter(l =>
          l.enriched_at &&
          (l.linkedin_employee_count != null || l.linkedin_employee_range != null) &&
          l.google_review_count != null
        )
        .map(l => l.id)
    );
    const alreadyEnrichedIds = alreadyFullyEnrichedIds;
    
    if (alreadyEnrichedIds.size > 0) {
      console.log(`Found ${alreadyEnrichedIds.size} listings already enriched - marking queue items as completed`);
      
      const itemsToComplete = queueItems.filter((item: { listing_id: string }) => alreadyEnrichedIds.has(item.listing_id));
      await Promise.all(itemsToComplete.map((item: { id: string; listing_id: string }) =>
        supabase
          .from('enrichment_queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)
      ));
      
      queueItems = queueItems.filter((item: { listing_id: string }) => !alreadyEnrichedIds.has(item.listing_id));
      
      if (queueItems.length === 0) {
        console.log('All items were already enriched - nothing to process');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Synced ${alreadyEnrichedIds.size} already-enriched items to completed`, 
            processed: 0,
            synced: alreadyEnrichedIds.size 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process items in PARALLEL chunks with inter-chunk delays
    // Moderate parallelism (3 at a time) balances speed vs. API rate limit safety
    const chunks = chunkArray(queueItems, CONCURRENCY_LIMIT);
    let chunkIndex = 0;

    for (const chunk of chunks) {
      // Safety cutoff - check before each chunk
      if (Date.now() - startedAt > MAX_FUNCTION_RUNTIME_MS) {
        console.log('Stopping early to avoid function timeout');
        break;
      }

      // Check if operation was paused by user
      if (await isOperationPaused(supabase, 'deal_enrichment')) {
        console.log('Operation paused by user — stopping processing');
        break;
      }

      // Add delay between chunks to spread API load (not before first chunk)
      if (chunkIndex > 0 && INTER_CHUNK_DELAY_MS > 0) {
        // Check if Gemini is in cooldown before starting next chunk
        const availability = await checkProviderAvailability(supabase, 'gemini');
        if (!availability.ok && availability.retryAfterMs) {
          const cooldownWait = Math.min(availability.retryAfterMs, 30000);
          console.log(`Gemini in cooldown — waiting ${cooldownWait}ms before next chunk`);
          await new Promise(r => setTimeout(r, cooldownWait));
        } else {
          console.log(`Waiting ${INTER_CHUNK_DELAY_MS}ms between chunks to avoid rate limits...`);
          await new Promise(r => setTimeout(r, INTER_CHUNK_DELAY_MS));
        }
      }
      chunkIndex++;

      console.log(`Processing chunk of ${chunk.length} items in parallel...`);

      // Items are already marked as 'processing' by either:
      // - The RPC claim_enrichment_queue_items call
      // - The fallback atomic claim loop above
      // No additional status update needed here.

      // Process entire chunk in parallel
      const chunkResults = await Promise.allSettled(
        chunk.map(async (item: { id: string; listing_id: string; attempts: number }) => {
          try {
            console.log(`Processing queue item ${item.id} for listing ${item.listing_id}`);

            // Fetch listing context
            const { data: listing, error: listingError } = await supabase
              .from('listings')
              .select('internal_company_name, title, address_city, address_state, address, linkedin_url, website')
              .eq('id', item.listing_id)
              .single();

            if (listingError || !listing) {
              throw new Error(`Failed to fetch listing context: ${listingError?.message || 'not found'}`);
            }

            const pipeline = await runListingEnrichmentPipeline(
              {
                supabaseUrl,
                serviceRoleKey: supabaseServiceKey,
                listingId: item.listing_id,
                timeoutMs: PROCESSING_TIMEOUT_MS,
              },
              listing
            );

            return { item, pipeline };
          } catch (error) {
            // Re-throw with item context so the allSettled rejected branch can still update the row.
            throw { item, error };
          }
        })
      );

      // Process results from this chunk
      for (const result of chunkResults) {
        results.processed++;

        if (result.status === 'fulfilled') {
          const { item, pipeline } = result.value;
          const currentAttempts = claimedItems ? item.attempts : item.attempts + 1;

          if (pipeline.ok) {
            // Success
            await supabase
              .from('enrichment_queue')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                last_error: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id);

            console.log(`Successfully enriched listing ${item.listing_id}: ${pipeline.fieldsUpdated.length} fields`);
            results.succeeded++;
            await updateGlobalQueueProgress(supabase, 'deal_enrichment', { completedDelta: 1 });
          } else {
            // Pipeline error
            const newStatus = currentAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
            await supabase
              .from('enrichment_queue')
              .update({
                status: newStatus,
                last_error: pipeline.error,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id);

            console.error(`Enrichment failed for listing ${item.listing_id}: ${pipeline.error}`);
            results.failed++;
            results.errors.push(`${item.listing_id}: ${pipeline.error}`);
            await updateGlobalQueueProgress(supabase, 'deal_enrichment', {
              failedDelta: 1,
              errorEntry: { itemId: item.listing_id, error: pipeline.error || 'Unknown error' },
            });
          }
         } else {
           // Promise rejected - network/timeout/uncaught error.
           // IMPORTANT: still update the queue row so it doesn't get stuck in `processing`.
           const reason = result.reason as any;
           const item = reason?.item as { id: string; listing_id: string; attempts: number } | undefined;
           const underlying = reason?.error;

           const errorMsg =
             underlying instanceof Error
               ? underlying.message
               : typeof underlying === 'string'
                 ? underlying
                 : (result.reason instanceof Error ? result.reason.message : 'Unknown error');

           console.error('Processing error:', result.reason);

           if (item?.id) {
             const currentAttempts = claimedItems ? item.attempts : item.attempts + 1;
             const newStatus = currentAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
             await supabase
               .from('enrichment_queue')
               .update({
                 status: newStatus,
                 last_error: `worker_error: ${errorMsg}`,
                 // Clear started_at so it can be re-claimed
                 started_at: null,
                 updated_at: new Date().toISOString(),
               })
               .eq('id', item.id);

             results.errors.push(`${item.listing_id}: ${errorMsg}`);
           } else {
             results.errors.push(`chunk item: ${errorMsg}`);
           }

           results.failed++;
           await updateGlobalQueueProgress(supabase, 'deal_enrichment', {
             failedDelta: 1,
             errorEntry: { itemId: item?.listing_id || 'unknown', error: errorMsg },
           });
         }
      }
    }

    console.log(`Queue processing complete: ${results.succeeded} succeeded, ${results.failed} failed out of ${results.processed} processed`);

    // Check if all items in the enrichment_queue are done (no more pending)
    const { count: remainingPending } = await supabase
      .from('enrichment_queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'processing']);

    if (remainingPending === 0) {
      await completeGlobalQueueOperation(supabase, 'deal_enrichment');
    } else if ((remainingPending ?? 0) > 0 && Date.now() - startedAt < MAX_FUNCTION_RUNTIME_MS - 5000) {
      // Fire-and-forget self-invocation to keep processing remaining items
      // without waiting for a 5-minute cron cycle
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (anonKey) {
        console.log(`${remainingPending} items remaining — invoking next batch`);
        fetch(`${supabaseUrl}/functions/v1/process-enrichment-queue`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ continuation: true }),
        }).catch((err) => console.warn('Self-invocation failed (cron will retry):', err));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} items (parallel mode)`,
        remaining: remainingPending ?? 0,
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-enrichment-queue:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
