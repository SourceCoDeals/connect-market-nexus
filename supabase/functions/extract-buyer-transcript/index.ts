import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Claude API configuration
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-20250514';

interface TranscriptExtractionRequest {
  transcript_id?: string;
  universe_id?: string;
  buyer_id?: string;
  transcript_text?: string;
  participants?: string[];
  call_date?: string;
}

interface ExtractedInsights {
  buyer_criteria?: {
    size_criteria?: {
      revenue_min?: number;
      revenue_max?: number;
      revenue_sweet_spot?: number;
      ebitda_min?: number;
      ebitda_max?: number;
      ebitda_sweet_spot?: number;
      employee_min?: number;
      employee_max?: number;
      location_count_min?: number;
      location_count_max?: number;
      confidence: number;
    };
    service_criteria?: {
      target_services: string[];
      service_exclusions: string[];
      service_confidence: number;
      service_notes: string;
    };
    geography_criteria?: {
      target_regions: string[];
      target_states: string[];
      geographic_exclusions: string[];
      geographic_flexibility: 'strict' | 'flexible' | 'national';
      confidence: number;
      geography_notes: string;
    };
    deal_preferences?: {
      deal_types: string[];
      structure_preferences: string[];
      valuation_parameters?: string;
      deal_breakers: string[];
      preferred_characteristics: string[];
      confidence: number;
    };
  };
  buyer_profile?: {
    thesis_summary?: string;
    strategic_priorities?: string[];
    acquisition_timeline?: string;
    deal_breakers?: string[];
  };
  key_quotes: Array<{
    quote: string;
    speaker: string;
    context: string;
    importance: 'high' | 'medium' | 'low';
  }>;
  overall_confidence: number;
}

/**
 * Extract buyer criteria and insights from call/meeting transcript
 * SOURCE PRIORITY: 100 (highest priority source)
 */
async function extractInsightsFromTranscript(
  transcriptText: string,
  participants: string[],
  callDate?: string
): Promise<ExtractedInsights> {
  console.log('[EXTRACTION_START] Processing buyer transcript');
  console.log(`[PARTICIPANTS] ${participants.join(', ')}`);

  const systemPrompt = `You are an expert M&A advisor at an investment bank that matches acquisition-ready businesses with institutional buyers (PE firms, platform companies, and strategic acquirers). You are analyzing a call transcript to extract the buyer's specific acquisition criteria and investment preferences.

Your job is to understand EXACTLY what this buyer is looking for so the system can match them with relevant deal opportunities. Precision matters — a buyer looking for "$5-15M revenue HVAC companies in the Southeast" is very different from one looking for "$20-50M revenue restoration companies nationally."

CORE RULES:

1. EXTRACT WHAT THEY SAID, NOT WHAT YOU THINK THEY MEAN: If the buyer says "we like companies around $10M," extract that. Do not expand it to "$5-20M" because that seems like a reasonable range. Only extract stated ranges.

2. CONFIDENCE SCORING: Every extracted criterion gets a confidence score:
   - 90-100: Direct quote with specific criteria ("We target companies with $10-50M in revenue")
   - 70-89: Clear statement with some detail ("We generally focus on the Southeast region")
   - 50-69: Implied preference from context or indirect statement ("We've done a few deals in Texas")
   - Below 50: Vague or uncertain — include but flag as low confidence

3. DISTINGUISH HARD REQUIREMENTS FROM PREFERENCES: "We won't look at anything under $2M EBITDA" is a hard floor. "We prefer $3-5M EBITDA" is a preference. "We've done deals at $1M EBITDA" is historical context. These are different and must be tagged differently.

4. LISTEN FOR EXCLUSIONS: What the buyer says they DON'T want is as important as what they DO want. "We stay away from anything with environmental exposure" or "We don't do turnarounds" — capture these explicitly.

5. SEPARATE THE PE FIRM FROM THE PLATFORM: If a PE-backed platform company is on the call, distinguish between the PE firm's criteria and the platform operator's criteria. The platform's operational priorities take precedence for matching purposes.

6. TRACK THE SPEAKER: If multiple people are on the call (e.g., a PE partner and a platform CEO), note who said what. The platform CEO saying "we need HVAC techs" has different weight than the PE partner saying "we like the HVAC space."

7. NUMBERS AS RAW INTEGERS: All dollar amounts must be stored as raw numbers with no formatting. "$7.5M" = 7500000. "about two million" = 2000000.

8. PERCENTAGES AS DECIMALS: 18% = 0.18. 5.5% = 0.055.

9. STATE CODES: Always 2-letter uppercase. "IN" not "Indiana."

10. VERBATIM QUOTES: When extracting key_quotes, copy-paste the EXACT words from the transcript. Do not paraphrase, clean up grammar, or summarize.`;

  const userPrompt = `Analyze the following buyer call transcript and extract their acquisition criteria, profile, and key statements.

PARTICIPANTS: ${participants.join(', ')}
${callDate ? `DATE: ${callDate}` : ''}

---

## BUYER CRITERIA

### size_criteria
Extract EVERY size parameter mentioned. Rules:
- "We target $10-50M revenue companies" → revenue_min = 10000000, revenue_max = 50000000, confidence = 95.
- "Sweet spot is around $3M EBITDA" → ebitda_sweet_spot = 3000000, confidence = 90.
- "We've done deals as small as $1M EBITDA" → This is historical, NOT a minimum. Only set ebitda_min if they say "we won't go below" or "minimum is."
- "We prefer 50+ employees" → employee_min = 50, confidence = 75.
- Hard requirements ("we won't look at," "minimum is," "must be at least") → confidence 90-100.
- Soft preferences ("we prefer," "ideally," "sweet spot") → confidence 70-89.
- Historical mentions ("we've done") → confidence 50-69. Set these as context, not requirements.

### service_criteria
Listen for:
- Explicit targets: "We're building a restoration platform" → target_services = ["fire restoration", "water restoration", "mold remediation"].
- Adjacencies: "We'd love to add roofing to our platform" → include "roofing."
- Exclusions: "We stay away from mold — too much liability" → service_exclusions = ["mold remediation"].
- Be specific: "HVAC" should become ["commercial HVAC", "residential HVAC"] if the buyer specifies which.
- If they describe an industry theme but not specific services, list the most likely constituent services AND note in service_notes that these are inferred from the theme.

### geography_criteria
Rules:
- Map regions to standard US regions: Southeast, Northeast, Mid-Atlantic, Midwest, Southwest, West, Pacific Northwest, Mountain West.
- "We focus on the Southeast" → target_regions = ["Southeast"], geographic_flexibility = "strict", confidence = 85.
- "We're national but most of our deals are in the Southeast" → target_regions = ["Southeast"], geographic_flexibility = "national", confidence = 70.
- Map every city/state mentioned: "We have operations in Dallas and Houston" → target_states includes "TX."
- "We don't want to go west of the Mississippi" → geographic_exclusions should list western states or note the boundary in geography_notes.
- If a buyer names specific MSAs like "We want top-25 MSAs," note that in geography_notes.

### deal_preferences
Listen carefully for:
- "We're looking for a platform" vs "We need add-ons for our existing platform" — fundamentally different.
- Structure: "We always do majority recap with rollover equity" vs "We buy 100%."
- Valuation: "We typically pay 4-6x EBITDA" or "We won't go above 5x."
- Deal breakers: "No turnarounds," "No owner-dependent businesses," "Must have a management team in place," "No environmental issues."
- Preferences: "We prefer recurring revenue," "We like businesses with long customer contracts," "Ideally family-owned."

---

## BUYER PROFILE

### thesis_summary (2-4 sentences)
Write a clear summary of this buyer's acquisition thesis. What are they building? Why? What does their ideal target look like? Use ONLY what was stated in the call. Do NOT supplement with generic PE language or assumed strategies.

### strategic_priorities (array, ordered by emphasis)
List the buyer's stated strategic priorities in order of emphasis during the call.

### acquisition_timeline ("active"|"opportunistic"|"on_hold")
- "active": Buyer is actively looking, has capital deployed, wants to see deals now.
- "opportunistic": Buyer will look at deals but isn't in a rush.
- "on_hold": Buyer is pausing acquisitions.

### deal_breakers (array)
EVERY deal-breaker mentioned, explicit or strongly implied.

---

## KEY QUOTES (6-10)
Extract 6-10 key quotes. Rules:
- EXACT VERBATIM from transcript.
- Identify the speaker (by name if possible, otherwise role).
- Provide brief context.
- Importance: "high" = specific criteria/deal-breakers, "medium" = preferences/strategic context, "low" = general observations.
- Priority order: size criteria > geography > services > deal structure > strategic priorities > general observations.

---

Now analyze the transcript below and return a JSON object with all fields above.

TRANSCRIPT:
${transcriptText.slice(0, 50000)}`;

  const tools = [{
    name: "extract_buyer_insights",
    description: "Extract comprehensive buyer acquisition criteria, profile, and key quotes from call transcript",
    input_schema: {
      type: "object",
      properties: {
        buyer_criteria: {
          type: "object",
          description: "Structured acquisition criteria extracted from the call",
          properties: {
            size_criteria: {
              type: "object",
              properties: {
                revenue_min: { type: "number", description: "Minimum revenue target in raw dollars. Only set if explicit floor stated." },
                revenue_max: { type: "number", description: "Maximum revenue target in raw dollars." },
                revenue_sweet_spot: { type: "number", description: "Ideal revenue target in raw dollars." },
                ebitda_min: { type: "number", description: "Minimum EBITDA target in raw dollars. Only set if explicit floor stated." },
                ebitda_max: { type: "number", description: "Maximum EBITDA target in raw dollars." },
                ebitda_sweet_spot: { type: "number", description: "Ideal EBITDA target in raw dollars." },
                employee_min: { type: "number", description: "Minimum employee count preference." },
                employee_max: { type: "number", description: "Maximum employee count preference." },
                location_count_min: { type: "number", description: "Minimum number of locations." },
                location_count_max: { type: "number", description: "Maximum number of locations." },
                confidence: { type: "number", description: "Confidence score 0-100 for size criteria extraction." }
              },
              required: ["confidence"]
            },
            service_criteria: {
              type: "object",
              properties: {
                target_services: {
                  type: "array",
                  items: { type: "string" },
                  description: "Specific services buyer is targeting. Be specific: 'commercial HVAC' not just 'HVAC'."
                },
                service_exclusions: {
                  type: "array",
                  items: { type: "string" },
                  description: "Services buyer explicitly avoids or excludes."
                },
                service_confidence: { type: "number", description: "Confidence score 0-100." },
                service_notes: { type: "string", description: "Context on why they want/avoid certain services. Note if inferred from industry theme." }
              },
              required: ["target_services", "service_confidence"]
            },
            geography_criteria: {
              type: "object",
              properties: {
                target_regions: {
                  type: "array",
                  items: { type: "string" },
                  description: "Standard US regions: Southeast, Northeast, Mid-Atlantic, Midwest, Southwest, West, Pacific Northwest, Mountain West."
                },
                target_states: {
                  type: "array",
                  items: { type: "string" },
                  description: "2-letter state codes where buyer wants to acquire. Map all city mentions to states."
                },
                geographic_exclusions: {
                  type: "array",
                  items: { type: "string" },
                  description: "States or regions buyer explicitly avoids."
                },
                geographic_flexibility: {
                  type: "string",
                  enum: ["strict", "flexible", "national"],
                  description: "How strict their geographic focus is."
                },
                confidence: { type: "number", description: "Confidence score 0-100." },
                geography_notes: { type: "string", description: "Additional geographic context, MSA preferences, boundary descriptions." }
              },
              required: ["confidence"]
            },
            deal_preferences: {
              type: "object",
              properties: {
                deal_types: {
                  type: "array",
                  items: { type: "string" },
                  description: "E.g., 'platform', 'add-on', 'tuck-in', 'strategic acquisition'."
                },
                structure_preferences: {
                  type: "array",
                  items: { type: "string" },
                  description: "E.g., 'majority recapitalization', 'full buyout', 'earnout', 'rollover equity'."
                },
                valuation_parameters: { type: "string", description: "Any multiple ranges or valuation approach mentioned." },
                deal_breakers: {
                  type: "array",
                  items: { type: "string" },
                  description: "Explicit things that kill a deal for this buyer."
                },
                preferred_characteristics: {
                  type: "array",
                  items: { type: "string" },
                  description: "Nice-to-haves that aren't hard requirements."
                },
                confidence: { type: "number", description: "Confidence score 0-100." }
              },
              required: ["confidence"]
            }
          }
        },
        buyer_profile: {
          type: "object",
          properties: {
            thesis_summary: {
              type: "string",
              description: "2-4 sentence summary of buyer's acquisition thesis. ONLY from what was stated in the call."
            },
            strategic_priorities: {
              type: "array",
              items: { type: "string" },
              description: "Buyer's stated strategic priorities, ordered by emphasis during the call."
            },
            acquisition_timeline: {
              type: "string",
              enum: ["active", "opportunistic", "on_hold"],
              description: "How actively the buyer is pursuing acquisitions."
            },
            deal_breakers: {
              type: "array",
              items: { type: "string" },
              description: "Every deal-breaker mentioned, explicit or strongly implied."
            }
          }
        },
        key_quotes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              quote: { type: "string", description: "EXACT VERBATIM quote from transcript." },
              speaker: { type: "string", description: "Who said it — by name or role (PE Partner, Platform CEO, Buyer Representative)." },
              context: { type: "string", description: "What question/topic prompted this statement." },
              importance: {
                type: "string",
                enum: ["high", "medium", "low"],
                description: "high = specific criteria/deal-breakers, medium = preferences/context, low = general observations."
              }
            },
            required: ["quote", "speaker", "context", "importance"]
          },
          description: "6-10 key verbatim quotes. Priority: size > geography > services > deal structure > strategy."
        },
        overall_confidence: {
          type: "number",
          description: "Overall extraction confidence 0-100."
        }
      },
      required: ["key_quotes", "overall_confidence"]
    }
  }];

  const startTime = Date.now();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: tools,
      tool_choice: { type: 'tool', name: 'extract_buyer_insights' }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const duration = Date.now() - startTime;

  console.log(`[EXTRACTION_COMPLETE] ${duration}ms`);
  console.log(`[USAGE] Input: ${result.usage?.input_tokens}, Output: ${result.usage?.output_tokens}`);
  console.log(`[KEY_QUOTES] ${result.content.find((c: any) => c.type === 'tool_use')?.input?.key_quotes?.length || 0} quotes extracted`);

  // Extract tool use result
  const toolUse = result.content.find((c: any) => c.type === 'tool_use');
  if (!toolUse) {
    throw new Error('No tool use found in Claude response');
  }

  return toolUse.input as ExtractedInsights;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const {
      transcript_id,
      universe_id,
      buyer_id,
      transcript_text,
      participants = [],
      call_date
    }: TranscriptExtractionRequest = await req.json();

    if (!transcript_text && !transcript_id) {
      throw new Error('Must provide either transcript_text or transcript_id');
    }

    console.log(`[REQUEST] Transcript: ${transcript_id || 'new'}, Universe: ${universe_id}, Buyer: ${buyer_id}`);

    let finalTranscriptText = transcript_text;
    let transcriptRecord: any = null;

    // If transcript_id provided, load from database
    if (transcript_id) {
      const { data, error } = await supabase
        .from('buyer_transcripts')
        .select('*')
        .eq('id', transcript_id)
        .single();

      if (error) {
        throw new Error(`Failed to load transcript: ${error.message}`);
      }

      transcriptRecord = data;
      finalTranscriptText = data.transcript_text;

      // Update status to processing
      await supabase
        .from('buyer_transcripts')
        .update({
          extraction_status: 'processing',
          processed_at: new Date().toISOString()
        })
        .eq('id', transcript_id);
    } else {
      // Create new transcript record
      const { data, error } = await supabase
        .from('buyer_transcripts')
        .insert({
          buyer_id,
          universe_id,
          transcript_text: finalTranscriptText,
          participants,
          call_date: call_date ? new Date(call_date).toISOString() : null,
          extraction_status: 'processing',
          processed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create transcript record: ${error.message}`);
      }

      transcriptRecord = data;
    }

    console.log(`[TRANSCRIPT_RECORD] ID: ${transcriptRecord.id}`);

    // Extract insights from transcript
    try {
      const insights = await extractInsightsFromTranscript(
        finalTranscriptText!,
        participants.length > 0 ? participants : (transcriptRecord.participants || []),
        call_date || transcriptRecord.call_date
      );

      // Update transcript record with extracted insights
      const { error: updateError } = await supabase
        .from('buyer_transcripts')
        .update({
          extraction_status: 'completed',
          extracted_insights: insights,
          processed_at: new Date().toISOString()
        })
        .eq('id', transcriptRecord.id);

      if (updateError) {
        throw new Error(`Failed to update transcript: ${updateError.message}`);
      }

      // If buyer_id provided, update buyer record with insights
      if (buyer_id) {
        const buyerUpdates: any = {};

        // Map buyer_profile fields
        if (insights.buyer_profile) {
          if (insights.buyer_profile.thesis_summary) {
            buyerUpdates.thesis_summary = insights.buyer_profile.thesis_summary;
          }
          if (insights.buyer_profile.strategic_priorities?.length) {
            buyerUpdates.strategic_priorities = insights.buyer_profile.strategic_priorities;
          }
          if (insights.buyer_profile.acquisition_timeline) {
            buyerUpdates.acquisition_timeline = insights.buyer_profile.acquisition_timeline;
          }
          if (insights.buyer_profile.deal_breakers?.length) {
            buyerUpdates.deal_breakers = insights.buyer_profile.deal_breakers;
          }
        }

        // Map buyer_criteria fields to buyer record
        if (insights.buyer_criteria) {
          // Map service targets to target_services (NOT target_industries — that's a different field)
          if (insights.buyer_criteria.service_criteria?.target_services?.length) {
            buyerUpdates.target_services = insights.buyer_criteria.service_criteria.target_services;
          }

          // Map geography targets
          if (insights.buyer_criteria.geography_criteria?.target_states?.length) {
            buyerUpdates.target_geographies = insights.buyer_criteria.geography_criteria.target_states;
          }
          if (insights.buyer_criteria.geography_criteria?.target_regions?.length) {
            if (!buyerUpdates.target_geographies) {
              buyerUpdates.target_geographies = [];
            }
          }

          // Map size criteria — deal structure can ONLY come from transcripts
          const size = insights.buyer_criteria.size_criteria;
          if (size) {
            if (size.revenue_min) buyerUpdates.target_revenue_min = size.revenue_min;
            if (size.revenue_max) buyerUpdates.target_revenue_max = size.revenue_max;
            if (size.revenue_sweet_spot) buyerUpdates.revenue_sweet_spot = size.revenue_sweet_spot;
            if (size.ebitda_min) buyerUpdates.target_ebitda_min = size.ebitda_min;
            if (size.ebitda_max) buyerUpdates.target_ebitda_max = size.ebitda_max;
            if (size.ebitda_sweet_spot) buyerUpdates.ebitda_sweet_spot = size.ebitda_sweet_spot;
          }
        }

        // Add key quotes to buyer record
        if (insights.key_quotes?.length > 0) {
          buyerUpdates.key_quotes = insights.key_quotes.map(q => `"${q.quote}" - ${q.speaker}`);
        }

        if (Object.keys(buyerUpdates).length > 0) {
          // Fetch existing extraction_sources and append (don't overwrite)
          const { data: existingBuyer } = await supabase
            .from('remarketing_buyers')
            .select('extraction_sources')
            .eq('id', buyer_id)
            .single();

          const existingSources = (existingBuyer?.extraction_sources || []) as any[];

          buyerUpdates.extraction_sources = [
            ...existingSources,
            {
              type: 'transcript',
              transcript_id: transcriptRecord.id,
              extracted_at: new Date().toISOString(),
              fields_extracted: Object.keys(buyerUpdates).filter(k => k !== 'extraction_sources'),
              confidence: insights.overall_confidence
            }
          ];
          buyerUpdates.data_last_updated = new Date().toISOString();

          await supabase
            .from('remarketing_buyers')
            .update(buyerUpdates)
            .eq('id', buyer_id);

          console.log(`[BUYER_UPDATED] Applied ${Object.keys(buyerUpdates).length} fields to buyer ${buyer_id}. Confidence: ${insights.overall_confidence}`);
        }
      }

      // If universe_id provided, create extraction source record
      if (universe_id) {
        await supabase
          .from('criteria_extraction_sources')
          .insert({
            universe_id,
            source_type: 'call_transcript',
            source_name: `Transcript - ${participants.join(', ') || 'Unknown'}`,
            source_metadata: {
              transcript_id: transcriptRecord.id,
              call_date: call_date || transcriptRecord.call_date,
              participants
            },
            extraction_status: 'completed',
            extraction_started_at: new Date().toISOString(),
            extraction_completed_at: new Date().toISOString(),
            extracted_data: insights,
            confidence_scores: {
              size: insights.buyer_criteria?.size_criteria?.confidence || 0,
              service: insights.buyer_criteria?.service_criteria?.service_confidence || 0,
              geography: insights.buyer_criteria?.geography_criteria?.confidence || 0,
              deal_preferences: insights.buyer_criteria?.deal_preferences?.confidence || 0,
              overall: insights.overall_confidence
            }
          });

        console.log(`[SOURCE_CREATED] Extraction source created for universe ${universe_id}`);
      }

      console.log(`[SUCCESS] Buyer transcript extraction completed with ${insights.overall_confidence}% confidence`);

      return new Response(
        JSON.stringify({
          success: true,
          transcript_id: transcriptRecord.id,
          insights,
          key_quotes_count: insights.key_quotes.length,
          message: 'Buyer transcript insights extracted successfully'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );

    } catch (extractionError) {
      // Mark extraction as failed
      await supabase
        .from('buyer_transcripts')
        .update({
          extraction_status: 'failed',
          extraction_error: extractionError.message,
          processed_at: new Date().toISOString()
        })
        .eq('id', transcriptRecord.id);

      throw extractionError;
    }

  } catch (error) {
    console.error('[ERROR]', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
