import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MappingRequest {
  columns: string[];
  targetType: 'buyer' | 'deal';
  sampleData?: Record<string, string>[];
}

interface ColumnMapping {
  csvColumn: string;
  targetField: string | null;
  confidence: number;
  aiSuggested: boolean;
}

// Extended buyer fields based on the technical spec
const BUYER_FIELDS = [
  { field: 'company_name', description: 'Platform/portfolio company name (REQUIRED)' },
  { field: 'platform_website', description: 'Website URL of the portfolio company' },
  { field: 'pe_firm_name', description: 'Name of the private equity firm/sponsor' },
  { field: 'pe_firm_website', description: 'Website URL of the PE firm' },
  { field: 'company_website', description: 'General website URL (if not separated into platform/PE)' },
  { field: 'buyer_type', description: 'Type of buyer (PE firm, platform, strategic, family office)' },
  { field: 'hq_city_state', description: 'Combined headquarters city and state (e.g., "Phoenix, AZ")' },
  { field: 'hq_city', description: 'Headquarters city only' },
  { field: 'hq_state', description: 'Headquarters state (2-letter code preferred, e.g., TX, CA)' },
  { field: 'hq_country', description: 'Headquarters country' },
  { field: 'thesis_summary', description: 'Investment thesis or focus areas' },
  { field: 'target_revenue_min', description: 'Minimum target company revenue' },
  { field: 'target_revenue_max', description: 'Maximum target company revenue' },
  { field: 'target_ebitda_min', description: 'Minimum target EBITDA' },
  { field: 'target_ebitda_max', description: 'Maximum target EBITDA' },
  { field: 'target_geographies', description: 'Target states or regions for acquisitions' },
  { field: 'target_services', description: 'Target services or industries' },
  { field: 'geographic_footprint', description: 'Current operating locations' },
  { field: 'notes', description: 'Additional notes' },
];

// Deal/listing fields for importing companies for sale
const DEAL_FIELDS = [
  { field: 'title', description: 'Company name (REQUIRED)' },
  { field: 'website', description: 'Company website URL' },
  { field: 'location', description: 'Primary location (city, state or just state)' },
  { field: 'revenue', description: 'Annual revenue in dollars' },
  { field: 'ebitda', description: 'Annual EBITDA in dollars' },
  { field: 'description', description: 'Company description or overview' },
  { field: 'geographic_states', description: 'States where company operates (comma-separated)' },
  { field: 'services', description: 'Services offered or industry sectors (comma-separated)' },
  { field: 'notes', description: 'Additional notes or comments' },
  { field: 'street_address', description: 'Street address' },
  { field: 'address_city', description: 'City name' },
  { field: 'address_state', description: 'State (2-letter code like TX, CA)' },
  { field: 'address_zip', description: 'ZIP or postal code' },
  { field: 'address_country', description: 'Country code (US, CA, etc.)' },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const { columns, targetType, sampleData } = await req.json() as MappingRequest;

    if (!columns || columns.length === 0) {
      return new Response(
        JSON.stringify({ mappings: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fields = targetType === 'buyer' ? BUYER_FIELDS : DEAL_FIELDS;

    // Build sample data string for context
    let sampleDataStr = '';
    if (sampleData && sampleData.length > 0) {
      sampleDataStr = '\n\nSample data from first 3 rows:\n';
      sampleData.slice(0, 3).forEach((row, i) => {
        sampleDataStr += `Row ${i + 1}: ${columns.map(col => `${col}="${row[col] || ''}"`).join(', ')}\n`;
      });
    }

    const systemPrompt = targetType === 'buyer'
      ? `You are a data mapping expert for M&A buyer data imports.
Given CSV column names and sample data, map them to target database fields.

Be intelligent about variations:
- "Firm Name", "Company", "Platform Name", "Name" → company_name
- "Platform Website", "Company URL", "Website" → platform_website or company_website
- "PE Firm", "Sponsor", "Private Equity Firm" → pe_firm_name
- "PE Website", "Sponsor Website" → pe_firm_website
- "HQ", "Headquarters", "City, State" → hq_city_state
- Columns with URL-like sample data should map to website fields
- Columns with 2-letter codes (TX, CA) likely map to hq_state

Return null for columns that don't match any field.
Prioritize platform_website and pe_firm_website over generic company_website when you can distinguish them.`
      : `You are a data mapping expert for M&A deal/company listings imports.
Given CSV column names and sample data, map them to target database fields.

Be intelligent about variations:
- "Company Name", "Business Name", "Name", "Title" → title
- "Website", "URL", "Site" → website
- "Location", "City", "Address" → location (or address_city if specifically city)
- "Revenue", "Sales", "Annual Revenue" → revenue
- "EBITDA", "Earnings", "Profit" → ebitda
- "Description", "About", "Overview", "Summary" → description
- "States", "Regions", "Operating States" → geographic_states
- "Services", "Industries", "Sectors" → services
- "Street", "Address Line 1" → street_address
- "City" → address_city
- "State", "ST" → address_state
- "ZIP", "Zip Code", "Postal Code" → address_zip
- "Country" → address_country

Return null for columns that don't match any field.
Location can be city+state combined or just a general location string.`;

    const userPrompt = `Map these CSV columns to target fields:

CSV Columns: ${columns.join(', ')}
${sampleDataStr}

Target Fields:
${fields.map(f => `- ${f.field}: ${f.description}`).join('\n')}

Map each CSV column to the most appropriate target field, or null if no match.
Consider the sample data to make better decisions.`;

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: getGeminiHeaders(GEMINI_API_KEY),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "map_columns",
            description: "Map CSV columns to target database fields",
            parameters: {
              type: "object",
              properties: {
                mappings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      csvColumn: { type: "string" },
                      targetField: { type: "string", nullable: true },
                      confidence: { type: "number", minimum: 0, maximum: 1 }
                    },
                    required: ["csvColumn", "targetField", "confidence"]
                  }
                }
              },
              required: ["mappings"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "map_columns" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.log("Rate limited, falling back to heuristic mapping");
        return new Response(
          JSON.stringify({ mappings: heuristicMapping(columns, targetType) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.log("Payment required, falling back to heuristic mapping");
        return new Response(
          JSON.stringify({ mappings: heuristicMapping(columns, targetType) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.log("No tool call, falling back to heuristic");
      return new Response(
        JSON.stringify({ mappings: heuristicMapping(columns, targetType) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let mappings: ColumnMapping[];
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      mappings = parsed.mappings.map((m: any) => ({
        ...m,
        aiSuggested: true
      }));
    } catch (e) {
      console.error("Failed to parse AI response, using heuristic");
      mappings = heuristicMapping(columns, targetType);
    }

    return new Response(
      JSON.stringify({ mappings }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Map CSV columns error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function heuristicMapping(columns: string[], targetType: 'buyer' | 'deal'): ColumnMapping[] {
  return columns.map(col => {
    const lower = col.toLowerCase();
    let targetField: string | null = null;
    let confidence = 0.5;

    if (targetType === 'deal') {
      // Deal-specific mapping logic
      // Company name/title
      if (lower.includes('company') || lower.includes('business') || lower.includes('name') || lower === 'title') {
        targetField = 'title';
        confidence = 0.9;
      }
      // Website
      else if (lower.includes('website') || lower.includes('url') || lower.includes('site')) {
        targetField = 'website';
        confidence = 0.8;
      }
      // Location and address fields
      else if (lower.includes('location') || lower === 'address') {
        targetField = 'location';
        confidence = 0.85;
      }
      else if (lower.includes('street') || lower.includes('address line')) {
        targetField = 'street_address';
        confidence = 0.8;
      }
      else if (lower === 'city' || (lower.includes('city') && !lower.includes('state'))) {
        targetField = 'address_city';
        confidence = 0.9;
      }
      else if (lower === 'state' || lower === 'st' || (lower.includes('state') && !lower.includes('city'))) {
        targetField = 'address_state';
        confidence = 0.85;
      }
      else if (lower.includes('zip') || lower.includes('postal')) {
        targetField = 'address_zip';
        confidence = 0.9;
      }
      else if (lower === 'country') {
        targetField = 'address_country';
        confidence = 0.8;
      }
      // Financial fields
      else if (lower.includes('revenue') || lower.includes('sales')) {
        targetField = 'revenue';
        confidence = 0.85;
      }
      else if (lower.includes('ebitda') || lower.includes('earnings') || lower.includes('profit')) {
        targetField = 'ebitda';
        confidence = 0.85;
      }
      // Description
      else if (lower.includes('description') || lower.includes('about') || lower.includes('overview') || lower.includes('summary')) {
        targetField = 'description';
        confidence = 0.8;
      }
      // Geographic states
      else if (lower.includes('states') || lower.includes('regions') || lower.includes('operating')) {
        targetField = 'geographic_states';
        confidence = 0.7;
      }
      // Services/Industries
      else if (lower.includes('service') || lower.includes('industry') || lower.includes('sector')) {
        targetField = 'services';
        confidence = 0.75;
      }
      // Notes
      else if (lower.includes('note') || lower.includes('comment')) {
        targetField = 'notes';
        confidence = 0.7;
      }
    } else {
      // Buyer-specific mapping logic (original)
      // Platform/Company name - most specific first
      if (lower.includes('platform') && (lower.includes('company') || lower.includes('name'))) {
        targetField = 'company_name';
        confidence = 0.9;
      } else if (lower.includes('company') || lower.includes('name') || lower.includes('firm')) {
        targetField = 'company_name';
        confidence = 0.8;
      }

      // Websites - be specific about platform vs PE firm
      else if (lower.includes('platform') && (lower.includes('website') || lower.includes('url') || lower.includes('site'))) {
        targetField = 'platform_website';
        confidence = 0.9;
      } else if ((lower.includes('pe') || lower.includes('sponsor') || lower.includes('firm')) &&
                 (lower.includes('website') || lower.includes('url') || lower.includes('site'))) {
        targetField = 'pe_firm_website';
        confidence = 0.9;
      } else if (lower.includes('website') || lower.includes('url') || lower.includes('site')) {
        targetField = 'company_website';
        confidence = 0.8;
      }

      // PE Firm name
      else if ((lower.includes('pe') || lower.includes('private equity') || lower.includes('sponsor')) &&
               (lower.includes('name') || lower === 'pe firm' || lower === 'sponsor')) {
        targetField = 'pe_firm_name';
        confidence = 0.85;
      }

      // Location - combined city/state
      else if ((lower.includes('hq') || lower.includes('headquarters')) &&
               (lower.includes('city') || lower.includes('state') || lower.includes('location'))) {
        targetField = 'hq_city_state';
        confidence = 0.8;
      } else if (lower.includes('city') && lower.includes('state')) {
        targetField = 'hq_city_state';
        confidence = 0.85;
      } else if (lower.includes('city') && !lower.includes('state')) {
        targetField = 'hq_city';
        confidence = 0.8;
      } else if (lower.includes('state') && !lower.includes('city') && !lower.includes('target')) {
        targetField = 'hq_state';
        confidence = 0.75;
      } else if (lower.includes('country')) {
        targetField = 'hq_country';
        confidence = 0.8;
      }

      // Type
      else if (lower.includes('type') || lower.includes('category')) {
        targetField = 'buyer_type';
        confidence = 0.7;
      }

      // Thesis/Strategy
      else if (lower.includes('thesis') || lower.includes('focus') || lower.includes('strategy')) {
        targetField = 'thesis_summary';
        confidence = 0.8;
      }

      // Financial criteria
      else if ((lower.includes('revenue') || lower.includes('rev')) && lower.includes('min')) {
        targetField = 'target_revenue_min';
        confidence = 0.9;
      } else if ((lower.includes('revenue') || lower.includes('rev')) && lower.includes('max')) {
        targetField = 'target_revenue_max';
        confidence = 0.9;
      } else if (lower.includes('ebitda') && lower.includes('min')) {
        targetField = 'target_ebitda_min';
        confidence = 0.9;
      } else if (lower.includes('ebitda') && lower.includes('max')) {
        targetField = 'target_ebitda_max';
        confidence = 0.9;
      }

      // Geography and services
      else if (lower.includes('target') && (lower.includes('geography') || lower.includes('state') || lower.includes('region'))) {
        targetField = 'target_geographies';
        confidence = 0.75;
      } else if (lower.includes('geography') || lower.includes('region')) {
        targetField = 'target_geographies';
        confidence = 0.6;
      } else if (lower.includes('service') || lower.includes('industry') || lower.includes('sector')) {
        targetField = 'target_services';
        confidence = 0.7;
      } else if (lower.includes('footprint') || lower.includes('location') || lower.includes('presence') || lower.includes('current')) {
        targetField = 'geographic_footprint';
        confidence = 0.6;
      }

      // Notes
      else if (lower.includes('note')) {
        targetField = 'notes';
        confidence = 0.8;
      }
    }

    return {
      csvColumn: col,
      targetField,
      confidence,
      aiSuggested: false
    };
  });
}
