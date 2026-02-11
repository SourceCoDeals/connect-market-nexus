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
 * SCORING METHODOLOGY V4 (0-100):
 *
 * SIZE (0-90 pts) — Always 90% of the score. Measured with the best available data:
 *   - With financials: Revenue (0-75) + EBITDA (0-15)
 *   - Without financials: LinkedIn employees (0-60) + Google reviews (0-15) + rating (0-15)
 *
 * MARKET (0-10 pts) — Always 10% of the score. Light bonus for geography/recurring revenue.
 *
 * Size floors guarantee minimum scores for large deals by revenue or EBITDA.
 */
function calculateScoresFromData(deal: any): DealQualityScores {
  const notes: string[] = [];

  // ===== NORMALIZE FINANCIALS =====
  const normalizeFinancial = (val: number): number => {
    if (val <= 0) return 0;
    if (val < 1000) return Math.round(val * 1_000_000);   // millions: 20 → $20M
    if (val < 100000) return Math.round(val * 1_000);      // thousands: 5000 → $5M
    return val;                                              // raw: 50000000 → $50M
  };

  // ===== FINANCIAL SIZE (0-45 pts) =====
  // Revenue is the primary size signal — if we know it, LinkedIn headcount
  // becomes a minor tiebreaker rather than a major scoring dimension.
  const revenue = normalizeFinancial(deal.revenue || 0);
  const ebitda = normalizeFinancial(deal.ebitda || 0);
  const hasFinancials = revenue > 0 || ebitda > 0;

  const employeeCount = deal.linkedin_employee_count || 0;
  const reviewCount = deal.google_review_count || 0;
  const googleRating = deal.google_rating || 0;

  let revenueScore = 0;
  let ebitdaScore = 0;
  let linkedinBoost = 0;
  let sizeFloor = 0;

  // ===== SIZE (0-90 pts) =====
  let sizeScore = 0;

  if (hasFinancials) {
    // Revenue scoring (0-35 pts) — this is the dominant signal
    let revPts = 0;
    if (revenue >= 100000000) revPts = 35;
    else if (revenue >= 75000000) revPts = 33;
    else if (revenue >= 50000000) revPts = 31;
    else if (revenue >= 25000000) revPts = 28;
    else if (revenue >= 10000000) revPts = 25;
    else if (revenue >= 7000000) revPts = 22;
    else if (revenue >= 5000000) revPts = 19;
    else if (revenue >= 3000000) revPts = 15;
    else if (revenue >= 2000000) revPts = 12;
    else if (revenue >= 1000000) revPts = 9;
    else if (revenue >= 500000) revPts = 5;
    else if (revenue > 0) revPts = 3;

    revenueScore = revPts;

    // EBITDA scoring (0-10 pts) — bonus for profitability, not punitive if missing
    let ebitdaPts = 0;
    if (ebitda >= 10000000) ebitdaPts = 10;
    else if (ebitda >= 5000000) ebitdaPts = 9;
    else if (ebitda >= 2000000) ebitdaPts = 8;
    else if (ebitda >= 1000000) ebitdaPts = 7;
    else if (ebitda >= 500000) ebitdaPts = 5;
    else if (ebitda >= 300000) ebitdaPts = 4;
    else if (ebitda >= 150000) ebitdaPts = 2;

    ebitdaScore = ebitdaPts;

    financialScore = Math.min(45, revPts + ebitdaPts);
  }

  // ===== COMPANY SIGNALS (0-30 pts, BUT reduced when financials known) =====
  const employeeCount = deal.linkedin_employee_count || 0;
  const reviewCount = deal.google_review_count || 0;
  const googleRating = deal.google_rating || 0;
  let signalsScore = 0;

  // LinkedIn employees — only a major factor when we DON'T have revenue
  let linkedinPts = 0;
  if (employeeCount >= 200) linkedinPts = 20;
  else if (employeeCount >= 100) linkedinPts = 18;
  else if (employeeCount >= 50) linkedinPts = 16;
  else if (employeeCount >= 25) linkedinPts = 14;
  else if (employeeCount >= 15) linkedinPts = 12;
  else if (employeeCount >= 10) linkedinPts = 10;
  else if (employeeCount >= 5) linkedinPts = 7;
  else if (employeeCount >= 3) linkedinPts = 4;
  else if (employeeCount > 0) linkedinPts = 2;

  if (hasFinancials) {
    // When we know revenue, LinkedIn is just a small tiebreaker (max 5 pts)
    signalsScore += Math.min(5, Math.round(linkedinPts * 0.25));
    if (employeeCount > 0) {
      notes.push(`LinkedIn: ${employeeCount} employees (tiebreaker — revenue known)`);
    }
  } else {
    // When we DON'T know revenue, LinkedIn is the primary size proxy
    signalsScore += linkedinPts;
    if (employeeCount > 0) {
      notes.push(`LinkedIn: ${employeeCount} employees (primary size proxy)`);
    }
  }

  linkedinBoost = signalsScore;

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

  if (reviewCount > 0) {
    notes.push(`Google: ${reviewCount} reviews, ${googleRating} rating`);
  }

  signalsScore = Math.min(30, signalsScore);

  // ===== MARKET POSITION (0-15 pts) =====
  // Geography and industry provide context, but should NOT heavily penalize.
  // Having any location info is good; specific metros are a bonus.
  let marketScore = 0;

  // Geography (0-8 pts) — bonus for good markets, not a penalty for others
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
    marketScore += 8;
    notes.push('Major metro area');
  } else if (secondaryCities.some(c => locationText.includes(c))) {
    marketScore += 6;
  } else if (city || state) {
    // Any known location gets baseline credit — no penalty for smaller markets
    marketScore += 4;
  }

  // Services/industry (0-7 pts) — light bonus, not a gate
  const category = (deal.category || '').toLowerCase();
  const serviceMix = (deal.service_mix || '').toLowerCase();
  const businessModel = (deal.business_model || '').toLowerCase();
  const description = (deal.description || deal.executive_summary || '').toLowerCase();
  const allText = `${category} ${serviceMix} ${businessModel} ${description}`;

  const peHotIndustries = [
    'restoration', 'fire restoration', 'water restoration', 'remediation', 'mitigation',
    'hvac', 'plumbing', 'electrical', 'roofing', 'pest control',
    'collision repair', 'auto body',
    'dental', 'veterinary', 'urgent care', 'behavioral health',
    'managed services', 'msp', 'it services', 'cybersecurity',
    'waste management', 'environmental services',
    'home services', 'facility maintenance'
  ];

  const moderateIndustries = [
    'landscaping', 'janitorial', 'commercial cleaning',
    'staffing', 'accounting', 'insurance',
    'engineering', 'consulting', 'construction',
    'auto glass', 'fleet', 'mechanical contracting'
  ];

  const hasPEHot = peHotIndustries.some(kw => allText.includes(kw));
  const hasModerate = moderateIndustries.some(kw => allText.includes(kw));
  const hasRecurring = /recurring|subscription|contract|maintenance|managed/.test(allText);

  let industryPts = 0;
  if (hasPEHot && hasRecurring) {
    industryPts = 7;
    notes.push('PE-attractive industry with recurring revenue');
  } else if (hasPEHot) {
    industryPts = 5;
    notes.push('PE-attractive industry');
  } else if (hasModerate && hasRecurring) {
    industryPts = 5;
  } else if (hasModerate) {
    industryPts = 3;
  } else if (hasRecurring) {
    industryPts = 4;
  } else if (category) {
    // Any categorized deal gets baseline credit
    industryPts = 2;
  }

  marketScore += industryPts;

  // Multi-location bonus (0-3 pts)
  const locationCount = deal.location_count || 0;
  if (locationCount >= 5) marketScore += 3;
  else if (locationCount >= 3) marketScore += 2;
  else if (locationCount >= 2) marketScore += 1;

  marketScore = Math.min(15, marketScore);

  // ===== DYNAMIC WEIGHT REDISTRIBUTION =====
  // When financials are missing, redistribute those 45 points
  // proportionally to Company Signals (70%) and Market Position (30%)
  let adjustedSignals = signalsScore;
  let adjustedMarket = marketScore;

  if (!hasFinancials) {
    const signalsMax = 30;
    const marketMax = 15;
    const totalAvailableMax = signalsMax + marketMax; // 45
    const scaleFactor = (45 + totalAvailableMax) / totalAvailableMax; // 90/45 = 2.0

    adjustedSignals = Math.round(signalsScore * scaleFactor);
    adjustedMarket = Math.round(marketScore * scaleFactor);

    // Cap at 80% of scaled max
    adjustedSignals = Math.min(Math.round(signalsMax * scaleFactor * 0.80), adjustedSignals);
    adjustedMarket = Math.min(Math.round(marketMax * scaleFactor * 0.80), adjustedMarket);

    if (signalsScore > 0 || marketScore > 0) {
      notes.push('No financials — score weighted to company signals & market position');
    } else {
      notes.push('No financials, employee, or review data — limited scoring data');
    }
  }

  // ===== SELLER READINESS (0-10 pts) — ONLY counted when we have seller data =====
  // If we haven't talked to the owner, we simply don't know — no penalty.
  let sellerScore = 0;
  const hasSeller = deal.seller_interest_score !== null && deal.seller_interest_score !== undefined
    && deal.seller_interest_score > 0;

  if (hasSeller) {
    // Proportional score (0-7 pts)
    sellerScore = Math.round((deal.seller_interest_score / 100) * 7);

    // High motivation bonus (additional 0-3 pts)
    if (deal.seller_interest_score >= 90) {
      sellerScore += 3;
      notes.push('Very high seller motivation — quality boost');
    } else if (deal.seller_interest_score >= 80) {
      sellerScore += 2;
      notes.push('High seller motivation');
    } else if (deal.seller_interest_score >= 70) {
      sellerScore += 1;
      notes.push('Good seller motivation');
    }

    sellerScore = Math.min(10, sellerScore);
  }

  // ===== CALCULATE TOTAL =====
  // Max possible: 45 (financial) + 30 (signals) + 15 (market) + 10 (seller) = 100
  // But when seller is unknown, max is 90 — we scale to 100 so scores are comparable.
  const baseScore = (hasFinancials ? financialScore : 0) + adjustedSignals + adjustedMarket;

  let totalScore: number;
  if (hasSeller) {
    totalScore = baseScore + sellerScore;
  } else {
    // Scale the 90-point base to 100 so deals aren't penalized for unknown seller info
    totalScore = Math.round((baseScore / 90) * 100);
  }

  // Store the size indicator for the dashboard
  const sizeIndicator = hasFinancials
    ? financialScore
    : Math.round(signalsScore * (45 / 30));

  return {
    deal_total_score: Math.min(100, Math.max(0, totalScore)),
    deal_size_score: Math.min(90, Math.max(0, sizeScore)),
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
            scoring_notes: scores.scoring_notes,
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
