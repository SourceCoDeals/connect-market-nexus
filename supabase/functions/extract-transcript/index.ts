import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  ANTHROPIC_API_URL, 
  getAnthropicHeaders, 
  DEFAULT_CLAUDE_FAST_MODEL,
  callClaudeWithTool
} from "../_shared/ai-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractTranscriptRequest {
  transcript_id: string;
  entity_type?: 'deal' | 'buyer' | 'both';
}

interface DealInsights {
  revenue?: number;
  ebitda?: number;
  growth_rate?: string;
  owner_involvement?: string;
  transition_timeline?: string;
  key_concerns?: string[];
  selling_motivation?: string;
}

interface BuyerInsights {
  investment_criteria?: string;
  target_industries?: string[];
  target_geography?: string[];
  deal_size_range?: string;
  acquisition_timeline?: string;
  strategic_priorities?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
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
    const insights: Record<string, unknown> = {};
    const keyQuotes: string[] = [];

    // Detect CEO involvement
    const ceoDetected = detectCEOInvolvement(transcriptText);
    if (ceoDetected) {
      console.log(`[TranscriptExtraction] CEO detected in transcript ${transcript_id}`);
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
      console.log(`[TranscriptExtraction] Extracting deal insights from transcript ${transcript_id}`);
      const dealInsights = await extractDealInsights(transcriptText, ANTHROPIC_API_KEY);
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
      console.log(`[TranscriptExtraction] Extracting buyer insights from transcript ${transcript_id}`);
      const buyerInsights = await extractBuyerInsights(transcriptText, ANTHROPIC_API_KEY);
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
  supabase: ReturnType<typeof createClient>,
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
    console.log(`[EngagementSignal] Created ${signalType} signal (+${signalValue} pts)`);
  }
}

// Extract deal insights from transcript using Claude
async function extractDealInsights(transcriptText: string, apiKey: string): Promise<DealInsights> {
  const systemPrompt = `You are an M&A analyst extracting structured deal information from call transcripts. 
Extract financial metrics, owner details, and deal-relevant information.
Be precise with numbers - convert "two million" to 2000000, etc.`;

  const tool = {
    type: "function",
    function: {
      name: "extract_deal_insights",
      description: "Extract structured deal information from a transcript",
      parameters: {
        type: "object",
        properties: {
          revenue: { type: "number", description: "Annual revenue in USD" },
          ebitda: { type: "number", description: "EBITDA in USD" },
          growth_rate: { type: "string", description: "YoY growth rate mentioned" },
          owner_involvement: { type: "string", description: "Level of owner involvement (full-time, part-time, passive)" },
          transition_timeline: { type: "string", description: "Owner's desired transition timeline" },
          key_concerns: { type: "array", items: { type: "string" }, description: "Key concerns or risks mentioned" },
          selling_motivation: { type: "string", description: "Primary reason for selling" }
        }
      }
    }
  };

  const result = await callClaudeWithTool(
    systemPrompt,
    `Extract deal insights from this transcript:\n\n${transcriptText.substring(0, 8000)}`,
    tool,
    apiKey,
    DEFAULT_CLAUDE_FAST_MODEL,
    30000
  );

  return (result.data as DealInsights) || {};
}

// Extract buyer insights from transcript using Claude
async function extractBuyerInsights(transcriptText: string, apiKey: string): Promise<BuyerInsights> {
  const systemPrompt = `You are an M&A analyst extracting buyer criteria and investment preferences from call transcripts.
Focus on what the buyer is looking for in potential acquisitions.`;

  const tool = {
    type: "function",
    function: {
      name: "extract_buyer_insights",
      description: "Extract structured buyer criteria from a transcript",
      parameters: {
        type: "object",
        properties: {
          investment_criteria: { type: "string", description: "Summary of investment criteria" },
          target_industries: { type: "array", items: { type: "string" }, description: "Industries of interest" },
          target_geography: { type: "array", items: { type: "string" }, description: "Geographic preferences" },
          deal_size_range: { type: "string", description: "Preferred deal size range" },
          acquisition_timeline: { type: "string", description: "Timeline for making acquisitions" },
          strategic_priorities: { type: "array", items: { type: "string" }, description: "Key strategic priorities" }
        }
      }
    }
  };

  const result = await callClaudeWithTool(
    systemPrompt,
    `Extract buyer insights from this transcript:\n\n${transcriptText.substring(0, 8000)}`,
    tool,
    apiKey,
    DEFAULT_CLAUDE_FAST_MODEL,
    30000
  );

  return (result.data as BuyerInsights) || {};
}

// Update listing with extracted transcript data
async function updateListingFromTranscript(
  supabase: ReturnType<typeof createClient>,
  listingId: string,
  insights: DealInsights,
  transcriptId: string
) {
  const updates: Record<string, unknown> = {};

  if (insights.revenue) {
    updates.revenue = insights.revenue;
  }
  if (insights.ebitda) {
    updates.ebitda = insights.ebitda;
  }
  if (insights.owner_involvement) {
    updates.owner_involvement = insights.owner_involvement;
  }
  if (insights.transition_timeline) {
    updates.transition_timeline = insights.transition_timeline;
  }
  if (insights.selling_motivation) {
    updates.selling_motivation = insights.selling_motivation;
  }

  if (Object.keys(updates).length > 0) {
    updates.extraction_sources = { transcript_id: transcriptId, extracted_at: new Date().toISOString() };
    
    const { error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', listingId);

    if (error) {
      console.error("Failed to update listing from transcript:", error);
    } else {
      console.log(`[TranscriptExtraction] Updated listing ${listingId} with ${Object.keys(updates).length} fields`);
    }
  }
}

// Update buyer with extracted transcript data
async function updateBuyerFromTranscript(
  supabase: ReturnType<typeof createClient>,
  buyerId: string,
  insights: BuyerInsights,
  transcriptId: string
) {
  const updates: Record<string, unknown> = {};

  if (insights.target_industries?.length) {
    updates.target_industries = insights.target_industries;
  }
  if (insights.target_geography?.length) {
    updates.target_geographies = insights.target_geography;
  }
  if (insights.strategic_priorities?.length) {
    updates.strategic_priorities = insights.strategic_priorities.join(', ');
  }
  if (insights.acquisition_timeline) {
    updates.acquisition_timeline = insights.acquisition_timeline;
  }

  if (Object.keys(updates).length > 0) {
    updates.extraction_sources = { transcript_id: transcriptId, extracted_at: new Date().toISOString() };
    
    const { error } = await supabase
      .from('buyers')
      .update(updates)
      .eq('id', buyerId);

    if (error) {
      console.error("Failed to update buyer from transcript:", error);
    } else {
      console.log(`[TranscriptExtraction] Updated buyer ${buyerId} with ${Object.keys(updates).length} fields`);
    }
  }
}
