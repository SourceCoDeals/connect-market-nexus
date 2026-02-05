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
  // New API: pass text directly (preferred for buyer_transcripts)
  buyerId?: string;
  transcriptText?: string;
  source?: string;
  transcriptId?: string; // ID of buyer_transcripts record to update
  // Legacy API: lookup from call_transcripts table
  transcript_id?: string;
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
  // Additional fields for comprehensive extraction
  services_offered?: string;
  operating_locations?: string[];
  geographic_footprint?: string[];
  business_summary?: string;
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
    const { buyerId, transcriptText, source, transcriptId, transcript_id, entity_type = 'both' } = body;

    let transcriptTextToProcess: string;
    let buyerIdToUpdate: string | undefined = buyerId;
    let listingIdToUpdate: string | undefined;
    let transcriptIdForTracking: string | undefined = transcriptId || transcript_id;
    let buyerTranscriptIdToUpdate: string | undefined = transcriptId; // Specific for buyer_transcripts table

    // NEW API: Direct text passed from buyer_transcripts flow
    if (transcriptText && buyerId) {
      console.log(`[TranscriptExtraction] Processing direct text for buyer ${buyerId}`);
      transcriptTextToProcess = transcriptText;
    }
    // LEGACY API: Lookup from call_transcripts table
    else if (transcript_id) {
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

      transcriptTextToProcess = transcript.transcript_text;
      buyerIdToUpdate = transcript.buyer_id;
      listingIdToUpdate = transcript.listing_id;

      // Update status to processing
      await supabase
        .from('call_transcripts')
        .update({ processing_status: 'processing', processed_at: new Date().toISOString() })
        .eq('id', transcript_id);
    } else {
      return new Response(
        JSON.stringify({ error: "Must provide either transcriptText+buyerId or transcript_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const insights: Record<string, unknown> = {};
    const keyQuotes: string[] = [];

    // Detect CEO involvement
    const ceoDetected = detectCEOInvolvement(transcriptTextToProcess);
    if (ceoDetected) {
      console.log(`[TranscriptExtraction] CEO detected in transcript`);
      insights.ceo_detected = true;

      // Create engagement signal if both buyer_id and listing_id are present
      if (buyerIdToUpdate && listingIdToUpdate) {
        await createEngagementSignal(
          supabase,
          listingIdToUpdate,
          buyerIdToUpdate,
          'ceo_involvement',
          40
        );
      }
    }

    // Extract based on entity type
    if ((entity_type === 'deal' || entity_type === 'both') && listingIdToUpdate) {
      console.log(`[TranscriptExtraction] Extracting deal insights`);
      const dealInsights = await extractDealInsights(transcriptTextToProcess, ANTHROPIC_API_KEY);
      insights.deal = dealInsights;

      // Extract key quotes
      const quotes = extractKeyQuotes(transcriptTextToProcess, 'deal');
      keyQuotes.push(...quotes);

      // Update listing with extracted data (source priority: transcript = 100)
      await updateListingFromTranscript(
        supabase,
        listingIdToUpdate,
        dealInsights,
        transcriptIdForTracking || 'direct'
      );
    }

    if ((entity_type === 'buyer' || entity_type === 'both') && buyerIdToUpdate) {
      console.log(`[TranscriptExtraction] Extracting buyer insights for ${buyerIdToUpdate}`);
      const buyerInsights = await extractBuyerInsights(transcriptTextToProcess, ANTHROPIC_API_KEY);
      insights.buyer = buyerInsights;

      // Extract key quotes
      const quotes = extractKeyQuotes(transcriptTextToProcess, 'buyer');
      keyQuotes.push(...quotes);

      // Update buyer with extracted data
      await updateBuyerFromTranscript(
        supabase,
        buyerIdToUpdate,
        buyerInsights,
        transcriptIdForTracking || 'direct'
      );

      // FIX #1: Update buyer_transcripts table if transcriptId was provided
      if (buyerTranscriptIdToUpdate) {
        const { error: transcriptUpdateError } = await supabase
          .from('buyer_transcripts')
          .update({
            processed_at: new Date().toISOString(),
            extracted_insights: buyerInsights,
            extraction_status: 'completed'
          })
          .eq('id', buyerTranscriptIdToUpdate);

        if (transcriptUpdateError) {
          console.error(`[TranscriptExtraction] Failed to update buyer_transcripts record:`, transcriptUpdateError);
        } else {
          console.log(`[TranscriptExtraction] Updated buyer_transcripts ${buyerTranscriptIdToUpdate} as processed`);
        }
      }
    }

    // Update call_transcripts record if using legacy API
    if (transcriptIdForTracking && transcript_id) {
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
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcript_id: transcriptIdForTracking,
        buyer_id: buyerIdToUpdate,
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
      description: "Extract platform company thesis, operations, and acquisition criteria from call transcript",
      parameters: {
        type: "object",
        properties: {
          thesis_summary: { 
            type: "string", 
            description: "1-2 paragraph summary of the platform company's ADD-ON acquisition strategy as stated in the call. This is their strategy for acquiring smaller companies. Write: 'Based on our conversation, [Company] is focused on...' Do NOT use marketing language or infer from website content." 
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
            description: "Industries explicitly mentioned as targets for add-on acquisitions" 
          },
          target_geography: { 
            type: "array", 
            items: { type: "string" }, 
            description: "Geographic preferences for add-on acquisitions (2-letter state codes)" 
          },
          deal_size_range: { 
            type: "string", 
            description: "Preferred deal size if mentioned (revenue/EBITDA ranges)" 
          },
          acquisition_timeline: { 
            type: "string", 
            description: "Timeline for making acquisitions if mentioned" 
          },
          services_offered: {
            type: "string",
            description: "Comma-separated list of services the platform company currently offers (e.g., 'water damage restoration, fire damage restoration, mold remediation')"
          },
          business_summary: {
            type: "string",
            description: "2-3 sentence overview of what the platform company does operationally"
          },
          operating_locations: {
            type: "array",
            items: { type: "string" },
            description: "Cities where the platform company currently operates, formatted as 'City, ST' (e.g., 'Dallas, TX')"
          },
          geographic_footprint: {
            type: "array",
            items: { type: "string" },
            description: "2-letter state codes where the platform company has PHYSICAL LOCATIONS or currently operates"
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
  
  // Platform company operational details
  if (insights.services_offered) {
    updates.services_offered = insights.services_offered;
  }
  if (insights.business_summary) {
    updates.business_summary = insights.business_summary;
  }
  if (insights.operating_locations?.length) {
    updates.operating_locations = insights.operating_locations;
  }
  if (insights.geographic_footprint?.length) {
    updates.geographic_footprint = insights.geographic_footprint;
  }

  if (Object.keys(updates).length > 0) {
    // FIX #2: Fetch existing extraction_sources and append (don't overwrite)
    const { data: existingBuyer } = await supabase
      .from('remarketing_buyers')
      .select('extraction_sources')
      .eq('id', buyerId)
      .single();

    const existingSources = (existingBuyer?.extraction_sources || []) as any[];

    // Mark extraction source as transcript (highest priority) - APPEND to array
    const newSource = {
      type: 'transcript',
      transcript_id: transcriptId,
      extracted_at: new Date().toISOString(),
      fields_extracted: Object.keys(updates).filter(k => k !== 'extraction_sources')
    };

    updates.extraction_sources = [...existingSources, newSource];
    updates.data_last_updated = new Date().toISOString();

    const { error } = await supabase
      .from('remarketing_buyers')
      .update(updates)
      .eq('id', buyerId);

    if (error) {
      console.error("Failed to update buyer from transcript:", error);
    } else {
      console.log(`[TranscriptExtraction] Updated buyer ${buyerId} with ${Object.keys(updates).length} fields (thesis_summary: ${!!updates.thesis_summary}). Total extraction sources: ${updates.extraction_sources.length}`);
    }
  } else if (insights.thesis_confidence === 'insufficient') {
    // FIX #2: Fetch existing extraction_sources and append (don't overwrite) - insufficient data case
    const { data: existingBuyer } = await supabase
      .from('remarketing_buyers')
      .select('extraction_sources')
      .eq('id', buyerId)
      .single();

    const existingSources = (existingBuyer?.extraction_sources || []) as any[];

    // Save insufficient flag and missing questions
    const insufficientUpdate = {
      thesis_confidence: 'insufficient',
      notes: `Insufficient transcript data. Follow-up questions needed:\n${(insights.missing_information || []).map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
      extraction_sources: [
        ...existingSources,
        {
          type: 'transcript',
          transcript_id: transcriptId,
          extracted_at: new Date().toISOString(),
          status: 'insufficient_data'
        }
      ],
      data_last_updated: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('remarketing_buyers')
      .update(insufficientUpdate)
      .eq('id', buyerId);

    if (error) {
      console.error("Failed to update buyer with insufficient status:", error);
    } else {
      console.log(`[TranscriptExtraction] Marked buyer ${buyerId} as insufficient - follow-up needed. Total extraction sources: ${insufficientUpdate.extraction_sources.length}`);
    }
  }
}
