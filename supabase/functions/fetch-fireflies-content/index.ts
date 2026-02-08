import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchRequest {
  transcriptId: string; // deal_transcripts.id
}

interface FirefliesSentence {
  text: string;
  speaker_name?: string;
  start_time?: number;
}

/**
 * Fetch full transcript content from Fireflies on-demand
 *
 * This function:
 * 1. Checks if content is already cached in database
 * 2. If not, fetches from Fireflies API
 * 3. Caches the content for future use
 * 4. Returns the transcript text
 *
 * Called by enrichment system when transcript content is needed.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as FetchRequest;
    const { transcriptId } = body;

    if (!transcriptId) {
      return new Response(
        JSON.stringify({ error: "transcriptId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the deal_transcript record
    const { data: dealTranscript, error: fetchError } = await supabase
      .from('deal_transcripts')
      .select('id, fireflies_transcript_id, transcript_text, source')
      .eq('id', transcriptId)
      .single();

    if (fetchError || !dealTranscript) {
      return new Response(
        JSON.stringify({ error: "Transcript not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only works for Fireflies transcripts
    if (dealTranscript.source !== 'fireflies' || !dealTranscript.fireflies_transcript_id) {
      return new Response(
        JSON.stringify({ error: "Not a Fireflies transcript" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already cached (content length > 100 chars indicates real content)
    if (dealTranscript.transcript_text && dealTranscript.transcript_text.length > 100) {
      console.log(`Returning cached content for transcript ${transcriptId}`);
      return new Response(
        JSON.stringify({
          success: true,
          content: dealTranscript.transcript_text,
          cached: true,
          transcript_id: transcriptId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch from Fireflies API
    console.log(`Fetching content from Fireflies for transcript ${dealTranscript.fireflies_transcript_id}`);

    const { data: firefliesData, error: firefliesError } = await supabase.functions.invoke(
      'fireflies_fetch',
      {
        body: {
          id: dealTranscript.fireflies_transcript_id
        }
      }
    );

    if (firefliesError) {
      console.error("Fireflies fetch error:", firefliesError);
      throw new Error(`Failed to fetch from Fireflies: ${firefliesError.message}`);
    }

    if (!firefliesData) {
      throw new Error("No data returned from Fireflies");
    }

    // Extract transcript text from response
    // Fireflies returns either transcript_text directly or sentences array
    let transcriptText = '';

    if (firefliesData.transcript_text && typeof firefliesData.transcript_text === 'string') {
      transcriptText = firefliesData.transcript_text;
    } else if (firefliesData.sentences && Array.isArray(firefliesData.sentences)) {
      // Build transcript from sentences with speaker labels
      transcriptText = firefliesData.sentences
        .map((s: FirefliesSentence) => {
          const speaker = s.speaker_name || 'Unknown';
          return `${speaker}: ${s.text}`;
        })
        .join('\n');
    } else if (firefliesData.content && typeof firefliesData.content === 'string') {
      transcriptText = firefliesData.content;
    }

    if (!transcriptText || transcriptText.length < 50) {
      console.warn("Fetched content is too short or empty:", transcriptText?.substring(0, 100));
      throw new Error("No valid transcript content found in Fireflies response");
    }

    console.log(`Fetched ${transcriptText.length} characters from Fireflies`);

    // Cache the content in database
    const { error: updateError } = await supabase
      .from('deal_transcripts')
      .update({
        transcript_text: transcriptText,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', transcriptId);

    if (updateError) {
      console.error("Failed to cache transcript content:", updateError);
      // Don't fail the request - still return the content
    } else {
      console.log(`Cached transcript content for ${transcriptId}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        content: transcriptText,
        cached: false,
        transcript_id: transcriptId,
        length: transcriptText.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Fetch content error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
