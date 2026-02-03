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
  deal_quality_score: number;
  deal_size_score: number;
  deal_motivation_score: number;
  scoring_notes?: string;
}

/**
 * Calculate deal quality score based on deal attributes.
 * This is the overall quality of the deal, NOT how well it fits a specific buyer.
 *
 * SIZE-DOMINANT Scoring methodology (0-100):
 * Size (EBITDA) is 60%+ of the score. Seller motivation is a BONUS only, never a penalty.
 *
 * 1. EBITDA/SIZE - PRIMARY DRIVER (0-65 pts, ~65% weight):
 *    - $5M+: 65 pts (premium)
 *    - $3M-5M: 58 pts (excellent)
 *    - $2M-3M: 50 pts (strong)
 *    - $1.5M-2M: 42 pts (good)
 *    - $1M-1.5M: 34 pts (solid)
 *    - $750K-1M: 26 pts (decent)
 *    - $500K-750K: 20 pts (small)
 *    - $250K-500K: 12 pts (micro)
 *    - Below $250K: 6 pts (lifestyle)
 *    - No EBITDA: 0 pts
 *
 * 2. Deal Quality/Margins (0-20 pts, ~20% weight):
 *    - EBITDA margin scoring (0-12 pts)
 *    - Multiple locations bonus (0-5 pts)
 *    - Established business bonus (0-3 pts)
 *
 * 3. Data Completeness (0-8 pts, ~8% weight):
 *    - Having key data filled in
 *
 * 4. Seller Motivation BONUS (0-7 pts, ~7% weight):
 *    - ONLY ADDS points when we have data, NEVER penalizes
 *    - Highly motivated: +7 pts
 *    - Moderately motivated: +4 pts
 *    - Some indication: +2 pts
 *    - No data: +0 pts (no penalty)
 *
 * Example scores:
 *   - $3M EBITDA, 20% margin, no motivation data: 58 + 15 + 8 + 0 = 81
 *   - $1M EBITDA, 25% margin, motivated seller: 34 + 17 + 8 + 4 = 63
 *   - $500K EBITDA, 15% margin, no data: 20 + 11 + 6 + 0 = 37
 */
function calculateScoresFromData(deal: any): DealQualityScores {
  let sizeScore = 0;
  let qualityScore = 0;
  let completenessScore = 0;
  let motivationBonus = 0;
  const notes: string[] = [];

  const revenue = deal.revenue || 0;
  const ebitda = deal.ebitda || 0;

  // ===== 1. EBITDA/SIZE - PRIMARY DRIVER (0-65 pts) =====
  // This is BY FAR the most important factor (~65% of score)

  if (ebitda >= 5000000) {
    sizeScore = 65; // Premium deal
  } else if (ebitda >= 3000000) {
    sizeScore = 58; // Excellent deal
  } else if (ebitda >= 2000000) {
    sizeScore = 50; // Strong deal
  } else if (ebitda >= 1500000) {
    sizeScore = 42; // Good deal
  } else if (ebitda >= 1000000) {
    sizeScore = 34; // Solid deal
  } else if (ebitda >= 750000) {
    sizeScore = 26; // Decent deal
  } else if (ebitda >= 500000) {
    sizeScore = 20; // Small deal
  } else if (ebitda >= 250000) {
    sizeScore = 12; // Micro deal
  } else if (ebitda > 0) {
    sizeScore = 6; // Lifestyle business
  } else {
    sizeScore = 0;
    notes.push("No EBITDA data");
  }

  // ===== 2. DEAL QUALITY/MARGINS (0-20 pts) =====

  // Margin scoring (0-12 pts)
  if (revenue > 0 && ebitda > 0) {
    const margin = ebitda / revenue;
    if (margin >= 0.30) {
      qualityScore += 12;
    } else if (margin >= 0.25) {
      qualityScore += 10;
    } else if (margin >= 0.20) {
      qualityScore += 8;
    } else if (margin >= 0.15) {
      qualityScore += 6;
    } else if (margin >= 0.10) {
      qualityScore += 4;
    } else if (margin > 0) {
      qualityScore += 2;
    }
  }

  // Multiple locations bonus (0-5 pts)
  const locationCount = deal.number_of_locations || deal.location_count || 1;
  if (locationCount >= 5) {
    qualityScore += 5;
  } else if (locationCount >= 3) {
    qualityScore += 4;
  } else if (locationCount >= 2) {
    qualityScore += 2;
  }

  // Established business bonus (0-3 pts)
  if (deal.founded_year) {
    const age = new Date().getFullYear() - deal.founded_year;
    if (age >= 15) {
      qualityScore += 3;
    } else if (age >= 10) {
      qualityScore += 2;
    } else if (age >= 5) {
      qualityScore += 1;
    }
  }

  // Cap quality score at 20
  qualityScore = Math.min(20, qualityScore);

  // ===== 3. DATA COMPLETENESS (0-8 pts) =====

  let dataPoints = 0;
  if (revenue > 0) dataPoints++;
  if (ebitda > 0) dataPoints++;
  if (deal.location || deal.address) dataPoints++;
  if (deal.description || deal.executive_summary) dataPoints++;
  if (deal.category || deal.service_mix) dataPoints++;
  if (deal.full_time_employees || deal.linkedin_employee_count) dataPoints++;

  if (dataPoints >= 5) {
    completenessScore = 8;
  } else if (dataPoints >= 4) {
    completenessScore = 6;
  } else if (dataPoints >= 2) {
    completenessScore = 4;
  } else if (dataPoints >= 1) {
    completenessScore = 2;
  } else {
    completenessScore = 0;
  }

  // ===== 4. SELLER MOTIVATION BONUS (0-7 pts) =====
  // This is a BONUS ONLY - no penalty for missing data

  const motivation = (deal.seller_motivation || deal.owner_goals || '').toLowerCase();
  const hasSellerInterestScore = deal.seller_interest_score && deal.seller_interest_score > 0;

  // Check for high motivation keywords
  const highMotivationKeywords = ['retire', 'health', 'urgent', 'immediate', 'must sell', 'motivated', 'ready to sell', 'transition'];
  const hasHighMotivation = highMotivationKeywords.some(kw => motivation.includes(kw));

  // Check for moderate motivation keywords
  const moderateMotivationKeywords = ['sell', 'exit', 'opportunity', 'partner', 'growth'];
  const hasModerateMotivation = moderateMotivationKeywords.some(kw => motivation.includes(kw));

  if (hasHighMotivation || (hasSellerInterestScore && deal.seller_interest_score >= 80)) {
    motivationBonus = 7; // Highly motivated - full bonus
  } else if (hasModerateMotivation || (hasSellerInterestScore && deal.seller_interest_score >= 60)) {
    motivationBonus = 4; // Moderately motivated
  } else if (motivation.length > 10 || (hasSellerInterestScore && deal.seller_interest_score >= 40)) {
    motivationBonus = 2; // Some indication
  } else {
    motivationBonus = 0; // No data - NO PENALTY, just no bonus
  }

  // ===== CALCULATE TOTAL =====
  // Size (65) + Quality (20) + Completeness (8) + Motivation Bonus (7) = 100 max
  let totalScore = sizeScore + qualityScore + completenessScore + motivationBonus;

  // Ensure scores are within bounds (no hard caps - let size drive the score)
  totalScore = Math.min(100, Math.max(0, totalScore));

  return {
    deal_total_score: totalScore,
    deal_quality_score: qualityScore,
    deal_size_score: sizeScore,
    deal_motivation_score: motivationBonus,
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
    const { listingId, calculateAll, rescoreAll } = body;

    // Rate limit check
    const rateLimitResult = await checkRateLimit(supabase, userId, 'deal_scoring', false);
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for user ${userId} on deal_scoring`);
      return rateLimitResponse(rateLimitResult);
    }

    // If calculating for all deals, check global rate limit
    if (calculateAll || rescoreAll) {
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
    } else if (rescoreAll) {
      // Rescore ALL listings (even ones with existing scores)
      const { data: listings, error: listingsError } = await supabase
        .from("listings")
        .select("*")
        .limit(100); // Process in larger batches for rescore

      if (listingsError) {
        throw new Error("Failed to fetch listings");
      }

      listingsToScore = listings || [];
    } else if (calculateAll) {
      // Score only listings that don't have a score yet
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
        JSON.stringify({ error: "Must provide listingId, calculateAll: true, or rescoreAll: true" }),
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
        const { error: updateError } = await supabase
          .from("listings")
          .update({
            deal_total_score: scores.deal_total_score,
            deal_quality_score: scores.deal_quality_score,
            deal_size_score: scores.deal_size_score,
            deal_motivation_score: scores.deal_motivation_score,
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
