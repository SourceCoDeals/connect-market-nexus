import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedCriteria {
  size_criteria: {
    revenue_min?: number;
    revenue_max?: number;
    ebitda_min?: number;
    ebitda_max?: number;
    employee_min?: number;
    employee_max?: number;
  };
  geography_criteria: {
    target_states?: string[];
    target_regions?: string[];
    exclude_states?: string[];
    adjacency_preference?: boolean;
  };
  service_criteria: {
    required_services?: string[];
    preferred_services?: string[];
    excluded_services?: string[];
  };
  buyer_types_criteria: {
    include_pe_firms?: boolean;
    include_platforms?: boolean;
    include_strategic?: boolean;
    include_family_office?: boolean;
  };
  scoring_behavior: {
    boost_adjacency?: boolean;
    penalize_distance?: boolean;
    require_thesis_match?: boolean;
    minimum_data_completeness?: 'high' | 'medium' | 'low';
  };
  extracted_keywords: string[];
  confidence: number;
}

serve(async (req) => {
  // Handle CORS preflight
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

    console.log(`Parsing fit criteria for universe: ${universe_name || 'unnamed'}`);
    console.log(`Input text length: ${fit_criteria_text.length} chars`);

    // Call AI to parse the natural language criteria
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Parse the following buyer universe fit criteria into structured data. Extract:

1. SIZE CRITERIA: revenue ranges, EBITDA ranges, employee counts
   - Convert values like "$5M-$30M revenue" to revenue_min: 5000000, revenue_max: 30000000
   - Handle "minimum $X", "at least $X", "up to $X" patterns

2. GEOGRAPHY CRITERIA: target states, regions, exclusions
   - Map regions like "Southeast" to actual states
   - Note any adjacency preferences mentioned

3. SERVICE/INDUSTRY CRITERIA: required vs preferred vs excluded services
   - Required: "must have", "need", "require"
   - Preferred: "ideally", "bonus", "nice to have"
   - Excluded: "no", "avoid", "not interested in"

4. BUYER TYPE PREFERENCES: PE firms, platforms, strategics, family offices
   - Default all to true unless explicitly excluded

5. SCORING BEHAVIOR hints:
   - "geographic focus" -> penalize_distance: true
   - "thesis alignment critical" -> require_thesis_match: true
   - "data quality important" -> minimum_data_completeness: 'high'

Return a JSON object matching this structure:
{
  "size_criteria": { "revenue_min": number, "revenue_max": number, "ebitda_min": number, "ebitda_max": number, "employee_min": number, "employee_max": number },
  "geography_criteria": { "target_states": string[], "target_regions": string[], "exclude_states": string[], "adjacency_preference": boolean },
  "service_criteria": { "required_services": string[], "preferred_services": string[], "excluded_services": string[] },
  "buyer_types_criteria": { "include_pe_firms": boolean, "include_platforms": boolean, "include_strategic": boolean, "include_family_office": boolean },
  "scoring_behavior": { "boost_adjacency": boolean, "penalize_distance": boolean, "require_thesis_match": boolean, "minimum_data_completeness": "high"|"medium"|"low" },
  "extracted_keywords": string[],
  "confidence": number (0-1)
}

FIT CRITERIA TEXT:
${fit_criteria_text}

Return ONLY valid JSON, no markdown or explanation.`
        }]
      })
    });

    if (!aiResponse.ok) {
      // Fallback to local parsing if AI unavailable
      console.log('AI unavailable, using local parsing fallback');
      const localParsed = parseLocally(fit_criteria_text);
      return new Response(
        JSON.stringify(localParsed),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.content?.[0]?.text || '{}';
    
    // Parse the AI response
    let parsed: ParsedCriteria;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.log('Failed to parse AI response, using local fallback');
      parsed = parseLocally(fit_criteria_text);
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
function parseLocally(text: string): ParsedCriteria {
  const lowerText = text.toLowerCase();
  
  const result: ParsedCriteria = {
    size_criteria: {},
    geography_criteria: {},
    service_criteria: {},
    buyer_types_criteria: {
      include_pe_firms: true,
      include_platforms: true,
      include_strategic: true,
      include_family_office: true
    },
    scoring_behavior: {},
    extracted_keywords: [],
    confidence: 0.5
  };

  // Parse revenue ranges
  const revenueMatch = text.match(/\$?(\d+(?:\.\d+)?)\s*[Mm](?:illion)?\s*[-–to]+\s*\$?(\d+(?:\.\d+)?)\s*[Mm](?:illion)?\s*(?:revenue|rev)/i);
  if (revenueMatch) {
    result.size_criteria.revenue_min = parseFloat(revenueMatch[1]) * 1000000;
    result.size_criteria.revenue_max = parseFloat(revenueMatch[2]) * 1000000;
  }

  // Parse EBITDA ranges
  const ebitdaMatch = text.match(/\$?(\d+(?:\.\d+)?)\s*[Mm](?:illion)?\s*[-–to]+\s*\$?(\d+(?:\.\d+)?)\s*[Mm](?:illion)?\s*EBITDA/i);
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
      result.geography_criteria.target_regions.push(region);
      result.geography_criteria.target_states = [
        ...(result.geography_criteria.target_states || []),
        ...states
      ];
    }
  }

  // Parse services - look for industry keywords
  const serviceKeywords = [
    'hvac', 'plumbing', 'electrical', 'roofing', 'landscaping', 'cleaning',
    'pest control', 'restoration', 'flooring', 'painting', 'insulation',
    'solar', 'security', 'fire protection', 'garage door', 'pool service'
  ];
  
  for (const service of serviceKeywords) {
    if (lowerText.includes(service)) {
      result.service_criteria.preferred_services = result.service_criteria.preferred_services || [];
      result.service_criteria.preferred_services.push(service.charAt(0).toUpperCase() + service.slice(1));
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
