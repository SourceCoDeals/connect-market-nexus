import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupResult {
  success: boolean;
  universeId: string;
  itemsDeleted: {
    generationState: boolean;
    tempFiles: number;
    logs: number;
  };
  message: string;
}

/**
 * Clean up temporary generation state after completion or timeout
 *
 * POST /functions/v1/cleanup-generation-state
 * {
 *   "universe_id": "uuid",
 *   "reason": "completed" | "timeout" | "error"
 * }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { universe_id, reason = 'completed' } = await req.json();

    if (!universe_id) {
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

    let itemsDeleted = {
      generationState: false,
      tempFiles: 0,
      logs: 0,
    };

    console.log(`Cleaning up generation state for universe ${universe_id}. Reason: ${reason}`);

    // 1. Delete generation state record
    try {
      const { error: deleteError } = await supabase
        .from('remarketing_guide_generation_state')
        .delete()
        .eq('universe_id', universe_id);

      if (deleteError) {
        console.warn(`Error deleting generation state: ${deleteError.message}`);
      } else {
        itemsDeleted.generationState = true;
      }
    } catch (e) {
      console.warn(`Failed to delete generation state: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 2. Archive/delete generation logs (keep for 7 days, then delete)
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: logError } = await supabase
        .from('remarketing_generation_logs')
        .delete()
        .eq('universe_id', universe_id)
        .lt('created_at', sevenDaysAgo);

      if (!logError) {
        itemsDeleted.logs += 1;
      }
    } catch (e) {
      console.warn(`Failed to clean logs: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 3. Delete from temporary storage (if using Supabase Storage)
    try {
      const tempBucket = 'guide-generation-temp';
      const { data: files } = await supabase
        .storage
        .from(tempBucket)
        .list(`${universe_id}/`);

      if (files && files.length > 0) {
        for (const file of files) {
          await supabase.storage
            .from(tempBucket)
            .remove([`${universe_id}/${file.name}`]);
          itemsDeleted.tempFiles++;
        }
      }
    } catch (e) {
      console.warn(`Failed to delete temp files: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 4. Mark as completed in the universe record (optional)
    try {
      const statusMap: Record<string, string> = {
        'completed': 'completed',
        'timeout': 'timed_out',
        'error': 'failed',
      };

      const { error: updateError } = await supabase
        .from('remarketing_buyer_universes')
        .update({
          guide_generation_status: statusMap[reason] || 'unknown',
          updated_at: new Date().toISOString(),
        })
        .eq('id', universe_id);

      if (updateError) {
        console.warn(`Error updating universe status: ${updateError.message}`);
      }
    } catch (e) {
      console.warn(`Failed to update universe: ${e instanceof Error ? e.message : String(e)}`);
    }

    const result: CleanupResult = {
      success: true,
      universeId: universe_id,
      itemsDeleted,
      message: `Successfully cleaned up generation state (reason: ${reason})`,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error cleaning up generation state:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
