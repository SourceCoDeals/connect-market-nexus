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
      
      // Fetch buyer context so the prompt can distinguish platform vs PE firm
      const { data: buyerContext } = await supabase
        .from('remarketing_buyers')
        .select('company_name, pe_firm_name')
        .eq('id', buyerIdToUpdate)
        .single();
      
      const buyerInsights = await extractBuyerInsights(
        transcriptTextToProcess,
        ANTHROPIC_API_KEY,
        buyerContext?.company_name || undefined,
        buyerContext?.pe_firm_name || undefined
      );
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

async function extractBuyerInsights(
  transcriptText: string,
  apiKey: string,
  platformCompanyName?: string,
  peFirmName?: string
): Promise<BuyerInsights> {
  const companyContext = platformCompanyName
    ? `\n\nKNOWN ENTITIES:
- PLATFORM COMPANY (the buyer / operating company): "${platformCompanyName}"
- PE FIRM SPONSOR: "${peFirmName || 'unknown'}"`
    : '';

  const systemPrompt = `You are an M&A analyst extracting the PLATFORM COMPANY'S acquisition thesis from a call transcript. You must distinguish between the platform company and the PE firm sponsor using BOTH names and contextual clues.
${companyContext}

CRITICAL — EVALUATION CALLS vs THESIS CALLS:
Some transcripts are calls where the BUYER is EVALUATING a potential acquisition target. In these calls:
- The TARGET company describes THEIR operations, services, locations, and financials
- The BUYER asks questions to evaluate fit
- DO NOT extract the target company's data as if it belongs to the buyer
- ONLY extract what you learn about the BUYER's acquisition criteria, strategy, and preferences
- If the call is primarily about evaluating a target, set thesis_confidence to "insufficient" and leave services_offered, business_summary, operating_locations, and geographic_footprint EMPTY
- The target's services, location, and financials are NOT the buyer's — they belong to the target

DISTINGUISHING PLATFORM vs PE FIRM — USE THESE CONTEXTUAL SIGNALS:

PLATFORM COMPANY signals (use for business_summary, services_offered, operating_locations, geographic_footprint):
- Discussions about the PLATFORM's own day-to-day operations, service delivery, crews, trucks, jobs
- "We do [service]", "our technicians", "we serve [area]", "our office in [city]" — ONLY when spoken BY the platform company
- Mentions of the platform's own specific service types (restoration, roofing, HVAC, plumbing, etc.)
- The platform company's own customer relationships, project descriptions, seasonal patterns
- Where the PLATFORM physically has offices, warehouses, or serves customers

PE FIRM signals (NEVER use for platform operational fields):
- Investment thesis, fund structure, LP discussions, portfolio strategy
- "Our fund", "our portfolio companies", "we've invested in"
- HQ of the PE firm — this is NOT an operating location
- Board-level strategy that doesn't describe day-to-day operations

TARGET COMPANY signals (NEVER use for buyer/platform fields):
- The person being interviewed describes THEIR company's operations
- "We have X employees", "we do $Y in revenue", "we're based in [city]"
- When spoken by someone who is NOT part of the buyer/platform organization
- Financial metrics of the company being evaluated for acquisition

GEOGRAPHIC FOOTPRINT — Only include states where the PLATFORM COMPANY physically operates. Never include:
- PE firm HQ location
- Target company locations
- States mentioned only as potential expansion targets

If the transcript is primarily an evaluation of a target company (not a discussion of the platform's own thesis), return:
- thesis_confidence: "insufficient"
- business_summary: "" (empty)
- services_offered: [] (empty)
- operating_locations: [] (empty)
- geographic_footprint: [] (empty)
- missing_information: explain that this was a target evaluation call`;

  const tool = {
    type: "function",
    function: {
      name: "extract_buyer_thesis",
      description: "Extract the platform company's acquisition thesis and buyer profile from a transcript. NEVER extract a target company's data as if it belongs to the buyer.",
      parameters: {
        type: "object",
        properties: {
          thesis_summary: {
            type: "string",
            description: "The platform company's OWN acquisition thesis — what they're looking to buy and why. NOT the target company's description. Leave empty if this is a target evaluation call."
          },
          thesis_confidence: {
            type: "string",
            enum: ["high", "medium", "low", "insufficient"],
            description: "How clearly the thesis was articulated. Set to 'insufficient' if this is primarily a target evaluation call rather than a thesis discussion."
          },
          strategic_priorities: {
            type: "array",
            items: { type: "string" },
            description: "The platform company's strategic goals and priorities. NOT the target's goals."
          },
          target_industries: {
            type: "array",
            items: { type: "string" },
            description: "Industries the buyer is targeting for acquisitions."
          },
          target_geography: {
            type: "object",
            properties: {
              regions: { type: "array", items: { type: "string" }, description: "Regional targets (e.g., 'Southeast', 'Mid-Atlantic')" },
              states: { type: "array", items: { type: "string" }, description: "2-letter state codes of target geographies" },
              notes: { type: "string", description: "Additional geographic context" }
            },
            description: "Where the buyer wants to acquire companies."
          },
          deal_size_range: {
            type: "object",
            properties: {
              revenue_min: { type: "number" },
              revenue_max: { type: "number" },
              ebitda_min: { type: "number" },
              ebitda_max: { type: "number" },
              notes: { type: "string" }
            },
            description: "Target acquisition size criteria."
          },
          acquisition_timeline: {
            type: "string",
            description: "How actively is the buyer looking? E.g., 'active', 'exploring', 'paused'. Use 'insufficient' if not discussed."
          },
          services_offered: {
            type: "array",
            items: { type: "string" },
            description: "Services the PLATFORM COMPANY itself provides (NOT the target's services). Leave empty if this is a target evaluation call."
          },
          business_summary: {
            type: "string",
            description: "Summary of the PLATFORM COMPANY's own business (NOT the target being evaluated). Leave empty if this is a target evaluation call."
          },
          operating_locations: {
            type: "array",
            items: { type: "string" },
            description: "'City, ST' format. Only the PLATFORM COMPANY's own physical locations. NOT PE firm HQ. NOT target company locations."
          },
          geographic_footprint: {
            type: "array",
            items: { type: "string" },
            description: "2-letter state codes where the PLATFORM COMPANY physically operates. NOT PE firm HQ states. NOT target company states."
          },
          missing_information: {
            type: "array",
            items: { type: "string" },
            description: "EVERYTHING the transcript did NOT cover. If this is a target evaluation call, note that the buyer's thesis/criteria were not discussed."
          }
        }
      }
    }
  };

  const result = await callClaudeWithTool(
    systemPrompt,
    `Analyze the following transcript and extract the platform company's acquisition thesis and profile. Remember: every statement must be traceable to what was said in the call. If the call is primarily about evaluating a target company for acquisition (not about the buyer's own thesis), set thesis_confidence to "insufficient" and leave operational fields empty.\n\nTRANSCRIPT:\n${transcriptText}`,
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
  }

  // CRITICAL: If thesis_confidence is insufficient, force-clear operational fields
  // These are likely from the TARGET company, not the buyer
  if (insights.thesis_confidence === 'insufficient') {
    insights.business_summary = '';
    insights.services_offered = [];
    insights.operating_locations = [];
    insights.geographic_footprint = [];
    // Keep thesis_summary blank too - insufficient means we don't have a real thesis
    insights.thesis_summary = '';
    insights.strategic_priorities = [];
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
// CRITICAL: Merges with existing data — never overwrites good data with empty/insufficient data
async function updateBuyerFromTranscript(
  supabase: any,
  buyerId: string,
  insights: BuyerInsights,
  transcriptId: string
) {
  // Fetch existing buyer data for merge logic
  const { data: existingBuyer } = await supabase
    .from('remarketing_buyers')
    .select('extraction_sources, thesis_summary, thesis_confidence, strategic_priorities, target_industries, services_offered, business_summary, operating_locations, geographic_footprint, key_quotes, target_geographies, acquisition_timeline')
    .eq('id', buyerId)
    .single();

  const existing = existingBuyer || {};
  const updates: Record<string, unknown> = {};

  // Helper: only overwrite if new value is non-empty AND (existing is empty OR new is better)
  const shouldUpdate = (field: string, newValue: unknown): boolean => {
    if (newValue === null || newValue === undefined) return false;
    if (typeof newValue === 'string' && newValue.trim() === '') return false;
    if (Array.isArray(newValue) && newValue.length === 0) return false;
    return true;
  };

  // Helper: merge arrays (union, deduplicated)
  const mergeArrays = (existing: unknown, newArr: string[]): string[] => {
    const existingArr = Array.isArray(existing) ? existing : [];
    const merged = new Set([...existingArr, ...newArr]);
    return Array.from(merged);
  };

  // THESIS FIELDS - Only saved from transcripts, never from websites
  // Only overwrite thesis if new one is meaningful (not insufficient)
  if (shouldUpdate('thesis_summary', insights.thesis_summary) && insights.thesis_confidence !== 'insufficient') {
    // Only overwrite if existing is empty OR new confidence is higher/equal
    const existingConfidence = existing.thesis_confidence || '';
    const confidenceRank: Record<string, number> = { 'high': 4, 'medium': 3, 'low': 2, 'insufficient': 1, '': 0 };
    const existingRank = confidenceRank[existingConfidence] || 0;
    const newRank = confidenceRank[insights.thesis_confidence || ''] || 0;

    if (!existing.thesis_summary || newRank >= existingRank) {
      updates.thesis_summary = insights.thesis_summary;
      updates.thesis_confidence = insights.thesis_confidence;
    }
  }

  // Strategic priorities — merge, don't overwrite
  if (insights.strategic_priorities?.length) {
    const merged = mergeArrays(existing.strategic_priorities, insights.strategic_priorities);
    if (merged.length > 0) updates.strategic_priorities = merged;
  }

  // Target industries — merge
  if (insights.target_industries?.length) {
    const merged = mergeArrays(existing.target_industries, insights.target_industries);
    if (merged.length > 0) updates.target_industries = merged;
  }

  // Handle structured geography — merge
  if (insights.target_geography?.states?.length) {
    const merged = mergeArrays(existing.target_geographies, insights.target_geography.states);
    if (merged.length > 0) updates.target_geographies = merged;
  }

  // Acquisition timeline — only update if currently empty or new is more specific
  if (shouldUpdate('acquisition_timeline', insights.acquisition_timeline) && insights.acquisition_timeline !== 'insufficient') {
    if (!existing.acquisition_timeline || existing.acquisition_timeline === 'insufficient') {
      updates.acquisition_timeline = insights.acquisition_timeline;
    }
  }

  // Deal structure — ONLY from transcripts
  if (insights.deal_size_range) {
    if (insights.deal_size_range.revenue_min) updates.target_revenue_min = insights.deal_size_range.revenue_min;
    if (insights.deal_size_range.revenue_max) updates.target_revenue_max = insights.deal_size_range.revenue_max;
    if (insights.deal_size_range.ebitda_min) updates.target_ebitda_min = insights.deal_size_range.ebitda_min;
    if (insights.deal_size_range.ebitda_max) updates.target_ebitda_max = insights.deal_size_range.ebitda_max;
  }

  // Platform company operational details — ONLY update if non-empty (guards already in extractBuyerInsights)
  if (shouldUpdate('services_offered', insights.services_offered)) {
    const newServices = Array.isArray(insights.services_offered)
      ? insights.services_offered.join(', ')
      : String(insights.services_offered);
    // Only overwrite if existing is empty or new has more detail
    if (!existing.services_offered || existing.services_offered.trim() === '') {
      updates.services_offered = newServices;
    }
  }

  if (shouldUpdate('business_summary', insights.business_summary)) {
    // Only overwrite if existing is empty or new is longer (more detailed)
    if (!existing.business_summary || existing.business_summary.trim() === '') {
      updates.business_summary = insights.business_summary;
    } else if (insights.business_summary!.length > existing.business_summary.length) {
      updates.business_summary = insights.business_summary;
    }
  }

  // Operating locations — merge
  if (insights.operating_locations?.length) {
    const existingLocs = Array.isArray(existing.operating_locations) ? existing.operating_locations : [];
    const merged = mergeArrays(existingLocs, insights.operating_locations);
    if (merged.length > 0) updates.operating_locations = merged;
  }

  // Geographic footprint — merge
  if (insights.geographic_footprint?.length) {
    const existingGeo = Array.isArray(existing.geographic_footprint) ? existing.geographic_footprint : [];
    const merged = mergeArrays(existingGeo, insights.geographic_footprint);
    if (merged.length > 0) updates.geographic_footprint = merged;
  }

  if (Object.keys(updates).length > 0) {
    const existingSources = (existing.extraction_sources || []) as any[];

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
    const existingSources = (existing.extraction_sources || []) as any[];

    // Log insufficient extraction but DON'T overwrite any existing data
    const insufficientUpdate: Record<string, unknown> = {
      extraction_sources: [
        ...existingSources,
        {
          type: 'transcript',
          transcript_id: transcriptId,
          extracted_at: new Date().toISOString(),
          status: 'insufficient_data',
          note: 'Target evaluation call — no buyer thesis data extracted'
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
      console.log(`[TranscriptExtraction] Marked transcript ${transcriptId} as insufficient for buyer ${buyerId} — no overwrites. Total extraction sources: ${(insufficientUpdate.extraction_sources as any[]).length}`);
    }
  }
}
