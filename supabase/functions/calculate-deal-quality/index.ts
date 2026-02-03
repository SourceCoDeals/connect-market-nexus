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
 * Scoring methodology (0-100):
 *
 * 1. Data Completeness (0-20 pts):
 *    - Has revenue: +5
 *    - Has EBITDA: +5
 *    - Has location: +3
 *    - Has description/summary: +3
 *    - Has services/industry: +2
 *    - Has employee count: +2
 *
 * 2. Financial Quality (0-30 pts):
 *    - Revenue > $5M: +15, > $2M: +10, > $1M: +5
 *    - EBITDA margin > 20%: +10, > 15%: +7, > 10%: +4
 *    - EBITDA > $500K: +5
 *
 * 3. Business Quality (0-25 pts):
 *    - Clear business model: +8
 *    - Multiple service lines: +5
 *    - Established (>10 years): +5, (>5 years): +3
 *    - Multiple locations: +7
 *
 * 4. Deal Readiness (0-25 pts):
 *    - Has asking price: +5
 *    - Has seller motivation: +5
 *    - Has financials shared: +5
 *    - Has CIM/deal memo: +5
 *    - Recent engagement: +5
 */
function calculateScoresFromData(deal: any): DealQualityScores {
  let totalScore = 0;
  let qualityScore = 0;
  let sizeScore = 0;
  let motivationScore = 0;
  const notes: string[] = [];

  // ===== DATA COMPLETENESS (0-20 pts) =====
  let completenessScore = 0;

  if (deal.revenue && deal.revenue > 0) {
    completenessScore += 5;
  } else {
    notes.push("Missing revenue data");
  }

  if (deal.ebitda && deal.ebitda > 0) {
    completenessScore += 5;
  } else {
    notes.push("Missing EBITDA data");
  }

  if (deal.location || deal.address) {
    completenessScore += 3;
  }

  if (deal.description || deal.executive_summary) {
    completenessScore += 3;
  }

  if (deal.category || deal.service_mix) {
    completenessScore += 2;
  }

  if (deal.full_time_employees || deal.linkedin_employee_count) {
    completenessScore += 2;
  }

  // ===== FINANCIAL QUALITY / SIZE SCORE (0-30 pts) =====
  const revenue = deal.revenue || 0;
  const ebitda = deal.ebitda || 0;

  // Revenue scoring
  if (revenue >= 5000000) {
    sizeScore += 15;
  } else if (revenue >= 2000000) {
    sizeScore += 10;
  } else if (revenue >= 1000000) {
    sizeScore += 5;
  } else if (revenue > 0) {
    sizeScore += 2;
  }

  // EBITDA margin scoring
  if (revenue > 0 && ebitda > 0) {
    const margin = ebitda / revenue;
    if (margin >= 0.20) {
      sizeScore += 10;
    } else if (margin >= 0.15) {
      sizeScore += 7;
    } else if (margin >= 0.10) {
      sizeScore += 4;
    } else if (margin > 0) {
      sizeScore += 2;
    }
  }

  // Absolute EBITDA scoring
  if (ebitda >= 500000) {
    sizeScore += 5;
  } else if (ebitda >= 200000) {
    sizeScore += 3;
  }

  // ===== BUSINESS QUALITY (0-25 pts) =====

  // Business model clarity
  if (deal.business_model || deal.service_mix) {
    qualityScore += 8;
  }

  // Multiple service lines
  const services = deal.service_mix?.split(',') || [];
  if (services.length >= 3) {
    qualityScore += 5;
  } else if (services.length >= 2) {
    qualityScore += 3;
  }

  // Company age/establishment
  if (deal.founded_year) {
    const age = new Date().getFullYear() - deal.founded_year;
    if (age >= 10) {
      qualityScore += 5;
    } else if (age >= 5) {
      qualityScore += 3;
    } else if (age >= 2) {
      qualityScore += 1;
    }
  }

  // Multiple locations
  const locationCount = deal.number_of_locations || deal.location_count || 1;
  if (locationCount >= 3) {
    qualityScore += 7;
  } else if (locationCount >= 2) {
    qualityScore += 4;
  }

  // ===== DEAL READINESS / MOTIVATION SCORE (0-25 pts) =====

  // Has asking price
  if (deal.asking_price && deal.asking_price > 0) {
    motivationScore += 5;
  }

  // Has seller motivation
  if (deal.seller_motivation || deal.owner_goals) {
    motivationScore += 5;
  }

  // Has financials/docs shared
  if (deal.financials_shared || deal.has_cim) {
    motivationScore += 5;
  }

  // Has deal memo/CIM link
  if (deal.internal_deal_memo_link) {
    motivationScore += 5;
  }

  // Recent engagement (enriched or updated recently)
  const enrichedAt = deal.enriched_at ? new Date(deal.enriched_at) : null;
  const updatedAt = deal.updated_at ? new Date(deal.updated_at) : null;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if ((enrichedAt && enrichedAt > thirtyDaysAgo) || (updatedAt && updatedAt > thirtyDaysAgo)) {
    motivationScore += 5;
  }

  // ===== CALCULATE TOTAL =====
  totalScore = completenessScore + sizeScore + qualityScore + motivationScore;

  // Ensure scores are within bounds
  totalScore = Math.min(100, Math.max(0, totalScore));
  qualityScore = Math.min(25, Math.max(0, qualityScore));
  sizeScore = Math.min(30, Math.max(0, sizeScore));
  motivationScore = Math.min(25, Math.max(0, motivationScore));

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
