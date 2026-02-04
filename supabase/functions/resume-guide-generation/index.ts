import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Resume an interrupted M&A guide generation from the last successful batch
 *
 * POST /functions/v1/resume-guide-generation
 * {
 *   "universe_id": "uuid",
 *   "batch_index": 2,
 *   "saved_content": "...previously generated content..."
 * }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { universe_id, batch_index, saved_content, industry_name, clarification_context } = await req.json();

    if (!universe_id || batch_index === undefined || !saved_content || !industry_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: universe_id, batch_index, saved_content, industry_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Resuming guide generation for universe ${universe_id} from batch ${batch_index + 1}`);

    // Call the main generate-ma-guide function with the saved content
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-ma-guide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.headers.get('Authorization')?.replace('Bearer ', '')}`,
      },
      body: JSON.stringify({
        industry_name,
        universe_id,
        batch_index,
        previous_content: saved_content,
        clarification_context,
        stream: true,
      }),
    });

    // Stream the response back
    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to resume generation: ${error}`);
      return new Response(
        JSON.stringify({ error: 'Failed to resume guide generation', details: error }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return the SSE stream
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error resuming guide generation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
