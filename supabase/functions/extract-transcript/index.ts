import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ANTHROPIC_API_URL,
  getAnthropicHeaders,
  DEFAULT_CLAUDE_FAST_MODEL,
  DEFAULT_CLAUDE_MODEL,
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
  financial_metrics?: {
    revenue?: { value?: number; period?: string; confidence?: string; source_quote?: string };
    ebitda?: { value?: number; margin?: number; confidence?: string; source_quote?: string };
    growth_rate?: { value?: number; period?: string; source_quote?: string };
    other_metrics?: Array<{ metric_name: string; value: number | string; source_quote: string }>;
  };
  owner_details?: {
    name?: string;
    role?: string;
    age_or_tenure?: string;
    motivation?: string;
    timeline?: string;
    compensation?: string;
  };
  company_details?: {
    name?: string;
    industry?: string;
    location?: string;
    employees?: number;
    founded?: number;
    services?: string[];
  };
  deal_details?: {
    asking_price?: number;
    valuation_multiple?: string;
    deal_type?: string;
    deal_stage?: string;
    broker_involved?: boolean;
    broker_name?: string;
  };
  key_takeaways?: string[];
  follow_up_needed?: string[];
}

interface BuyerInsights {
  thesis_summary?: string;
  thesis_confidence?: 'high' | 'medium' | 'low' | 'insufficient';
  strategic_priorities?: string[];
  target_industries?: string[];
  target_geography?: { regions?: string[]; states?: string[]; notes?: string };
  deal_size_range?: { revenue_min?: number; revenue_max?: number; ebitda_min?: number; ebitda_max?: number; notes?: string };
  acquisition_timeline?: string;
  services_offered?: string[];
  business_summary?: string;
  operating_locations?: string[];
  geographic_footprint?: string[];
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
    const { buyerId, transcriptText, source, transcriptId, transcript_id, entity_type = 'both' } = body;

    let transcriptTextToProcess: string;
    let buyerIdToUpdate: string | undefined = buyerId;
    let listingIdToUpdate: string | undefined;
    let transcriptIdForTracking: string | undefined = transcriptId || transcript_id;
    let buyerTranscriptIdToUpdate: string | undefined = transcriptId;

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

      // Update buyer with extracted data
      await updateBuyerFromTranscript(
        supabase,
        buyerIdToUpdate,
        buyerInsights,
        transcriptIdForTracking || 'direct'
      );

      // Update buyer_transcripts table if transcriptId was provided
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

// ============================================================================
// DEAL INSIGHTS EXTRACTION (Spec Section 4: Generic Transcript — Deal Insights)
// ============================================================================

async function extractDealInsights(transcriptText: string, apiKey: string): Promise<DealInsights> {
  const systemPrompt = `You are an M&A analyst extracting structured deal information from call transcripts. Your job is to pull out every financial metric, owner detail, and deal-relevant data point.

RULES:
1. Be precise with numbers: "two million" = 2000000, "about seven and a half million" = 7500000, "six fifty" in context of thousands = 650000, "six fifty" in context of millions = 6500000. Use context to determine scale.
2. Always convert to raw numbers — no dollar signs, commas, or abbreviations.
3. Percentages as decimals: 18% = 0.18.
4. If unsure about a figure, include it with a confidence flag rather than omitting it.
5. Extract financial data even when embedded in casual conversation: "yeah, we cleared about two million after expenses last year" = EBITDA/profit ~2000000.
6. Distinguish between: revenue, gross profit, EBITDA, SDE, net income, cash flow. Owners use these terms loosely — categorize based on context, not the word they used.`;

  const tool = {
    type: "function",
    function: {
      name: "extract_deal_insights",
      description: "Extract all deal-relevant information from a transcript including financials, owner details, company details, and deal specifics",
      parameters: {
        type: "object",
        properties: {
          financial_metrics: {
            type: "object",
            properties: {
              revenue: {
                type: "object",
                properties: {
                  value: { type: "number", description: "Annual revenue in raw dollars (e.g., 5000000 for $5M)" },
                  period: { type: "string", description: "Time period: TTM, FY2025, etc." },
                  confidence: { type: "string", enum: ["high", "medium", "low"], description: "high=explicit, medium=approximate, low=inferred" },
                  source_quote: { type: "string", description: "Exact verbatim quote where revenue was mentioned" }
                }
              },
              ebitda: {
                type: "object",
                properties: {
                  value: { type: "number", description: "EBITDA/SDE in raw dollars" },
                  margin: { type: "number", description: "EBITDA margin as decimal (0.18 for 18%)" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                  source_quote: { type: "string", description: "Exact verbatim quote" }
                }
              },
              growth_rate: {
                type: "object",
                properties: {
                  value: { type: "number", description: "Growth rate as decimal (0.15 for 15%)" },
                  period: { type: "string", description: "Time period for growth rate" },
                  source_quote: { type: "string" }
                }
              },
              other_metrics: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    metric_name: { type: "string", description: "E.g., average job size, customer count, backlog" },
                    value: { type: "string", description: "Value of the metric (number or description)" },
                    source_quote: { type: "string" }
                  },
                  required: ["metric_name", "value"]
                },
                description: "Any financial metrics that don't fit main categories"
              }
            }
          },
          owner_details: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string" },
              age_or_tenure: { type: "string", description: "Age or years in business" },
              motivation: { type: "string", description: "Why they're selling/exploring options" },
              timeline: { type: "string", description: "Desired timeline for transaction" },
              compensation: { type: "string", description: "Owner compensation if mentioned (salary, benefits, perks)" }
            }
          },
          company_details: {
            type: "object",
            properties: {
              name: { type: "string" },
              industry: { type: "string", description: "Most specific industry label" },
              location: { type: "string", description: "City, ST format" },
              employees: { type: "number", description: "Total employee count (FT + PT)" },
              founded: { type: "number", description: "4-digit founding year" },
              services: {
                type: "array",
                items: { type: "string" },
                description: "All services/products mentioned"
              }
            }
          },
          deal_details: {
            type: "object",
            properties: {
              asking_price: { type: "number", description: "Asking price in raw dollars" },
              valuation_multiple: { type: "string", description: "E.g., '4-6x EBITDA', '1.2x revenue'" },
              deal_type: { type: "string", description: "Full sale, majority recap, partnership, etc." },
              deal_stage: { type: "string", description: "Early exploration, LOI, due diligence, etc." },
              broker_involved: { type: "boolean" },
              broker_name: { type: "string" }
            }
          },
          key_takeaways: {
            type: "array",
            items: { type: "string" },
            description: "5-8 most important facts from this call. Prioritize: financial data, owner situation, deal timing, red flags, competitive advantages."
          },
          follow_up_needed: {
            type: "array",
            items: { type: "string" },
            description: "Questions that remain unanswered after this call."
          }
        }
      }
    }
  };

  const result = await callClaudeWithTool(
    systemPrompt,
    `Extract all deal-relevant information from this transcript. Capture every financial figure, owner detail, and deal-relevant data point.\n\nTRANSCRIPT:\n${transcriptText}`,
    tool,
    apiKey,
    DEFAULT_CLAUDE_MODEL,
    45000,
    8192
  );

  return (result.data as DealInsights) || {};
}

// ============================================================================
// BUYER THESIS EXTRACTION (Spec Section 3: Generic Transcript — Buyer Thesis)
// ============================================================================

async function extractBuyerInsights(transcriptText: string, apiKey: string): Promise<BuyerInsights> {
  const systemPrompt = `You are an M&A analyst extracting the PLATFORM COMPANY'S acquisition thesis from a call transcript. You must distinguish between the platform company's operating perspective and the PE firm sponsor's investment perspective. The platform company's actual operational needs and stated criteria take precedence.

CRITICAL RULES — READ CAREFULLY:

1. TRANSCRIPT-ONLY EXTRACTION: Every statement in thesis_summary MUST be directly traceable to something said in the call. If you cannot point to a specific moment in the transcript that supports a claim, do not include it.

2. DO NOT INFER, FILL GAPS, OR "ROUND OUT" THE THESIS WITH:
   - Typical PE criteria for this industry
   - Language from the company's website or marketing materials
   - Generic industry knowledge ("most restoration companies prefer…")
   - What "comparable platforms" usually look for
   - Your own assessment of what would be logical for them to want

3. PLATFORM vs PE FIRM: The PE firm sponsor is incidental context. "Apex Capital partners with Apex Restoration to pursue add-ons" — focus on Apex Restoration's criteria, not Apex Capital's general investment thesis.

4. INSUFFICIENT DATA IS A VALID ANSWER: If the transcript doesn't contain enough information to construct a meaningful thesis, set thesis_confidence to "insufficient" and explain what's missing in missing_information. This is BETTER than fabricating a thesis.

5. QUOTE YOUR SOURCES: For every claim in the thesis_summary, you should be able to identify the approximate part of the transcript it came from. If you can't, remove the claim.

6. NUMBERS AS RAW INTEGERS: All dollar amounts as raw numbers. "$7.5M" = 7500000.

7. STATE CODES: Always 2-letter uppercase. "IN" not "Indiana."`;

  const tool = {
    type: "function",
    function: {
      name: "extract_buyer_thesis",
      description: "Extract platform company thesis, operations, and acquisition criteria from call transcript. Every claim must be traceable to the transcript.",
      parameters: {
        type: "object",
        properties: {
          thesis_summary: {
            type: "string",
            description: "3-5 sentence thesis based SOLELY on what was stated in the call. What they're looking for, why, and ideal target. Every sentence must be directly supportable by the transcript. DO NOT use marketing language or infer from website content."
          },
          thesis_confidence: {
            type: "string",
            enum: ["high", "medium", "low", "insufficient"],
            description: "high=clear specific detailed criteria, medium=some criteria with gaps, low=vague statements only, insufficient=not enough info for meaningful thesis"
          },
          strategic_priorities: {
            type: "array",
            items: { type: "string" },
            description: "Priorities IN THE ORDER OF EMPHASIS given during the call. Only include priorities actually stated, not inferred."
          },
          target_industries: {
            type: "array",
            items: { type: "string" },
            description: "Specific industries mentioned as targets. Use specific labels: 'fire & water restoration' not just 'restoration'. Only include industries explicitly mentioned."
          },
          target_geography: {
            type: "object",
            properties: {
              regions: { type: "array", items: { type: "string" }, description: "Regions explicitly stated." },
              states: { type: "array", items: { type: "string" }, description: "2-letter state codes. Map cities to states. Do not assume adjacent states." },
              notes: { type: "string", description: "Additional geographic context." }
            },
            description: "Only geography explicitly stated in the call."
          },
          deal_size_range: {
            type: "object",
            properties: {
              revenue_min: { type: "number", description: "Minimum target revenue in raw dollars." },
              revenue_max: { type: "number", description: "Maximum target revenue in raw dollars." },
              ebitda_min: { type: "number", description: "Minimum target EBITDA in raw dollars." },
              ebitda_max: { type: "number", description: "Maximum target EBITDA in raw dollars." },
              notes: { type: "string", description: "Context on deal size preferences." }
            },
            description: "Only stated ranges. Do NOT infer from the platform's own size."
          },
          acquisition_timeline: {
            type: "string",
            description: "'active' (actively looking, capital deployed), 'opportunistic' (if right thing comes along), or 'on_hold' (pausing, digesting). Include brief explanation."
          },
          services_offered: {
            type: "array",
            items: { type: "string" },
            description: "Services the PLATFORM COMPANY currently offers (their existing services, helps understand complementary vs overlapping)."
          },
          business_summary: {
            type: "string",
            description: "2-3 sentence overview of what the platform company does operationally."
          },
          operating_locations: {
            type: "array",
            items: { type: "string" },
            description: "Cities where the platform currently operates, formatted as 'City, ST'."
          },
          geographic_footprint: {
            type: "array",
            items: { type: "string" },
            description: "2-letter state codes where the platform has PHYSICAL LOCATIONS or currently operates."
          },
          missing_information: {
            type: "array",
            items: { type: "string" },
            description: "EVERYTHING the transcript did NOT cover that would be needed for complete buyer matching. E.g., 'No EBITDA range specified', 'Geographic preferences not discussed', 'Valuation expectations not discussed'. Critical — tells the team what to ask on the next call."
          }
        }
      }
    }
  };

  const result = await callClaudeWithTool(
    systemPrompt,
    `Analyze the following transcript and extract the platform company's acquisition thesis and profile. Remember: every statement must be traceable to what was said in the call. If data is insufficient, that is a valid answer — set thesis_confidence to "insufficient" and list what's missing.\n\nTRANSCRIPT:\n${transcriptText}`,
    tool,
    apiKey,
    DEFAULT_CLAUDE_MODEL,
    45000,
    8192
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

  if (insights.financial_metrics?.revenue?.value) {
    updates.revenue = insights.financial_metrics.revenue.value;
    if (insights.financial_metrics.revenue.confidence) {
      updates.revenue_confidence = insights.financial_metrics.revenue.confidence;
    }
    if (insights.financial_metrics.revenue.source_quote) {
      updates.revenue_source_quote = insights.financial_metrics.revenue.source_quote;
    }
  }
  if (insights.financial_metrics?.ebitda?.value) {
    updates.ebitda = insights.financial_metrics.ebitda.value;
    if (insights.financial_metrics.ebitda.margin) {
      updates.ebitda_margin = insights.financial_metrics.ebitda.margin;
    }
    if (insights.financial_metrics.ebitda.confidence) {
      updates.ebitda_confidence = insights.financial_metrics.ebitda.confidence;
    }
  }
  if (insights.owner_details?.motivation) {
    updates.owner_goals = insights.owner_details.motivation;
  }
  if (insights.owner_details?.timeline) {
    updates.transition_preferences = insights.owner_details.timeline;
  }
  if (insights.company_details?.industry) {
    updates.industry = insights.company_details.industry;
  }
  if (insights.company_details?.employees) {
    updates.full_time_employees = insights.company_details.employees;
  }
  if (insights.company_details?.founded) {
    updates.founded_year = insights.company_details.founded;
  }
  if (insights.company_details?.services?.length) {
    updates.services = insights.company_details.services;
  }
  if (insights.deal_details?.asking_price) {
    updates.asking_price = insights.deal_details.asking_price;
  }
  if (insights.key_takeaways?.length) {
    updates.financial_notes = insights.key_takeaways.join('\n');
  }
  if (insights.follow_up_needed?.length) {
    updates.financial_followup_questions = insights.follow_up_needed;
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
  // Handle structured geography
  if (insights.target_geography) {
    if (insights.target_geography.states?.length) {
      updates.target_geographies = insights.target_geography.states;
    }
  }
  if (insights.acquisition_timeline) {
    updates.acquisition_timeline = insights.acquisition_timeline;
  }

  // Platform company operational details
  if (insights.services_offered?.length) {
    updates.services_offered = insights.services_offered.join(', ');
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
    // Fetch existing extraction_sources and append (don't overwrite)
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
      console.log(`[TranscriptExtraction] Updated buyer ${buyerId} with ${Object.keys(updates).length} fields (thesis_summary: ${!!updates.thesis_summary}). Total extraction sources: ${(updates.extraction_sources as any[]).length}`);
    }
  } else if (insights.thesis_confidence === 'insufficient') {
    // Fetch existing extraction_sources and append (don't overwrite) - insufficient data case
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
