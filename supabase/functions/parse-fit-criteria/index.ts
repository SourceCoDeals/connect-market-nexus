import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Placeholder patterns to detect and clean
const PLACEHOLDER_PATTERNS = [
  /\[X\]/gi,
  /\$\[X\]/gi,
  /\[VALUE\]/gi,
  /\[INSERT\]/gi,
  /TBD/gi,
  /X\.X/g,
  /\$X+M?/gi,
];

function cleanPlaceholders(value: any): any {
  if (typeof value === 'string') {
    let cleaned = value;
    for (const pattern of PLACEHOLDER_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }
    return cleaned.trim() || null;
  }
  if (Array.isArray(value)) {
    return value.map(cleanPlaceholders).filter(Boolean);
  }
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      const cleaned = cleanPlaceholders(val);
      if (cleaned !== null && cleaned !== undefined && cleaned !== '') {
        result[key] = cleaned;
      }
    }
    return result;
  }
  return value;
}

// Separate EBITDA multiples from dollar values
function fixMisplacedMultiples(criteria: any): any {
  if (!criteria?.size_criteria) return criteria;
  
  const size = criteria.size_criteria;
  
  // If EBITDA min looks like a multiple (< 20), move it
  if (size.ebitda_min && size.ebitda_min < 20) {
    size.ebitda_multiple_min = size.ebitda_min;
    delete size.ebitda_min;
  }
  if (size.ebitda_max && size.ebitda_max < 20) {
    size.ebitda_multiple_max = size.ebitda_max;
    delete size.ebitda_max;
  }
  
  return criteria;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fit_criteria_text, universe_name } = await req.json();

    if (!fit_criteria_text) {
      return new Response(
        JSON.stringify({ error: 'fit_criteria_text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      // Fallback to local parsing
      console.log("GEMINI_API_KEY not configured, using local parsing");
      const localParsed = parseLocally(fit_criteria_text);
      return new Response(
        JSON.stringify(localParsed),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsing fit criteria for universe: ${universe_name || 'unnamed'}`);
    console.log(`Input text length: ${fit_criteria_text.length} chars`);

    const systemPrompt = `You are an M&A criteria extraction expert. Parse buyer universe fit criteria from natural language into structured data.

CRITICAL REQUIREMENTS:
1. Extract PRIMARY_FOCUS - the core service lines the buyer universe targets. This is REQUIRED.
2. Separate EBITDA dollar values from EBITDA multiples (e.g., "5x EBITDA" is a multiple, "$5M EBITDA" is a dollar value)
3. Convert all currency to raw numbers (e.g., "$5M" = 5000000, "$500K" = 500000)
4. Use full state names (e.g., "Texas" not "TX")
5. Do NOT include placeholder values like [X], TBD, or $XM`;

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: getGeminiHeaders(GEMINI_API_KEY),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse this fit criteria text:\n\n${fit_criteria_text}` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_fit_criteria",
            description: "Extract structured buyer universe criteria from text",
            parameters: {
              type: "object",
              properties: {
                size_criteria: {
                  type: "object",
                  description: "Financial and size requirements",
                  properties: {
                    revenue_min: { type: "number", description: "Minimum revenue in dollars" },
                    revenue_max: { type: "number", description: "Maximum revenue in dollars" },
                    ebitda_min: { type: "number", description: "Minimum EBITDA in dollars (NOT multiples)" },
                    ebitda_max: { type: "number", description: "Maximum EBITDA in dollars (NOT multiples)" },
                    ebitda_multiple_min: { type: "number", description: "Minimum EBITDA multiple (e.g., 4 for 4x)" },
                    ebitda_multiple_max: { type: "number", description: "Maximum EBITDA multiple (e.g., 8 for 8x)" },
                    employee_min: { type: "number" },
                    employee_max: { type: "number" },
                    locations_min: { type: "number" },
                    locations_max: { type: "number" },
                    total_sqft_min: { type: "number" },
                    total_sqft_max: { type: "number" }
                  }
                },
                geography_criteria: {
                  type: "object",
                  description: "Geographic targeting",
                  properties: {
                    target_states: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Full state names to target"
                    },
                    target_regions: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Region names like Southeast, Midwest"
                    },
                    exclude_states: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "States to exclude"
                    },
                    coverage: { 
                      type: "string", 
                      enum: ["local", "regional", "national"],
                      description: "Geographic coverage type"
                    },
                    hq_requirements: { type: "string" },
                    adjacency_preference: { type: "boolean" }
                  }
                },
                service_criteria: {
                  type: "object",
                  description: "Service and industry requirements",
                  properties: {
                    primary_focus: {
                      type: "array",
                      items: { type: "string" },
                      description: "REQUIRED: Core service lines the buyer universe targets. This is critical for scoring."
                    },
                    required_services: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Services that are required/must-have"
                    },
                    preferred_services: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Nice-to-have services"
                    },
                    excluded_services: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Services to avoid/exclude"
                    },
                    business_model: { type: "string" },
                    customer_profile: { type: "string" }
                  },
                  required: ["primary_focus"]
                },
                buyer_types_criteria: {
                  type: "object",
                  description: "Types of buyers to include",
                  properties: {
                    include_pe_firms: { type: "boolean", default: true },
                    include_platforms: { type: "boolean", default: true },
                    include_strategic: { type: "boolean", default: true },
                    include_family_office: { type: "boolean", default: true }
                  }
                },
                scoring_behavior: {
                  type: "object",
                  description: "Scoring algorithm hints",
                  properties: {
                    boost_adjacency: { type: "boolean" },
                    penalize_distance: { type: "boolean" },
                    require_thesis_match: { type: "boolean" },
                    geography_strictness: { type: "string", enum: ["strict", "moderate", "flexible"] },
                    size_strictness: { type: "string", enum: ["strict", "moderate", "flexible"] },
                    minimum_data_completeness: { type: "string", enum: ["high", "medium", "low"] }
                  }
                },
                extracted_keywords: {
                  type: "array",
                  items: { type: "string" },
                  description: "Key terms extracted from the text"
                },
                confidence: {
                  type: "number",
                  description: "Confidence score 0-1"
                }
              },
              required: ["size_criteria", "geography_criteria", "service_criteria", "buyer_types_criteria"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_fit_criteria" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Fallback to local parsing
      console.log('AI unavailable, using local parsing fallback');
      const localParsed = parseLocally(fit_criteria_text);
      return new Response(
        JSON.stringify(localParsed),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.log('No tool call response, using local fallback');
      const localParsed = parseLocally(fit_criteria_text);
      return new Response(
        JSON.stringify(localParsed),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsed = JSON.parse(toolCall.function.arguments);
    
    // Post-processing
    parsed = cleanPlaceholders(parsed);
    parsed = fixMisplacedMultiples(parsed);
    
    // Ensure primary_focus exists
    if (!parsed.service_criteria?.primary_focus || parsed.service_criteria.primary_focus.length === 0) {
      // Try to infer from required_services
      if (parsed.service_criteria?.required_services?.length > 0) {
        parsed.service_criteria.primary_focus = parsed.service_criteria.required_services.slice(0, 3);
      }
    }

    console.log('Parsed criteria:', JSON.stringify(parsed, null, 2));

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing fit criteria:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Local fallback parser using regex patterns
function parseLocally(text: string) {
  const lowerText = text.toLowerCase();
  
  const result = {
    size_criteria: {} as Record<string, any>,
    geography_criteria: {} as Record<string, any>,
    service_criteria: {
      primary_focus: [] as string[],
      required_services: [] as string[],
      preferred_services: [] as string[],
      excluded_services: [] as string[]
    },
    buyer_types_criteria: {
      include_pe_firms: true,
      include_platforms: true,
      include_strategic: true,
      include_family_office: true
    },
    scoring_behavior: {} as Record<string, any>,
    extracted_keywords: [] as string[],
    confidence: 0.5
  };

  // Parse revenue ranges
  const revenueMatch = text.match(/\$?(\d+(?:\.\d+)?)\s*[Mm](?:illion|M)?\s*[-–to]+\s*\$?(\d+(?:\.\d+)?)\s*[Mm](?:illion|M)?\s*(?:revenue|rev)/i);
  if (revenueMatch) {
    result.size_criteria.revenue_min = parseFloat(revenueMatch[1]) * 1000000;
    result.size_criteria.revenue_max = parseFloat(revenueMatch[2]) * 1000000;
  }

  // Parse EBITDA ranges
  const ebitdaMatch = text.match(/\$?(\d+(?:\.\d+)?)\s*[Mm](?:illion|M)?\s*[-–to]+\s*\$?(\d+(?:\.\d+)?)\s*[Mm](?:illion|M)?\s*EBITDA/i);
  if (ebitdaMatch) {
    result.size_criteria.ebitda_min = parseFloat(ebitdaMatch[1]) * 1000000;
    result.size_criteria.ebitda_max = parseFloat(ebitdaMatch[2]) * 1000000;
  }

  // Parse regions
  const regionMap: Record<string, string[]> = {
    'southeast': ['Florida', 'Georgia', 'Alabama', 'South Carolina', 'North Carolina', 'Tennessee', 'Mississippi', 'Louisiana'],
    'northeast': ['New York', 'New Jersey', 'Pennsylvania', 'Massachusetts', 'Connecticut', 'Maine', 'New Hampshire', 'Vermont', 'Rhode Island'],
    'midwest': ['Illinois', 'Ohio', 'Michigan', 'Indiana', 'Wisconsin', 'Minnesota', 'Iowa', 'Missouri'],
    'southwest': ['Texas', 'Arizona', 'New Mexico', 'Oklahoma'],
    'west coast': ['California', 'Oregon', 'Washington'],
    'mountain': ['Colorado', 'Utah', 'Nevada', 'Idaho', 'Montana', 'Wyoming']
  };

  for (const [region, states] of Object.entries(regionMap)) {
    if (lowerText.includes(region)) {
      result.geography_criteria.target_regions = result.geography_criteria.target_regions || [];
      result.geography_criteria.target_regions.push(region.charAt(0).toUpperCase() + region.slice(1));
      result.geography_criteria.target_states = [
        ...(result.geography_criteria.target_states || []),
        ...states
      ];
    }
  }

  // Parse services - look for industry keywords
  const serviceKeywords = [
    'HVAC', 'Plumbing', 'Electrical', 'Roofing', 'Landscaping', 'Cleaning',
    'Pest Control', 'Restoration', 'Flooring', 'Painting', 'Insulation',
    'Solar', 'Security', 'Fire Protection', 'Garage Door', 'Pool Service',
    'Auto Body', 'Collision Repair', 'Mechanical', 'Glass'
  ];
  
  for (const service of serviceKeywords) {
    if (lowerText.includes(service.toLowerCase())) {
      result.service_criteria.required_services.push(service);
      if (result.service_criteria.primary_focus.length < 3) {
        result.service_criteria.primary_focus.push(service);
      }
    }
  }

  // Parse buyer type exclusions
  if (lowerText.includes('no pe') || lowerText.includes('exclude private equity')) {
    result.buyer_types_criteria.include_pe_firms = false;
  }
  if (lowerText.includes('no strategic') || lowerText.includes('exclude strategic')) {
    result.buyer_types_criteria.include_strategic = false;
  }

  // Extract keywords for reference
  const keywordPatterns = [
    /platform/gi, /add-on/gi, /roll-up/gi, /consolidation/gi,
    /recurring/gi, /residential/gi, /commercial/gi, /home services/gi
  ];
  
  for (const pattern of keywordPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      result.extracted_keywords.push(...matches.map(m => m.toLowerCase()));
    }
  }
  result.extracted_keywords = [...new Set(result.extracted_keywords)];

  return result;
}
