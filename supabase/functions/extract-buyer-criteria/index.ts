import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { extractCriteriaFromGuide, type BuyerCriteria } from '../_shared/buyer-criteria-extraction.ts';
import { authenticateRequest } from '../_shared/auth-middleware.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractionRequest {
  universe_id: string;
  guide_content: string;
  source_name: string;
  industry_name?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ✅ AUTHENTICATION (ADDED 2026-02-04)
    const auth = await authenticateRequest(req, supabase, {
      requireAuth: true,
      requireAdmin: true, // Only admins can extract criteria
      // No rate limiting - admins can extract unlimited criteria (user is willing to pay for AI operations)
      corsHeaders,
    });

    if (!auth.authenticated || auth.errorResponse) {
      return auth.errorResponse!;
    }

    const { universe_id, guide_content, source_name, industry_name = 'Unknown Industry' }: ExtractionRequest = await req.json();

    if (!universe_id || !guide_content) {
      throw new Error('Missing required fields: universe_id, guide_content');
    }

    console.log(`[REQUEST] Universe: ${universe_id}, Source: ${source_name}, Industry: ${industry_name}`);

    // Create extraction source record
    const { data: sourceRecord, error: sourceError } = await supabase
      .from('criteria_extraction_sources')
      .insert({
        universe_id,
        source_type: 'ai_guide',
        source_name,
        source_metadata: {
          industry_name,
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

    console.log(`[SOURCE_CREATED] ID: ${sourceRecord.id}`);

    // Extract criteria using Claude
    try {
      const criteria = await extractCriteriaFromGuide(guide_content, industry_name);

      // Update source record with extraction results
      const { error: updateError } = await supabase
        .from('criteria_extraction_sources')
        .update({
          extraction_status: 'completed',
          extraction_completed_at: new Date().toISOString(),
          extracted_data: criteria,
          confidence_scores: {
            size: criteria.size_criteria.confidence_score,
            service: criteria.service_criteria.confidence_score,
            geography: criteria.geography_criteria.confidence_score,
            buyer_types: criteria.buyer_types_criteria.confidence_score,
            overall: criteria.overall_confidence
          }
        })
        .eq('id', sourceRecord.id);

      if (updateError) {
        throw new Error(`Failed to update source record: ${updateError.message}`);
      }

      console.log(`[SUCCESS] Extraction completed with ${criteria.overall_confidence}% confidence`);

      return new Response(
        JSON.stringify({
          success: true,
          source_id: sourceRecord.id,
          criteria,
          message: 'Criteria extracted successfully'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );

    } catch (extractionError) {
      // Mark extraction as failed
      await supabase
        .from('criteria_extraction_sources')
        .update({
          extraction_status: 'failed',
          extraction_error: extractionError.message,
          extraction_completed_at: new Date().toISOString()
        })
        .eq('id', sourceRecord.id);

      throw extractionError;
    }

  } catch (error) {
    console.error('[ERROR]', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
