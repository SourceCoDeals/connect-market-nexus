import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerationStatus {
  universe_id: string;
  status: 'idle' | 'generating' | 'completed' | 'failed';
  currentBatch: number;
  totalBatches: number;
  currentPhase: number;
  totalPhases: number;
  phaseName?: string;
  progressPercent: number;
  savedContent?: string;
  savedContentLength: number;
  lastError?: {
    code: string;
    message: string;
    timestamp: string;
    batch: number;
  };
  estimatedTimeRemainingMs?: number;
  lastUpdateAt: string;
}

const TOTAL_PHASES = 13;
const BATCH_SIZE = 2;

/**
 * Get the current status of a guide generation
 *
 * GET /functions/v1/get-generation-status?universe_id=uuid
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const universeId = url.searchParams.get('universe_id');

    if (!universeId) {
      return new Response(
        JSON.stringify({ error: 'Missing universe_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get generation state from remarketing_guide_generation_state table
    // (This table would need to be created as part of the schema)
    const { data: state, error: stateError } = await supabase
      .from('remarketing_guide_generation_state')
      .select('*')
      .eq('universe_id', universeId)
      .single();

    if (stateError && stateError.code !== 'PGRST116') {
      // PGRST116 = row not found (expected)
      console.error('Error fetching generation state:', stateError);
    }

    // If no state found, return idle status
    if (!state) {
      const status: GenerationStatus = {
        universe_id: universeId,
        status: 'idle',
        currentBatch: 0,
        totalBatches: Math.ceil(TOTAL_PHASES / BATCH_SIZE),
        currentPhase: 0,
        totalPhases: TOTAL_PHASES,
        progressPercent: 0,
        savedContentLength: 0,
        lastUpdateAt: new Date().toISOString(),
      };

      return new Response(
        JSON.stringify(status),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate progress
    const totalBatches = Math.ceil(TOTAL_PHASES / BATCH_SIZE);
    const progressPercent = Math.round((state.current_phase / TOTAL_PHASES) * 100);

    // Estimate remaining time (rough estimate: 30s per phase)
    const estimatedTimeRemainingMs = (TOTAL_PHASES - state.current_phase) * 30000;

    const status: GenerationStatus = {
      universe_id: universeId,
      status: state.status || 'generating',
      currentBatch: state.current_batch || 0,
      totalBatches,
      currentPhase: state.current_phase || 0,
      totalPhases: TOTAL_PHASES,
      phaseName: state.phase_name,
      progressPercent,
      savedContent: state.saved_content,
      savedContentLength: state.saved_content?.length || 0,
      lastError: state.last_error ? JSON.parse(state.last_error) : undefined,
      estimatedTimeRemainingMs: state.status === 'generating' ? estimatedTimeRemainingMs : undefined,
      lastUpdateAt: state.updated_at,
    };

    return new Response(
      JSON.stringify(status),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error getting generation status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
