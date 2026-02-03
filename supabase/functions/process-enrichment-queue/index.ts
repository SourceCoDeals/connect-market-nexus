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

    // Fetch pending queue items (oldest first, respecting max attempts)
    const { data: queueItems, error: fetchError } = await supabase
      .from('enrichment_queue')
      .select(`
        id,
        listing_id,
        status,
        attempts,
        queued_at
      `)
      .eq('status', 'pending')
      .lt('attempts', MAX_ATTEMPTS)
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Error fetching queue items:', fetchError);
      throw fetchError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending enrichment items in queue');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending items', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${queueItems.length} pending items to process`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each item sequentially to avoid overwhelming external APIs
    for (const item of queueItems) {
      console.log(`Processing queue item ${item.id} for listing ${item.listing_id} (attempt ${item.attempts + 1})`);

      // Mark as processing
      await supabase
        .from('enrichment_queue')
        .update({
          status: 'processing',
          attempts: item.attempts + 1,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      try {
        // Call enrich-deal function
        const enrichResponse = await fetch(`${supabaseUrl}/functions/v1/enrich-deal`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dealId: item.listing_id }),
          signal: AbortSignal.timeout(PROCESSING_TIMEOUT_MS),
        });

        const enrichResult = await enrichResponse.json();

        if (enrichResponse.ok && enrichResult.success) {
          // Success - mark as completed
          await supabase
            .from('enrichment_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          console.log(`Successfully enriched listing ${item.listing_id}: ${enrichResult.fieldsUpdated?.length || 0} fields updated`);
          results.succeeded++;
        } else {
          // Failed - update with error
          const errorMsg = enrichResult.error || `HTTP ${enrichResponse.status}`;
          
          // Check if max attempts reached
          const newStatus = item.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending';
          
          await supabase
            .from('enrichment_queue')
            .update({
              status: newStatus,
              last_error: errorMsg,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          console.error(`Enrichment failed for listing ${item.listing_id}: ${errorMsg}`);
          results.failed++;
          results.errors.push(`${item.listing_id}: ${errorMsg}`);
        }
      } catch (error) {
        // Network/timeout error
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const newStatus = item.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending';
        
        await supabase
          .from('enrichment_queue')
          .update({
            status: newStatus,
            last_error: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

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
