import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
  industry_adjustment?: number;
  universe_bonus?: number;
}

interface IndustryAdjustment {
  industry: string;
  score_adjustment: number;
  margin_threshold_adjustment: number;
  size_multiplier: number;
  confidence: string;
}

interface UniverseCriteria {
  size_criteria?: {
    ebitda_min?: number;
    ebitda_max?: number;
    revenue_min?: number;
    revenue_max?: number;
    ebitda_multiple_min?: number;
    ebitda_multiple_max?: number;
  };
  geography_criteria?: {
    target_states?: string[];
    exclude_states?: string[];
    coverage?: string;
  };
  service_criteria?: {
    primary_focus?: string[];
    required_services?: string[];
    preferred_services?: string[];
    excluded_services?: string[];
    business_model?: string;
  };
  ma_guide_content?: string;
  name?: string;
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
 * 5. Industry Adjustment (learned from manual overrides):
 *    - Applied after base calculation
 *    - Can be +/- based on historical override patterns
 *
 * Example scores:
 *   - $3M EBITDA, 20% margin, no motivation data: 58 + 15 + 8 + 0 = 81
 *   - $1M EBITDA, 25% margin, motivated seller: 34 + 17 + 8 + 4 = 63
 *   - $500K EBITDA, 15% margin, no data: 20 + 11 + 6 + 0 = 37
 */
function calculateScoresFromData(
  deal: any,
  industryAdjustment: IndustryAdjustment | null = null
): DealQualityScores {
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

  // Apply industry size multiplier if learned
  if (industryAdjustment && industryAdjustment.size_multiplier !== 1.0) {
    sizeScore = Math.round(sizeScore * industryAdjustment.size_multiplier);
    sizeScore = Math.min(65, Math.max(0, sizeScore)); // Keep within bounds
  }

  // ===== 2. DEAL QUALITY/MARGINS (0-20 pts) =====

  // Margin scoring (0-12 pts) - adjusted by industry if learned
  const marginAdjustment = industryAdjustment?.margin_threshold_adjustment || 0;

  if (revenue > 0 && ebitda > 0) {
    const margin = ebitda / revenue;
    const adjustedMargin = margin - marginAdjustment; // Lower threshold for industries with typically lower margins

    if (adjustedMargin >= 0.30) {
      qualityScore += 12;
    } else if (adjustedMargin >= 0.25) {
      qualityScore += 10;
    } else if (adjustedMargin >= 0.20) {
      qualityScore += 8;
    } else if (adjustedMargin >= 0.15) {
      qualityScore += 6;
    } else if (adjustedMargin >= 0.10) {
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

  // ===== 5. APPLY INDUSTRY ADJUSTMENT (learned from overrides) =====
  let appliedAdjustment = 0;
  if (industryAdjustment && industryAdjustment.score_adjustment !== 0) {
    appliedAdjustment = industryAdjustment.score_adjustment;
    totalScore += appliedAdjustment;

    if (industryAdjustment.confidence === 'high') {
      notes.push(`Industry adjustment: ${appliedAdjustment > 0 ? '+' : ''}${appliedAdjustment} (high confidence)`);
    } else {
      notes.push(`Industry adjustment: ${appliedAdjustment > 0 ? '+' : ''}${appliedAdjustment} (${industryAdjustment.confidence})`);
    }
  }

  // Ensure scores are within bounds (no hard caps - let size drive the score)
  totalScore = Math.min(100, Math.max(0, totalScore));

  return {
    deal_total_score: totalScore,
    deal_quality_score: qualityScore,
    deal_size_score: sizeScore,
    deal_motivation_score: motivationBonus,
    scoring_notes: notes.length > 0 ? notes.join("; ") : undefined,
    industry_adjustment: appliedAdjustment !== 0 ? appliedAdjustment : undefined,
  };
}

/**
 * Calculate universe-specific scoring bonuses when buyer universe context is provided.
 * This adds bonuses when deals match the target criteria from buyer criteria and AI industry guides.
 *
 * Bonuses (0-15 pts total):
 * - Sweet Spot Match (0-8 pts): Deal EBITDA/revenue falls within target range
 * - Geography Match (0-4 pts): Deal location matches target states
 * - Service/Industry Match (0-3 pts): Deal services match primary focus areas
 */
function calculateUniverseBonuses(
  deal: any,
  universe: UniverseCriteria
): { bonus: number; notes: string[] } {
  let totalBonus = 0;
  const notes: string[] = [];

  const ebitda = deal.ebitda || 0;
  const revenue = deal.revenue || 0;
  const dealStates = deal.geographic_states || [];
  const dealLocation = (deal.location || '').toLowerCase();
  const dealCategory = (deal.category || '').toLowerCase();
  const dealServices = (deal.service_mix || '').toLowerCase();

  // ===== 1. SWEET SPOT MATCH (0-8 pts) =====
  // Strong bonus when deal falls perfectly within buyer's target size range
  const sizeCriteria = universe.size_criteria;
  if (sizeCriteria && ebitda > 0) {
    const ebitdaMin = sizeCriteria.ebitda_min || 0;
    const ebitdaMax = sizeCriteria.ebitda_max || Number.MAX_SAFE_INTEGER;
    const revenueMin = sizeCriteria.revenue_min || 0;
    const revenueMax = sizeCriteria.revenue_max || Number.MAX_SAFE_INTEGER;

    // Check if within EBITDA sweet spot
    const inEbitdaRange = ebitda >= ebitdaMin && ebitda <= ebitdaMax;
    // Check if within revenue sweet spot (if we have revenue data)
    const inRevenueRange = revenue === 0 || (revenue >= revenueMin && revenue <= revenueMax);

    if (inEbitdaRange && inRevenueRange) {
      // Perfect sweet spot - full bonus
      totalBonus += 8;
      notes.push(`Sweet spot match: EBITDA ${formatCurrency(ebitda)} within target range`);
    } else if (inEbitdaRange || inRevenueRange) {
      // Partial match - reduced bonus
      totalBonus += 4;
      notes.push('Partial size match with target criteria');
    } else if (ebitda > 0 && ebitdaMin > 0) {
      // Check if close to range (within 20%)
      const lowerBound = ebitdaMin * 0.8;
      const upperBound = ebitdaMax * 1.2;
      if (ebitda >= lowerBound && ebitda <= upperBound) {
        totalBonus += 2;
        notes.push('Near target size range');
      }
    }
  }

  // ===== 2. GEOGRAPHY MATCH (0-4 pts) =====
  // Bonus when deal location aligns with target geography
  const geoCriteria = universe.geography_criteria;
  if (geoCriteria) {
    const targetStates = (geoCriteria.target_states || []).map(s => s.toLowerCase());
    const excludeStates = (geoCriteria.exclude_states || []).map(s => s.toLowerCase());

    // Check if deal is in an excluded state (no bonus, add warning)
    const dealStatesLower = dealStates.map((s: string) => s.toLowerCase());
    const inExcludedState = dealStatesLower.some((s: string) => excludeStates.includes(s));

    if (inExcludedState) {
      notes.push('Warning: Deal in excluded geographic region');
    } else if (targetStates.length > 0) {
      // Check if deal matches target states
      const matchingStates = dealStatesLower.filter((s: string) => targetStates.includes(s));

      if (matchingStates.length > 0) {
        totalBonus += 4;
        notes.push(`Geography match: ${matchingStates.join(', ').toUpperCase()}`);
      } else if (dealLocation) {
        // Try to match location string against target states
        const locationMatch = targetStates.some(state =>
          dealLocation.includes(state) || dealLocation.includes(getStateName(state))
        );
        if (locationMatch) {
          totalBonus += 3;
          notes.push('Location matches target geography');
        }
      }
    } else if (geoCriteria.coverage === 'national') {
      // National coverage - small bonus for any US deal
      totalBonus += 2;
      notes.push('National coverage criteria');
    }
  }

  // ===== 3. SERVICE/INDUSTRY MATCH (0-3 pts) =====
  // Bonus when deal services/industry match buyer's primary focus
  const serviceCriteria = universe.service_criteria;
  if (serviceCriteria) {
    const primaryFocus = (serviceCriteria.primary_focus || []).map(s => s.toLowerCase());
    const requiredServices = (serviceCriteria.required_services || []).map(s => s.toLowerCase());
    const preferredServices = (serviceCriteria.preferred_services || []).map(s => s.toLowerCase());
    const excludedServices = (serviceCriteria.excluded_services || []).map(s => s.toLowerCase());

    // Check for excluded services (warning, no bonus)
    const hasExcluded = excludedServices.some(excl =>
      dealCategory.includes(excl) || dealServices.includes(excl)
    );

    if (hasExcluded) {
      notes.push('Warning: Deal has excluded service type');
    } else {
      // Check primary focus match (strongest)
      const matchesPrimary = primaryFocus.some(focus =>
        dealCategory.includes(focus) || dealServices.includes(focus) || focus.includes(dealCategory)
      );

      // Check required services match
      const matchesRequired = requiredServices.some(req =>
        dealCategory.includes(req) || dealServices.includes(req)
      );

      // Check preferred services match
      const matchesPreferred = preferredServices.some(pref =>
        dealCategory.includes(pref) || dealServices.includes(pref)
      );

      if (matchesPrimary) {
        totalBonus += 3;
        notes.push('Primary focus match');
      } else if (matchesRequired) {
        totalBonus += 2;
        notes.push('Required service match');
      } else if (matchesPreferred) {
        totalBonus += 1;
        notes.push('Preferred service match');
      }

      // Check business model alignment
      if (serviceCriteria.business_model) {
        const dealDesc = (deal.description || deal.executive_summary || '').toLowerCase();
        const targetModel = serviceCriteria.business_model.toLowerCase();

        if (targetModel.includes('recurring') && (dealDesc.includes('recurring') || dealDesc.includes('subscription') || dealDesc.includes('contract'))) {
          totalBonus += 1;
          notes.push('Recurring revenue model match');
        } else if (targetModel.includes('b2b') && dealDesc.includes('commercial')) {
          totalBonus += 1;
          notes.push('B2B business model match');
        }
      }
    }
  }

  // ===== 4. AI INDUSTRY GUIDE INSIGHTS =====
  // Extract relevant insights from the M&A guide if available
  if (universe.ma_guide_content && universe.ma_guide_content.length > 1000) {
    const guideContent = universe.ma_guide_content.toLowerCase();

    // Check if the guide mentions this industry as attractive
    if (dealCategory && guideContent.includes(dealCategory)) {
      // Look for positive indicators near the industry mention
      const attractiveKeywords = ['attractive', 'desirable', 'strong demand', 'active buyer', 'consolidation'];
      const hasPositive = attractiveKeywords.some(kw => guideContent.includes(kw));

      if (hasPositive) {
        notes.push(`Industry guide: ${dealCategory} noted as attractive`);
      }
    }

    // Add note that universe context was used
    notes.unshift(`Scored with ${universe.name || 'buyer universe'} criteria`);
  }

  // Cap total bonus at 15 points
  totalBonus = Math.min(15, totalBonus);

  return { bonus: totalBonus, notes };
}

/**
 * Helper to format currency for notes
 */
function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

/**
 * Helper to get state name from abbreviation
 */
function getStateName(abbrev: string): string {
  const states: Record<string, string> = {
    'al': 'alabama', 'ak': 'alaska', 'az': 'arizona', 'ar': 'arkansas', 'ca': 'california',
    'co': 'colorado', 'ct': 'connecticut', 'de': 'delaware', 'fl': 'florida', 'ga': 'georgia',
    'hi': 'hawaii', 'id': 'idaho', 'il': 'illinois', 'in': 'indiana', 'ia': 'iowa',
    'ks': 'kansas', 'ky': 'kentucky', 'la': 'louisiana', 'me': 'maine', 'md': 'maryland',
    'ma': 'massachusetts', 'mi': 'michigan', 'mn': 'minnesota', 'ms': 'mississippi', 'mo': 'missouri',
    'mt': 'montana', 'ne': 'nebraska', 'nv': 'nevada', 'nh': 'new hampshire', 'nj': 'new jersey',
    'nm': 'new mexico', 'ny': 'new york', 'nc': 'north carolina', 'nd': 'north dakota', 'oh': 'ohio',
    'ok': 'oklahoma', 'or': 'oregon', 'pa': 'pennsylvania', 'ri': 'rhode island', 'sc': 'south carolina',
    'sd': 'south dakota', 'tn': 'tennessee', 'tx': 'texas', 'ut': 'utah', 'vt': 'vermont',
    'va': 'virginia', 'wa': 'washington', 'wv': 'west virginia', 'wi': 'wisconsin', 'wy': 'wyoming'
  };
  return states[abbrev.toLowerCase()] || abbrev;
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
    const { listingId, calculateAll, rescoreAll, universeId } = body;

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

    // ===== FETCH BUYER UNIVERSE CRITERIA (if provided) =====
    let universeCriteria: UniverseCriteria | null = null;

    if (universeId) {
      console.log(`Fetching buyer universe criteria for: ${universeId}`);

      const { data: universe, error: universeError } = await supabase
        .from('remarketing_buyer_universes')
        .select('name, size_criteria, geography_criteria, service_criteria, ma_guide_content')
        .eq('id', universeId)
        .single();

      if (universeError) {
        console.warn(`Failed to fetch universe ${universeId}:`, universeError);
      } else if (universe) {
        universeCriteria = {
          name: universe.name,
          size_criteria: universe.size_criteria as UniverseCriteria['size_criteria'],
          geography_criteria: universe.geography_criteria as UniverseCriteria['geography_criteria'],
          service_criteria: universe.service_criteria as UniverseCriteria['service_criteria'],
          ma_guide_content: universe.ma_guide_content || undefined,
        };

        console.log(`Using universe criteria from: ${universe.name}`);
        if (universeCriteria.size_criteria) {
          console.log('Size criteria:', JSON.stringify(universeCriteria.size_criteria));
        }
        if (universeCriteria.service_criteria?.primary_focus) {
          console.log('Primary focus:', universeCriteria.service_criteria.primary_focus);
        }
      }
    }

    // ===== FETCH LEARNED INDUSTRY ADJUSTMENTS =====
    const { data: industryAdjustments } = await supabase
      .from('industry_score_adjustments')
      .select('industry, score_adjustment, margin_threshold_adjustment, size_multiplier, confidence');

    // Build lookup map for quick access
    const industryAdjustmentMap = new Map<string, IndustryAdjustment>();
    for (const adj of (industryAdjustments || [])) {
      // Normalize industry name for matching
      const normalizedIndustry = adj.industry.toLowerCase().trim();
      industryAdjustmentMap.set(normalizedIndustry, adj);
    }

    // Helper to find industry adjustment (fuzzy match)
    const findIndustryAdjustment = (category: string | null): IndustryAdjustment | null => {
      if (!category) return null;
      const normalized = category.toLowerCase().trim();

      // Direct match
      if (industryAdjustmentMap.has(normalized)) {
        return industryAdjustmentMap.get(normalized)!;
      }

      // Partial match (e.g., "Home Services - HVAC" matches "Home Services")
      for (const [key, value] of industryAdjustmentMap) {
        if (normalized.includes(key) || key.includes(normalized)) {
          return value;
        }
      }

      return null;
    };

    let scored = 0;
    let errors = 0;
    let skippedOverrides = 0;
    const results: any[] = [];

    for (const listing of listingsToScore) {
      try {
        // Skip if listing has a manual override (respect human judgment)
        if (listing.manual_score_override !== null && listing.manual_score_override !== undefined) {
          skippedOverrides++;
          continue;
        }

        // Find industry adjustment for this listing
        const industryAdjustment = findIndustryAdjustment(listing.category);

        // Calculate base scores from deal data with learned adjustments
        const scores = calculateScoresFromData(listing, industryAdjustment);

        // Apply universe-specific bonuses if universe context provided
        let universeBonus = 0;
        let allNotes: string[] = [];

        if (scores.scoring_notes) {
          allNotes.push(scores.scoring_notes);
        }

        if (universeCriteria) {
          const { bonus, notes: universeNotes } = calculateUniverseBonuses(listing, universeCriteria);
          universeBonus = bonus;

          if (universeNotes.length > 0) {
            allNotes = [...universeNotes, ...allNotes];
          }

          // Add bonus to total score (capped at 100)
          scores.deal_total_score = Math.min(100, scores.deal_total_score + universeBonus);
          scores.universe_bonus = universeBonus;
        }

        // Combine all scoring notes
        if (allNotes.length > 0) {
          scores.scoring_notes = allNotes.join("; ");
        }

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
            industryAdjustment: industryAdjustment?.score_adjustment || 0,
            universeBonus: universeBonus,
            scoringNotes: scores.scoring_notes,
          });
        }
      } catch (e) {
        console.error(`Error scoring listing ${listing.id}:`, e);
        errors++;
      }
    }

    console.log(`Scored ${scored} listings, ${errors} errors, ${skippedOverrides} skipped (manual overrides)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scored ${scored} deals${errors > 0 ? `, ${errors} errors` : ''}${skippedOverrides > 0 ? `, ${skippedOverrides} skipped (manual overrides)` : ''}`,
        scored,
        errors,
        skippedOverrides,
        industryAdjustmentsApplied: results.filter(r => r.industryAdjustment !== 0).length,
        universeBonusesApplied: universeCriteria ? results.filter(r => r.universeBonus > 0).length : 0,
        universeUsed: universeCriteria ? universeCriteria.name : null,
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
