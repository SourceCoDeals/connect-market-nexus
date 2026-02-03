import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";
import { validateExtraction } from "../_shared/validation.ts";
import { buildPriorityUpdates } from "../_shared/source-priority.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractTranscriptRequest {
  transcript_id: string;
  entity_type?: 'deal' | 'buyer' | 'both';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: ExtractTranscriptRequest = await req.json();
    const { transcript_id, entity_type = 'both' } = body;

    // Fetch transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from('call_transcripts')
      .select('*')
      .eq('id', transcript_id)
      .single();

    if (transcriptError || !transcript) {
      return new Response(
        JSON.stringify({ error: "Transcript not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await supabase
      .from('call_transcripts')
      .update({ processing_status: 'processing', processed_at: new Date().toISOString() })
      .eq('id', transcript_id);

    const transcriptText = transcript.transcript_text;
    const insights: any = {};
    const keyQuotes: string[] = [];

    // Detect CEO involvement
    const ceoDetected = detectCEOInvolvement(transcriptText);
    if (ceoDetected) {
      console.log(\`[TranscriptExtraction] CEO detected in transcript \${transcript_id}\`);
      insights.ceo_detected = true;

      // Create engagement signal if buyer_id is present
      if (transcript.buyer_id && transcript.listing_id) {
        await createEngagementSignal(
          supabase,
          transcript.listing_id,
          transcript.buyer_id,
          'ceo_involvement',
          40
        );
      }
    }

    // Extract based on entity type
    if ((entity_type === 'deal' || entity_type === 'both') && transcript.listing_id) {
      console.log(\`[TranscriptExtraction] Extracting deal insights from transcript \${transcript_id}\`);
      const dealInsights = await extractDealInsights(transcriptText, GEMINI_API_KEY);
      insights.deal = dealInsights;

      // Extract key quotes
      const quotes = extractKeyQuotes(transcriptText, 'deal');
      keyQuotes.push(...quotes);

      // Update listing with extracted data (source priority: transcript = 100)
      await updateListingFromTranscript(
        supabase,
        transcript.listing_id,
        dealInsights,
        transcript_id
      );
    }

    if ((entity_type === 'buyer' || entity_type === 'both') && transcript.buyer_id) {
      console.log(\`[TranscriptExtraction] Extracting buyer insights from transcript \${transcript_id}\`);
      const buyerInsights = await extractBuyerInsights(transcriptText, GEMINI_API_KEY);
      insights.buyer = buyerInsights;

      // Extract key quotes
      const quotes = extractKeyQuotes(transcriptText, 'buyer');
      keyQuotes.push(...quotes);

      // Update buyer with extracted data
      await updateBuyerFromTranscript(
        supabase,
        transcript.buyer_id,
        buyerInsights,
        transcript_id
      );
    }

    // Update transcript with insights
    const { error: updateError } = await supabase
      .from('call_transcripts')
      .update({
        extracted_insights: insights,
        key_quotes: keyQuotes,
        ceo_detected: ceoDetected,
        processing_status: 'completed',
      })
      .eq('id', transcript_id);

    if (updateError) {
      console.error("Failed to update transcript:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcript_id,
        insights,
        key_quotes: keyQuotes,
        ceo_detected: ceoDetected,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Extract transcript error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Detect CEO/owner involvement in transcript
function detectCEOInvolvement(transcript: string): boolean {
  const ceoPatterns = [
    /\bCEO\b/i,
    /\bchief executive officer\b/i,
    /\bowner\b/i,
    /\bfounder\b/i,
    /\bpresident\b/i,
    /\bI started (the|this) (business|company)/i,
    /\bI (own|founded|built) (the|this) (business|company)/i,
    /\bI('m| am) the owner/i,
  ];

  return ceoPatterns.some(pattern => pattern.test(transcript));
}

// Extract key verbatim quotes
function extractKeyQuotes(transcript: string, entityType: 'deal' | 'buyer'): string[] {
  const quotes: string[] = [];
  const sentences = transcript.split(/[.!?]+/);

  const keywords = entityType === 'deal'
    ? ['revenue', 'ebitda', 'profit', 'growth', 'owner', 'sell', 'transition']
    : ['looking for', 'target', 'acquire', 'invest', 'strategy', 'criteria'];

  for (const sentence of sentences) {
    if (keywords.some(kw => sentence.toLowerCase().includes(kw))) {
      const cleaned = sentence.trim();
      if (cleaned.length > 20 && cleaned.length < 200) {
        quotes.push(cleaned);
      }
    }
  }

  return quotes.slice(0, 5);
}

// Create engagement signal for CEO involvement
async function createEngagementSignal(
  supabase: any,
  listingId: string,
  buyerId: string,
  signalType: string,
  signalValue: number
) {
  const { error } = await supabase
    .from('engagement_signals')
    .insert({
      listing_id: listingId,
      buyer_id: buyerId,
      signal_type: signalType,
      signal_value: signalValue,
      source: 'system_detected',
      notes: 'Auto-detected from call transcript',
    });

  if (error) {
    console.error("Failed to create engagement signal:", error);
  } else {
    console.log(\`[EngagementSignal] Created \${signalType} signal (+\${signalValue} pts)\`);
  }
}
