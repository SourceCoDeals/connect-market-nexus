 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 // Process one batch per invocation to stay within timeout limits
 const BATCH_SIZE = 1; // Must match generate-ma-guide BATCH_SIZE
 const TOTAL_PHASES = 13;
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
   const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
   const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
   const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
   try {
     // Find pending or processing generations
     const { data: generations, error: fetchError } = await supabase
       .from('ma_guide_generations')
       .select('*, remarketing_buyer_universes!inner(name, description, ma_guide_qa_context)')
       .in('status', ['pending', 'processing'])
       .order('created_at', { ascending: true })
       .limit(1); // Process one at a time
 
     if (fetchError) {
       console.error('[process-ma-guide-queue] Error fetching generations:', fetchError);
       throw fetchError;
     }
 
     if (!generations || generations.length === 0) {
       console.log('[process-ma-guide-queue] No pending generations');
       return new Response(
         JSON.stringify({ message: 'No pending generations' }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const generation = generations[0];
     const universe = generation.remarketing_buyer_universes;
     
     console.log(`[process-ma-guide-queue] Processing generation ${generation.id}, phase ${generation.phases_completed}/${TOTAL_PHASES}`);
 
     // Calculate which batch to process next
     const currentBatch = Math.floor(generation.phases_completed / BATCH_SIZE);
     const totalBatches = Math.ceil(TOTAL_PHASES / BATCH_SIZE);
 
     // If already complete, mark as done
     if (currentBatch >= totalBatches) {
       await supabase
         .from('ma_guide_generations')
         .update({
           status: 'completed',
           completed_at: new Date().toISOString(),
           phases_completed: TOTAL_PHASES
         })
         .eq('id', generation.id);
 
       return new Response(
         JSON.stringify({ message: 'Generation completed', generation_id: generation.id }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Update status to processing
     await supabase
       .from('ma_guide_generations')
       .update({
         status: 'processing',
         current_phase: `Batch ${currentBatch + 1}/${totalBatches}`
       })
       .eq('id', generation.id);
 
     // Get previous content from generated_content
     const previousContent = generation.generated_content?.content || '';
 
     // Call generate-ma-guide for this batch
     console.log(`[process-ma-guide-queue] Calling generate-ma-guide for batch ${currentBatch}`);
     
     const response = await fetch(`${supabaseUrl}/functions/v1/generate-ma-guide`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'apikey': supabaseAnonKey,
       },
       body: JSON.stringify({
         industry_name: universe.name,
         industry_description: universe.description,
         universe_id: generation.universe_id,
         clarification_context: universe.ma_guide_qa_context,
         stream: false,
         batch_index: currentBatch,
         previous_content: previousContent
       }),
       signal: AbortSignal.timeout(120000), // 2 minute timeout
     });
 
     if (!response.ok) {
       const errorText = await response.text();
       
       // Check for rate limit
       if (response.status === 429) {
         console.log('[process-ma-guide-queue] Rate limited, will retry on next cron');
         // Don't update status - leave as processing so cron picks it up again
         return new Response(
           JSON.stringify({ message: 'Rate limited, will retry', generation_id: generation.id }),
           { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
       
       throw new Error(`Batch ${currentBatch} failed: ${response.status} - ${errorText.substring(0, 200)}`);
     }
 
     const result = await response.json();
     const newContent = result.content || previousContent;
     const newPhasesCompleted = Math.min((currentBatch + 1) * BATCH_SIZE, TOTAL_PHASES);
 
     console.log(`[process-ma-guide-queue] Batch ${currentBatch} complete. Phases: ${newPhasesCompleted}/${TOTAL_PHASES}`);
 
     // Update progress
     const updateData: Record<string, unknown> = {
       generated_content: { content: newContent },
       phases_completed: newPhasesCompleted,
       current_phase: `Batch ${currentBatch + 1}/${totalBatches} complete`
     };
 
     // Check if this was the final batch
     if (result.is_final || newPhasesCompleted >= TOTAL_PHASES) {
       updateData.status = 'completed';
       updateData.completed_at = new Date().toISOString();
       
       if (result.criteria) {
         updateData.generated_content = {
           content: newContent,
           criteria: result.criteria,
           quality: result.quality
         };
       }
 
       // Update universe with final content
       await supabase
         .from('remarketing_buyer_universes')
         .update({
           ma_guide_content: newContent,
           ...(result.criteria ? { fit_criteria: result.criteria } : {})
         })
         .eq('id', generation.universe_id);
 
       console.log(`[process-ma-guide-queue] Generation ${generation.id} COMPLETED`);
     }
 
     await supabase
       .from('ma_guide_generations')
       .update(updateData)
       .eq('id', generation.id);

    // Self-chain: if there are more batches, trigger ourselves for the next one
    // This ensures continuous processing without waiting for the cron job (up to 60s gap)
    if (!result.is_final && newPhasesCompleted < TOTAL_PHASES) {
      console.log(`[process-ma-guide-queue] Triggering next batch (${newPhasesCompleted}/${TOTAL_PHASES} phases done)`);
      // Small delay to avoid rate limiting, then fire-and-forget
      setTimeout(() => {
        fetch(`${supabaseUrl}/functions/v1/process-ma-guide-queue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({ triggered_by: generation.id, batch: newPhasesCompleted }),
        }).catch(err => {
          // Non-blocking - cron will pick it up as backup
          console.log('[process-ma-guide-queue] Self-chain trigger failed, cron will handle:', err.message);
        });
      }, 2000); // 2s delay between batches to avoid rate limits
    }

     return new Response(
       JSON.stringify({
         message: result.is_final ? 'Generation completed' : 'Batch processed',
         generation_id: generation.id,
         phases_completed: newPhasesCompleted,
         total_phases: TOTAL_PHASES,
         is_complete: result.is_final || newPhasesCompleted >= TOTAL_PHASES
       }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error: unknown) {
     const errorMessage = error instanceof Error ? error.message : String(error);
     console.error('[process-ma-guide-queue] Error:', errorMessage);
 
     // Check if we have a generation to update
     const { data: activeGen } = await supabase
       .from('ma_guide_generations')
       .select('id')
       .eq('status', 'processing')
       .limit(1)
       .single();
 
     if (activeGen) {
       // Determine if error is recoverable
       const isRecoverable = 
         errorMessage.includes('429') ||
         errorMessage.includes('timeout') ||
         errorMessage.includes('ECONNRESET') ||
         errorMessage.includes('529');
 
       if (!isRecoverable) {
         await supabase
           .from('ma_guide_generations')
           .update({
             status: 'failed',
             error: JSON.stringify({
               message: errorMessage,
               is_recoverable: false,
               timestamp: new Date().toISOString()
             })
           })
           .eq('id', activeGen.id);
       }
       // If recoverable, leave as processing for next cron run
     }
 
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });