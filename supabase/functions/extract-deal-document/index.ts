import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Claude API configuration
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-20250514';

interface DocumentExtractionRequest {
  universe_id: string;
  document_url: string;
  document_name: string;
  industry_name?: string;
}

interface ExtractedCriteria {
  size_criteria?: any;
  service_criteria?: any;
  geography_criteria?: any;
  buyer_types_criteria?: any;
  confidence_score: number;
}

/**
 * Extract text content from PDF using Claude's vision capabilities
 * or from plain text documents
 */
async function extractDocumentText(documentUrl: string): Promise<string> {
  console.log('[DOCUMENT_FETCH] Downloading document from storage');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Download document from Supabase Storage
  const { data, error } = await supabase.storage
    .from('documents')
    .download(documentUrl);

  if (error) {
    throw new Error(`Failed to download document: ${error.message}`);
  }

  const buffer = await data.arrayBuffer();
  const text = new TextDecoder().decode(buffer);

  console.log(`[DOCUMENT_LOADED] ${text.length} characters`);

  return text;
}

/**
 * Extract buyer criteria from uploaded document (PDF, research report, etc.)
 */
async function extractCriteriaFromDocument(
  documentText: string,
  documentName: string,
  industryName: string
): Promise<ExtractedCriteria> {
  console.log('[EXTRACTION_START] Processing document');

  const systemPrompt = `You are an expert M&A advisor analyzing industry research documents, reports, and deal memos. Extract buyer fit criteria from documents that may be shorter and more focused than comprehensive guides.

EXTRACTION APPROACH:
1. Look for specific buyer targeting criteria (size, geography, services)
2. Identify buyer types mentioned (PE firms, platforms, strategics)
3. Extract explicit criteria even if incomplete
4. Mark confidence based on specificity and clarity

CONFIDENCE SCORING:
- 90-100: Explicit criteria with specific numbers
- 70-89: Clear patterns with some specificity
- 50-69: General patterns but lacking detail
- Below 50: Vague or conflicting information

Focus on EXPLICIT criteria. If a section isn't covered in the document, return null for that section.`;

  const userPrompt = `Extract buyer fit criteria from this ${industryName} document: "${documentName}"

DOCUMENT CONTENT:
${documentText.slice(0, 50000)} <!-- Limit to 50k chars -->

Extract whatever criteria are explicitly mentioned:
1. SIZE CRITERIA: Revenue/EBITDA ranges, location counts
2. SERVICE CRITERIA: Services buyers target
3. GEOGRAPHY CRITERIA: Geographic preferences
4. BUYER TYPE PROFILES: Types of buyers discussed

If a section isn't covered in the document, mark it as null or return confidence_score: 0 for that section.
Include confidence scores (0-100) for each section based on how explicitly the criteria are stated.`;

  const tools = [{
    name: "extract_document_criteria",
    description: "Extract buyer fit criteria from uploaded document",
    input_schema: {
      type: "object",
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
            ebitda_sweet_spot: { type: "number", nullable: true },
            location_count_min: { type: "number", nullable: true },
            location_count_max: { type: "number", nullable: true },
            confidence_score: { type: "number", description: "0-100" }
          },
          required: ["confidence_score"]
        },
        service_criteria: {
          type: "object",
          nullable: true,
          properties: {
            target_services: {
              type: "array",
              items: { type: "string" }
            },
            service_exclusions: {
              type: "array",
              items: { type: "string" }
            },
            confidence_score: { type: "number", description: "0-100" }
          },
          required: ["confidence_score"]
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
            },
            confidence_score: { type: "number", description: "0-100" }
          },
          required: ["confidence_score"]
        },
        buyer_types_criteria: {
          type: "object",
          nullable: true,
          properties: {
            buyer_types: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  buyer_type: {
                    type: "string",
                    enum: ["pe_firm", "platform", "strategic", "family_office", "other"]
                  },
                  profile_name: { type: "string" },
                  description: { type: "string" },
                  typical_size_range: {
                    type: "object",
                    properties: {
                      revenue_min: { type: "number", nullable: true },
                      revenue_max: { type: "number", nullable: true }
                    }
                  },
                  geographic_focus: {
                    type: "array",
                    items: { type: "string" }
                  },
                  service_preferences: {
                    type: "array",
                    items: { type: "string" }
                  },
                  priority_rank: { type: "number" }
                },
                required: ["buyer_type", "profile_name", "priority_rank"]
              }
            },
            confidence_score: { type: "number", description: "0-100" }
          },
          required: ["confidence_score"]
        },
        overall_confidence: {
          type: "number",
          description: "Overall extraction confidence 0-100"
        }
      },
      required: ["overall_confidence"]
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
      tool_choice: { type: 'tool', name: 'extract_document_criteria' }
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

  // Extract tool use result
  const toolUse = result.content.find((c: any) => c.type === 'tool_use');
  if (!toolUse) {
    throw new Error('No tool use found in Claude response');
  }

  return toolUse.input as ExtractedCriteria;
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
      universe_id,
      document_url,
      document_name,
      industry_name = 'Unknown Industry'
    }: DocumentExtractionRequest = await req.json();

    if (!universe_id || !document_url || !document_name) {
      throw new Error('Missing required fields: universe_id, document_url, document_name');
    }

    console.log(`[REQUEST] Universe: ${universe_id}, Document: ${document_name}`);

    // Create extraction source record
    const { data: sourceRecord, error: sourceError } = await supabase
      .from('criteria_extraction_sources')
      .insert({
        universe_id,
        source_type: 'uploaded_document',
        source_name: document_name,
        source_url: document_url,
        source_metadata: {
          industry_name,
          document_url
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

    // Extract document text
    try {
      const documentText = await extractDocumentText(document_url);

      // Extract criteria using Claude
      const criteria = await extractCriteriaFromDocument(documentText, document_name, industry_name);

      // Calculate confidence scores for each section
      const confidenceScores: any = {
        overall: criteria.overall_confidence
      };

      if (criteria.size_criteria) {
        confidenceScores.size = criteria.size_criteria.confidence_score;
      }
      if (criteria.service_criteria) {
        confidenceScores.service = criteria.service_criteria.confidence_score;
      }
      if (criteria.geography_criteria) {
        confidenceScores.geography = criteria.geography_criteria.confidence_score;
      }
      if (criteria.buyer_types_criteria) {
        confidenceScores.buyer_types = criteria.buyer_types_criteria.confidence_score;
      }

      // Update source record with extraction results
      const { error: updateError } = await supabase
        .from('criteria_extraction_sources')
        .update({
          extraction_status: 'completed',
          extraction_completed_at: new Date().toISOString(),
          extracted_data: criteria,
          confidence_scores: confidenceScores
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
          message: 'Document criteria extracted successfully'
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
