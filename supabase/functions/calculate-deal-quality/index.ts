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
 * REALISTIC Scoring methodology (0-100):
 *
 * A 90+ score requires: $2M+ EBITDA AND highly motivated seller
 *
 * 1. EBITDA - PRIMARY DRIVER (0-50 pts):
 *    - $3M+: 50 pts (premium deal)
 *    - $2M-3M: 42 pts (strong deal)
 *    - $1.5M-2M: 35 pts (good deal)
 *    - $1M-1.5M: 28 pts (solid deal)
 *    - $500K-1M: 20 pts (small deal)
 *    - $250K-500K: 12 pts (micro deal)
 *    - Below $250K: 5 pts (lifestyle business)
 *    - No EBITDA data: 0 pts
 *
 * 2. Seller Motivation - REQUIRED FOR 90+ (0-25 pts):
 *    - Highly motivated (retirement, health, urgent): 20-25 pts
 *    - Motivated (clear reason stated): 12-15 pts
 *    - Has some indication: 5-8 pts
 *    - No motivation info: 0 pts
 *
 * 3. Deal Quality/Margins (0-15 pts):
 *    - EBITDA margin 25%+: 10 pts
 *    - EBITDA margin 20-25%: 8 pts
 *    - EBITDA margin 15-20%: 6 pts
 *    - EBITDA margin 10-15%: 4 pts
 *    - Multiple locations: +3 pts
 *    - Established business (10+ yrs): +2 pts
 *
 * 4. Data Completeness (0-10 pts):
 *    - Has all key data points: 10 pts
 *    - Missing some data: 5 pts
 *    - Missing critical data: 0 pts
 */
function calculateScoresFromData(deal: any): DealQualityScores {
  let sizeScore = 0;
  let motivationScore = 0;
  let qualityScore = 0;
  let completenessScore = 0;
  const notes: string[] = [];

  const revenue = deal.revenue || 0;
  const ebitda = deal.ebitda || 0;

  // ===== 1. EBITDA - PRIMARY DRIVER (0-50 pts) =====
  // This is the most important factor - no great deal without solid EBITDA

  if (ebitda >= 3000000) {
    sizeScore = 50; // Premium deal
  } else if (ebitda >= 2000000) {
    sizeScore = 42; // Strong deal
  } else if (ebitda >= 1500000) {
    sizeScore = 35; // Good deal
  } else if (ebitda >= 1000000) {
    sizeScore = 28; // Solid deal
  } else if (ebitda >= 500000) {
    sizeScore = 20; // Small deal
  } else if (ebitda >= 250000) {
    sizeScore = 12; // Micro deal
  } else if (ebitda > 0) {
    sizeScore = 5; // Lifestyle business
  } else {
    sizeScore = 0;
    notes.push("No EBITDA data - cannot properly score");
  }

  // ===== 2. SELLER MOTIVATION - REQUIRED FOR 90+ (0-25 pts) =====
  // Without clear motivation, max score is capped

  const motivation = (deal.seller_motivation || deal.owner_goals || '').toLowerCase();
  const hasSellerInterestScore = deal.seller_interest_score && deal.seller_interest_score > 0;

  // Check for high motivation keywords
  const highMotivationKeywords = ['retire', 'health', 'urgent', 'immediate', 'must sell', 'motivated', 'ready to sell', 'transition'];
  const hasHighMotivation = highMotivationKeywords.some(kw => motivation.includes(kw));

  // Check for moderate motivation keywords
  const moderateMotivationKeywords = ['sell', 'exit', 'opportunity', 'partner', 'growth'];
  const hasModerateMotivation = moderateMotivationKeywords.some(kw => motivation.includes(kw));

  if (hasHighMotivation || (hasSellerInterestScore && deal.seller_interest_score >= 80)) {
    motivationScore = 23; // Highly motivated
  } else if (hasModerateMotivation || (hasSellerInterestScore && deal.seller_interest_score >= 60)) {
    motivationScore = 14; // Motivated
  } else if (motivation.length > 10 || (hasSellerInterestScore && deal.seller_interest_score >= 40)) {
    motivationScore = 7; // Some indication
  } else if (deal.asking_price && deal.asking_price > 0) {
    motivationScore = 4; // Has asking price at least
  } else {
    motivationScore = 0;
    notes.push("No seller motivation data");
  }

  // ===== 3. DEAL QUALITY/MARGINS (0-15 pts) =====

  // Margin scoring (0-10 pts)
  if (revenue > 0 && ebitda > 0) {
    const margin = ebitda / revenue;
    if (margin >= 0.25) {
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

  // Multiple locations bonus (0-3 pts)
  const locationCount = deal.number_of_locations || deal.location_count || 1;
  if (locationCount >= 3) {
    qualityScore += 3;
  } else if (locationCount >= 2) {
    qualityScore += 2;
  }

  // Established business bonus (0-2 pts)
  if (deal.founded_year) {
    const age = new Date().getFullYear() - deal.founded_year;
    if (age >= 10) {
      qualityScore += 2;
    } else if (age >= 5) {
      qualityScore += 1;
    }
  }

  // Cap quality score at 15
  qualityScore = Math.min(15, qualityScore);

  // ===== 4. DATA COMPLETENESS (0-10 pts) =====

  let dataPoints = 0;
  if (revenue > 0) dataPoints++;
  if (ebitda > 0) dataPoints++;
  if (deal.location || deal.address) dataPoints++;
  if (deal.description || deal.executive_summary) dataPoints++;
  if (deal.category || deal.service_mix) dataPoints++;
  if (deal.full_time_employees || deal.linkedin_employee_count) dataPoints++;

  if (dataPoints >= 5) {
    completenessScore = 10;
  } else if (dataPoints >= 3) {
    completenessScore = 6;
  } else if (dataPoints >= 1) {
    completenessScore = 3;
  } else {
    completenessScore = 0;
  }

  // ===== CALCULATE TOTAL =====
  let totalScore = sizeScore + motivationScore + qualityScore + completenessScore;

  // ===== HARD CAPS =====
  // Without $2M+ EBITDA, cap at 89
  if (ebitda < 2000000) {
    totalScore = Math.min(totalScore, 89);
  }

  // Without motivation data, cap at 75
  if (motivationScore < 7) {
    totalScore = Math.min(totalScore, 75);
  }

  // Without EBITDA data, cap at 40
  if (ebitda <= 0) {
    totalScore = Math.min(totalScore, 40);
  }

  // Ensure scores are within bounds
  totalScore = Math.min(100, Math.max(0, totalScore));

  return {
    deal_total_score: totalScore,
    deal_quality_score: qualityScore,
    deal_size_score: sizeScore,
    deal_motivation_score: motivationScore,
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
