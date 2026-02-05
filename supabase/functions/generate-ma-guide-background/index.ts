import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { universe_id } = await req.json();

    if (!universe_id) {
      return new Response(
        JSON.stringify({ error: 'universe_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if there's already an active generation for this universe
    const { data: existingGeneration } = await supabase
      .from('ma_guide_generations')
      .select('*')
      .eq('universe_id', universe_id)
      .in('status', ['pending', 'processing'])
      .single();

    if (existingGeneration) {
      return new Response(
        JSON.stringify({
          generation_id: existingGeneration.id,
          status: existingGeneration.status,
          message: 'Generation already in progress'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch universe details
    const { data: universe, error: universeError } = await supabase
      .from('remarketing_buyer_universes')
      .select('name, description, ma_guide_qa_context')
      .eq('id', universe_id)
      .single();

    if (universeError || !universe) {
      return new Response(
        JSON.stringify({ error: 'Universe not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a new generation record
    const { data: generation, error: generationError } = await supabase
      .from('ma_guide_generations')
      .insert({
        universe_id,
        status: 'processing',
        current_phase: 'Initializing',
        phases_completed: 0,
        total_phases: 13,
        generated_content: {}
      })
      .select()
      .single();

    if (generationError || !generation) {
      throw new Error(`Failed to create generation record: ${generationError?.message}`);
    }

    console.log(`[generate-ma-guide-background] Created generation ${generation.id} for universe ${universe_id}`);

    // Return immediately with the generation ID
    // The actual generation will happen asynchronously
    const response = new Response(
      JSON.stringify({
        generation_id: generation.id,
        status: 'processing',
        message: 'Generation started. Poll the ma_guide_generations table for progress.'
      }),
      {
        status: 202, // Accepted
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

    // Start the background generation (don't await)
    // Note: This will continue running after the response is sent
    processGenerationInBackground(
      generation.id,
      universe_id,
      universe.name,
      universe.description,
      universe.ma_guide_qa_context,
      supabase
    ).catch(async (error) => {
      console.error(`[generate-ma-guide-background] Generation ${generation.id} failed:`, error);
      // Update generation status to failed
      await supabase
        .from('ma_guide_generations')
        .update({
          status: 'failed',
          error: error.message || 'Unknown error occurred'
        })
        .eq('id', generation.id);
    });

    return response;

  } catch (error: any) {
    console.error('[generate-ma-guide-background] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processGenerationInBackground(
  generationId: string,
  universeId: string,
  industryName: string,
  industryDescription: string | null,
  clarificationContext: any,
  supabase: any
) {
  console.log(`[processGenerationInBackground] Starting generation ${generationId}`);

  try {
    // Call the original generate-ma-guide function in non-streaming mode
    // We'll do this batch by batch to avoid timeouts
    const BATCH_SIZE = 2; // Same as original
    const TOTAL_PHASES = 13;
    const totalBatches = Math.ceil(TOTAL_PHASES / BATCH_SIZE);

    let fullContent = '';

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      console.log(`[processGenerationInBackground] Processing batch ${batchIndex + 1}/${totalBatches}`);

      // Update status
      await supabase
        .from('ma_guide_generations')
        .update({
          current_phase: `Batch ${batchIndex + 1}/${totalBatches}`,
          phases_completed: batchIndex * BATCH_SIZE
        })
        .eq('id', generationId);

      // Call the original function for this batch
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-ma-guide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          industry_name: industryName,
          industry_description: industryDescription,
          universe_id: universeId,
          clarification_context: clarificationContext,
          stream: false,
          batch_index: batchIndex,
          previous_content: fullContent
        })
      });

      if (!response.ok) {
        throw new Error(`Batch ${batchIndex} failed: ${response.statusText}`);
      }

      const result = await response.json();
      fullContent = result.content || fullContent;

      // Update progress with content
      await supabase
        .from('ma_guide_generations')
        .update({
          generated_content: { content: fullContent },
          phases_completed: (batchIndex + 1) * BATCH_SIZE
        })
        .eq('id', generationId);

      // If this is the last batch and we have criteria, save them
      if (result.is_final && result.criteria) {
        await supabase
          .from('ma_guide_generations')
          .update({
            generated_content: {
              content: fullContent,
              criteria: result.criteria,
              quality: result.quality
            }
          })
          .eq('id', generationId);

        // Also update the universe with the generated content
        await supabase
          .from('remarketing_buyer_universes')
          .update({
            ma_guide_content: fullContent,
            fit_criteria: result.criteria
          })
          .eq('id', universeId);
      }
    }

    // Mark as completed
    await supabase
      .from('ma_guide_generations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        phases_completed: TOTAL_PHASES
      })
      .eq('id', generationId);

    console.log(`[processGenerationInBackground] Generation ${generationId} completed successfully`);

  } catch (error: any) {
    console.error(`[processGenerationInBackground] Error in generation ${generationId}:`, error);

    // Update status to failed
    await supabase
      .from('ma_guide_generations')
      .update({
        status: 'failed',
        error: error.message || 'Unknown error occurred'
      })
      .eq('id', generationId);

    throw error;
  }
}
