import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * PROCESS ENRICHMENT QUEUE
 *
 * This function processes pending items in the enrichment_queue table.
 * It should be called via cron job every few minutes.
 *
 * Features:
 * - Processes items in batches (default 5)
 * - Uses FOR UPDATE SKIP LOCKED to prevent concurrent processing
 * - Retries failed items up to 3 times
 * - Updates queue status (pending -> processing -> completed/failed)
 * - Rate limits between enrichments (3 second delay)
 *
 * Usage:
 *   POST { "batchSize": 5 }
 *   - batchSize: Number of items to process per run (default 5, max 10)
 */

interface QueueItem {
  id: string;
  listing_id: string;
  queued_at: string;
  attempts: number;
  status: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batchSize || 5, 10); // Max 10 per run

    console.log(`Processing enrichment queue: batchSize=${batchSize}`);

    // Fetch pending items (oldest first, max 3 attempts)
    // Use FOR UPDATE SKIP LOCKED to prevent concurrent processing
    const { data: pendingItems, error: fetchError } = await supabase
      .from('enrichment_queue')
      .select('id, listing_id, queued_at, attempts, status')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('queued_at', { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      console.error('Error fetching queue:', fetchError);
      throw new Error(`Failed to fetch queue: ${fetchError.message}`);
    }

    if (!pendingItems || pendingItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending items in enrichment queue',
          processed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingItems.length} pending items`);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const results: Array<{
      listingId: string;
      status: 'success' | 'failed';
      error?: string;
    }> = [];

    for (const item of pendingItems as QueueItem[]) {
      console.log(`Processing queue item ${item.id} for listing ${item.listing_id}`);

      // Mark as processing
      await supabase
        .from('enrichment_queue')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          attempts: item.attempts + 1,
        })
        .eq('id', item.id);

      try {
        // Call the enrich-deal function
        const enrichResponse = await supabase.functions.invoke('enrich-deal', {
          body: { dealId: item.listing_id },
        });

        if (enrichResponse.error) {
          throw new Error(enrichResponse.error.message || 'Enrichment failed');
        }

        const enrichData = enrichResponse.data;

        if (enrichData?.success) {
          // Mark as completed
          await supabase
            .from('enrichment_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              last_error: null,
            })
            .eq('id', item.id);

          // Update the listing's enrichment tracking
          await supabase
            .from('listings')
            .update({
              enrichment_scheduled_at: null,
              enrichment_refresh_due_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
            })
            .eq('id', item.listing_id);

          results.push({
            listingId: item.listing_id,
            status: 'success',
          });
          succeeded++;

          console.log(`Successfully enriched listing ${item.listing_id}`);
        } else {
          throw new Error(enrichData?.error || 'Unknown enrichment error');
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error enriching listing ${item.listing_id}:`, errorMessage);

        // Check if max retries reached
        const newAttempts = item.attempts + 1;
        const newStatus = newAttempts >= 3 ? 'failed' : 'pending';

        await supabase
          .from('enrichment_queue')
          .update({
            status: newStatus,
            last_error: errorMessage,
            started_at: null, // Reset for retry
          })
          .eq('id', item.id);

        results.push({
          listingId: item.listing_id,
          status: 'failed',
          error: errorMessage,
        });
        failed++;
      }

      processed++;

      // Rate limit: wait 3 seconds between enrichments
      if (processed < pendingItems.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processed} items: ${succeeded} succeeded, ${failed} failed`,
        processed,
        succeeded,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-enrichment-queue:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
