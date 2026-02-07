import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DealQualityScores {
  deal_total_score: number;
  deal_size_score: number;
  revenue_score?: number;
  ebitda_score?: number;
  linkedin_boost?: number;
  quality_calculation_version?: string;
  scoring_notes?: string;
}

/**
 * Calculate deal quality score based on deal attributes.
 * This is the overall quality of the deal, NOT how well it fits a specific buyer.
 *
 * SCORING METHODOLOGY V2 (0-100):
 *
 * 1. SIZE (0-70 pts) - 70% weight - This is what matters most
 *    A. Revenue Score (0-60 pts) - Exponential curve
 *       - $0-1M: 0-15 pts (linear)
 *       - $1M-5M: 15-35 pts (accelerating)
 *       - $5M-10M: 35-50 pts (strong acceleration)
 *       - $10M+: 50-60 pts (premium tier)
 *
 *    B. EBITDA Score (0-40 pts) - Exponential curve
 *       - $0-300K: 0 pts (below threshold)
 *       - $300K-1M: 0-15 pts (linear)
 *       - $1M-3M: 15-28 pts (accelerating)
 *       - $3M-5M: 28-35 pts (strong)
 *       - $5M+: 35-40 pts (premium)
 *
 *    C. LinkedIn Employee Boost (0-25 pts BONUS) - Applied even with financials
 *       - 100+ employees: +20-25 pts (validates large operation)
 *       - 50-99 employees: +10-15 pts (validates mid-size)
 *       - 25-49 employees: +5-10 pts (validates small-mid)
 *       - <25 employees: No boost (financials tell the story)
 *
 *    D. Proxy Scoring (when NO financials): LinkedIn employee count only
 *       - Uses employee count to estimate both revenue and EBITDA
 *       - Same 0-100 scale as financial scoring
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

  // ===== SIZE SCORE (0-100 pts max with LinkedIn boost) =====
  // Size is 70% of what matters in deal quality
  const revenue = deal.revenue || 0;
  const ebitda = deal.ebitda || 0;
  const employeeCount = deal.linkedin_employee_count || 0;
  const reviewCount = deal.google_review_count || 0;
  const hasFinancials = revenue > 0 || ebitda > 0;

  let revenueScore = 0;
  let ebitdaScore = 0;
  let linkedinBoost = 0;

  if (hasFinancials) {
    // PRIMARY PATH: Use actual financials when available

    // A. Revenue Score (0-60 pts) - EXPONENTIAL CURVE
    if (revenue >= 20000000) {
      revenueScore = 60; // $20M+ revenue - top tier
    } else if (revenue >= 15000000) {
      revenueScore = 58; // $15-20M revenue
    } else if (revenue >= 10000000) {
      revenueScore = 54; // $10-15M revenue - strong acceleration
    } else if (revenue >= 7000000) {
      revenueScore = 48; // $7-10M revenue
    } else if (revenue >= 5000000) {
      revenueScore = 40; // $5-7M revenue - entering sweet spot
    } else if (revenue >= 3000000) {
      revenueScore = 30; // $3-5M revenue - good size
    } else if (revenue >= 2000000) {
      revenueScore = 22; // $2-3M revenue
    } else if (revenue >= 1000000) {
      revenueScore = 15; // $1-2M revenue - baseline
    } else if (revenue >= 500000) {
      revenueScore = 8;  // $500K-1M revenue
    } else if (revenue > 0) {
      revenueScore = 3;  // Under $500K - very small
    }

    // B. EBITDA Score (0-40 pts) - EXPONENTIAL CURVE
    if (ebitda >= 5000000) {
      ebitdaScore = 40; // $5M+ EBITDA - premium
    } else if (ebitda >= 3000000) {
      ebitdaScore = 35; // $3-5M EBITDA - strong
    } else if (ebitda >= 2000000) {
      ebitdaScore = 28; // $2-3M EBITDA - accelerating
    } else if (ebitda >= 1000000) {
      ebitdaScore = 20; // $1-2M EBITDA - good
    } else if (ebitda >= 500000) {
      ebitdaScore = 12; // $500K-1M EBITDA
    } else if (ebitda >= 300000) {
      ebitdaScore = 5;  // $300K-500K EBITDA - minimum threshold
    }
    // Below $300K EBITDA gets 0 points (too small)

    sizeScore = revenueScore + ebitdaScore;

    // C. LinkedIn Employee BOOST (0-25 pts) - Validates scale even with financials
    if (employeeCount >= 200) {
      linkedinBoost = 25; // 200+ employees confirms massive operation
      notes.push('Large team (200+ employees) validates premium scale');
    } else if (employeeCount >= 150) {
      linkedinBoost = 22; // 150-199 employees
    } else if (employeeCount >= 100) {
      linkedinBoost = 20; // 100-149 employees confirms large operation
      notes.push('Large team (100+ employees) confirms significant scale');
    } else if (employeeCount >= 75) {
      linkedinBoost = 15; // 75-99 employees
    } else if (employeeCount >= 50) {
      linkedinBoost = 12; // 50-74 employees validates mid-size
      notes.push('Mid-size team (50+ employees) validates operation');
    } else if (employeeCount >= 35) {
      linkedinBoost = 8; // 35-49 employees
    } else if (employeeCount >= 25) {
      linkedinBoost = 5; // 25-34 employees validates small-mid
    }
    // <25 employees: No boost when we have financials

    sizeScore += linkedinBoost;

  } else if (employeeCount > 0) {
    // PROXY PATH: Estimate size from LinkedIn employee count when no financials
    // Use employee count to estimate BOTH revenue and EBITDA scores
    notes.push('Size estimated from LinkedIn employee count (no financials)');

    // Estimated revenue score based on ~$500K-800K revenue per employee
    if (employeeCount >= 200) {
      revenueScore = 60; // Likely $100M+ revenue
      ebitdaScore = 40; // Likely $10M+ EBITDA
    } else if (employeeCount >= 150) {
      revenueScore = 58; // Likely $75M+ revenue
      ebitdaScore = 38;
    } else if (employeeCount >= 100) {
      revenueScore = 54; // Likely $50M+ revenue
      ebitdaScore = 35;
    } else if (employeeCount >= 75) {
      revenueScore = 48; // Likely $37M+ revenue
      ebitdaScore = 30;
    } else if (employeeCount >= 50) {
      revenueScore = 40; // Likely $25M+ revenue
      ebitdaScore = 25;
    } else if (employeeCount >= 35) {
      revenueScore = 30; // Likely $17M+ revenue
      ebitdaScore = 18;
    } else if (employeeCount >= 25) {
      revenueScore = 22; // Likely $12M+ revenue
      ebitdaScore = 12;
    } else if (employeeCount >= 15) {
      revenueScore = 15; // Likely $7M+ revenue
      ebitdaScore = 8;
    } else if (employeeCount >= 10) {
      revenueScore = 10; // Likely $5M+ revenue
      ebitdaScore = 5;
    } else if (employeeCount >= 5) {
      revenueScore = 6; // Likely $2M+ revenue
      ebitdaScore = 0;
    } else {
      revenueScore = 3;  // Small business
      ebitdaScore = 0;
    }

    sizeScore = revenueScore + ebitdaScore;

  } else if (reviewCount > 0) {
    // TERTIARY PROXY: Estimate size from Google review count when no financials or employees
    // For consumer-facing businesses, review volume indicates customer throughput
    notes.push('Size estimated from Google review count');

    if (reviewCount >= 1000) {
      revenueScore = 50;
      ebitdaScore = 20; // Very high volume - likely $10M+ revenue
    } else if (reviewCount >= 250) {
      revenueScore = 35;
      ebitdaScore = 15; // High volume - likely $5M+ revenue
    } else if (reviewCount >= 100) {
      revenueScore = 20;
      ebitdaScore = 8;  // Established - likely $2M+ revenue
    } else if (reviewCount >= 50) {
      revenueScore = 10;
      ebitdaScore = 0;  // Growing - likely $1M revenue
    } else {
      revenueScore = 3;
      ebitdaScore = 0;  // Under 50 reviews - small/new business
    }

    sizeScore = revenueScore + ebitdaScore;

  } else {
    notes.push('No financials, employee, or review data - size unknown');
    // No penalty - just can't score size yet
  }

  // Cap size score at 100 (with LinkedIn boost, this is possible)
  sizeScore = Math.min(100, sizeScore);

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
  // Base score from size + geography + services (max 115 pts with LinkedIn boost, typically max 85-100)
  // Note: Size can exceed 70 pts with LinkedIn boost (up to 100 pts theoretically)
  // We'll cap the base at 100 before adding seller interest
  const baseScore = Math.min(100, sizeScore + geographyScore + servicesScore);

  // If we have seller interest score, add it (max 15 pts)
  // If we don't have it, scale the base score to 100 so great deals aren't penalized
  let totalScore: number;

  if (deal.seller_interest_score !== null && deal.seller_interest_score !== undefined) {
    // We have seller interest - add it to the base (0-15 pts)
    sellerInterestScore = Math.round((deal.seller_interest_score / 100) * 15);
    // Cap at 85 before adding seller interest so final doesn't exceed 100
    totalScore = Math.min(85, baseScore) + sellerInterestScore;

    if (deal.seller_interest_score >= 70) {
      notes.push('High seller motivation');
    }
  } else {
    // No seller interest score - use base score directly (already 0-100)
    totalScore = baseScore;
  }

  return {
    deal_total_score: Math.min(100, Math.max(0, totalScore)),
    deal_size_score: sizeScore,
    revenue_score: revenueScore || undefined,
    ebitda_score: ebitdaScore || undefined,
    linkedin_boost: linkedinBoost || undefined,
    quality_calculation_version: 'v2.0',
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

    const body = await req.json();
    const { listingId, calculateAll, forceRecalculate, triggerEnrichment } = body;

    let listingsToScore: any[] = [];
    let enrichmentQueued = 0;

    // Helper function to queue deals for enrichment
    const queueDealsForEnrichment = async (dealIds: string[], reason: string) => {
      console.log(`Queueing ${dealIds.length} deals for enrichment (${reason})`);
      let queuedCount = 0;
      
      for (const dealId of dealIds) {
        // Check if already in queue (pending or processing)
        const { data: existing } = await supabase
          .from("enrichment_queue")
          .select("id")
          .eq("listing_id", dealId)
          .in("status", ["pending", "processing"])
          .maybeSingle();

        if (!existing) {
          const { error: queueError } = await supabase
            .from("enrichment_queue")
            .upsert({
              listing_id: dealId,
              status: "pending",
              attempts: 0,
              queued_at: new Date().toISOString(),
            }, { onConflict: 'listing_id' });

          if (!queueError) {
            queuedCount++;
          }
        }
      }
      
      if (queuedCount > 0) {
        console.log(`Queued ${queuedCount} deals for enrichment`);
      }
      return queuedCount;
    };

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
      
      // Always queue single listing for enrichment when scoring
      enrichmentQueued = await queueDealsForEnrichment([listingId], 'single deal score');
    } else if (forceRecalculate) {
      // Force recalculate ALL active listings (even if already scored)
      const { data: listings, error: listingsError } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "active")
        .is("deleted_at", null)
        .limit(100); // Process in larger batches for rescore

      if (listingsError) {
        throw new Error("Failed to fetch listings");
      }

      listingsToScore = listings || [];
      console.log(`Force recalculating scores for ${listingsToScore.length} listings`);

      // If triggerEnrichment is true, queue ALL deals for re-enrichment
      // AND reset their enriched_at to force full re-processing
      if (triggerEnrichment && listingsToScore.length > 0) {
        const dealIds = listingsToScore.map(l => l.id);
        
        // Reset enriched_at to null so the queue processor actually processes them
        console.log(`Resetting enriched_at for ${dealIds.length} deals to force re-enrichment`);
        const { error: resetError } = await supabase
          .from("listings")
          .update({ enriched_at: null })
          .in("id", dealIds);
        
        if (resetError) {
          console.error("Failed to reset enriched_at:", resetError);
        }
        
        enrichmentQueued = await queueDealsForEnrichment(dealIds, 'force recalculate all');
      }
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

      // Queue unscored deals for enrichment (they likely need it)
      if (listingsToScore.length > 0) {
        const unscoredIds = listingsToScore
          .filter(l => !l.enriched_at) // Only those not enriched
          .map(l => l.id);
        
        if (unscoredIds.length > 0) {
          enrichmentQueued = await queueDealsForEnrichment(unscoredIds, 'unscored deals');
        }
      }

      // Also queue enrichment for stale deals (not enriched in 30+ days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

      const { data: staleDeals, error: staleError } = await supabase
        .from("listings")
        .select("id, enriched_at")
        .eq("status", "active")
        .is("deleted_at", null)
        .or(`enriched_at.is.null,enriched_at.lt.${thirtyDaysAgoISO}`)
        .limit(20);

      if (!staleError && staleDeals && staleDeals.length > 0) {
        console.log(`Found ${staleDeals.length} deals needing enrichment (stale or never enriched)`);
        const staleIds = staleDeals.map(d => d.id);
        const staleQueued = await queueDealsForEnrichment(staleIds, 'stale deals');
        enrichmentQueued += staleQueued;
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Must provide listingId, calculateAll: true, or forceRecalculate: true" }),
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

        // Update the listing with all scoring fields
        const { error: updateError } = await supabase
          .from("listings")
          .update({
            deal_total_score: scores.deal_total_score,
            deal_size_score: scores.deal_size_score,
            revenue_score: scores.revenue_score,
            ebitda_score: scores.ebitda_score,
            linkedin_boost: scores.linkedin_boost,
            quality_calculation_version: scores.quality_calculation_version,
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

    console.log(`Scored ${scored} listings, ${errors} errors, ${enrichmentQueued} queued for enrichment`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scored ${scored} deals${errors > 0 ? `, ${errors} errors` : ''}`,
        scored,
        errors,
        enrichmentQueued,
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
