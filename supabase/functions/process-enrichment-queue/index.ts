import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const BATCH_SIZE = 5; // Process up to 5 items per run
const MAX_ATTEMPTS = 3; // Maximum retry attempts
const PROCESSING_TIMEOUT_MS = 120000; // 2 minutes per item

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
        // Call enrich-deal function with both Authorization and apikey headers
        // The service role key works as both a JWT bearer token and an API key
        const enrichResponse = await fetch(`${supabaseUrl}/functions/v1/enrich-deal`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dealId: item.listing_id }),
          signal: AbortSignal.timeout(PROCESSING_TIMEOUT_MS),
        });

        const enrichResult = await enrichResponse.json();

        if (enrichResponse.ok && enrichResult.success) {
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

          console.log(`Successfully enriched listing ${item.listing_id}: ${enrichResult.fieldsUpdated?.length || 0} fields updated`);
          results.succeeded++;
        } else {
          // Failed - update with error
          const errorMsg = enrichResult.error || `HTTP ${enrichResponse.status}`;

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
