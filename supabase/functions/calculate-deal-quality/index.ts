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
  scoring_notes?: string;
}

/**
 * Calculate deal quality score based on deal attributes.
 * This is the overall quality of the deal, NOT how well it fits a specific buyer.
 *
 * SCORING METHODOLOGY (0-100):
 *
 * 1. SIZE (0-70 pts) - 70% weight - This is what matters most
 *    - Based on revenue, EBITDA, or proxies (LinkedIn employees, Google reviews)
 *    - Larger deals = higher scores
 *
 * 2. GEOGRAPHY (0-10 pts) - 10% weight
 *    - Urban/metro areas score higher than rural
 *    - Major cities get bonus points
 *
 * 3. SERVICES/BUSINESS TYPE (0-5 pts) - 5% weight
 *    - Recurring revenue and essential services score higher
 *
 * 4. SELLER INTEREST (0-15 pts) - 15% weight (bonus when available)
 *    - Pulled from seller_interest_score (AI-analyzed separately)
 *    - If no seller interest score, base score is scaled to 100
 *    - Great deals without seller interest data can still score 100
 *
 * NOTE: Data completeness does NOT affect score. A great deal with little
 * data is still a great deal - we just need to get more info on it.
 */
function calculateScoresFromData(deal: any): DealQualityScores {
  let sizeScore = 0;
  let geographyScore = 0;
  let servicesScore = 0;
  let sellerInterestScore = 0;
  const notes: string[] = [];

  // ===== SIZE SCORE (0-70 pts) =====
  // Size is 70% of what matters in deal quality
  const revenue = deal.revenue || 0;
  const ebitda = deal.ebitda || 0;
  const employeeCount = deal.linkedin_employee_count || 0;
  const reviewCount = deal.google_review_count || 0;
  const hasFinancials = revenue > 0 || ebitda > 0;

  if (hasFinancials) {
    // PRIMARY PATH: Use actual financials when available

    // Revenue-based scoring (0-45 pts)
    if (revenue >= 10000000) {
      sizeScore += 45; // $10M+ revenue
    } else if (revenue >= 5000000) {
      sizeScore += 38; // $5-10M revenue
    } else if (revenue >= 3000000) {
      sizeScore += 30; // $3-5M revenue
    } else if (revenue >= 2000000) {
      sizeScore += 24; // $2-3M revenue
    } else if (revenue >= 1000000) {
      sizeScore += 16; // $1-2M revenue
    } else if (revenue >= 500000) {
      sizeScore += 8;  // $500K-1M revenue
    } else if (revenue > 0) {
      sizeScore += 3;  // Under $500K
    }

    // EBITDA-based bonus (0-25 pts)
    // Below $300K EBITDA = 0 points (too small)
    if (ebitda >= 5000000) {
      sizeScore += 25; // $5M+ EBITDA - top tier
    } else if (ebitda >= 2000000) {
      sizeScore += 22; // $2M-5M EBITDA
    } else if (ebitda >= 1000000) {
      sizeScore += 18; // $1M-2M EBITDA
    } else if (ebitda >= 500000) {
      sizeScore += 14; // $500K-1M EBITDA
    } else if (ebitda >= 300000) {
      sizeScore += 10; // $300K-600K EBITDA
    }
    // Below $300K EBITDA gets 0 points
  } else if (employeeCount > 0) {
    // PROXY PATH: Estimate size from LinkedIn employee count when no financials
    // Industry average: ~$400K-800K revenue per employee for services businesses (doubled estimate)
    notes.push('Size estimated from LinkedIn employee count');

    if (employeeCount >= 200) {
      sizeScore += 70; // Likely $80M+ revenue - top tier
    } else if (employeeCount >= 100) {
      sizeScore += 58; // Likely $40-80M revenue
    } else if (employeeCount >= 50) {
      sizeScore += 48; // Likely $20-40M revenue
    } else if (employeeCount >= 25) {
      sizeScore += 38; // Likely $10-20M revenue
    } else if (employeeCount >= 15) {
      sizeScore += 28; // Likely $6-10M revenue
    } else if (employeeCount >= 10) {
      sizeScore += 20; // Likely $4-6M revenue
    } else if (employeeCount >= 5) {
      sizeScore += 12; // Likely $2-4M revenue
    } else {
      sizeScore += 5;  // Small business
    }
  } else if (reviewCount > 0) {
    // TERTIARY PROXY: Estimate size from Google review count when no financials or employees
    // For consumer-facing businesses, review volume indicates customer throughput
    notes.push('Size estimated from Google review count');

    if (reviewCount >= 2000) {
      sizeScore += 55; // Very high volume - likely $10M+ revenue
    } else if (reviewCount >= 1000) {
      sizeScore += 45; // High volume - likely $5-10M revenue
    } else if (reviewCount >= 500) {
      sizeScore += 35; // Established - likely $3-5M revenue
    } else if (reviewCount >= 200) {
      sizeScore += 25; // Growing - likely $1-3M revenue
    } else if (reviewCount >= 100) {
      sizeScore += 15; // Small but active - likely $500K-1M revenue
    } else if (reviewCount >= 50) {
      sizeScore += 8;  // Small - likely $250K-500K revenue
    } else {
      sizeScore += 3;  // Very small or new
    }
  } else {
    notes.push('No financials, employee, or review data - size unknown');
    // No penalty - just can't score size yet
  }

  // Cap size score at 70
  sizeScore = Math.min(70, sizeScore);

  // ===== GEOGRAPHY SCORE (0-10 pts) =====
  // Urban/metro areas are more valuable than rural
  const city = (deal.address_city || '').toLowerCase();
  const state = (deal.address_state || '').toUpperCase();
  const location = (deal.location || '').toLowerCase();

  // Major metro areas (10 pts)
  const majorMetros = [
    'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
    'san antonio', 'san diego', 'dallas', 'austin', 'san jose', 'san francisco',
    'seattle', 'denver', 'boston', 'atlanta', 'miami', 'washington', 'dc',
    'minneapolis', 'tampa', 'orlando', 'detroit', 'portland', 'charlotte',
    'nashville', 'las vegas', 'baltimore', 'indianapolis', 'columbus', 'jacksonville'
  ];

  // Secondary cities (7 pts)
  const secondaryCities = [
    'raleigh', 'richmond', 'sacramento', 'kansas city', 'st louis', 'pittsburgh',
    'cincinnati', 'milwaukee', 'oklahoma city', 'memphis', 'louisville', 'tucson',
    'albuquerque', 'fresno', 'mesa', 'omaha', 'colorado springs', 'tulsa',
    'arlington', 'bakersfield', 'wichita', 'boise', 'salt lake'
  ];

  // High-value states for services businesses (bonus for being in these states at all)
  const highValueStates = ['TX', 'FL', 'CA', 'AZ', 'NC', 'GA', 'TN', 'CO', 'WA'];

  const locationText = `${city} ${location}`;

  if (majorMetros.some(metro => locationText.includes(metro))) {
    geographyScore = 10;
    notes.push('Major metro area');
  } else if (secondaryCities.some(c => locationText.includes(c))) {
    geographyScore = 7;
  } else if (highValueStates.includes(state)) {
    geographyScore = 5; // In a good state but not a major city
  } else if (city || state) {
    geographyScore = 3; // Has location but not premium
  }
  // No geography info = 0 pts (not penalized, just can't contribute)

  // ===== SERVICES/BUSINESS TYPE SCORE (0-5 pts) =====
  const category = (deal.category || '').toLowerCase();
  const serviceMix = (deal.service_mix || '').toLowerCase();
  const businessModel = (deal.business_model || '').toLowerCase();
  const description = (deal.description || deal.executive_summary || '').toLowerCase();
  const allText = `${category} ${serviceMix} ${businessModel} ${description}`;

  // High-value recurring revenue or essential services (5 pts)
  const highValueKeywords = [
    'recurring', 'subscription', 'contract', 'maintenance', 'managed services',
    'hvac', 'plumbing', 'electrical', 'roofing', 'pest control', 'waste',
    'healthcare', 'dental', 'veterinary'
  ];
  if (highValueKeywords.some(kw => allText.includes(kw))) {
    servicesScore = 5;
  }
  // Other services (3 pts)
  else if (category) {
    servicesScore = 3;
  }

  // ===== CALCULATE TOTAL =====
  // Base score from size + geography + services (max 85 pts)
  const baseScore = sizeScore + geographyScore + servicesScore;

  // If we have seller interest score, add it (max 15 pts)
  // If we don't have it, scale the base score to 100 so great deals aren't penalized
  let totalScore: number;

  if (deal.seller_interest_score !== null && deal.seller_interest_score !== undefined) {
    // We have seller interest - add it to the base (0-15 pts)
    sellerInterestScore = Math.round((deal.seller_interest_score / 100) * 15);
    totalScore = baseScore + sellerInterestScore;

    if (deal.seller_interest_score >= 70) {
      notes.push('High seller motivation');
    }
  } else {
    // No seller interest score - scale base score (0-85) to (0-100)
    // This way a great deal without seller interest data can still score 100
    totalScore = Math.round((baseScore / 85) * 100);
  }

  return {
    deal_total_score: Math.min(100, Math.max(0, totalScore)),
    deal_size_score: sizeScore,
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
