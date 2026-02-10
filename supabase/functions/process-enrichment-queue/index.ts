import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runListingEnrichmentPipeline } from "./enrichmentPipeline.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration - OPTIMIZED FOR SPEED
// Process items in PARALLEL batches instead of sequential
const BATCH_SIZE = 10; // Fetch 10 items per run
const CONCURRENCY_LIMIT = 5; // Process 5 items in parallel at once
const MAX_ATTEMPTS = 3; // Maximum retry attempts
const PROCESSING_TIMEOUT_MS = 90000; // 90 seconds per item

// Stop early to avoid the platform killing the function mid-item.
const MAX_FUNCTION_RUNTIME_MS = 110000; // ~110s

// Helper to chunk array into smaller arrays
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

      queueItems = pendingItems;
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

    // PRE-CHECK: Mark items as completed if their listings are already enriched
    // Also sweep ALL pending already-enriched items (not just this batch) to prevent stuck queues
    const { data: allPendingEnriched } = await supabase
      .from('enrichment_queue')
      .select('id, listing_id')
      .eq('status', 'pending')
      .limit(500);

    let extraSynced = 0;
    if (allPendingEnriched && allPendingEnriched.length > 0) {
      const allPendingListingIds = allPendingEnriched.map(i => i.listing_id);
      const { data: enrichedCheck } = await supabase
        .from('listings')
        .select('id')
        .in('id', allPendingListingIds)
        .not('enriched_at', 'is', null);

      const enrichedSet = new Set(enrichedCheck?.map(l => l.id) || []);
      const toComplete = allPendingEnriched.filter(i => enrichedSet.has(i.listing_id));

      if (toComplete.length > 0) {
        await Promise.all(toComplete.map(item =>
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
        extraSynced = toComplete.length;
        console.log(`Pre-check: synced ${extraSynced} already-enriched items to completed`);

        // Remove synced items from current batch
        const completedIds = new Set(toComplete.map(i => i.id));
        queueItems = queueItems.filter((item: { id: string }) => !completedIds.has(item.id));

        if (queueItems.length === 0) {
          console.log('All items were already enriched - nothing to process');
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `Synced ${extraSynced} already-enriched items to completed`, 
              processed: 0,
              synced: extraSynced 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const listingIds = queueItems.map((item: { listing_id: string }) => item.listing_id);
    const { data: enrichedListings } = await supabase
      .from('listings')
      .select('id, enriched_at')
      .in('id', listingIds)
      .not('enriched_at', 'is', null);

    const alreadyEnrichedIds = new Set(enrichedListings?.map(l => l.id) || []);
    
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

    // Process items in PARALLEL chunks (not sequential!)
    // This is the key performance improvement: 5 items at once instead of 1
    const chunks = chunkArray(queueItems, CONCURRENCY_LIMIT);
    
    for (const chunk of chunks) {
      // Safety cutoff - check before each chunk
      if (Date.now() - startedAt > MAX_FUNCTION_RUNTIME_MS) {
        console.log('Stopping early to avoid function timeout');
        break;
      }

      console.log(`Processing chunk of ${chunk.length} items in parallel...`);

      // Mark all items in chunk as processing (if not already claimed via RPC)
      if (!claimedItems) {
        await Promise.all(chunk.map((item: { id: string; attempts: number }) =>
          supabase
            .from('enrichment_queue')
            .update({
              status: 'processing',
              attempts: item.attempts + 1,
              started_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)
            .eq('status', 'pending')
        ));
      }

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
         }
      }
    }

    console.log(`Queue processing complete: ${results.succeeded} succeeded, ${results.failed} failed out of ${results.processed} processed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} items (parallel mode)`,
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
