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
  thesis_summary?: string;
  thesis_confidence?: 'high' | 'medium' | 'low' | 'insufficient';
  strategic_priorities?: string[];
  investment_criteria?: string;
  target_industries?: string[];
  target_geography?: string[];
  deal_size_range?: string;
  acquisition_timeline?: string;
  missing_information?: string[];
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

// Extract buyer thesis and insights from transcript using Claude
// CRITICAL: This is the ONLY source for thesis_summary - never from websites
async function extractBuyerInsights(transcriptText: string, apiKey: string): Promise<BuyerInsights> {
  const systemPrompt = `You are an M&A analyst extracting the PLATFORM COMPANY'S acquisition thesis from a call transcript.

CRITICAL REQUIREMENTS:
1. The thesis_summary MUST be derived ONLY from what was explicitly stated in this call transcript.
2. Write entirely from the PLATFORM COMPANY'S operating perspective, as expressed verbally in the call.
3. If the PE firm sponsor is mentioned, it should be incidental context only.
4. DO NOT infer, fill gaps, or "round out" the thesis with:
   - Typical PE investment criteria
   - Website language
   - Generic industry knowledge
   - Comparable platforms

5. If information is insufficient, set thesis_confidence to "insufficient" and list specific missing questions.
6. Every statement MUST be directly traceable to the transcript.

OUTPUT FORMAT:
- thesis_summary: 1-2 tight paragraphs, plain factual call-derived language, no marketing speak
- strategic_priorities: Array of specific priorities mentioned in the call
- thesis_confidence: "high" (comprehensive data), "medium" (partial data), "low" (minimal data), "insufficient" (cannot form thesis)
- missing_information: Questions that must be answered on a future call if data is insufficient`;

  const tool = {
    type: "function",
    function: {
      name: "extract_buyer_thesis",
      description: "Extract platform company thesis and acquisition criteria from call transcript",
      parameters: {
        type: "object",
        properties: {
          thesis_summary: { 
            type: "string", 
            description: "1-2 paragraph summary of the platform company's acquisition strategy as stated in the call. Write: 'Based on our conversation, [Company] is focused on...' Do NOT use marketing language or infer from website content." 
          },
          thesis_confidence: { 
            type: "string", 
            enum: ["high", "medium", "low", "insufficient"],
            description: "Confidence level based on data completeness from transcript"
          },
          strategic_priorities: { 
            type: "array", 
            items: { type: "string" }, 
            description: "Specific strategic priorities mentioned in the call" 
          },
          target_industries: { 
            type: "array", 
            items: { type: "string" }, 
            description: "Industries explicitly mentioned as targets" 
          },
          target_geography: { 
            type: "array", 
            items: { type: "string" }, 
            description: "Geographic preferences explicitly mentioned" 
          },
          deal_size_range: { 
            type: "string", 
            description: "Preferred deal size if mentioned (revenue/EBITDA ranges)" 
          },
          acquisition_timeline: { 
            type: "string", 
            description: "Timeline for making acquisitions if mentioned" 
          },
          missing_information: {
            type: "array",
            items: { type: "string" },
            description: "Questions that need to be answered on a future call if thesis_confidence is insufficient"
          }
        }
      }
    }
  };

  const result = await callClaudeWithTool(
    systemPrompt,
    `Extract the PLATFORM COMPANY'S thesis and acquisition criteria from this call transcript. Remember: every statement must be traceable to what was said in the call.\n\n${transcriptText.substring(0, 12000)}`,
    tool,
    apiKey,
    DEFAULT_CLAUDE_FAST_MODEL,
    45000
  );

  const insights = (result.data as BuyerInsights) || {};
  
  // Validate: if thesis_confidence is insufficient, ensure missing_information is populated
  if (insights.thesis_confidence === 'insufficient' && (!insights.missing_information || insights.missing_information.length === 0)) {
    insights.missing_information = [
      "What specific services/verticals are you targeting for add-ons?",
      "What geographic markets are you prioritizing?",
      "What is your target size range (revenue/EBITDA)?",
      "What is your acquisition timeline?",
      "What are your deal structure preferences?"
    ];
    insights.thesis_summary = "Insufficient source data. See missing_information for required follow-up questions.";
  }
  
  return insights;
}

// Update listing with extracted transcript data
async function updateListingFromTranscript(
  supabase: any,
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
// CRITICAL: This is the ONLY place thesis_summary should be saved from
async function updateBuyerFromTranscript(
  supabase: any,
  buyerId: string,
  insights: BuyerInsights,
  transcriptId: string
) {
  const updates: Record<string, unknown> = {};

  // THESIS FIELDS - Only saved from transcripts, never from websites
  if (insights.thesis_summary && insights.thesis_confidence !== 'insufficient') {
    updates.thesis_summary = insights.thesis_summary;
  }
  if (insights.thesis_confidence) {
    updates.thesis_confidence = insights.thesis_confidence;
  }
  if (insights.strategic_priorities?.length) {
    updates.strategic_priorities = insights.strategic_priorities;
  }
  
  // Other buyer criteria
  if (insights.target_industries?.length) {
    updates.target_industries = insights.target_industries;
  }
  if (insights.target_geography?.length) {
    updates.target_geographies = insights.target_geography;
  }
  if (insights.acquisition_timeline) {
    updates.acquisition_timeline = insights.acquisition_timeline;
  }

  if (Object.keys(updates).length > 0) {
    // Mark extraction source as transcript (highest priority)
    updates.extraction_sources = [{ 
      type: 'transcript',
      transcript_id: transcriptId, 
      extracted_at: new Date().toISOString(),
      fields_extracted: Object.keys(updates).filter(k => k !== 'extraction_sources')
    }];
    updates.data_last_updated = new Date().toISOString();
    
    const { error } = await supabase
      .from('remarketing_buyers')
      .update(updates)
      .eq('id', buyerId);

    if (error) {
      console.error("Failed to update buyer from transcript:", error);
    } else {
      console.log(`[TranscriptExtraction] Updated buyer ${buyerId} with ${Object.keys(updates).length} fields (thesis_summary: ${!!updates.thesis_summary})`);
    }
  } else if (insights.thesis_confidence === 'insufficient') {
    // Save insufficient flag and missing questions
    const insufficientUpdate = {
      thesis_confidence: 'insufficient',
      notes: `Insufficient transcript data. Follow-up questions needed:\n${(insights.missing_information || []).map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
      extraction_sources: [{ 
        type: 'transcript',
        transcript_id: transcriptId, 
        extracted_at: new Date().toISOString(),
        status: 'insufficient_data'
      }],
      data_last_updated: new Date().toISOString(),
    };
    
    const { error } = await supabase
      .from('remarketing_buyers')
      .update(insufficientUpdate)
      .eq('id', buyerId);

    if (error) {
      console.error("Failed to update buyer with insufficient status:", error);
    } else {
      console.log(`[TranscriptExtraction] Marked buyer ${buyerId} as insufficient - follow-up needed`);
    }
  }
}
