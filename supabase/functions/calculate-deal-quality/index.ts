import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";
import { checkRateLimit, checkGlobalRateLimit, rateLimitResponse } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DealQualityScores {
  deal_total_score: number;
  deal_size_score: number;
  deal_services_score: number;
  scoring_notes?: string;
}

/**
 * Calculate deal quality score based on deal attributes.
 * This is the overall quality of the deal, NOT how well it fits a specific buyer.
 *
 * SIMPLIFIED SCORING METHODOLOGY (0-100):
 *
 * 1. SIZE (0-65 pts) - 65% weight - This is what matters most
 *    - Based on revenue, EBITDA, or LinkedIn employee count as proxy
 *    - Larger deals = higher scores
 *
 * 2. SERVICES/BUSINESS TYPE (0-15 pts) - 15% weight
 *    - Industry attractiveness for M&A
 *    - Recurring revenue models score higher
 *
 * 3. SELLER INTEREST (0-20 pts) - 20% weight
 *    - Pulled from seller_interest_score (AI-analyzed separately)
 *    - Indicates how motivated the seller is
 *
 * NOTE: Data completeness does NOT affect score. A great deal with little
 * data is still a great deal - we just need to get more info on it.
 */
function calculateScoresFromData(deal: any): DealQualityScores {
  let sizeScore = 0;
  let servicesScore = 0;
  let sellerInterestScore = 0;
  const notes: string[] = [];

  // ===== SIZE SCORE (0-65 pts) =====
  // Size is 65% of what matters in deal quality
  const revenue = deal.revenue || 0;
  const ebitda = deal.ebitda || 0;
  const employeeCount = deal.linkedin_employee_count || 0;
  const hasFinancials = revenue > 0 || ebitda > 0;

  if (hasFinancials) {
    // PRIMARY PATH: Use actual financials when available

    // Revenue-based scoring (0-40 pts)
    if (revenue >= 10000000) {
      sizeScore += 40; // $10M+ revenue
    } else if (revenue >= 5000000) {
      sizeScore += 35; // $5-10M revenue
    } else if (revenue >= 3000000) {
      sizeScore += 28; // $3-5M revenue
    } else if (revenue >= 2000000) {
      sizeScore += 22; // $2-3M revenue
    } else if (revenue >= 1000000) {
      sizeScore += 15; // $1-2M revenue
    } else if (revenue >= 500000) {
      sizeScore += 8;  // $500K-1M revenue
    } else if (revenue > 0) {
      sizeScore += 3;  // Under $500K
    }

    // EBITDA-based bonus (0-25 pts)
    if (ebitda >= 2000000) {
      sizeScore += 25; // $2M+ EBITDA
    } else if (ebitda >= 1000000) {
      sizeScore += 20; // $1-2M EBITDA
    } else if (ebitda >= 500000) {
      sizeScore += 15; // $500K-1M EBITDA
    } else if (ebitda >= 250000) {
      sizeScore += 10; // $250-500K EBITDA
    } else if (ebitda >= 100000) {
      sizeScore += 5;  // $100-250K EBITDA
    } else if (ebitda > 0) {
      sizeScore += 2;  // Under $100K EBITDA
    }
  } else if (employeeCount > 0) {
    // PROXY PATH: Estimate size from LinkedIn employee count when no financials
    // Industry average: ~$200K-400K revenue per employee for services businesses
    notes.push('Size estimated from LinkedIn employee count');

    if (employeeCount >= 200) {
      sizeScore += 65; // Likely $40M+ revenue - top tier
    } else if (employeeCount >= 100) {
      sizeScore += 55; // Likely $20-40M revenue
    } else if (employeeCount >= 50) {
      sizeScore += 45; // Likely $10-20M revenue
    } else if (employeeCount >= 25) {
      sizeScore += 35; // Likely $5-10M revenue
    } else if (employeeCount >= 15) {
      sizeScore += 25; // Likely $3-5M revenue
    } else if (employeeCount >= 10) {
      sizeScore += 18; // Likely $2-3M revenue
    } else if (employeeCount >= 5) {
      sizeScore += 10; // Likely $1-2M revenue
    } else {
      sizeScore += 4;  // Small business
    }
  } else {
    notes.push('No financials or employee data - size unknown');
    // No penalty - just can't score size yet
  }

  // Cap size score at 65
  sizeScore = Math.min(65, sizeScore);

  // ===== SERVICES/BUSINESS TYPE SCORE (0-15 pts) =====
  // Certain industries/business models are more attractive for M&A
  const category = (deal.category || '').toLowerCase();
  const serviceMix = (deal.service_mix || '').toLowerCase();
  const businessModel = (deal.business_model || '').toLowerCase();
  const description = (deal.description || deal.executive_summary || '').toLowerCase();
  const allText = `${category} ${serviceMix} ${businessModel} ${description}`;

  // High-value recurring revenue businesses (15 pts)
  const recurringKeywords = ['recurring', 'subscription', 'contract', 'maintenance', 'managed services', 'saas', 'membership'];
  if (recurringKeywords.some(kw => allText.includes(kw))) {
    servicesScore += 15;
    notes.push('Recurring revenue model');
  }
  // Essential services / recession-resistant (12 pts)
  else if (['hvac', 'plumbing', 'electrical', 'roofing', 'pest control', 'waste', 'healthcare', 'dental', 'veterinary'].some(kw => allText.includes(kw))) {
    servicesScore += 12;
  }
  // Professional services / B2B (10 pts)
  else if (['staffing', 'consulting', 'engineering', 'it services', 'accounting', 'legal'].some(kw => allText.includes(kw))) {
    servicesScore += 10;
  }
  // General services (8 pts)
  else if (['landscaping', 'cleaning', 'restoration', 'construction', 'manufacturing'].some(kw => allText.includes(kw))) {
    servicesScore += 8;
  }
  // Has category but not a high-value one (5 pts)
  else if (category) {
    servicesScore += 5;
  }

  // ===== SELLER INTEREST SCORE (0-20 pts) =====
  // This comes from the AI-analyzed seller_interest_score (0-100)
  // Scale it to 0-20 pts for the total score
  if (deal.seller_interest_score !== null && deal.seller_interest_score !== undefined) {
    sellerInterestScore = Math.round((deal.seller_interest_score / 100) * 20);
    if (deal.seller_interest_score >= 70) {
      notes.push('High seller motivation');
    }
  }
  // If no seller interest score yet, don't penalize - just can't contribute

  // ===== CALCULATE TOTAL =====
  const totalScore = sizeScore + servicesScore + sellerInterestScore;

  return {
    deal_total_score: Math.min(100, Math.max(0, totalScore)),
    deal_size_score: sizeScore,
    deal_services_score: servicesScore,
    scoring_notes: notes.length > 0 ? notes.join("; ") : undefined,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user identity for rate limiting
    const authHeader = req.headers.get('Authorization');
    let userId = 'system';
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    const body = await req.json();
    const { listingId, calculateAll } = body;

    // Rate limit check
    const rateLimitResult = await checkRateLimit(supabase, userId, 'deal_scoring', false);
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for user ${userId} on deal_scoring`);
      return rateLimitResponse(rateLimitResult);
    }

    // If calculating for all deals, check global rate limit
    if (calculateAll) {
      const globalRateLimit = await checkGlobalRateLimit(supabase, 'global_ai_calls');
      if (!globalRateLimit.allowed) {
        console.error('Global rate limit exceeded for bulk deal scoring');
        return rateLimitResponse(globalRateLimit);
      }
    }

    let listingsToScore: any[] = [];

    if (listingId) {
      // Score single listing
      const { data: listing, error: listingError } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .single();

      if (listingError || !listing) {
        throw new Error("Listing not found");
      }

      listingsToScore = [listing];
    } else if (calculateAll) {
      // Score all listings that don't have a score yet
      const { data: listings, error: listingsError } = await supabase
        .from("listings")
        .select("*")
        .is("deal_total_score", null)
        .limit(50); // Process in batches

      if (listingsError) {
        throw new Error("Failed to fetch listings");
      }

      listingsToScore = listings || [];
    } else {
      return new Response(
        JSON.stringify({ error: "Must provide listingId or set calculateAll: true" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (listingsToScore.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No listings to score",
          scored: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Scoring ${listingsToScore.length} listings...`);

    let scored = 0;
    let errors = 0;
    const results: any[] = [];

    for (const listing of listingsToScore) {
      try {
        // Calculate scores based on deal data
        const scores = calculateScoresFromData(listing);

        // Update the listing
        // Note: deal_quality_score field stores the services score (repurposed)
        const { error: updateError } = await supabase
          .from("listings")
          .update({
            deal_total_score: scores.deal_total_score,
            deal_size_score: scores.deal_size_score,
          })
          .eq("id", listing.id);

        if (updateError) {
          console.error(`Failed to update listing ${listing.id}:`, updateError);
          errors++;
        } else {
          scored++;
          results.push({
            id: listing.id,
            title: listing.title,
            scores,
          });
        }
      } catch (e) {
        console.error(`Error scoring listing ${listing.id}:`, e);
        errors++;
      }
    }

    console.log(`Scored ${scored} listings, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scored ${scored} deals${errors > 0 ? `, ${errors} errors` : ''}`,
        scored,
        errors,
        results: results.slice(0, 10), // Return first 10 for reference
        remaining: listingsToScore.length > 50 ? "More deals available, run again" : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Calculate deal quality error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
