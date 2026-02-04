import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Claude API configuration
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const EXTRACTION_TIMEOUT_MS = 120000; // 2 minutes per extraction
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds between retries

interface ExtractionRequest {
  universe_id: string;
  guide_content: string;
  source_name: string;
  industry_name?: string;
}

interface BuyerCriteria {
  size_criteria: {
    revenue_min?: number;
    revenue_max?: number;
    revenue_sweet_spot?: number;
    ebitda_min?: number;
    ebitda_max?: number;
    ebitda_sweet_spot?: number;
    location_count_min?: number;
    location_count_max?: number;
    employee_count_min?: number;
    employee_count_max?: number;
    confidence_score: number;
  };
  service_criteria: {
    target_services: string[];
    service_exclusions: string[];
    service_priorities: { service: string; priority: number; reasoning: string }[];
    confidence_score: number;
  };
  geography_criteria: {
    target_regions: string[];
    target_states: string[];
    geographic_exclusions: string[];
    geographic_priorities: { location: string; priority: number; reasoning: string }[];
    confidence_score: number;
  };
  buyer_types_criteria: {
    buyer_types: Array<{
      buyer_type: 'pe_firm' | 'platform' | 'strategic' | 'family_office' | 'other';
      profile_name: string;
      description: string;
      typical_size_range: { revenue_min?: number; revenue_max?: number };
      geographic_focus: string[];
      service_preferences: string[];
      strategic_rationale: string;
      typical_structure: string;
      growth_strategies: string[];
      priority_rank: number;
    }>;
    confidence_score: number;
  };
  overall_confidence: number;
}

/**
 * Extract buyer fit criteria from AI-generated M&A guide
 */
async function extractCriteriaFromGuide(
  guideContent: string,
  industryName: string
): Promise<BuyerCriteria> {
  console.log('[EXTRACTION_START] Beginning criteria extraction');
  console.log(`[GUIDE_LENGTH] ${guideContent.length} characters, ~${Math.round(guideContent.split(/\s+/).length)} words`);

  // Claude function calling for structured extraction
  const systemPrompt = `You are an expert M&A advisor specializing in buyer universe analysis. Your task is to extract structured buyer fit criteria from comprehensive industry M&A guides.

EXTRACTION GUIDELINES:
1. Size Criteria: Look for revenue/EBITDA ranges, location counts, employee counts that define ideal acquisition targets
2. Service Criteria: Identify which services/offerings buyers prefer and which they avoid
3. Geography Criteria: Extract geographic preferences (regions, states) and exclusions
4. Buyer Types: Identify different buyer categories (PE firms, platforms, strategics) with detailed profiles

CONFIDENCE SCORING:
- 90-100: Explicit numerical ranges and clear statements
- 70-89: Strong contextual evidence with some specificity
- 50-69: General patterns but lacking specific numbers
- Below 50: Weak or conflicting evidence

Be specific and quantitative. Extract actual numbers, not vague terms like "small" or "large".`;

  const userPrompt = `Extract comprehensive buyer fit criteria from this ${industryName} M&A guide:

${guideContent}

Extract:
1. SIZE CRITERIA: Revenue ranges, EBITDA ranges, location counts, employee counts
2. SERVICE CRITERIA: Specific services buyers target and avoid
3. GEOGRAPHY CRITERIA: Regions/states buyers prefer and avoid
4. BUYER TYPE PROFILES: Different buyer categories with detailed profiles

Provide specific numbers and ranges where available. Include confidence scores (0-100) for each section.`;

  const tools = [{
    name: "extract_buyer_criteria",
    description: "Extract structured buyer fit criteria from M&A industry guide",
    input_schema: {
      type: "object",
      properties: {
        size_criteria: {
          type: "object",
          properties: {
            revenue_min: { type: "number", description: "Minimum revenue in dollars" },
            revenue_max: { type: "number", description: "Maximum revenue in dollars" },
            revenue_sweet_spot: { type: "number", description: "Ideal revenue in dollars" },
            ebitda_min: { type: "number", description: "Minimum EBITDA in dollars" },
            ebitda_max: { type: "number", description: "Maximum EBITDA in dollars" },
            ebitda_sweet_spot: { type: "number", description: "Ideal EBITDA in dollars" },
            location_count_min: { type: "number", description: "Minimum number of locations" },
            location_count_max: { type: "number", description: "Maximum number of locations" },
            employee_count_min: { type: "number", description: "Minimum employees" },
            employee_count_max: { type: "number", description: "Maximum employees" },
            confidence_score: { type: "number", description: "Confidence score 0-100" }
          },
          required: ["confidence_score"]
        },
        service_criteria: {
          type: "object",
          properties: {
            target_services: {
              type: "array",
              items: { type: "string" },
              description: "Services buyers actively seek"
            },
            service_exclusions: {
              type: "array",
              items: { type: "string" },
              description: "Services buyers avoid"
            },
            service_priorities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  service: { type: "string" },
                  priority: { type: "number", description: "1=highest priority" },
                  reasoning: { type: "string" }
                },
                required: ["service", "priority", "reasoning"]
              }
            },
            confidence_score: { type: "number", description: "Confidence score 0-100" }
          },
          required: ["target_services", "confidence_score"]
        },
        geography_criteria: {
          type: "object",
          properties: {
            target_regions: {
              type: "array",
              items: { type: "string" },
              description: "US regions buyers target (e.g., 'Northeast', 'Southeast')"
            },
            target_states: {
              type: "array",
              items: { type: "string" },
              description: "Specific states buyers target"
            },
            geographic_exclusions: {
              type: "array",
              items: { type: "string" },
              description: "Regions/states buyers avoid"
            },
            geographic_priorities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  location: { type: "string" },
                  priority: { type: "number", description: "1=highest priority" },
                  reasoning: { type: "string" }
                },
                required: ["location", "priority", "reasoning"]
              }
            },
            confidence_score: { type: "number", description: "Confidence score 0-100" }
          },
          required: ["confidence_score"]
        },
        buyer_types_criteria: {
          type: "object",
          properties: {
            buyer_types: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  buyer_type: {
                    type: "string",
                    enum: ["pe_firm", "platform", "strategic", "family_office", "other"],
                    description: "Type of buyer"
                  },
                  profile_name: {
                    type: "string",
                    description: "Descriptive name (e.g., 'Regional Platform Aggregator')"
                  },
                  description: {
                    type: "string",
                    description: "Detailed profile description"
                  },
                  typical_size_range: {
                    type: "object",
                    properties: {
                      revenue_min: { type: "number" },
                      revenue_max: { type: "number" }
                    }
                  },
                  geographic_focus: {
                    type: "array",
                    items: { type: "string" },
                    description: "Typical geographic preferences"
                  },
                  service_preferences: {
                    type: "array",
                    items: { type: "string" },
                    description: "Services this buyer type targets"
                  },
                  strategic_rationale: {
                    type: "string",
                    description: "Why this buyer type acquires in this industry"
                  },
                  typical_structure: {
                    type: "string",
                    description: "Common deal structure (asset, stock, merger)"
                  },
                  growth_strategies: {
                    type: "array",
                    items: { type: "string" },
                    description: "How they grow acquisitions"
                  },
                  priority_rank: {
                    type: "number",
                    description: "Importance ranking (1=highest)"
                  }
                },
                required: ["buyer_type", "profile_name", "description", "priority_rank"]
              }
            },
            confidence_score: { type: "number", description: "Confidence score 0-100" }
          },
          required: ["buyer_types", "confidence_score"]
        },
        overall_confidence: {
          type: "number",
          description: "Overall extraction confidence score 0-100"
        }
      },
      required: ["size_criteria", "service_criteria", "geography_criteria", "buyer_types_criteria", "overall_confidence"]
    }
  }];

  const startTime = Date.now();

  // Retry logic with exponential backoff
  let lastError: Error | null = null;
  let response: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[EXTRACTION_ATTEMPT] ${attempt}/${MAX_RETRIES}`);

      response = await fetch('https://api.anthropic.com/v1/messages', {
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
          tool_choice: { type: 'tool', name: 'extract_buyer_criteria' }
        }),
        signal: AbortSignal.timeout(EXTRACTION_TIMEOUT_MS)
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Check if it's a rate limit or transient error
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Transient error: ${response.status} - ${errorText}`);
        }

        // Permanent error - don't retry
        throw new Error(`Claude API error: ${response.status} - ${errorText}`);
      }

      // Success - break out of retry loop
      break;

    } catch (error: any) {
      lastError = error;
      console.error(`[EXTRACTION_ERROR] Attempt ${attempt} failed:`, error.message);

      // Don't retry on permanent errors
      if (!error.message.includes('Transient') && !error.message.includes('timeout')) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[RETRY_WAIT] Waiting ${delay}ms before retry ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  if (!response || !response.ok) {
    throw lastError || new Error('Extraction failed after all retries');
  }

  const result = await response.json();
  const duration = Date.now() - startTime;

  console.log(`[EXTRACTION_COMPLETE] ${duration}ms`);
  console.log(`[USAGE] Input: ${result.usage?.input_tokens}, Output: ${result.usage?.output_tokens}`);

  // Extract tool use result
  const toolUse = result.content.find((c: any) => c.type === 'tool_use');
  if (!toolUse) {
    throw new Error('No tool use found in Claude response');
  }

  return toolUse.input as BuyerCriteria;
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

    const { universe_id, guide_content, source_name, industry_name = 'Unknown Industry' }: ExtractionRequest = await req.json();

    if (!universe_id || !guide_content) {
      throw new Error('Missing required fields: universe_id, guide_content');
    }

    console.log(`[REQUEST] Universe: ${universe_id}, Source: ${source_name}, Industry: ${industry_name}`);

    // Create extraction source record
    const { data: sourceRecord, error: sourceError } = await supabase
      .from('criteria_extraction_sources')
      .insert({
        universe_id,
        source_type: 'ai_guide',
        source_name,
        source_metadata: {
          industry_name,
          content_length: guide_content.length,
          word_count: guide_content.split(/\s+/).length
        },
        extraction_status: 'processing',
        extraction_started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sourceError) {
      throw new Error(`Failed to create source record: ${sourceError.message}`);
    }

    console.log(`[SOURCE_CREATED] ID: ${sourceRecord.id}`);

    // Extract criteria using Claude
    try {
      const criteria = await extractCriteriaFromGuide(guide_content, industry_name);

      // Update source record with extraction results
      const { error: updateError } = await supabase
        .from('criteria_extraction_sources')
        .update({
          extraction_status: 'completed',
          extraction_completed_at: new Date().toISOString(),
          extracted_data: criteria,
          confidence_scores: {
            size: criteria.size_criteria.confidence_score,
            service: criteria.service_criteria.confidence_score,
            geography: criteria.geography_criteria.confidence_score,
            buyer_types: criteria.buyer_types_criteria.confidence_score,
            overall: criteria.overall_confidence
          }
        })
        .eq('id', sourceRecord.id);

      if (updateError) {
        throw new Error(`Failed to update source record: ${updateError.message}`);
      }

      console.log(`[SUCCESS] Extraction completed with ${criteria.overall_confidence}% confidence`);

      return new Response(
        JSON.stringify({
          success: true,
          source_id: sourceRecord.id,
          criteria,
          message: 'Criteria extracted successfully'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );

    } catch (extractionError) {
      // Mark extraction as failed
      await supabase
        .from('criteria_extraction_sources')
        .update({
          extraction_status: 'failed',
          extraction_error: extractionError.message,
          extraction_completed_at: new Date().toISOString()
        })
        .eq('id', sourceRecord.id);

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
