import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { extractCriteriaFromGuide } from '../_shared/buyer-criteria-extraction.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { universe_id, guide_content, source_name, industry_name } = await req.json();

    if (!universe_id) {
      return new Response(
        JSON.stringify({ error: 'universe_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!guide_content || guide_content.length < 1000) {
      return new Response(
        JSON.stringify({
          error: 'guide_content must have at least 1000 characters',
          actual_length: guide_content?.length || 0,
          suggestion: 'Generate a comprehensive M&A guide first before extracting criteria'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if guide contains buyer-related keywords
    const hasRelevantContent = /buyer|acqui|purchase|private equity|PE|platform|strategic|target|criteri/i.test(guide_content);
    if (!hasRelevantContent) {
      console.warn(`[VALIDATION_WARNING] Guide may not contain buyer criteria. Length: ${guide_content.length}`);
      // Don't fail, but log warning - the extraction will handle this
    }

    console.log(`[VALIDATION_PASSED] Guide content: ${guide_content.length} chars, has buyer keywords: ${hasRelevantContent}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if there's already an active extraction for this universe
    const { data: existingExtraction } = await supabase
      .from('buyer_criteria_extractions')
      .select('*')
      .eq('universe_id', universe_id)
      .in('status', ['pending', 'processing'])
      .single();

    if (existingExtraction) {
      return new Response(
        JSON.stringify({
          extraction_id: existingExtraction.id,
          status: existingExtraction.status,
          message: 'Extraction already in progress'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create extraction source record first
    const { data: sourceRecord, error: sourceError } = await supabase
      .from('criteria_extraction_sources')
      .insert({
        universe_id,
        source_type: 'ai_guide',
        source_name: source_name || 'M&A Guide',
        source_metadata: {
          industry_name: industry_name || 'Unknown',
          content_length: guide_content.length,
          word_count: guide_content.split(/\s+/).length
        },
        extraction_status: 'processing',
        extraction_started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sourceError) {
      throw new Error(`Failed to create source record: ${sourceError.message}`);
    }

    // Create a new extraction tracking record
    const { data: extraction, error: extractionError } = await supabase
      .from('buyer_criteria_extractions')
      .insert({
        universe_id,
        source_id: sourceRecord.id,
        status: 'processing',
        current_phase: 'Initializing',
        phases_completed: 0,
        total_phases: 4, // Size, Service, Geography, Buyer Types
        extracted_criteria: {}
      })
      .select()
      .single();

    if (extractionError || !extraction) {
      throw new Error(`Failed to create extraction record: ${extractionError?.message}`);
    }

    console.log(`[extract-buyer-criteria-background] Created extraction ${extraction.id} for universe ${universe_id}`);

    // Return immediately with the extraction ID
    const response = new Response(
      JSON.stringify({
        extraction_id: extraction.id,
        source_id: sourceRecord.id,
        status: 'processing',
        message: 'Extraction started. Poll the buyer_criteria_extractions table for progress.'
      }),
      {
        status: 202, // Accepted
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

    // Start the background extraction (don't await)
    processExtractionInBackground(
      extraction.id,
      sourceRecord.id,
      universe_id,
      guide_content,
      industry_name || 'Unknown Industry',
      supabase
    ).catch(async (error) => {
      console.error(`[extract-buyer-criteria-background] Extraction ${extraction.id} failed:`, error);
      // Update extraction status to failed
      await supabase
        .from('buyer_criteria_extractions')
        .update({
          status: 'failed',
          error: error.message || 'Unknown error occurred',
          completed_at: new Date().toISOString()
        })
        .eq('id', extraction.id);

      // Update source record
      await supabase
        .from('criteria_extraction_sources')
        .update({
          extraction_status: 'failed',
          extraction_error: error.message,
          extraction_completed_at: new Date().toISOString()
        })
        .eq('id', sourceRecord.id);
    });

    return response;

  } catch (error: any) {
    console.error('[extract-buyer-criteria-background] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processExtractionInBackground(
  extractionId: string,
  sourceId: string,
  universeId: string,
  guideContent: string,
  industryName: string,
  supabase: any
) {
  console.log(`[processExtractionInBackground] Starting extraction ${extractionId}`);

  try {
    let extractedCriteria: any = {};
    let confidenceScores: any = {};

    // Update status to extracting (single update)
    await supabase
      .from('buyer_criteria_extractions')
      .update({
        current_phase: 'Extracting criteria from guide',
        phases_completed: 0
      })
      .eq('id', extractionId);

    // Call the shared extraction function directly (no HTTP overhead!)
    console.log(`[processExtractionInBackground] Calling direct extraction for universe ${universeId}`);

    const criteria = await extractCriteriaFromGuide(guideContent, industryName);

    extractedCriteria = criteria;
    confidenceScores = {
      size: criteria.size_criteria?.confidence_score || 0,
      service: criteria.service_criteria?.confidence_score || 0,
      geography: criteria.geography_criteria?.confidence_score || 0,
      buyer_types: criteria.buyer_types_criteria?.confidence_score || 0,
      overall: criteria.overall_confidence || 0
    };

    console.log(`[processExtractionInBackground] Extraction completed with ${criteria.overall_confidence}% confidence`);

    // OPTIMIZATION: Batch all database updates into a single transaction
    // This reduces round-trips from 4 individual updates to 1 transaction
    const completedAt = new Date().toISOString();

    // Use a Supabase RPC function for atomic batch update
    // If RPC not available, use Promise.all to parallelize updates
    await Promise.all([
      // Update extraction record with all final data in one call
      supabase
        .from('buyer_criteria_extractions')
        .update({
          status: 'completed',
          extracted_criteria: extractedCriteria,
          confidence_scores: confidenceScores,
          phases_completed: 4,
          completed_at: completedAt
        })
        .eq('id', extractionId),

      // Update source record
      supabase
        .from('criteria_extraction_sources')
        .update({
          extraction_status: 'completed',
          extraction_completed_at: completedAt,
          extracted_data: extractedCriteria,
          confidence_scores: confidenceScores
        })
        .eq('id', sourceId),

      // Update universe with extracted criteria
      supabase
        .from('remarketing_universes')
        .update({
          size_criteria: extractedCriteria.size_criteria,
          service_criteria: extractedCriteria.service_criteria,
          geography_criteria: extractedCriteria.geography_criteria,
          buyer_types_criteria: extractedCriteria.buyer_types_criteria
        })
        .eq('id', universeId)
    ]);

    console.log(`[processExtractionInBackground] Extraction ${extractionId} completed successfully (batched updates)`);

  } catch (error: any) {
    console.error(`[processExtractionInBackground] Error in extraction ${extractionId}:`, error);

    const completedAt = new Date().toISOString();
    const errorMessage = error.message || 'Unknown error occurred';

    // OPTIMIZATION: Batch error updates in parallel
    await Promise.all([
      supabase
        .from('buyer_criteria_extractions')
        .update({
          status: 'failed',
          error: errorMessage,
          completed_at: completedAt
        })
        .eq('id', extractionId),

      supabase
        .from('criteria_extraction_sources')
        .update({
          extraction_status: 'failed',
          extraction_error: errorMessage,
          extraction_completed_at: completedAt
        })
        .eq('id', sourceId)
    ]);

    throw error;
  }
}
