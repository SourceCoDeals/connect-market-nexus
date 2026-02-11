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
 * SCORING METHODOLOGY V3 (0-100):
 *
 * 1. FINANCIAL SIZE (0-55 pts) — Revenue & EBITDA. BY FAR the most important factor.
 * 2. COMPANY SIGNALS (0-10 pts with financials, 0-30 without) — LinkedIn is a size
 *    proxy so it only counts when financials are unknown. Google reviews/rating always count.
 * 3. MARKET POSITION (0-10 pts) — Light geographic & recurring-revenue bonus, not a penalty.
 *
 * Size floors guarantee minimum scores for large deals (e.g. $10M+ rev = 80 floor).
 * When financials are missing, their points are redistributed to Company Signals
 * (where LinkedIn acts as a size proxy) and Market Position.
 */
function calculateScoresFromData(deal: any): DealQualityScores {
  const notes: string[] = [];

  // ===== NORMALIZE FINANCIALS =====
  // Some deals store revenue/ebitda as millions (e.g., 20 = $20M) while
  // others store as raw integers (e.g., 50000000 = $50M). Normalize to raw integers.
  const normalizeFinancial = (val: number): number => {
    if (val <= 0) return 0;
    // Values under 1000 are assumed to be in millions (e.g., 20 → 20,000,000)
    if (val < 1000) return Math.round(val * 1_000_000);
    // Values 1000-99999 are assumed to be in thousands (e.g., 5000 → 5,000,000)
    if (val < 100000) return Math.round(val * 1_000);
    // Values >= 100000 are already raw integers
    return val;
  };

  // ===== FINANCIAL SIZE (0-55 pts) =====
  // Revenue/EBITDA is BY FAR the most important factor.
  // "When you get that big nothing matters but size."
  const revenue = normalizeFinancial(deal.revenue || 0);
  const ebitda = normalizeFinancial(deal.ebitda || 0);
  const hasFinancials = revenue > 0 || ebitda > 0;
  let financialScore = 0;

  let revenueScore = 0;
  let ebitdaScore = 0;
  let linkedinBoost = 0;

  // Size floor: large EBITDA guarantees a minimum total score
  // regardless of other factors — size dominates at this level
  let sizeFloor = 0;

  if (hasFinancials) {
    // Revenue scoring (0-42 pts)
    let revPts = 0;
    if (revenue >= 100000000) revPts = 42;
    else if (revenue >= 50000000) revPts = 39;
    else if (revenue >= 25000000) revPts = 36;
    else if (revenue >= 10000000) revPts = 33;
    else if (revenue >= 7000000) revPts = 29;
    else if (revenue >= 5000000) revPts = 26;
    else if (revenue >= 3000000) revPts = 22;
    else if (revenue >= 2000000) revPts = 17;
    else if (revenue >= 1000000) revPts = 12;
    else if (revenue >= 500000) revPts = 6;
    else if (revenue > 0) revPts = 3;

    revenueScore = revPts;

    // EBITDA scoring (0-13 pts)
    let ebitdaPts = 0;
    if (ebitda >= 5000000) ebitdaPts = 13;
    else if (ebitda >= 3000000) ebitdaPts = 11;
    else if (ebitda >= 2000000) ebitdaPts = 10;
    else if (ebitda >= 1000000) ebitdaPts = 8;
    else if (ebitda >= 500000) ebitdaPts = 6;
    else if (ebitda >= 300000) ebitdaPts = 4;
    else if (ebitda >= 150000) ebitdaPts = 2;

    ebitdaScore = ebitdaPts;

    financialScore = Math.min(55, revPts + ebitdaPts);

    // Size floor: big deals get a guaranteed minimum total score.
    // Revenue is the primary driver. EBITDA can push higher if available.
    if (revenue >= 50000000) {
      sizeFloor = 90;
      notes.push('$50M+ revenue — elite deal size');
    } else if (revenue >= 25000000) {
      sizeFloor = 85;
      notes.push('$25M+ revenue — premium deal size');
    } else if (revenue >= 10000000) {
      sizeFloor = 80;
      notes.push('$10M+ revenue — strong deal size');
    } else if (revenue >= 7000000) {
      sizeFloor = 75;
      notes.push('$7M+ revenue — solid deal size');
    } else if (revenue >= 5000000) {
      sizeFloor = 70;
      notes.push('$5M+ revenue — good deal size');
    }

    // EBITDA can push the floor higher (e.g. high-margin $8M rev company with $3M EBITDA)
    if (ebitda >= 5000000 && sizeFloor < 90) {
      sizeFloor = 90;
      notes.push('$5M+ EBITDA — elite profitability');
    } else if (ebitda >= 3000000 && sizeFloor < 85) {
      sizeFloor = 85;
      notes.push('$3M+ EBITDA — premium profitability');
    }
  }

  // ===== COMPANY SIGNALS (0-30 pts without financials, 0-10 with financials) =====
  const employeeCount = deal.linkedin_employee_count || 0;
  const reviewCount = deal.google_review_count || 0;
  const googleRating = deal.google_rating || 0;
  let signalsScore = 0;

  // LinkedIn employees (0-20 pts) — SIZE PROXY ONLY
  // If we already know revenue, employee count is redundant as a size indicator
  if (!hasFinancials) {
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
      linkedinBoost = signalsScore;
      notes.push(`LinkedIn: ${employeeCount} employees (used as size proxy — no financials)`);
    }
  } else if (employeeCount > 0) {
    notes.push(`LinkedIn: ${employeeCount} employees (skipped — revenue already known)`);
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

  signalsScore = Math.min(hasFinancials ? 10 : 30, signalsScore);

  // ===== MARKET POSITION (0-10 pts) =====
  // Light bonus for strong markets — not a penalty for weaker ones.
  // Market/industry doesn't determine deal quality by itself.
  let marketScore = 0;

  // Geography (0-5 pts)
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

  if (majorMetros.some(metro => locationText.includes(metro))) {
    marketScore += 5;
    notes.push('Major metro area');
  } else if (secondaryCities.some(c => locationText.includes(c))) {
    marketScore += 3;
  } else if (city || state) {
    marketScore += 2;
  }

  // Multi-location bonus (0-3 pts)
  const locationCount = deal.location_count || 0;
  if (locationCount >= 5) marketScore += 3;
  else if (locationCount >= 3) marketScore += 2;
  else if (locationCount >= 2) marketScore += 1;

  // Recurring revenue bonus (0-2 pts) — a quality signal, not an industry penalty
  const description = (deal.description || deal.executive_summary || '').toLowerCase();
  const businessModel = (deal.business_model || '').toLowerCase();
  const allText = `${(deal.category || '')} ${(deal.service_mix || '')} ${businessModel} ${description}`.toLowerCase();
  const hasRecurring = /recurring|subscription|contract|maintenance|managed/.test(allText);
  if (hasRecurring) {
    marketScore += 2;
    notes.push('Recurring revenue model');
  }

  marketScore = Math.min(10, marketScore);

  // ===== DYNAMIC WEIGHT REDISTRIBUTION =====
  // When financials are missing, redistribute those 35 points
  // proportionally to Company Signals (which includes LinkedIn as size proxy)
  let adjustedSignals = signalsScore;
  let adjustedMarket = marketScore;

  if (!hasFinancials) {
    const signalsMax = 30; // LinkedIn (20) + Google reviews (5) + rating (5)
    const marketMax = 10;
    const totalAvailableMax = signalsMax + marketMax; // 40
    const scaleFactor = (55 + totalAvailableMax) / totalAvailableMax; // 95/40 = 2.375

    adjustedSignals = Math.round(signalsScore * scaleFactor);
    adjustedMarket = Math.round(marketScore * scaleFactor);

    // Cap at 85% of scaled max — prevents no-financials deals from scoring
    // as high as equivalent deals WITH financials
    adjustedSignals = Math.min(Math.round(signalsMax * scaleFactor * 0.85), adjustedSignals);
    adjustedMarket = Math.min(Math.round(marketMax * scaleFactor * 0.85), adjustedMarket);

    if (signalsScore > 0 || marketScore > 0) {
      notes.push('No financials — LinkedIn employees used as size proxy');
    } else {
      notes.push('No financials, employee, or review data — limited scoring data');
    }
  }

  // ===== CALCULATE TOTAL =====
  const rawScore = (hasFinancials ? financialScore : 0) + adjustedSignals + adjustedMarket;
  const totalScore = sizeFloor > 0 ? Math.max(rawScore, sizeFloor) : rawScore;

  // Store the size indicator for the dashboard (use financial or employee proxy)
  const sizeIndicator = hasFinancials
    ? financialScore
    : Math.round(signalsScore * (55 / 30)); // Scale signals to size range for display

  return {
    deal_total_score: Math.min(100, Math.max(0, totalScore)),
    deal_size_score: Math.min(70, Math.max(0, sizeIndicator)),
    revenue_score: hasFinancials ? revenueScore : undefined,
    ebitda_score: hasFinancials ? ebitdaScore : undefined,
    linkedin_boost: employeeCount > 0 ? linkedinBoost : undefined,
    quality_calculation_version: 'v3',
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
