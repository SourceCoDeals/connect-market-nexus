import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

interface ScoreRequest {
  buyerId: string;
  universeId: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: ScoreRequest = await req.json();
    const { buyerId, universeId } = body;

    if (!buyerId || !universeId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: buyerId and universeId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[score-industry-alignment] Starting for buyer: ${buyerId}, universe: ${universeId}`);

    // Step 1: Fetch buyer data
    const { data: buyer, error: buyerError } = await supabase
      .from("remarketing_buyers")
      .select(`
        id, company_name, company_website, pe_firm_name, 
        hq_city, hq_state, business_summary,
        target_services, target_geographies,
        thesis_summary, industry_vertical, target_industries
      `)
      .eq("id", buyerId)
      .single();

    if (buyerError || !buyer) {
      console.error("Buyer not found:", buyerError);
      return new Response(
        JSON.stringify({ error: "Buyer not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Fetch universe data including M&A guide content and documents
    const { data: universe, error: universeError } = await supabase
      .from("remarketing_buyer_universes")
      .select("id, name, description, fit_criteria, ma_guide_content, documents, size_criteria, geography_criteria, service_criteria")
      .eq("id", universeId)
      .single();

    if (universeError || !universe) {
      console.error("Universe not found:", universeError);
      return new Response(
        JSON.stringify({ error: "Universe not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2b: Get M&A guide content - check both ma_guide_content column AND documents array
    let maGuideContent = universe.ma_guide_content?.trim() || "";

    // If no inline content, check for M&A guide in documents
    if (!maGuideContent && Array.isArray(universe.documents)) {
      const maGuideDoc = universe.documents.find((doc: any) => doc.type === "ma_guide" && doc.url);
      
      if (maGuideDoc) {
        console.log(`[score-industry-alignment] Found M&A guide document: ${maGuideDoc.name}`);
        try {
          // Fetch the HTML content from the document URL
          const docResponse = await fetch(maGuideDoc.url);
          if (docResponse.ok) {
            const htmlContent = await docResponse.text();
            // Extract text content from HTML (strip tags for cleaner AI input)
            maGuideContent = htmlContent
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/\s+/g, ' ')
              .trim();
            console.log(`[score-industry-alignment] Extracted ${maGuideContent.length} chars from document`);
          } else {
            console.error(`[score-industry-alignment] Failed to fetch document: ${docResponse.status}`);
          }
        } catch (fetchError) {
          console.error(`[score-industry-alignment] Error fetching M&A guide document:`, fetchError);
        }
      }
    }

    // MANDATORY: Check for M&A guide - required for industry alignment scoring
    if (!maGuideContent) {
      console.log(`[score-industry-alignment] M&A guide missing for universe: ${universe.name}`);
      return new Response(
        JSON.stringify({
          error: "M&A Guide required",
          error_code: "ma_guide_missing",
          message: "Please create an M&A guide for this universe before scoring industry fit. The guide defines what companies belong in this industry."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[score-industry-alignment] Scoring ${buyer.company_name} against ${universe.name}`);

    // Step 3: Build AI prompt - industry-agnostic, uses M&A guide as source of truth
    const systemPrompt = `You are an M&A industry expert specializing in evaluating company fit for buyer universes. Your job is to score how well a company aligns with a specific target industry.

PRIMARY SOURCE OF TRUTH:
Use the M&A Industry Guide provided below as your primary reference for understanding what companies belong in this industry. The guide contains detailed research on market segments, typical buyers, services, and business models for this specific industry.

CRITICAL RULES:
1. Be STRICT - adjacent or tangentially related industries should score LOW (under 40)
2. Company names and keywords can be MISLEADING - "ABC Restoration" could be car restoration, furniture restoration, art restoration, or disaster restoration. Always evaluate the actual business activities.
3. Distinguish between companies that PROVIDE services in this industry vs companies that USE or PURCHASE those services. Customers of this industry are NOT in this industry.
4. Equipment suppliers, software vendors, and vendors TO this industry are NOT the same as service providers IN this industry
5. Consider business model (B2B vs B2C), service type, target customers, and operational footprint
6. Use all available context: company data, existing enrichment, and the M&A guide knowledge

SCORING SCALE (be strict - most companies should NOT be a fit):
- 95-100: Perfect fit - clearly operates in exact target industry with matching business model and services
- 85-94: Excellent fit - right industry, minor variations in focus, geography, or service mix
- 70-84: Good fit - right industry, some differences in service mix or business model
- 55-69: Partial fit - adjacent industry segment or significantly different business model
- 40-54: Weak fit - related but distinctly different industry or business model
- 20-39: Poor fit - different industry with only superficial connection (adjacent industry, vendors to industry)
- 0-19: Non-fit - completely unrelated industry or a customer of the industry rather than a provider`;

    // Include the FULL M&A guide as industry knowledge - no truncation
    const industryKnowledge = `
M&A INDUSTRY GUIDE (PRIMARY REFERENCE - Use this to understand what belongs in the "${universe.name}" industry):
${maGuideContent}
`;

    // Build service criteria context
    let serviceCriteriaContext = "";
    const serviceCriteria = universe.service_criteria as any;
    if (serviceCriteria) {
      if (serviceCriteria.primary_focus) {
        serviceCriteriaContext += `\nPrimary Industry Focus: ${serviceCriteria.primary_focus}`;
      }
      if (serviceCriteria.keywords?.length) {
        serviceCriteriaContext += `\nIndustry Keywords: ${serviceCriteria.keywords.join(", ")}`;
      }
    }

    const userPrompt = `
UNIVERSE DETAILS:
Industry: ${universe.name}
Description: ${universe.description || "Not specified"}
Fit Criteria: ${universe.fit_criteria || "Not specified"}
${serviceCriteriaContext}
${industryKnowledge}

COMPANY TO EVALUATE:
Name: ${buyer.company_name}
Location: ${[buyer.hq_city, buyer.hq_state].filter(Boolean).join(", ") || "Not provided"}
Website: ${buyer.company_website || "Not provided"}
PE Firm: ${buyer.pe_firm_name || "Not specified"}
Industry Vertical: ${buyer.industry_vertical || "Not specified"}

${buyer.business_summary ? `
Business Overview (from prior enrichment):
${buyer.business_summary}
` : ""}

${buyer.thesis_summary ? `
Investment Thesis:
${buyer.thesis_summary}
` : ""}

${buyer.target_services?.length ? `
Services: ${buyer.target_services.join(", ")}
` : ""}

${buyer.target_industries?.length ? `
Target Industries: ${buyer.target_industries.join(", ")}
` : ""}

${buyer.target_geographies?.length ? `
Target Geographies: ${buyer.target_geographies.join(", ")}
` : ""}

TASK: Analyze this company and determine its alignment score (0-100) with the target industry "${universe.name}". 

REMEMBER:
- Use the M&A Industry Guide above as your primary reference
- Be STRICT - adjacent industries, vendors to the industry, and customers of the industry should score LOW
- Keywords in company names can be misleading - evaluate actual business activities
- Companies that PURCHASE services from this industry are NOT part of this industry

Use the score_alignment tool to return your evaluation.`;

    // Step 4: Call Gemini API with tool calling
    const toolDefinition = {
      type: "function",
      function: {
        name: "score_alignment",
        description: "Score a company's alignment with the target industry",
        parameters: {
          type: "object",
          properties: {
            score: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "Alignment score from 0-100"
            },
            reasoning: {
              type: "string",
              description: "Detailed 3-4 sentence explanation of why this score was assigned. Include specific factors that support or hurt the fit."
            },
            key_factors: {
              type: "array",
              items: { type: "string" },
              description: "3-5 specific factors that influenced the score (positive or negative)"
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "Confidence level in this score based on available data"
            }
          },
          required: ["score", "reasoning", "key_factors", "confidence"],
          additionalProperties: false
        }
      }
    };

    console.log(`[score-industry-alignment] Calling AI for ${buyer.company_name}...`);

    const aiResponse = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: getGeminiHeaders(GEMINI_API_KEY),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [toolDefinition],
        tool_choice: { type: "function", function: { name: "score_alignment" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[score-industry-alignment] AI API error: ${aiResponse.status}`, errorText);
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI credits depleted",
            error_code: "payment_required",
            message: "Please add credits to continue scoring"
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limited",
            error_code: "rate_limited",
            message: "Too many requests - please wait and retry"
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    console.log(`[score-industry-alignment] AI Response:`, JSON.stringify(aiResult).slice(0, 500));

    // Extract tool call result
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("[score-industry-alignment] No tool call in AI response:", aiResult);
      throw new Error("AI did not return a scoring result");
    }

    let scoringResult;
    try {
      scoringResult = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error("[score-industry-alignment] Failed to parse tool arguments:", toolCall.function.arguments);
      throw new Error("Failed to parse AI scoring result");
    }

    console.log(`[score-industry-alignment] Score for ${buyer.company_name}: ${scoringResult.score}`);

    // Step 5: Update the buyer with alignment data
    const { error: updateError } = await supabase
      .from("remarketing_buyers")
      .update({
        alignment_score: scoringResult.score,
        alignment_reasoning: scoringResult.reasoning,
        alignment_checked_at: new Date().toISOString()
      })
      .eq("id", buyerId);

    if (updateError) {
      console.error("[score-industry-alignment] Update error:", updateError);
      throw new Error(`Failed to update buyer: ${updateError.message}`);
    }

    // Step 6: Return the result
    return new Response(
      JSON.stringify({
        success: true,
        buyer_id: buyerId,
        company_name: buyer.company_name,
        score: scoringResult.score,
        reasoning: scoringResult.reasoning,
        key_factors: scoringResult.key_factors,
        confidence: scoringResult.confidence
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[score-industry-alignment] Error:", error);
    
    return new Response(
      JSON.stringify({
        error: "Scoring failed",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
