import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.30.1";
import { checkRateLimit, rateLimitResponse } from "../_shared/security.ts";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user is an admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: Check rate limit before making AI calls
    const rateLimitResult = await checkRateLimit(supabase, user.id, "ai_query", true);
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for admin ${user.id} on ai_query`);
      return rateLimitResponse(rateLimitResult);
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

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: system_prompt,
      messages: [
        {
          role: "user",
          content: user_message,
        },
      ],
    });

    const assistant_message = response.content[0].type === "text"
      ? response.content[0].text
      : "";

    console.log("[update-fit-criteria-chat] Generated response");

    return new Response(
      JSON.stringify({
        response: assistant_message,
        usage: response.usage,
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
