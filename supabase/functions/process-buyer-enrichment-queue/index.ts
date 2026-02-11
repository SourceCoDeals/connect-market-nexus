import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { updateGlobalQueueProgress, completeGlobalQueueOperation, isOperationPaused, recoverStaleOperations } from "../_shared/global-activity-queue.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration — conservative to avoid Claude rate limits
// Each buyer makes 4-5 Claude API calls, so we process ONE at a time.
// Timeout is generous to accommodate automatic retry-on-429 in callClaudeWithTool.
const BATCH_SIZE = 1;
const MAX_ATTEMPTS = 3;
const PROCESSING_TIMEOUT_MS = 180000; // 3 minutes per buyer (increased from 2min to allow retries on 429)
const RATE_LIMIT_BACKOFF_MS = 60000; // 60s backoff on rate limit (reduced — callClaudeWithTool now handles retries)
const STALE_PROCESSING_MINUTES = 5; // Recovery timeout for stuck items (increased from 3min to match longer timeout)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing buyer enrichment queue...');

    // Auto-recover any stale global operations (prevents deadlocks)
    const recovered = await recoverStaleOperations(supabase);
    if (recovered > 0) {
      console.log(`Recovered ${recovered} stale global operations`);
    }

    // Recovery: reset stale processing items (stuck for 3+ minutes)
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

    // GUARD: If anything is currently processing (and not stale), skip this run
    // This prevents concurrent processor invocations from competing
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

    // Fetch ONE pending item
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
      // All done — complete the global queue operation
      await completeGlobalQueueOperation(supabase, 'buyer_enrichment');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending items', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if operation was paused by user
    if (await isOperationPaused(supabase, 'buyer_enrichment')) {
      console.log('Buyer enrichment paused by user — stopping');
      return new Response(
        JSON.stringify({ success: true, message: 'Paused by user', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const item = queueItems[0];
    console.log(`Processing buyer ${item.buyer_id} (attempt ${item.attempts + 1})`);

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
      // CRITICAL: Use anon key for 'apikey' header (gateway routing)
      // and service role key for 'Authorization' (permissions)
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

        console.log(`Buyer ${item.buyer_id} rate limited, will retry after ${resetAt}`);
        return new Response(
          JSON.stringify({ success: true, processed: 1, rateLimited: 1 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      // Check for partial enrichment (rate limited mid-execution but saved partial data)
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

        console.log(`Buyer ${item.buyer_id} partially enriched (${data.extractionDetails?.promptsSuccessful}/${data.extractionDetails?.promptsRun} prompts), re-queued`);
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

      return new Response(
        JSON.stringify({ success: true, processed: 1, succeeded: 1 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

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

      return new Response(
        JSON.stringify({ success: true, processed: 1, failed: 1, error: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in process-buyer-enrichment-queue:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
