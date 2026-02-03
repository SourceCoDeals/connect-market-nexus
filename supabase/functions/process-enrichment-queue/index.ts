import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runListingEnrichmentPipeline } from "./enrichmentPipeline.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
// IMPORTANT: This function is often triggered via cron (every 5 min) AND can be triggered manually from the UI.
// Keep each run small enough to complete within edge function runtime limits.
const BATCH_SIZE = 1; // Process a small number of items per run to avoid timeouts
const MAX_ATTEMPTS = 3; // Maximum retry attempts
const PROCESSING_TIMEOUT_MS = 90000; // 90 seconds per item

// Stop early to avoid the platform killing the function mid-item.
const MAX_FUNCTION_RUNTIME_MS = 110000; // ~110s

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

    console.log('Processing enrichment queue...');

    // Use RPC to atomically claim items (prevents race conditions)
    // This updates status to 'processing' and returns the items in one atomic operation
    const { data: claimedItems, error: claimError } = await supabase.rpc(
      'claim_enrichment_queue_items',
      { batch_size: BATCH_SIZE, max_attempts: MAX_ATTEMPTS }
    );

    // Fallback to regular query if RPC doesn't exist yet
    let queueItems = claimedItems;
    if (claimError?.code === 'PGRST202') {
      // RPC doesn't exist, use regular query with immediate status update
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
    // This handles the case where enrichment succeeded but queue status wasn't updated
    const listingIds = queueItems.map((item: { listing_id: string }) => item.listing_id);
    const { data: enrichedListings } = await supabase
      .from('listings')
      .select('id, enriched_at')
      .in('id', listingIds)
      .not('enriched_at', 'is', null);

    const alreadyEnrichedIds = new Set(enrichedListings?.map(l => l.id) || []);
    
    if (alreadyEnrichedIds.size > 0) {
      console.log(`Found ${alreadyEnrichedIds.size} listings already enriched - marking queue items as completed`);
      
      // Mark these queue items as completed
      const itemsToComplete = queueItems.filter((item: { listing_id: string }) => alreadyEnrichedIds.has(item.listing_id));
      for (const item of itemsToComplete) {
        await supabase
          .from('enrichment_queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);
        console.log(`Synced queue item ${item.id} to completed (listing ${item.listing_id} was already enriched)`);
      }
      
      // Filter out already-completed items from processing
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

    // Process each item sequentially to avoid overwhelming external APIs
    for (const item of queueItems) {
      // Safety cutoff
      if (Date.now() - startedAt > MAX_FUNCTION_RUNTIME_MS) {
        console.log('Stopping early to avoid function timeout');
        break;
      }

      console.log(`Processing queue item ${item.id} for listing ${item.listing_id} (attempt ${item.attempts + 1})`);

      // Mark as processing (skip if already claimed via RPC)
      if (!claimedItems) {
        const { error: markError } = await supabase
          .from('enrichment_queue')
          .update({
            status: 'processing',
            attempts: item.attempts + 1,
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)
          .eq('status', 'pending'); // Only update if still pending (prevents race)

        if (markError) {
          console.warn(`Failed to mark item ${item.id} as processing:`, markError);
          continue; // Skip this item, likely picked up by another worker
        }
      }

      try {
        // Fetch listing context needed for downstream enrichment steps
        const { data: listing, error: listingError } = await supabase
          .from('listings')
          .select('internal_company_name, title, address_city, address_state, address, linkedin_url')
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

        if (pipeline.ok) {
          // Success - mark as completed
          const { error: completeError } = await supabase
            .from('enrichment_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          if (completeError) {
            console.error(`Failed to mark item ${item.id} as completed:`, completeError);
          }

          console.log(
            `Successfully enriched listing ${item.listing_id}: ${pipeline.fieldsUpdated.length} fields updated (${pipeline.fieldsUpdated.join(', ')})`
          );
          results.succeeded++;
        } else {
          const errorMsg = pipeline.error;

          // Check if max attempts reached
          const currentAttempts = claimedItems ? item.attempts : item.attempts + 1;
          const newStatus = currentAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';

          const { error: failError } = await supabase
            .from('enrichment_queue')
            .update({
              status: newStatus,
              last_error: errorMsg,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          if (failError) {
            console.error(`Failed to update item ${item.id} status:`, failError);
          }

          console.error(`Enrichment failed for listing ${item.listing_id}: ${errorMsg}`);
          results.failed++;
          results.errors.push(`${item.listing_id}: ${errorMsg}`);
        }
      } catch (error) {
        // Network/timeout error
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const currentAttempts = claimedItems ? item.attempts : item.attempts + 1;
        const newStatus = currentAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';

        const { error: catchError } = await supabase
          .from('enrichment_queue')
          .update({
            status: newStatus,
            last_error: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        if (catchError) {
          console.error(`Failed to update item ${item.id} after error:`, catchError);
        }

        console.error(`Error processing ${item.listing_id}:`, error);
        results.failed++;
        results.errors.push(`${item.listing_id}: ${errorMsg}`);
      }

      results.processed++;

      // Small delay between items to be nice to external APIs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Queue processing complete: ${results.succeeded} succeeded, ${results.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} items`,
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
