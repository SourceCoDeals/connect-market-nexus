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
    // --- Revenue (0-75 pts) ---
    if (revenue >= 100000000)     revenueScore = 75;
    else if (revenue >= 50000000) revenueScore = 70;
    else if (revenue >= 25000000) revenueScore = 64;
    else if (revenue >= 10000000) revenueScore = 58;
    else if (revenue >= 7000000)  revenueScore = 50;
    else if (revenue >= 5000000)  revenueScore = 44;
    else if (revenue >= 3000000)  revenueScore = 37;
    else if (revenue >= 2000000)  revenueScore = 28;
    else if (revenue >= 1000000)  revenueScore = 20;
    else if (revenue >= 500000)   revenueScore = 10;
    else if (revenue > 0)         revenueScore = 5;

    // --- EBITDA (0-15 pts) ---
    if (ebitda >= 5000000)        ebitdaScore = 15;
    else if (ebitda >= 3000000)   ebitdaScore = 13;
    else if (ebitda >= 2000000)   ebitdaScore = 11;
    else if (ebitda >= 1000000)   ebitdaScore = 9;
    else if (ebitda >= 500000)    ebitdaScore = 7;
    else if (ebitda >= 300000)    ebitdaScore = 5;
    else if (ebitda >= 150000)    ebitdaScore = 3;

    sizeScore = Math.min(90, revenueScore + ebitdaScore);

    // --- Size floors (revenue-driven, EBITDA can push higher) ---
    if (revenue >= 50000000)      { sizeFloor = 90; notes.push('$50M+ revenue'); }
    else if (revenue >= 25000000) { sizeFloor = 85; notes.push('$25M+ revenue'); }
    else if (revenue >= 10000000) { sizeFloor = 80; notes.push('$10M+ revenue'); }
    else if (revenue >= 7000000)  { sizeFloor = 75; notes.push('$7M+ revenue'); }
    else if (revenue >= 5000000)  { sizeFloor = 70; notes.push('$5M+ revenue'); }

    if (ebitda >= 5000000 && sizeFloor < 90) { sizeFloor = 90; notes.push('$5M+ EBITDA'); }
    else if (ebitda >= 3000000 && sizeFloor < 85) { sizeFloor = 85; notes.push('$3M+ EBITDA'); }

  } else {
    // --- No financials: use proxy signals to estimate size (0-90 pts) ---

    // LinkedIn employees (0-60 pts) — strongest size proxy
    let empPts = 0;
    if (employeeCount >= 200)     empPts = 60;
    else if (employeeCount >= 100) empPts = 54;
    else if (employeeCount >= 50) empPts = 48;
    else if (employeeCount >= 25) empPts = 42;
    else if (employeeCount >= 15) empPts = 36;
    else if (employeeCount >= 10) empPts = 30;
    else if (employeeCount >= 5)  empPts = 21;
    else if (employeeCount >= 3)  empPts = 12;
    else if (employeeCount > 0)   empPts = 6;

    if (employeeCount > 0) {
      linkedinBoost = empPts;
      notes.push(`LinkedIn: ${employeeCount} employees (size proxy)`);
    }

    // Google review count (0-15 pts) — volume proxy
    let revPts = 0;
    if (reviewCount >= 200)       revPts = 15;
    else if (reviewCount >= 100)  revPts = 12;
    else if (reviewCount >= 50)   revPts = 9;
    else if (reviewCount >= 20)   revPts = 6;
    else if (reviewCount > 0)     revPts = 3;

    // Google rating (0-15 pts) — quality proxy
    let ratPts = 0;
    if (googleRating >= 4.5)      ratPts = 15;
    else if (googleRating >= 4.0) ratPts = 12;
    else if (googleRating >= 3.5) ratPts = 9;
    else if (googleRating >= 3.0) ratPts = 3;

    if (reviewCount > 0) {
      notes.push(`Google: ${reviewCount} reviews, ${googleRating} rating (size proxy)`);
    }

    sizeScore = Math.min(90, empPts + revPts + ratPts);

    if (sizeScore === 0) {
      notes.push('No financials or proxy data — limited scoring data');
    } else {
      notes.push('No financials — using proxy signals for size');
    }
  }

  // ===== MARKET (0-10 pts) =====
  let marketScore = 0;

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

  const locationCount = deal.location_count || 0;
  if (locationCount >= 5) marketScore += 3;
  else if (locationCount >= 3) marketScore += 2;
  else if (locationCount >= 2) marketScore += 1;

  const description = (deal.description || deal.executive_summary || '').toLowerCase();
  const businessModel = (deal.business_model || '').toLowerCase();
  const allText = `${(deal.category || '')} ${(deal.service_mix || '')} ${businessModel} ${description}`.toLowerCase();
  if (/recurring|subscription|contract|maintenance|managed/.test(allText)) {
    marketScore += 2;
    notes.push('Recurring revenue model');
  }

  marketScore = Math.min(10, marketScore);

  // ===== TOTAL =====
  const rawScore = sizeScore + marketScore;
  const totalScore = sizeFloor > 0 ? Math.max(rawScore, sizeFloor) : rawScore;

  return {
    deal_total_score: Math.min(100, Math.max(0, totalScore)),
    deal_size_score: Math.min(90, Math.max(0, sizeScore)),
    revenue_score: hasFinancials ? revenueScore : undefined,
    ebitda_score: hasFinancials ? ebitdaScore : undefined,
    linkedin_boost: employeeCount > 0 ? linkedinBoost : undefined,
    quality_calculation_version: 'v4',
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
