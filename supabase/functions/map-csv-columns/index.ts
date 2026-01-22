import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MappingRequest {
  columns: string[];
  targetType: 'buyer' | 'deal';
}

interface ColumnMapping {
  csvColumn: string;
  targetField: string | null;
  confidence: number;
  aiSuggested: boolean;
}

const BUYER_FIELDS = [
  { field: 'company_name', description: 'Company or firm name' },
  { field: 'company_website', description: 'Website URL' },
  { field: 'buyer_type', description: 'Type of buyer (PE firm, platform, strategic, family office)' },
  { field: 'thesis_summary', description: 'Investment thesis or focus areas' },
  { field: 'target_revenue_min', description: 'Minimum target revenue' },
  { field: 'target_revenue_max', description: 'Maximum target revenue' },
  { field: 'target_ebitda_min', description: 'Minimum target EBITDA' },
  { field: 'target_ebitda_max', description: 'Maximum target EBITDA' },
  { field: 'target_geographies', description: 'Target states or regions' },
  { field: 'target_services', description: 'Target services or industries' },
  { field: 'geographic_footprint', description: 'Current operating locations' },
  { field: 'notes', description: 'Additional notes' },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { columns, targetType } = await req.json() as MappingRequest;

    if (!columns || columns.length === 0) {
      return new Response(
        JSON.stringify({ mappings: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fields = targetType === 'buyer' ? BUYER_FIELDS : BUYER_FIELDS;

    const systemPrompt = `You are a data mapping expert. Given CSV column names, map them to target database fields.
Be intelligent about variations - "Firm Name", "Company", "Name" should all map to "company_name".
Return null for columns that don't match any field.`;

    const userPrompt = `Map these CSV columns to target fields:

CSV Columns: ${columns.join(', ')}

Target Fields:
${fields.map(f => `- ${f.field}: ${f.description}`).join('\n')}

Map each CSV column to the most appropriate target field, or null if no match.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
          JSON.stringify({ mappings: heuristicMapping(columns) }),
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
        JSON.stringify({ mappings: heuristicMapping(columns) }),
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
      mappings = heuristicMapping(columns);
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

function heuristicMapping(columns: string[]): ColumnMapping[] {
  return columns.map(col => {
    const lower = col.toLowerCase();
    let targetField: string | null = null;
    let confidence = 0.5;

    if (lower.includes('company') || lower.includes('name') || lower.includes('firm')) {
      targetField = 'company_name';
      confidence = 0.8;
    } else if (lower.includes('website') || lower.includes('url') || lower.includes('site')) {
      targetField = 'company_website';
      confidence = 0.9;
    } else if (lower.includes('type') || lower.includes('category')) {
      targetField = 'buyer_type';
      confidence = 0.7;
    } else if (lower.includes('thesis') || lower.includes('focus') || lower.includes('strategy')) {
      targetField = 'thesis_summary';
      confidence = 0.8;
    } else if ((lower.includes('revenue') || lower.includes('rev')) && lower.includes('min')) {
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
    } else if (lower.includes('geography') || lower.includes('state') || lower.includes('region') || lower.includes('target')) {
      targetField = 'target_geographies';
      confidence = 0.6;
    } else if (lower.includes('service') || lower.includes('industry') || lower.includes('sector')) {
      targetField = 'target_services';
      confidence = 0.7;
    } else if (lower.includes('footprint') || lower.includes('location') || lower.includes('presence') || lower.includes('current')) {
      targetField = 'geographic_footprint';
      confidence = 0.6;
    } else if (lower.includes('note')) {
      targetField = 'notes';
      confidence = 0.8;
    }

    return {
      csvColumn: col,
      targetField,
      confidence,
      aiSuggested: false
    };
  });
}
