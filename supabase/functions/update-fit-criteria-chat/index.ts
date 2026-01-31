import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      current_criteria, 
      instruction,
      universe_name 
    } = await req.json();

    if (!instruction) {
      return new Response(
        JSON.stringify({ error: 'instruction is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    console.log(`Updating criteria for universe: ${universe_name || 'unnamed'}`);
    console.log(`Instruction: ${instruction}`);

    const systemPrompt = `You are an M&A criteria management assistant. Your job is to update buyer universe fit criteria based on natural language instructions.

You will receive the current criteria state and an instruction. Return the COMPLETE updated criteria set (not a diff).

Always maintain the structure of the criteria:
- size_criteria: revenue_min, revenue_max, ebitda_min, ebitda_max, locations_min, locations_max, employee_min, employee_max
- geography_criteria: target_states, target_regions, exclude_states, coverage, hq_requirements
- service_criteria: primary_focus (CRITICAL), required_services, preferred_services, excluded_services, business_model, customer_profile
- buyer_types_criteria: include_pe_firms, include_platforms, include_strategic, include_family_office
- scoring_behavior: boost_adjacency, penalize_distance, require_thesis_match, geography_strictness, size_strictness

When adding states, use full state names (e.g., "Texas" not "TX").
When adding services, use proper capitalization.
Always preserve existing values that aren't being modified.`;

    const userPrompt = `Current criteria:
${JSON.stringify(current_criteria || {}, null, 2)}

Instruction: "${instruction}"

Return the complete updated criteria as JSON. Only return valid JSON, no explanation.`;

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
            name: "update_criteria",
            description: "Return the complete updated criteria set",
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
                    locations_max: { type: "number" },
                    employee_min: { type: "number" },
                    employee_max: { type: "number" },
                    total_sqft_min: { type: "number" },
                    total_sqft_max: { type: "number" }
                  }
                },
                geography_criteria: {
                  type: "object",
                  properties: {
                    target_states: { type: "array", items: { type: "string" } },
                    target_regions: { type: "array", items: { type: "string" } },
                    exclude_states: { type: "array", items: { type: "string" } },
                    coverage: { type: "string", enum: ["local", "regional", "national"] },
                    hq_requirements: { type: "string" },
                    adjacency_preference: { type: "boolean" }
                  }
                },
                service_criteria: {
                  type: "object",
                  properties: {
                    primary_focus: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Core service lines this buyer universe targets - REQUIRED for scoring"
                    },
                    required_services: { type: "array", items: { type: "string" } },
                    preferred_services: { type: "array", items: { type: "string" } },
                    excluded_services: { type: "array", items: { type: "string" } },
                    business_model: { type: "string" },
                    customer_profile: { type: "string" }
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
                scoring_behavior: {
                  type: "object",
                  properties: {
                    boost_adjacency: { type: "boolean" },
                    penalize_distance: { type: "boolean" },
                    require_thesis_match: { type: "boolean" },
                    geography_strictness: { type: "string", enum: ["strict", "moderate", "flexible"] },
                    size_strictness: { type: "string", enum: ["strict", "moderate", "flexible"] },
                    service_matching_mode: { type: "string", enum: ["keyword", "semantic", "hybrid"] }
                  }
                }
              }
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "update_criteria" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits" }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const text = await response.text();
      console.error("AI Gateway error:", response.status, text);
      throw new Error("Failed to update criteria");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("No criteria returned from AI");
    }

    const updatedCriteria = JSON.parse(toolCall.function.arguments);
    
    // Merge with existing to preserve any fields AI didn't return
    const mergedCriteria = {
      size_criteria: { ...current_criteria?.size_criteria, ...updatedCriteria.size_criteria },
      geography_criteria: { ...current_criteria?.geography_criteria, ...updatedCriteria.geography_criteria },
      service_criteria: { ...current_criteria?.service_criteria, ...updatedCriteria.service_criteria },
      buyer_types_criteria: { ...current_criteria?.buyer_types_criteria, ...updatedCriteria.buyer_types_criteria },
      scoring_behavior: { ...current_criteria?.scoring_behavior, ...updatedCriteria.scoring_behavior }
    };

    console.log("Updated criteria:", JSON.stringify(mergedCriteria, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true,
        criteria: mergedCriteria,
        instruction_processed: instruction
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error updating criteria:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
