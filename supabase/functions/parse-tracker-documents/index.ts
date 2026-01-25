import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Parse Tracker Documents Edge Function
 * 
 * Input Pathway 2: Document Upload & Parsing
 * Downloads documents from Supabase Storage, extracts text, and parses criteria
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { universe_id, document_urls, document_names } = await req.json();

    if (!document_urls || document_urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No documents provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client for storage access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Processing ${document_urls.length} documents for universe ${universe_id}`);

    // Extract text from each document
    const allTexts: string[] = [];
    
    for (let i = 0; i < document_urls.length; i++) {
      const url = document_urls[i];
      const name = document_names?.[i] || `Document ${i + 1}`;
      
      try {
        const text = await extractTextFromDocument(url, name, LOVABLE_API_KEY);
        if (text) {
          allTexts.push(`\n--- ${name} ---\n${text}`);
        }
      } catch (err) {
        console.error(`Failed to extract text from ${name}:`, err);
        // Continue with other documents
      }
    }

    if (allTexts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Could not extract text from any documents' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const combinedText = allTexts.join('\n\n');
    console.log(`Extracted ${combinedText.length} chars from ${allTexts.length} documents`);

    // Now extract criteria from the combined text
    const criteria = await extractCriteriaFromText(combinedText, LOVABLE_API_KEY);

    // Update the universe if ID provided
    if (universe_id && criteria) {
      const { error: updateError } = await supabase
        .from('remarketing_buyer_universes')
        .update({
          size_criteria: criteria.size_criteria || {},
          service_criteria: criteria.service_criteria || {},
          geography_criteria: criteria.geography_criteria || {},
          buyer_types_criteria: criteria.buyer_types_criteria || {},
          scoring_behavior: criteria.scoring_hints || {},
          documents_analyzed_at: new Date().toISOString(),
          // Human-readable summaries
          fit_criteria_size: criteria.summaries?.size_summary || null,
          fit_criteria_service: criteria.summaries?.service_summary || null,
          fit_criteria_geography: criteria.summaries?.geography_summary || null,
          fit_criteria_buyer_types: criteria.summaries?.buyer_types_summary || null,
        })
        .eq('id', universe_id);

      if (updateError) {
        console.error('Failed to update universe:', updateError);
      } else {
        console.log('Universe criteria updated successfully');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        criteria: criteria,
        documentsProcessed: allTexts.length,
        totalCharsExtracted: combinedText.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing documents:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to parse documents' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractTextFromDocument(url: string, filename: string, apiKey: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  // Fetch the document
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.status}`);
  }

  // Handle based on file type
  switch (ext) {
    case 'txt':
      return await response.text();
      
    case 'pdf':
      // Use AI vision to extract text from PDF
      return await extractPdfWithVision(url, apiKey);
      
    case 'docx':
      // Extract from DOCX (simplified - just get raw text from XML)
      const buffer = await response.arrayBuffer();
      return await extractDocxText(buffer);
      
    case 'doc':
      // For .doc files, use AI vision as fallback
      return await extractPdfWithVision(url, apiKey);
      
    default:
      // Try to read as text
      try {
        return await response.text();
      } catch {
        return await extractPdfWithVision(url, apiKey);
      }
  }
}

async function extractPdfWithVision(url: string, apiKey: string): Promise<string> {
  // Use Gemini's vision capability to extract text from document images
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this document. Include all content, tables, and data. Format as plain text preserving structure where possible."
            },
            {
              type: "image_url",
              image_url: { url: url }
            }
          ]
        }
      ],
      max_tokens: 8000
    }),
  });

  if (!response.ok) {
    throw new Error(`AI extraction failed: ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  // Simple DOCX extraction - DOCX is a ZIP with XML inside
  // For production, you'd want a proper DOCX parser
  try {
    const uint8 = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8');
    const content = decoder.decode(uint8);
    
    // Try to find XML document content
    const docMatch = content.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (docMatch) {
      return docMatch
        .map(m => m.replace(/<[^>]+>/g, ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Fallback: extract any readable text
    return content.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

async function extractCriteriaFromText(text: string, apiKey: string): Promise<any> {
  const EXTRACTION_TOOL = {
    type: "function",
    function: {
      name: "extract_criteria",
      description: "Extract structured buyer universe criteria from document text",
      parameters: {
        type: "object",
        properties: {
          size_criteria: {
            type: "object",
            properties: {
              revenue_min: { type: "number" },
              revenue_max: { type: "number" },
              ebitda_min: { type: "number" },
              ebitda_max: { type: "number" },
              locations_min: { type: "number" },
              locations_max: { type: "number" }
            }
          },
          service_criteria: {
            type: "object",
            properties: {
              primary_focus: { type: "array", items: { type: "string" } },
              required_services: { type: "array", items: { type: "string" } },
              preferred_services: { type: "array", items: { type: "string" } },
              excluded_services: { type: "array", items: { type: "string" } },
              business_model: { type: "string" },
              customer_profile: { type: "string" }
            },
            required: ["primary_focus"]
          },
          geography_criteria: {
            type: "object",
            properties: {
              target_states: { type: "array", items: { type: "string" } },
              target_regions: { type: "array", items: { type: "string" } },
              coverage: { type: "string", enum: ["local", "regional", "national"] },
              exclude_states: { type: "array", items: { type: "string" } }
            }
          },
          buyer_types_criteria: {
            type: "object",
            properties: {
              include_pe_firms: { type: "boolean" },
              include_platforms: { type: "boolean" },
              include_strategic: { type: "boolean" },
              include_family_office: { type: "boolean" }
            }
          },
          scoring_hints: {
            type: "object",
            properties: {
              geography_mode: { type: "string", enum: ["strict", "flexible", "national"] },
              size_importance: { type: "string", enum: ["critical", "important", "flexible"] }
            }
          },
          summaries: {
            type: "object",
            properties: {
              size_summary: { type: "string" },
              service_summary: { type: "string" },
              geography_summary: { type: "string" },
              buyer_types_summary: { type: "string" }
            }
          }
        },
        required: ["service_criteria"]
      }
    }
  };

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an expert M&A analyst extracting buyer universe criteria from documents.
Extract structured criteria including:
- Size criteria (revenue, EBITDA ranges)
- Service/industry focus (ALWAYS populate primary_focus)
- Geographic targets
- Buyer type preferences
Convert all currency values to raw numbers (no $ or M suffixes).
Do not use placeholder values like [X] or [TBD].`
        },
        {
          role: "user",
          content: `Extract buyer universe criteria from this document text:\n\n${text.slice(0, 50000)}`
        }
      ],
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "function", function: { name: "extract_criteria" } }
    }),
  });

  if (!response.ok) {
    throw new Error(`AI extraction failed: ${response.status}`);
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall) {
    throw new Error("No extraction result");
  }

  return JSON.parse(toolCall.function.arguments);
}
