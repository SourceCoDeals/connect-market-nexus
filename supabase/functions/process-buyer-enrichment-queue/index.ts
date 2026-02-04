import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const BATCH_SIZE = 10;
const CONCURRENCY_LIMIT = 3; // Lower than deals since buyer enrichment is more intensive
const MAX_ATTEMPTS = 3;
const PROCESSING_TIMEOUT_MS = 120000; // 2 minutes per buyer
const MAX_FUNCTION_RUNTIME_MS = 110000; // ~110s safety cutoff
const RATE_LIMIT_BACKOFF_MS = 60000; // 1 minute backoff on rate limit

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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing buyer enrichment queue...');

    // Recovery: reset stale processing items (stuck for 10+ minutes)
    const staleCutoffIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase
      .from('buyer_enrichment_queue')
      .update({
        status: 'pending',
        started_at: null,
        updated_at: new Date().toISOString(),
        last_error: 'Recovered from stale processing state',
      })
      .eq('status', 'processing')
      .lt('started_at', staleCutoffIso);

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

    // Fetch pending items
    const { data: queueItems, error: fetchError } = await supabase
      .from('buyer_enrichment_queue')
      .select('id, buyer_id, universe_id, status, attempts, queued_at')
      .eq('status', 'pending')
      .lt('attempts', MAX_ATTEMPTS)
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Error fetching queue items:', fetchError);
      throw fetchError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending buyer enrichment items in queue');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending items', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${queueItems.length} buyers to process`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      rateLimited: 0,
      errors: [] as string[],
    };

    // Process in parallel chunks
    const chunks = chunkArray(queueItems, CONCURRENCY_LIMIT);
    let hitRateLimit = false;
    
    for (const chunk of chunks) {
      // Safety cutoff
      if (Date.now() - startedAt > MAX_FUNCTION_RUNTIME_MS) {
        console.log('Stopping early to avoid function timeout');
        break;
      }

      // Stop if we hit rate limit in previous chunk
      if (hitRateLimit) {
        console.log('Rate limit hit, marking remaining items for retry');
        break;
      }

      console.log(`Processing chunk of ${chunk.length} buyers in parallel...`);

      // Mark as processing
      await Promise.all(chunk.map((item) =>
        supabase
          .from('buyer_enrichment_queue')
          .update({
            status: 'processing',
            attempts: item.attempts + 1,
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)
          .eq('status', 'pending')
      ));

      // Process chunk in parallel
      const chunkResults = await Promise.allSettled(
        chunk.map(async (item) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), PROCESSING_TIMEOUT_MS);

          try {
            console.log(`Enriching buyer ${item.buyer_id}`);

            // Call the enrich-buyer function
            const response = await fetch(`${supabaseUrl}/functions/v1/enrich-buyer`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey,
              },
              body: JSON.stringify({ buyerId: item.buyer_id }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = await response.json().catch(() => ({}));

            if (response.status === 401) {
              console.error('enrich-buyer returned 401', {
                buyerId: item.buyer_id,
                bodyKeys: typeof data === 'object' && data ? Object.keys(data) : [],
                error: (data as any)?.error,
                success: (data as any)?.success,
              });
            }

            if (response.status === 429 || data.error_code === 'rate_limited') {
              return { item, rateLimited: true, resetTime: data.resetTime };
            }

            if (!response.ok || !data.success) {
              throw new Error(data.error || `HTTP ${response.status}`);
            }

            return { item, success: true, fieldsUpdated: data.fieldsUpdated };
          } catch (error) {
            clearTimeout(timeoutId);
            throw { item, error };
          }
        })
      );

      // Process results
      for (const result of chunkResults) {
        results.processed++;

        if (result.status === 'fulfilled') {
          const value = result.value;

          if (value.rateLimited) {
            // Rate limited - mark for retry after backoff
            hitRateLimit = true;
            const resetAt = value.resetTime || new Date(Date.now() + RATE_LIMIT_BACKOFF_MS).toISOString();
            
            await supabase
              .from('buyer_enrichment_queue')
              .update({
                status: 'rate_limited',
                rate_limit_reset_at: resetAt,
                last_error: 'Rate limited - will retry after reset',
                updated_at: new Date().toISOString(),
              })
              .eq('id', value.item.id);

            results.rateLimited++;
            console.log(`Buyer ${value.item.buyer_id} rate limited, will retry after ${resetAt}`);
          } else if (value.success) {
            // Success
            await supabase
              .from('buyer_enrichment_queue')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                last_error: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', value.item.id);

            results.succeeded++;
            console.log(`Successfully enriched buyer ${value.item.buyer_id}: ${value.fieldsUpdated} fields`);
          }
        } else {
          // Error
          const reason = result.reason as { item?: { id: string; buyer_id: string; attempts: number }; error?: Error };
          const item = reason?.item;
          const errorMsg = reason?.error instanceof Error ? reason.error.message : 'Unknown error';

          if (item?.id) {
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

            results.errors.push(`${item.buyer_id}: ${errorMsg}`);
          }

          results.failed++;
          console.error(`Failed to enrich buyer:`, errorMsg);
        }
      }
    }

    // If we hit rate limit, mark remaining pending items
    if (hitRateLimit) {
      const resetAt = new Date(Date.now() + RATE_LIMIT_BACKOFF_MS).toISOString();
      await supabase
        .from('buyer_enrichment_queue')
        .update({
          status: 'rate_limited',
          rate_limit_reset_at: resetAt,
          last_error: 'Rate limited - will retry after reset',
          updated_at: new Date().toISOString(),
        })
        .eq('status', 'pending');
    }

    console.log(`Queue processing complete: ${results.succeeded} succeeded, ${results.failed} failed, ${results.rateLimited} rate limited`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} buyers`,
        ...results,
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
