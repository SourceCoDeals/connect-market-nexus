import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { updateGlobalQueueProgress, completeGlobalQueueOperation, isOperationPaused, recoverStaleOperations } from "../_shared/global-activity-queue.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { checkProviderAvailability, reportRateLimit } from "../_shared/rate-limiter.ts";

const MAX_ATTEMPTS = 3;
const RATE_LIMIT_BACKOFF_MS = 60000;
const STALE_PROCESSING_MINUTES = 5;
const MAX_FUNCTION_RUNTIME_MS = 140000;
const INTER_ITEM_DELAY_MS = 2000; // 2s between scoring calls to respect Gemini limits

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);

  try {
    const functionStartTime = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing scoring queue (self-looping)...');

    // Recover stale global operations
    await recoverStaleOperations(supabase);

    // Recovery: reset stale processing items
    const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000).toISOString();
    await supabase
      .from('remarketing_scoring_queue')
      .update({ status: 'pending', last_error: 'Recovered from stale processing', processed_at: null })
      .eq('status', 'processing')
      .lt('created_at', staleCutoff);

    // Guard: skip if another processor is active
    const { data: active } = await supabase
      .from('remarketing_scoring_queue')
      .select('id')
      .eq('status', 'processing')
      .limit(1);

    if (active && active.length > 0) {
      console.log('Another scoring processor is active, skipping');
      return new Response(JSON.stringify({ success: true, message: 'Skipped', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark exhausted items as failed
    await supabase
      .from('remarketing_scoring_queue')
      .update({ status: 'failed', last_error: 'Max attempts reached', processed_at: new Date().toISOString() })
      .eq('status', 'pending')
      .gte('attempts', MAX_ATTEMPTS);

    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    let rateLimited = false;

    while (true) {
      if (Date.now() - functionStartTime > MAX_FUNCTION_RUNTIME_MS) {
        console.log(`Time limit reached after ${totalProcessed} items`);
        break;
      }

      if (await isOperationPaused(supabase, 'buyer_scoring')) {
        console.log('Scoring paused by user');
        break;
      }

      // Fetch next pending item
      const { data: items, error: fetchErr } = await supabase
        .from('remarketing_scoring_queue')
        .select('*')
        .eq('status', 'pending')
        .lt('attempts', MAX_ATTEMPTS)
        .order('created_at', { ascending: true })
        .limit(1);

      if (fetchErr) { console.error('Fetch error:', fetchErr); break; }
      if (!items || items.length === 0) {
        console.log(`Queue empty. Processed ${totalProcessed} items.`);
        await completeGlobalQueueOperation(supabase, 'buyer_scoring');
        break;
      }

      const item = items[0];
      console.log(`Processing ${item.score_type} scoring: buyer=${item.buyer_id}, listing=${item.listing_id} (attempt ${item.attempts + 1})`);

      // Check rate limiter
      const availability = await checkProviderAvailability(supabase, 'gemini');
      if (!availability.ok) {
        const waitMs = availability.retryAfterMs || RATE_LIMIT_BACKOFF_MS;
        if (waitMs > 30000) {
          console.log(`Gemini rate limited for ${Math.round(waitMs / 1000)}s — stopping`);
          rateLimited = true;
          break;
        }
        console.log(`Waiting ${Math.round(waitMs / 1000)}s for Gemini...`);
        await new Promise(r => setTimeout(r, waitMs));
      }

      // Mark as processing
      await supabase
        .from('remarketing_scoring_queue')
        .update({ status: 'processing', attempts: item.attempts + 1 })
        .eq('id', item.id)
        .eq('status', 'pending');

      try {
        let functionName: string;
        let body: Record<string, unknown>;

        if (item.score_type === 'alignment') {
          functionName = 'score-industry-alignment';
          body = { buyerId: item.buyer_id, universeId: item.universe_id };
        } else {
          functionName = 'score-buyer-deal';
          body = { bulk: true, listingId: item.listing_id, universeId: item.universe_id };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await response.json().catch(() => ({}));

        if (response.status === 429 || data.error_code === 'rate_limited') {
          await reportRateLimit(supabase, 'gemini', RATE_LIMIT_BACKOFF_MS / 1000);
          await supabase
            .from('remarketing_scoring_queue')
            .update({ status: 'pending', last_error: 'Rate limited - will retry' })
            .eq('id', item.id);
          console.log('Rate limited, stopping loop');
          rateLimited = true;
          totalProcessed++;
          break;
        }

        if (data.error_code === 'ma_guide_missing' || data.error_code === 'payment_required') {
          await supabase
            .from('remarketing_scoring_queue')
            .update({ status: 'failed', last_error: data.error_code, processed_at: new Date().toISOString() })
            .eq('id', item.id);
          // Fail all remaining items of same type+universe
          await supabase
            .from('remarketing_scoring_queue')
            .update({ status: 'failed', last_error: data.error_code, processed_at: new Date().toISOString() })
            .eq('universe_id', item.universe_id)
            .eq('score_type', item.score_type)
            .eq('status', 'pending');
          console.log(`Critical error ${data.error_code}, failing all remaining items`);
          await completeGlobalQueueOperation(supabase, 'buyer_scoring', 'failed');
          totalFailed++;
          totalProcessed++;
          break;
        }

        if (!response.ok && !data.success) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        // Success
        await supabase
          .from('remarketing_scoring_queue')
          .update({ status: 'completed', processed_at: new Date().toISOString() })
          .eq('id', item.id);
        
        await updateGlobalQueueProgress(supabase, 'buyer_scoring', { completedDelta: 1 });
        totalSucceeded++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const newStatus = item.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending';
        await supabase
          .from('remarketing_scoring_queue')
          .update({ status: newStatus, last_error: errorMsg, processed_at: newStatus === 'failed' ? new Date().toISOString() : null })
          .eq('id', item.id);
        console.error(`Scoring failed for item ${item.id}:`, errorMsg);
        await updateGlobalQueueProgress(supabase, 'buyer_scoring', {
          failedDelta: 1,
          errorEntry: { itemId: item.id, error: errorMsg },
        });
        totalFailed++;
      }

      totalProcessed++;

      // Delay between items
      if (Date.now() - functionStartTime < MAX_FUNCTION_RUNTIME_MS) {
        await new Promise(r => setTimeout(r, INTER_ITEM_DELAY_MS));
      }
    }

    // Self-invoke if more items remain
    const { count: remaining } = await supabase
      .from('remarketing_scoring_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (remaining && remaining > 0 && !rateLimited) {
      console.log(`${remaining} items still pending, triggering next batch...`);
      fetch(`${supabaseUrl}/functions/v1/process-scoring-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ continuation: true }),
        signal: AbortSignal.timeout(30_000),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ success: true, processed: totalProcessed, succeeded: totalSucceeded, failed: totalFailed, remaining: remaining || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in process-scoring-queue:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
