import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScoreRequest {
  listingId: string;
  buyerId: string;
  universeId: string;
}

interface BulkScoreRequest {
  listingId: string;
  universeId: string;
  buyerIds?: string[];
  options?: {
    rescoreExisting?: boolean;
    minDataCompleteness?: 'high' | 'medium' | 'low';
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const isBulk = body.bulk === true;

    if (isBulk) {
      return await handleBulkScore(supabase, body as BulkScoreRequest, LOVABLE_API_KEY, corsHeaders);
    } else {
      return await handleSingleScore(supabase, body as ScoreRequest, LOVABLE_API_KEY, corsHeaders);
    }
  } catch (error) {
    console.error("Score buyer-deal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleSingleScore(
  supabase: any,
  request: ScoreRequest,
  apiKey: string,
  corsHeaders: Record<string, string>
) {
  const { listingId, buyerId, universeId } = request;

  // Fetch listing
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    throw new Error("Listing not found");
  }

  // Fetch buyer
  const { data: buyer, error: buyerError } = await supabase
    .from("remarketing_buyers")
    .select("*")
    .eq("id", buyerId)
    .single();

  if (buyerError || !buyer) {
    throw new Error("Buyer not found");
  }

  // Fetch universe for weights
  const { data: universe, error: universeError } = await supabase
    .from("remarketing_buyer_universes")
    .select("*")
    .eq("id", universeId)
    .single();

  if (universeError || !universe) {
    throw new Error("Universe not found");
  }

  // Generate score using AI
  const score = await generateAIScore(listing, buyer, universe, apiKey);

  // Upsert score
  const { data: savedScore, error: saveError } = await supabase
    .from("remarketing_scores")
    .upsert({
      listing_id: listingId,
      buyer_id: buyerId,
      universe_id: universeId,
      ...score,
      scored_at: new Date().toISOString(),
    }, { onConflict: "listing_id,buyer_id" })
    .select()
    .single();

  if (saveError) {
    console.error("Failed to save score:", saveError);
    throw new Error("Failed to save score");
  }

  return new Response(
    JSON.stringify({ success: true, score: savedScore }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleBulkScore(
  supabase: any,
  request: BulkScoreRequest,
  apiKey: string,
  corsHeaders: Record<string, string>
) {
  const { listingId, universeId, buyerIds, options } = request;
  const rescoreExisting = options?.rescoreExisting ?? false;
  const minDataCompleteness = options?.minDataCompleteness;

  // Fetch listing
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    throw new Error("Listing not found");
  }

  // Fetch universe with structured criteria
  const { data: universe, error: universeError } = await supabase
    .from("remarketing_buyer_universes")
    .select("*")
    .eq("id", universeId)
    .single();

  if (universeError || !universe) {
    throw new Error("Universe not found");
  }

  // Fetch buyers
  let buyerQuery = supabase
    .from("remarketing_buyers")
    .select("*")
    .eq("universe_id", universeId)
    .eq("archived", false);

  if (buyerIds && buyerIds.length > 0) {
    buyerQuery = buyerQuery.in("id", buyerIds);
  }

  // Filter by data completeness if specified
  if (minDataCompleteness) {
    if (minDataCompleteness === 'high') {
      buyerQuery = buyerQuery.eq('data_completeness', 'high');
    } else if (minDataCompleteness === 'medium') {
      buyerQuery = buyerQuery.in('data_completeness', ['high', 'medium']);
    }
    // 'low' means all, so no filter
  }

  const { data: buyers, error: buyersError } = await buyerQuery;

  if (buyersError) {
    throw new Error("Failed to fetch buyers");
  }

  if (!buyers || buyers.length === 0) {
    return new Response(
      JSON.stringify({ success: true, scores: [], message: "No buyers to score" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // If not rescoring, filter out buyers that already have scores
  let buyersToScore = buyers;
  if (!rescoreExisting) {
    const { data: existingScores } = await supabase
      .from("remarketing_scores")
      .select("buyer_id")
      .eq("listing_id", listingId);

    const scoredBuyerIds = new Set((existingScores || []).map((s: any) => s.buyer_id));
    buyersToScore = buyers.filter((b: any) => !scoredBuyerIds.has(b.id));

    if (buyersToScore.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          scores: [], 
          message: "All buyers already scored",
          totalProcessed: 0,
          totalBuyers: buyers.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  console.log(`Scoring ${buyersToScore.length} buyers for listing ${listingId} (rescore: ${rescoreExisting})`);

  // Process in batches to avoid rate limits
  const batchSize = 5;
  const scores: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < buyersToScore.length; i += batchSize) {
    const batch = buyersToScore.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (buyer: any) => {
      try {
        const score = await generateAIScore(listing, buyer, universe, apiKey);
        return {
          listing_id: listingId,
          buyer_id: buyer.id,
          universe_id: universeId,
          ...score,
          scored_at: new Date().toISOString(),
        };
      } catch (err) {
        console.error(`Failed to score buyer ${buyer.id}:`, err);
        errors.push(`Failed to score ${buyer.company_name}`);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    const validScores = batchResults.filter(s => s !== null);

    if (validScores.length > 0) {
      const { data: savedScores, error: saveError } = await supabase
        .from("remarketing_scores")
        .upsert(validScores, { onConflict: "listing_id,buyer_id" })
        .select();

      if (saveError) {
        console.error("Failed to save batch scores:", saveError);
        errors.push("Failed to save some scores");
      } else {
        scores.push(...(savedScores || []));
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + batchSize < buyersToScore.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      scores, 
      errors: errors.length > 0 ? errors : undefined,
      totalProcessed: scores.length,
      totalBuyers: buyersToScore.length 
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function generateAIScore(
  listing: any,
  buyer: any,
  universe: any,
  apiKey: string
): Promise<{
  composite_score: number;
  geography_score: number;
  size_score: number;
  service_score: number;
  owner_goals_score: number;
  tier: string;
  fit_reasoning: string;
  data_completeness: string;
  status: string;
}> {
  const systemPrompt = `You are an M&A advisor scoring buyer-deal fits. Analyze the match between a business listing and a potential buyer (PE firm/platform/strategic acquirer).

Score each category from 0-100 based on fit quality:
- Geography: How well does the deal's location match the buyer's target geography or existing footprint?
- Size: Does the deal's revenue/EBITDA fit the buyer's investment criteria?
- Service: How aligned are the deal's services with the buyer's focus areas?
- Owner Goals: How compatible is the deal with typical buyer acquisition strategies?

Provide scores and a brief reasoning for the overall fit.`;

  const userPrompt = `DEAL:
- Title: ${listing.title || "Unknown"}
- Category: ${listing.category || "Unknown"}
- Location: ${listing.location || "Unknown"}
- Revenue: ${listing.revenue ? `$${listing.revenue.toLocaleString()}` : "Unknown"}
- EBITDA: ${listing.ebitda ? `$${listing.ebitda.toLocaleString()}` : "Unknown"}
- Description: ${listing.hero_description || listing.description || "No description"}

BUYER:
- Company: ${buyer.company_name}
- Type: ${buyer.buyer_type || "Unknown"}
- Target Revenue: ${buyer.target_revenue_min ? `$${buyer.target_revenue_min.toLocaleString()}` : "?"} - ${buyer.target_revenue_max ? `$${buyer.target_revenue_max.toLocaleString()}` : "?"}
- Target EBITDA: ${buyer.target_ebitda_min ? `$${buyer.target_ebitda_min.toLocaleString()}` : "?"} - ${buyer.target_ebitda_max ? `$${buyer.target_ebitda_max.toLocaleString()}` : "?"}
- Target Geographies: ${buyer.target_geographies?.join(", ") || "Unknown"}
- Target Services: ${buyer.target_services?.join(", ") || "Unknown"}
- Current Footprint: ${buyer.geographic_footprint?.join(", ") || "Unknown"}
- Investment Thesis: ${buyer.thesis_summary || "Unknown"}

UNIVERSE CRITERIA:
${universe.fit_criteria || "General buyer-deal matching"}

WEIGHTS:
- Geography: ${universe.geography_weight}%
- Size: ${universe.size_weight}%
- Service: ${universe.service_weight}%
- Owner Goals: ${universe.owner_goals_weight}%

Analyze this buyer-deal fit.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
          name: "score_buyer_deal",
          description: "Score the buyer-deal fit across categories",
          parameters: {
            type: "object",
            properties: {
              geography_score: { 
                type: "number", 
                description: "Score 0-100 for geographic fit" 
              },
              size_score: { 
                type: "number", 
                description: "Score 0-100 for size/financial fit" 
              },
              service_score: { 
                type: "number", 
                description: "Score 0-100 for service/industry fit" 
              },
              owner_goals_score: { 
                type: "number", 
                description: "Score 0-100 for owner goals compatibility" 
              },
              reasoning: { 
                type: "string", 
                description: "2-3 sentence explanation of the overall fit" 
              }
            },
            required: ["geography_score", "size_score", "service_score", "owner_goals_score", "reasoning"],
            additionalProperties: false
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "score_buyer_deal" } }
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded");
    }
    if (response.status === 402) {
      throw new Error("Payment required");
    }
    const text = await response.text();
    console.error("AI Gateway error:", response.status, text);
    throw new Error("AI scoring failed");
  }

  const result = await response.json();
  
  // Parse the tool call response
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.error("No tool call in response:", JSON.stringify(result));
    throw new Error("Invalid AI response format");
  }

  let scores;
  try {
    scores = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error("Failed to parse AI response:", toolCall.function.arguments);
    throw new Error("Failed to parse AI scores");
  }

  // Calculate composite score using universe weights
  const composite = Math.round(
    (scores.geography_score * universe.geography_weight +
     scores.size_score * universe.size_weight +
     scores.service_score * universe.service_weight +
     scores.owner_goals_score * universe.owner_goals_weight) / 100
  );

  // Determine tier
  let tier: string;
  if (composite >= 85) tier = "A";
  else if (composite >= 70) tier = "B";
  else if (composite >= 55) tier = "C";
  else tier = "D";

  // Determine data completeness based on buyer data
  const hasThesis = !!buyer.thesis_summary;
  const hasTargets = buyer.target_geographies?.length > 0 || buyer.target_services?.length > 0;
  const hasFinancials = buyer.target_revenue_min || buyer.target_ebitda_min;
  
  let dataCompleteness: string;
  if (hasThesis && hasTargets && hasFinancials) {
    dataCompleteness = "high";
  } else if (hasThesis || (hasTargets && hasFinancials)) {
    dataCompleteness = "medium";
  } else {
    dataCompleteness = "low";
  }

  return {
    composite_score: composite,
    geography_score: scores.geography_score,
    size_score: scores.size_score,
    service_score: scores.service_score,
    owner_goals_score: scores.owner_goals_score,
    tier,
    fit_reasoning: scores.reasoning,
    data_completeness: dataCompleteness,
    status: "pending"
  };
}
