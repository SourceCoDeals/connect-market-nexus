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
 * 1. FINANCIAL SIZE (0-35 pts) — Revenue & EBITDA when available
 * 2. COMPANY SIGNALS (0-30 pts) — LinkedIn employees, Google reviews/rating
 * 3. MARKET POSITION (0-20 pts) — Geography, services, multi-location
 * 4. SELLER READINESS (0-15 pts) — Seller interest score
 *
 * KEY PRINCIPLE: When financials are missing, their 35 points are
 * redistributed proportionally to Company Signals and Market Position.
 * This ensures companies with strong LinkedIn/Google presence aren't
 * penalized just because we haven't gotten financial data yet.
 */
function calculateScoresFromData(deal: any): DealQualityScores {
  const notes: string[] = [];

  // ===== FINANCIAL SIZE (0-35 pts) =====
  const revenue = deal.revenue || 0;
  const ebitda = deal.ebitda || 0;
  const hasFinancials = revenue > 0 || ebitda > 0;
  let financialScore = 0;

  let revenueScore = 0;
  let ebitdaScore = 0;
  let linkedinBoost = 0;

  if (hasFinancials) {
    // Revenue scoring (0-22 pts)
    let revPts = 0;
    if (revenue >= 10000000) revPts = 22;
    else if (revenue >= 7000000) revPts = 20;
    else if (revenue >= 5000000) revPts = 18;
    else if (revenue >= 3000000) revPts = 14;
    else if (revenue >= 2000000) revPts = 11;
    else if (revenue >= 1000000) revPts = 8;
    else if (revenue >= 500000) revPts = 4;
    else if (revenue > 0) revPts = 2;

    revenueScore = revPts;

    // EBITDA scoring (0-13 pts)
    let ebitdaPts = 0;
    if (ebitda >= 5000000) ebitdaPts = 13;
    else if (ebitda >= 2000000) ebitdaPts = 11;
    else if (ebitda >= 1000000) ebitdaPts = 9;
    else if (ebitda >= 500000) ebitdaPts = 7;
    else if (ebitda >= 300000) ebitdaPts = 5;
    else if (ebitda >= 150000) ebitdaPts = 3;

    ebitdaScore = ebitdaPts;

    financialScore = Math.min(35, revPts + ebitdaPts);
  }

  // ===== COMPANY SIGNALS (0-30 pts) =====
  const employeeCount = deal.linkedin_employee_count || 0;
  const reviewCount = deal.google_review_count || 0;
  const googleRating = deal.google_rating || 0;
  let signalsScore = 0;

  // LinkedIn employees (0-20 pts) — calibrated for SMBs
  if (employeeCount >= 200) signalsScore += 20;
  else if (employeeCount >= 100) signalsScore += 18;
  else if (employeeCount >= 50) signalsScore += 16;
  else if (employeeCount >= 25) signalsScore += 14;
  else if (employeeCount >= 15) signalsScore += 12;
  else if (employeeCount >= 10) signalsScore += 10;
  else if (employeeCount >= 5) signalsScore += 7;
  else if (employeeCount >= 3) signalsScore += 4;
  else if (employeeCount > 0) signalsScore += 2;

  if (employeeCount > 0) {
    linkedinBoost = signalsScore; // Track LinkedIn contribution
    notes.push(`LinkedIn: ${employeeCount} employees`);
  }

  // Google review count (0-5 pts) — customer volume indicator
  if (reviewCount >= 200) signalsScore += 5;
  else if (reviewCount >= 100) signalsScore += 4;
  else if (reviewCount >= 50) signalsScore += 3;
  else if (reviewCount >= 20) signalsScore += 2;
  else if (reviewCount > 0) signalsScore += 1;

  // Google rating (0-5 pts)
  if (googleRating >= 4.5) signalsScore += 5;
  else if (googleRating >= 4.0) signalsScore += 4;
  else if (googleRating >= 3.5) signalsScore += 3;
  else if (googleRating >= 3.0) signalsScore += 1;
  // Below 3.0 = 0 pts

  if (reviewCount > 0) {
    notes.push(`Google: ${reviewCount} reviews, ${googleRating} rating`);
  }

  signalsScore = Math.min(30, signalsScore);

  // ===== MARKET POSITION (0-20 pts) =====
  let marketScore = 0;

  // Geography (0-10 pts)
  const city = (deal.address_city || '').toLowerCase();
  const state = (deal.address_state || '').toUpperCase();
  const location = (deal.location || '').toLowerCase();
  const locationText = `${city} ${location}`;

  const majorMetros = [
    'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
    'san antonio', 'san diego', 'dallas', 'austin', 'san jose', 'san francisco',
    'seattle', 'denver', 'boston', 'atlanta', 'miami', 'washington', 'dc',
    'minneapolis', 'tampa', 'orlando', 'detroit', 'portland', 'charlotte',
    'nashville', 'las vegas', 'baltimore', 'indianapolis', 'columbus', 'jacksonville'
  ];
  const secondaryCities = [
    'raleigh', 'richmond', 'sacramento', 'kansas city', 'st louis', 'pittsburgh',
    'cincinnati', 'milwaukee', 'oklahoma city', 'memphis', 'louisville', 'tucson',
    'albuquerque', 'fresno', 'mesa', 'omaha', 'colorado springs', 'tulsa',
    'arlington', 'bakersfield', 'wichita', 'boise', 'salt lake', 'madison',
    'green bay', 'des moines', 'knoxville', 'chattanooga', 'birmingham'
  ];
  const highValueStates = ['TX', 'FL', 'CA', 'AZ', 'NC', 'GA', 'TN', 'CO', 'WA'];

  if (majorMetros.some(metro => locationText.includes(metro))) {
    marketScore += 10;
    notes.push('Major metro area');
  } else if (secondaryCities.some(c => locationText.includes(c))) {
    marketScore += 7;
  } else if (highValueStates.includes(state)) {
    marketScore += 5;
  } else if (city || state) {
    marketScore += 3;
  }

  // Services/business type (0-5 pts)
  const category = (deal.category || '').toLowerCase();
  const serviceMix = (deal.service_mix || '').toLowerCase();
  const businessModel = (deal.business_model || '').toLowerCase();
  const description = (deal.description || deal.executive_summary || '').toLowerCase();
  const allText = `${category} ${serviceMix} ${businessModel} ${description}`;

  const highValueKeywords = [
    'recurring', 'subscription', 'contract', 'maintenance', 'managed services',
    'hvac', 'plumbing', 'electrical', 'roofing', 'pest control', 'waste',
    'healthcare', 'dental', 'veterinary', 'restoration', 'remediation',
    'fire', 'water damage', 'environmental', 'janitorial', 'landscaping'
  ];

  if (highValueKeywords.some(kw => allText.includes(kw))) {
    marketScore += 5;
  } else if (category) {
    marketScore += 3;
  }

  // Multi-location bonus (0-5 pts)
  const locationCount = deal.location_count || 0;
  if (locationCount >= 5) marketScore += 5;
  else if (locationCount >= 3) marketScore += 4;
  else if (locationCount >= 2) marketScore += 3;

  marketScore = Math.min(20, marketScore);

  // ===== DYNAMIC WEIGHT REDISTRIBUTION =====
  // When financials are missing, redistribute those 35 points
  // proportionally to Company Signals (60%) and Market Position (40%)
  let adjustedSignals = signalsScore;
  let adjustedMarket = marketScore;

  if (!hasFinancials) {
    // Scale signals and market up to absorb the financial weight
    const signalsMax = 30;
    const marketMax = 20;
    const totalAvailableMax = signalsMax + marketMax; // 50
    const scaleFactor = (35 + totalAvailableMax) / totalAvailableMax; // 85/50 = 1.7

    adjustedSignals = Math.round(signalsScore * scaleFactor);
    adjustedMarket = Math.round(marketScore * scaleFactor);

    // Cap at scaled maximums
    adjustedSignals = Math.min(Math.round(signalsMax * scaleFactor), adjustedSignals);
    adjustedMarket = Math.min(Math.round(marketMax * scaleFactor), adjustedMarket);

    if (signalsScore > 0 || marketScore > 0) {
      notes.push('No financials — score weighted to company signals & market position');
    } else {
      notes.push('No financials, employee, or review data — limited scoring data');
    }
  }

  // ===== SELLER READINESS (0-15 pts) =====
  let sellerScore = 0;
  const hasSeller = deal.seller_interest_score !== null && deal.seller_interest_score !== undefined;

  if (hasSeller) {
    sellerScore = Math.round((deal.seller_interest_score / 100) * 15);
    if (deal.seller_interest_score >= 70) {
      notes.push('High seller motivation');
    }
  }

  // ===== CALCULATE TOTAL =====
  let totalScore: number;
  const baseScore = (hasFinancials ? financialScore : 0) + adjustedSignals + adjustedMarket;

  if (hasSeller) {
    totalScore = baseScore + sellerScore;
  } else {
    // Scale base to 100 so great deals without seller data can still score high
    const maxBase = hasFinancials ? 85 : 85; // 35+30+20 or redistributed equivalent
    totalScore = Math.round((baseScore / maxBase) * 100);
  }

  // Store the size indicator for the dashboard (use financial or employee proxy)
  const sizeIndicator = hasFinancials
    ? financialScore
    : Math.round(signalsScore * (35 / 30)); // Scale signals to size range for display

  return {
    deal_total_score: Math.min(100, Math.max(0, totalScore)),
    deal_size_score: Math.min(70, Math.max(0, sizeIndicator)),
    revenue_score: hasFinancials ? revenueScore : undefined,
    ebitda_score: hasFinancials ? ebitdaScore : undefined,
    linkedin_boost: employeeCount > 0 ? linkedinBoost : undefined,
    quality_calculation_version: 'v2',
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
      // No auto-enrichment — only enrich when explicitly requested
    } else if (forceRecalculate) {
      // Force recalculate ALL active listings (even if already scored)
      const { data: listings, error: listingsError } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "active")
        .is("deleted_at", null)
        .limit(100);

      if (listingsError) {
        throw new Error("Failed to fetch listings");
      }

      listingsToScore = listings || [];
      console.log(`Force recalculating scores for ${listingsToScore.length} listings`);

      // Only queue enrichment when explicitly requested via triggerEnrichment flag
      if (triggerEnrichment && listingsToScore.length > 0) {
        const dealIds = listingsToScore.map(l => l.id);
        
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
        .limit(50);

      if (listingsError) {
        throw new Error("Failed to fetch listings");
      }

      listingsToScore = listings || [];
      // No auto-enrichment — scoring only uses existing data
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
