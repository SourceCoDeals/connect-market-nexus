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
  transcript_id?: string; // If extracting from existing transcript
  universe_id?: string; // If extracting for universe criteria
  buyer_id?: string; // If extracting for specific buyer
  transcript_text?: string; // Raw transcript text
  participants?: string[]; // Call participants
  call_date?: string; // Date of call/meeting
}

interface ExtractedInsights {
  buyer_criteria?: {
    size_criteria?: any;
    service_criteria?: any;
    geography_criteria?: any;
    deal_preferences?: string[];
    confidence_score: number;
  };
  buyer_profile?: {
    thesis_summary?: string;
    strategic_priorities?: string[];
    acquisition_timeline?: string;
    deal_breakers?: string[];
    confidence_score: number;
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
  console.log('[EXTRACTION_START] Processing transcript');
  console.log(`[PARTICIPANTS] ${participants.join(', ')}`);

  const systemPrompt = `You are an expert M&A advisor analyzing call/meeting transcripts to extract buyer fit criteria and investment insights. Transcripts are the HIGHEST PRIORITY SOURCE (priority: 100) because they capture actual buyer statements.

EXTRACTION FOCUS:
1. Buyer Criteria: What the buyer is explicitly looking for (size, geography, services)
2. Buyer Profile: Investment thesis, priorities, timeline, deal breakers
3. Key Quotes: Verbatim statements that reveal important criteria or preferences

CONFIDENCE SCORING:
- 90-100: Direct quotes with specific criteria ("We target $10-50M revenue")
- 70-89: Clear statements with some detail ("We like the Southeast region")
- 50-69: Implied preferences from context
- Below 50: Vague or uncertain statements

CRITICAL: Extract verbatim quotes for important criteria. These are invaluable for understanding buyer intent.`;

  const userPrompt = `Extract buyer insights from this transcript:

PARTICIPANTS: ${participants.join(', ')}
${callDate ? `DATE: ${callDate}` : ''}

TRANSCRIPT:
${transcriptText.slice(0, 50000)} <!-- Limit to 50k chars -->

Extract:
1. BUYER CRITERIA: Size ranges, geographic preferences, target services, deal preferences
2. BUYER PROFILE: Investment thesis, strategic priorities, timeline, deal breakers
3. KEY QUOTES: Important verbatim statements (capture exact wording)

Focus on EXPLICIT statements made by the buyer. Include confidence scores based on specificity.`;

  const tools = [{
    name: "extract_transcript_insights",
    description: "Extract buyer criteria and insights from call transcript",
    input_schema: {
      type: "object",
      properties: {
        buyer_criteria: {
          type: "object",
          nullable: true,
          properties: {
            size_criteria: {
              type: "object",
              nullable: true,
              properties: {
                revenue_min: { type: "number", nullable: true },
                revenue_max: { type: "number", nullable: true },
                revenue_sweet_spot: { type: "number", nullable: true },
                ebitda_min: { type: "number", nullable: true },
                ebitda_max: { type: "number", nullable: true },
                location_count_min: { type: "number", nullable: true },
                location_count_max: { type: "number", nullable: true },
              }
            },
            service_criteria: {
              type: "object",
              nullable: true,
              properties: {
                target_services: {
                  type: "array",
                  items: { type: "string" },
                  description: "Services buyer wants to acquire"
                },
                service_exclusions: {
                  type: "array",
                  items: { type: "string" },
                  description: "Services buyer avoids"
                }
              }
            },
            geography_criteria: {
              type: "object",
              nullable: true,
              properties: {
                target_regions: {
                  type: "array",
                  items: { type: "string" }
                },
                target_states: {
                  type: "array",
                  items: { type: "string" }
                },
                geographic_exclusions: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            },
            deal_preferences: {
              type: "array",
              items: { type: "string" },
              description: "Preferred deal structures, terms, conditions"
            },
            confidence_score: {
              type: "number",
              description: "Confidence in extracted criteria 0-100"
            }
          },
          required: ["confidence_score"]
        },
        buyer_profile: {
          type: "object",
          nullable: true,
          properties: {
            thesis_summary: {
              type: "string",
              description: "Investment thesis in 2-3 sentences"
            },
            strategic_priorities: {
              type: "array",
              items: { type: "string" },
              description: "Key strategic priorities"
            },
            acquisition_timeline: {
              type: "string",
              description: "How actively they're buying (active, opportunistic, on hold)"
            },
            deal_breakers: {
              type: "array",
              items: { type: "string" },
              description: "Absolute deal breakers mentioned"
            },
            confidence_score: {
              type: "number",
              description: "Confidence in profile 0-100"
            }
          },
          required: ["confidence_score"]
        },
        key_quotes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              quote: {
                type: "string",
                description: "Verbatim quote from transcript"
              },
              speaker: {
                type: "string",
                description: "Who said it (name or role)"
              },
              context: {
                type: "string",
                description: "What the quote reveals about buyer criteria"
              },
              importance: {
                type: "string",
                enum: ["high", "medium", "low"],
                description: "Importance of this quote"
              }
            },
            required: ["quote", "speaker", "context", "importance"]
          },
          description: "Important verbatim quotes"
        },
        overall_confidence: {
          type: "number",
          description: "Overall extraction confidence 0-100"
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
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: tools,
      tool_choice: { type: 'tool', name: 'extract_transcript_insights' }
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
      if (buyer_id && insights.buyer_profile) {
        const buyerUpdates: any = {};

        if (insights.buyer_profile.thesis_summary) {
          buyerUpdates.thesis_summary = insights.buyer_profile.thesis_summary;
        }
        if (insights.buyer_profile.strategic_priorities) {
          buyerUpdates.strategic_priorities = insights.buyer_profile.strategic_priorities;
        }
        if (insights.buyer_profile.acquisition_timeline) {
          buyerUpdates.acquisition_timeline = insights.buyer_profile.acquisition_timeline;
        }
        if (insights.buyer_profile.deal_breakers) {
          buyerUpdates.deal_breakers = insights.buyer_profile.deal_breakers;
        }

        // Add key quotes to buyer record
        if (insights.key_quotes && insights.key_quotes.length > 0) {
          buyerUpdates.key_quotes = insights.key_quotes.map(q => `"${q.quote}" - ${q.speaker}`);
        }

        if (Object.keys(buyerUpdates).length > 0) {
          buyerUpdates.data_last_updated = new Date().toISOString();

          await supabase
            .from('remarketing_buyers')
            .update(buyerUpdates)
            .eq('id', buyer_id);

          console.log(`[BUYER_UPDATED] Applied ${Object.keys(buyerUpdates).length} fields to buyer ${buyer_id}`);
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
              criteria: insights.buyer_criteria?.confidence_score || 0,
              profile: insights.buyer_profile?.confidence_score || 0,
              overall: insights.overall_confidence
            }
          });

        console.log(`[SOURCE_CREATED] Extraction source created for universe ${universe_id}`);
      }

      console.log(`[SUCCESS] Transcript extraction completed with ${insights.overall_confidence}% confidence`);

      return new Response(
        JSON.stringify({
          success: true,
          transcript_id: transcriptRecord.id,
          insights,
          key_quotes_count: insights.key_quotes.length,
          message: 'Transcript insights extracted successfully'
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
