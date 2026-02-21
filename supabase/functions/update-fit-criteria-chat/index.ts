import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_API_URL, getGeminiHeaders } from "../_shared/ai-providers.ts";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const { tracker_id, user_message, current_criteria } = await req.json();

    console.log("[update-fit-criteria-chat] Processing request:", {
      tracker_id,
      has_current_criteria: !!current_criteria,
    });

    const system_prompt = `You are an AI assistant helping to refine buyer fit criteria for M&A deal sourcing.

Your role is to:
1. Help users refine their size, service, and geography criteria
2. Suggest improvements based on deal characteristics
3. Ask clarifying questions to better understand requirements
4. Provide structured criteria updates in JSON format

Current criteria context:
${JSON.stringify(current_criteria, null, 2)}

When suggesting updates, provide:
1. Specific recommendations with rationale
2. JSON format updates that can be directly applied
3. Clarifying questions if needed

Be concise and actionable.`;

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: getGeminiHeaders(geminiApiKey),
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: system_prompt },
          { role: "user", content: user_message },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 300)}`);
    }

    const data = await response.json();
    const assistant_message = data.choices?.[0]?.message?.content || "";

    console.log("[update-fit-criteria-chat] Generated response");

    return new Response(
      JSON.stringify({
        response: assistant_message,
        usage: data.usage ? {
          input_tokens: data.usage.prompt_tokens || 0,
          output_tokens: data.usage.completion_tokens || 0,
        } : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[update-fit-criteria-chat] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
