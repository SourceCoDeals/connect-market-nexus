import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";
import { calculateProximityScore, getProximityTier } from "../_shared/geography-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScoreRequest {
  listingId: string;
  buyerId: string;
  universeId: string;
}

interface BulkScoreRequest {
  listingId: string;
  universeId: string;
  buyerIds?: string[];
  customInstructions?: string; // Admin custom scoring instructions
  options?: {
    rescoreExisting?: boolean;
    minDataCompleteness?: 'high' | 'medium' | 'low';
  };
}

interface ScoringAdjustment {
  adjustment_type: string;
  adjustment_value: number;
  reason?: string;
}

interface LearningPattern {
  buyer_id: string;
  approvalRate: number;
  avgScoreOnApproved: number;
  avgScoreOnPassed: number;
  totalActions: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const isBulk = body.bulk === true;



    if (isBulk) {
      return await handleBulkScore(supabase, body as BulkScoreRequest, GEMINI_API_KEY, corsHeaders);
    } else {
      return await handleSingleScore(supabase, body as ScoreRequest, GEMINI_API_KEY, corsHeaders);
    }
  } catch (error) {
    console.error("Score buyer-deal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Fetch scoring adjustments for a listing
async function fetchScoringAdjustments(supabase: any, listingId: string): Promise<ScoringAdjustment[]> {
  const { data, error } = await supabase
    .from("deal_scoring_adjustments")
    .select("adjustment_type, adjustment_value, reason")
    .eq("listing_id", listingId);

  if (error) {
    console.warn("Failed to fetch scoring adjustments:", error);
    return [];
  }
  return data || [];
}

// Fetch engagement signals for a listing-buyer pair
// FIX #4: De-duplicate by signal_type to prevent inflated bonuses
async function fetchEngagementBonus(
  supabase: any,
  listingId: string,
  buyerId: string
): Promise<{ bonus: number; signals: any[]; reasoning: string }> {
  const { data: signals, error } = await supabase
    .from('engagement_signals')
    .select('*')
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .order('signal_date', { ascending: false });

  if (error || !signals || signals.length === 0) {
    return { bonus: 0, signals: [], reasoning: '' };
  }

  // CRITICAL FIX: De-duplicate signals by type (count each signal type only once)
  const uniqueSignalsByType = new Map<string, any>();
  for (const signal of signals) {
    const type = signal.signal_type;
    if (!uniqueSignalsByType.has(type)) {
      uniqueSignalsByType.set(type, signal);
    }
  }
  const uniqueSignals = Array.from(uniqueSignalsByType.values());

  // Calculate total bonus (capped at 100 per spec)
  const totalBonus = Math.min(100, uniqueSignals.reduce((sum: number, s: any) => sum + (s.signal_value || 0), 0));

  // Build reasoning string
  const signalSummary = uniqueSignals.map((s: any) =>
    `${s.signal_type.replace('_', ' ')} (+${s.signal_value})`
  ).join(', ');

  const reasoning = `Engagement signals: ${signalSummary} = +${totalBonus} pts`;

  return { bonus: totalBonus, signals: uniqueSignals, reasoning };
}

// Fetch engagement signals for multiple buyers (bulk scoring optimization)
async function fetchBulkEngagementBonuses(
  supabase: any,
  listingId: string,
  buyerIds: string[]
): Promise<Map<string, { bonus: number; reasoning: string }>> {
  const bonuses = new Map<string, { bonus: number; reasoning: string }>();

  if (buyerIds.length === 0) return bonuses;

  const { data: signals, error } = await supabase
    .from('engagement_signals')
    .select('*')
    .eq('listing_id', listingId)
    .in('buyer_id', buyerIds);

  if (error || !signals) {
    console.warn("Failed to fetch engagement signals:", error);
    return bonuses;
  }

  // Group signals by buyer_id
  const signalsByBuyer = new Map<string, any[]>();
  for (const signal of signals) {
    if (!signalsByBuyer.has(signal.buyer_id)) {
      signalsByBuyer.set(signal.buyer_id, []);
    }
    signalsByBuyer.get(signal.buyer_id)!.push(signal);
  }

  // Calculate bonus for each buyer (with de-duplication by signal type)
  for (const [buyerId, buyerSignals] of signalsByBuyer) {
    // CRITICAL FIX: De-duplicate signals by type (count each signal type only once)
    const uniqueSignalsByType = new Map<string, any>();
    for (const signal of buyerSignals) {
      const type = signal.signal_type;
      if (!uniqueSignalsByType.has(type)) {
        uniqueSignalsByType.set(type, signal);
      }
    }
    const uniqueSignals = Array.from(uniqueSignalsByType.values());

    const totalBonus = Math.min(100, uniqueSignals.reduce((sum, s) => sum + (s.signal_value || 0), 0));
    const signalSummary = uniqueSignals.map(s =>
      `${s.signal_type.replace('_', ' ')} (+${s.signal_value})`
    ).join(', ');
    const reasoning = `Engagement signals: ${signalSummary} = +${totalBonus} pts`;

    bonuses.set(buyerId, { bonus: totalBonus, reasoning });
  }

  return bonuses;
}

// Fetch learning patterns from buyer history
async function fetchLearningPatterns(supabase: any, buyerIds: string[]): Promise<Map<string, LearningPattern>> {
  const patterns = new Map<string, LearningPattern>();

  if (buyerIds.length === 0) return patterns;

  const { data: history, error } = await supabase
    .from("buyer_learning_history")
    .select("buyer_id, action, composite_score")
    .in("buyer_id", buyerIds);

  if (error || !history) {
    console.warn("Failed to fetch learning history:", error);
    return patterns;
  }

  // Group by buyer
  const buyerHistory = new Map<string, any[]>();
  for (const record of history) {
    if (!buyerHistory.has(record.buyer_id)) {
      buyerHistory.set(record.buyer_id, []);
    }
    buyerHistory.get(record.buyer_id)!.push(record);
  }

  // Calculate patterns
  for (const [buyerId, records] of buyerHistory) {
    const approved = records.filter(r => r.action === 'approved');
    const passed = records.filter(r => r.action === 'passed');
    
    const avgApprovedScore = approved.length > 0 
      ? approved.reduce((sum, r) => sum + (r.composite_score || 0), 0) / approved.length 
      : 0;
    const avgPassedScore = passed.length > 0
      ? passed.reduce((sum, r) => sum + (r.composite_score || 0), 0) / passed.length
      : 0;

    patterns.set(buyerId, {
      buyer_id: buyerId,
      approvalRate: records.length > 0 ? approved.length / records.length : 0,
      avgScoreOnApproved: avgApprovedScore,
      avgScoreOnPassed: avgPassedScore,
      totalActions: records.length,
    });
  }

  return patterns;
}

// Calculate geography score using adjacency intelligence
async function calculateGeographyScore(
  listing: any,
  buyer: any,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ score: number; reasoning: string; tier: string }> {
  // Extract deal state from location
  const dealLocation = listing.location || "";
  const dealState = dealLocation.match(/,\s*([A-Z]{2})\s*$/i)?.[1]?.toUpperCase();

  // CRITICAL FIX: Use target_geographies (expansion targets), NOT geographic_footprint (current operations)
  // Buyers acquire in their target expansion markets, not necessarily where they already operate
  let buyerTargetStates = (buyer.target_geographies || [])
    .filter(Boolean)
    .map((s: string) => s.toUpperCase().trim());

  // Fallback: If no target geographies specified, use current footprint as proxy
  // (assumes buyer wants to expand in areas where they already operate)
  if (buyerTargetStates.length === 0) {
    buyerTargetStates = (buyer.geographic_footprint || [])
      .filter(Boolean)
      .map((s: string) => s.toUpperCase().trim());
  }

  if (!dealState || buyerTargetStates.length === 0) {
    return {
      score: 50,
      reasoning: "Limited geography data available",
      tier: 'regional'
    };
  }

  // Use adjacency intelligence to calculate proximity score
  const { score: baseScore, reasoning: baseReasoning } = await calculateProximityScore(
    dealState,
    buyerTargetStates,
    supabaseUrl,
    supabaseKey
  );

  // Apply deal attractiveness modifier
  const attractiveness = calculateAttractivenessMultiplier(listing);
  const adjustedScore = Math.round(Math.min(100, baseScore * attractiveness.multiplier));

  // Get tier classification
  const tier = await getProximityTier(
    dealState,
    buyerTargetStates,
    supabaseUrl,
    supabaseKey
  );

  // Combine reasoning
  const fullReasoning = attractiveness.multiplier !== 1.0
    ? `${baseReasoning}. ${attractiveness.reasoning} (${baseScore} → ${adjustedScore})`
    : baseReasoning;

  return { score: adjustedScore, reasoning: fullReasoning, tier };
}

// Calculate service overlap percentage for context
function calculateServiceOverlap(
  listing: any,
  buyer: any
): { percentage: number; matchingServices: string[]; allDealServices: string[] } {
  const dealServices = (listing.services || listing.categories || [listing.category])
    .filter(Boolean)
    .map((s: string) => s?.toLowerCase().trim());

  const buyerServices = (buyer.target_services || [])
    .filter(Boolean)
    .map((s: string) => s?.toLowerCase().trim());

  if (buyerServices.length === 0 || dealServices.length === 0) {
    return { percentage: 0, matchingServices: [], allDealServices: dealServices };
  }

  const matching = dealServices.filter((ds: string) =>
    buyerServices.some((bs: string) =>
      ds?.includes(bs) || bs?.includes(ds) ||
      // Semantic matches for common industry terms
      (ds?.includes('collision') && bs?.includes('body')) ||
      (ds?.includes('body') && bs?.includes('collision')) ||
      (ds?.includes('repair') && bs?.includes('service')) ||
      (ds?.includes('auto') && bs?.includes('automotive'))
    )
  );

  // CRITICAL FIX: Prevent division by zero if both arrays are empty
  const denominator = Math.max(dealServices.length, buyerServices.length, 1);
  const percentage = Math.round((matching.length / denominator) * 100);
  return { percentage, matchingServices: matching, allDealServices: dealServices };
}

// Apply primary focus bonus when deal's primary service matches buyer's primary focus
function applyPrimaryFocusBonus(
  listing: any,
  buyer: any,
  behavior: ScoringBehavior,
  currentScore: number
): { score: number; bonusApplied: boolean } {
  if (!behavior.require_primary_focus) {
    return { score: currentScore, bonusApplied: false };
  }

  const dealPrimaryService = (listing.services?.[0] || listing.category || listing.categories?.[0])?.toLowerCase().trim();
  const buyerPrimaryFocus = buyer.target_services?.[0]?.toLowerCase().trim();
  
  if (!dealPrimaryService || !buyerPrimaryFocus) {
    return { score: currentScore, bonusApplied: false };
  }
  
  // Semantic matching for primary focus
  const isPrimaryMatch = dealPrimaryService.includes(buyerPrimaryFocus) || 
                         buyerPrimaryFocus.includes(dealPrimaryService) ||
                         (dealPrimaryService.includes('collision') && buyerPrimaryFocus.includes('body')) ||
                         (dealPrimaryService.includes('body') && buyerPrimaryFocus.includes('collision'));
  
  if (isPrimaryMatch) {
    return { score: Math.min(100, currentScore + 10), bonusApplied: true };
  }
  
  return { score: currentScore, bonusApplied: false };
}

// Apply sweet spot bonus when deal revenue/EBITDA matches buyer's ideal target
function applySweetSpotBonus(
  listing: any,
  buyer: any,
  sizeScore: number
): { score: number; bonusApplied: boolean; bonusReason?: string } {
  const dealRevenue = listing.revenue;
  const revenueSweetSpot = buyer.revenue_sweet_spot;
  const ebitdaSweetSpot = buyer.ebitda_sweet_spot;
  const dealEbitda = listing.ebitda;
  
  if (!dealRevenue && !dealEbitda) {
    return { score: sizeScore, bonusApplied: false };
  }
  
  let bonusApplied = false;
  let bonusReason: string | undefined;
  let adjustedScore = sizeScore;
  
  // Check revenue sweet spot (within 20% variance)
  if (revenueSweetSpot && dealRevenue) {
    const variance = Math.abs(dealRevenue - revenueSweetSpot) / revenueSweetSpot;
    if (variance <= 0.2) {
      adjustedScore = Math.min(100, adjustedScore + 5);
      bonusApplied = true;
      bonusReason = `+5pt revenue sweet spot match`;
    }
  }
  
  // Check EBITDA sweet spot (within 20% variance) - only if revenue didn't match
  if (!bonusApplied && ebitdaSweetSpot && dealEbitda) {
    const variance = Math.abs(dealEbitda - ebitdaSweetSpot) / ebitdaSweetSpot;
    if (variance <= 0.2) {
      adjustedScore = Math.min(100, adjustedScore + 5);
      bonusApplied = true;
      bonusReason = `+5pt EBITDA sweet spot match`;
    }
  }
  
  return { score: adjustedScore, bonusApplied, bonusReason };
}

// ========== SIZE MULTIPLIER CALCULATION (KEY SPEC INNOVATION) ==========
// Size acts as a GATE on final score - a deal perfect on geography and services
// but wrong on size will NOT score high. The size multiplier (0-1.0) is applied
// to the final composite score.
function calculateSizeMultiplier(
  listing: any,
  buyer: any,
  behavior: ScoringBehavior,
  sizeScore: number
): number {
  // CRITICAL FIX: Keep NULL as NULL, don't convert to 0
  const dealRevenue = listing.revenue; // NULL if unknown
  const dealEbitda = listing.ebitda; // NULL if unknown
  const buyerMinRevenue = buyer.target_revenue_min;
  const buyerMaxRevenue = buyer.target_revenue_max;
  const buyerMinEbitda = buyer.target_ebitda_min;
  const revenueSweetSpot = buyer.revenue_sweet_spot;

  // If size score is very low, apply heavy multiplier penalty
  if (sizeScore <= 25) {
    return 0.3; // Heavy penalty - 70% reduction
  }

  // If both revenue and EBITDA are NULL/unknown, use proxy scoring (moderate penalty)
  if (dealRevenue === null && dealEbitda === null) {
    // Can't disqualify without data - use moderate penalty instead
    return 0.7; // 30% penalty for missing financial data
  }

  // Check for disqualification scenarios (only when we have actual data)

  // Revenue significantly below minimum (>30% below)
  if (buyerMinRevenue && dealRevenue !== null && dealRevenue < buyerMinRevenue * 0.7) {
    if (behavior.below_minimum_handling === 'disqualify') {
      return 0; // Complete disqualification
    }
    return 0.3; // Heavy penalty
  }

  // Revenue below minimum but within 30%
  if (buyerMinRevenue && dealRevenue !== null && dealRevenue < buyerMinRevenue) {
    const percentBelow = (buyerMinRevenue - dealRevenue) / buyerMinRevenue;
    // Sliding scale: 20% below = 0.5x, 10% below = 0.65x
    return Math.max(0.35, 0.35 + (1 - percentBelow / 0.3) * 0.35);
  }

  // Revenue significantly above maximum (>50% above)
  if (buyerMaxRevenue && dealRevenue !== null && dealRevenue > buyerMaxRevenue * 1.5) {
    return 0; // Disqualify - way too big
  }

  // EBITDA significantly below minimum
  if (buyerMinEbitda && dealEbitda !== null && dealEbitda < buyerMinEbitda * 0.5) {
    return 0.25; // Very heavy penalty
  }

  // EBITDA below minimum (but not by much)
  if (buyerMinEbitda && dealEbitda !== null && dealEbitda < buyerMinEbitda) {
    const percentBelow = (buyerMinEbitda - dealEbitda) / buyerMinEbitda;
    return Math.max(0.4, 1 - percentBelow);
  }
  
  // ========== POSITIVE SCENARIOS (DEAL FITS WELL) ==========

  // Perfect sweet spot match (only when we have actual revenue data)
  if (revenueSweetSpot && dealRevenue !== null && dealRevenue > 0) {
    const percentDiff = Math.abs(dealRevenue - revenueSweetSpot) / revenueSweetSpot;
    if (percentDiff < 0.1) {
      return 1.0; // Perfect match - no penalty
    } else if (percentDiff < 0.2) {
      return 0.95; // Very close - minimal penalty
    } else if (percentDiff < 0.4) {
      return 0.85; // Reasonable match
    }
  }

  // Within buyer's range (only when we have actual revenue data)
  if (buyerMinRevenue && buyerMaxRevenue && dealRevenue !== null && dealRevenue >= buyerMinRevenue && dealRevenue <= buyerMaxRevenue) {
    return 1.0; // In range - no penalty
  }

  // Default - no special multiplier
  return 1.0;
}

// Calculate deal attractiveness multiplier based on overall deal quality
// High-quality deals get geography boost, low-quality deals get penalty
// CRITICAL FIX: Deal quality score may not be populated yet (execution order issue)
// Use neutral multiplier as fallback to avoid penalizing deals incorrectly
function calculateAttractivenessMultiplier(listing: any): { multiplier: number; reasoning: string } {
  const dealScore = listing.deal_total_score;

  // If deal score is not populated (NULL/undefined), use neutral multiplier
  // This prevents incorrectly penalizing deals before deal quality scoring runs
  if (dealScore === null || dealScore === undefined) {
    return {
      multiplier: 1.0,
      reasoning: "Deal quality score pending - using neutral multiplier"
    };
  }

  if (dealScore >= 90) {
    return {
      multiplier: 1.3,
      reasoning: "Exceptional deal quality (90+) - 30% geography boost"
    };
  } else if (dealScore >= 70) {
    return {
      multiplier: 1.15,
      reasoning: "High deal quality (70-89) - 15% geography boost"
    };
  } else if (dealScore >= 50) {
    return {
      multiplier: 1.0,
      reasoning: "Standard deal quality (50-69) - neutral"
    };
  } else if (dealScore > 0) {
    return {
      multiplier: 0.85,
      reasoning: "Below-average deal quality (<50) - 15% geography penalty"
    };
  } else {
    // Deal score is 0 (explicitly scored as poor)
    return {
      multiplier: 0.85,
      reasoning: "Low deal quality (0) - 15% geography penalty"
    };
  }
}

// Calculate thesis bonus by comparing buyer's investment thesis with deal characteristics
function calculateThesisBonus(
  listing: any,
  buyer: any
): { bonus: number; reasoning: string } {
  const thesisSummary = (buyer.thesis_summary || '').toLowerCase().trim();

  if (!thesisSummary || thesisSummary.length < 10) {
    return { bonus: 0, reasoning: '' };
  }

  let bonusPoints = 0;
  const matches: string[] = [];

  // Extract deal text for analysis
  const dealDescription = [
    listing.description || '',
    listing.executive_summary || '',
    listing.general_notes || '',
    (listing.services || listing.categories || [listing.category]).join(' ')
  ].join(' ').toLowerCase();

  // Thesis keyword categories with point values
  const thesisPatterns = [
    // Business model patterns (5 points each)
    { pattern: /recurring\s+revenue/i, value: 5, label: 'recurring revenue model' },
    { pattern: /subscription/i, value: 5, label: 'subscription model' },
    { pattern: /saas/i, value: 5, label: 'SaaS business' },
    { pattern: /contract\s+revenue/i, value: 5, label: 'contract-based revenue' },

    // Growth patterns (5 points each)
    { pattern: /high\s+growth/i, value: 5, label: 'high growth' },
    { pattern: /organic\s+growth/i, value: 5, label: 'organic growth' },
    { pattern: /rapid\s+expansion/i, value: 5, label: 'rapid expansion' },

    // Strategy patterns (7 points each)
    { pattern: /roll[\s-]?up/i, value: 7, label: 'roll-up strategy' },
    { pattern: /platform/i, value: 7, label: 'platform acquisition' },
    { pattern: /add[\s-]?on/i, value: 7, label: 'add-on acquisition' },
    { pattern: /bolt[\s-]?on/i, value: 7, label: 'bolt-on acquisition' },
    { pattern: /tuck[\s-]?in/i, value: 7, label: 'tuck-in acquisition' },

    // Owner alignment patterns (5 points each)
    { pattern: /equity\s+rollover/i, value: 5, label: 'equity rollover alignment' },
    { pattern: /owner\s+transition/i, value: 5, label: 'owner transition support' },
    { pattern: /management\s+retention/i, value: 5, label: 'management retention' },

    // Industry-specific patterns (3 points each)
    { pattern: /automotive/i, value: 3, label: 'automotive focus' },
    { pattern: /collision/i, value: 3, label: 'collision repair focus' },
    { pattern: /multi[\s-]?location/i, value: 3, label: 'multi-location preference' },
    { pattern: /branded/i, value: 3, label: 'branded locations' },
  ];

  // Check thesis against deal characteristics
  for (const { pattern, value, label } of thesisPatterns) {
    const thesisMatch = pattern.test(thesisSummary);
    const dealMatch = pattern.test(dealDescription);

    if (thesisMatch && dealMatch) {
      bonusPoints += value;
      matches.push(label);
    }
  }

  // CRITICAL FIX: Increase thesis bonus cap from 30 to 50 points
  // Exceptionally strong thesis matches deserve higher weight (transcript-derived data is highest quality)
  bonusPoints = Math.min(50, bonusPoints);

  const reasoning = matches.length > 0
    ? `Thesis alignment: ${matches.join(', ')}`
    : '';

  return { bonus: bonusPoints, reasoning };
}

// Apply learning adjustments to score
function applyLearningAdjustment(
  baseScore: number,
  pattern: LearningPattern | undefined,
  adjustments: ScoringAdjustment[],
  calculatedThesisBonus: number = 0,
  thesisReasoning: string = ''
): { adjustedScore: number; thesisBonus: number; adjustmentReason?: string; learningNote?: string } {
  let adjustedScore = baseScore;
  let thesisBonus = calculatedThesisBonus; // Start with calculated bonus
  const reasons: string[] = [];
  let learningNote: string | undefined;

  // Add thesis reasoning if present
  if (thesisReasoning) {
    reasons.push(thesisReasoning);
  }

  // Apply deal-level adjustments
  for (const adj of adjustments) {
    if (adj.adjustment_type === 'boost') {
      adjustedScore += adj.adjustment_value;
      reasons.push(`+${adj.adjustment_value} (${adj.reason || 'boost'})`);
    } else if (adj.adjustment_type === 'penalize') {
      adjustedScore -= adj.adjustment_value;
      reasons.push(`-${adj.adjustment_value} (${adj.reason || 'penalty'})`);
    } else if (adj.adjustment_type === 'thesis_match') {
      // Manual thesis adjustment overrides calculated bonus
      thesisBonus = adj.adjustment_value;
      reasons.push(`+${adj.adjustment_value} thesis bonus (manual override)`);
    }
  }

  // Apply buyer-specific learning with detailed notes
  if (pattern && pattern.totalActions >= 3) {
    // If buyer has high approval rate, slight boost
    if (pattern.approvalRate >= 0.7) {
      const learningBoost = Math.round(pattern.approvalRate * 5);
      adjustedScore += learningBoost;
      reasons.push(`+${learningBoost} (high approval history)`);
      learningNote = `📈 Learning: High approval rate (${Math.round(pattern.approvalRate * 100)}%) on ${pattern.totalActions} deals.`;
    }
    // If buyer consistently passes at certain scores, slight penalty if close
    else if (pattern.approvalRate < 0.3 && pattern.avgScoreOnPassed > 0) {
      const passedCount = Math.round(pattern.totalActions * (1 - pattern.approvalRate));
      if (baseScore < pattern.avgScoreOnPassed + 10) {
        adjustedScore -= 3;
        reasons.push(`-3 (low approval pattern)`);
      }
      learningNote = `📉 Learning: Previously rejected ${passedCount} similar deals.`;
    }
  }

  // Clamp to valid range
  adjustedScore = Math.max(0, Math.min(100, adjustedScore + thesisBonus));

  return {
    adjustedScore,
    thesisBonus,
    adjustmentReason: reasons.length > 0 ? reasons.join('; ') : undefined,
    learningNote,
  };
}

async function handleSingleScore(
  supabase: any,
  request: ScoreRequest,
  apiKey: string,
  corsHeaders: Record<string, string>
) {
  const { listingId, buyerId, universeId } = request;

  // Fetch listing
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    throw new Error("Listing not found");
  }

  // Fetch buyer
  const { data: buyer, error: buyerError } = await supabase
    .from("remarketing_buyers")
    .select("*")
    .eq("id", buyerId)
    .single();

  if (buyerError || !buyer) {
    throw new Error("Buyer not found");
  }

  // Fetch universe for weights
  const { data: universe, error: universeError } = await supabase
    .from("remarketing_buyer_universes")
    .select("*")
    .eq("id", universeId)
    .single();

  if (universeError || !universe) {
    throw new Error("Universe not found");
  }

  // Fetch adjustments, learning patterns, and engagement signals
  const [adjustments, learningPatterns, engagementData] = await Promise.all([
    fetchScoringAdjustments(supabase, listingId),
    fetchLearningPatterns(supabase, [buyerId]),
    fetchEngagementBonus(supabase, listingId, buyerId),
  ]);

  // Generate score using AI (no custom instructions for single score)
  const score = await generateAIScore(listing, buyer, universe, apiKey, undefined);

  // Calculate thesis bonus
  const thesisAnalysis = calculateThesisBonus(listing, buyer);

  // Apply learning adjustments
  const { adjustedScore, thesisBonus, adjustmentReason } = applyLearningAdjustment(
    score.composite_score,
    learningPatterns.get(buyerId),
    adjustments,
    thesisAnalysis.bonus,
    thesisAnalysis.reasoning
  );

  // Apply engagement bonus (CRITICAL: Applied AFTER other adjustments, capped at 100 total)
  const finalScore = Math.min(100, adjustedScore + engagementData.bonus);
  const finalReasoning = engagementData.bonus > 0
    ? `${adjustmentReason || score.fit_reasoning}\n\n${engagementData.reasoning}`
    : (adjustmentReason || score.fit_reasoning);

  // Recalculate tier based on final score (with engagement bonus) - ALIGNED WITH SPEC
  let tier: string;
  if (finalScore >= 80) tier = "A";      // Tier 1 per spec
  else if (finalScore >= 60) tier = "B"; // Tier 2 per spec
  else if (finalScore >= 40) tier = "C"; // Tier 3 per spec
  else tier = "D";                        // Pass per spec

  // Create deal snapshot for stale detection
  const dealSnapshot = {
    revenue: listing.revenue,
    ebitda: listing.ebitda,
    location: listing.location,
    category: listing.category,
    snapshot_at: new Date().toISOString(),
  };

  // Upsert score with new fields
  const { data: savedScore, error: saveError } = await supabase
    .from("remarketing_scores")
    .upsert({
      listing_id: listingId,
      buyer_id: buyerId,
      universe_id: universeId,
      ...score,
      composite_score: finalScore,
      tier,
      thesis_bonus: thesisBonus,
      acquisition_score: score.acquisition_score,
      portfolio_score: score.portfolio_score,
      business_model_score: score.business_model_score,
      fit_reasoning: finalReasoning,
      scored_at: new Date().toISOString(),
      deal_snapshot: dealSnapshot,
    }, { onConflict: "listing_id,buyer_id" })
    .select()
    .single();

  if (saveError) {
    console.error("Failed to save score:", saveError);
    throw new Error("Failed to save score");
  }

  return new Response(
    JSON.stringify({ success: true, score: savedScore }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleBulkScore(
  supabase: any,
  request: BulkScoreRequest,
  apiKey: string,
  corsHeaders: Record<string, string>
) {
  const { listingId, universeId, buyerIds, customInstructions, options } = request;
  const rescoreExisting = options?.rescoreExisting ?? false;
  const minDataCompleteness = options?.minDataCompleteness;

  console.log("Custom instructions received:", customInstructions ? "Yes" : "No");

  // Fetch listing
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    throw new Error("Listing not found");
  }

  // ========== DEAL SCORING READINESS VALIDATION ==========
  // Audit the deal's data completeness and flag missing scoring inputs
  const dealDiagnostics = {
    missing_fields: [] as string[],
    warnings: [] as string[],
    data_quality: 'high' as 'high' | 'medium' | 'low',
  };

  // Check critical scoring fields
  const hasRevenue = listing.revenue !== null && listing.revenue !== undefined;
  const hasEbitda = listing.ebitda !== null && listing.ebitda !== undefined;
  const hasLocation = !!(listing.location && listing.location.trim());
  const hasServices = !!(
    (listing.services && Array.isArray(listing.services) && listing.services.length > 0) ||
    (listing.categories && Array.isArray(listing.categories) && listing.categories.length > 0) ||
    (listing.category && listing.category.trim())
  );
  const hasDescription = !!(listing.hero_description?.trim() || listing.description?.trim());

  if (!hasRevenue) dealDiagnostics.missing_fields.push('revenue');
  if (!hasEbitda) dealDiagnostics.missing_fields.push('ebitda');
  if (!hasLocation) dealDiagnostics.missing_fields.push('location');
  if (!hasServices) dealDiagnostics.missing_fields.push('services/category');
  if (!hasDescription) dealDiagnostics.missing_fields.push('description');
  if (!listing.seller_motivation) dealDiagnostics.missing_fields.push('seller_motivation');

  if (!hasRevenue && !hasEbitda) {
    dealDiagnostics.warnings.push('No financial data — size scoring will use proxy values');
  }
  if (!hasServices) {
    dealDiagnostics.warnings.push('No services/category — service scoring will use weight redistribution');
  }
  if (!hasLocation) {
    dealDiagnostics.warnings.push('No location — geography scoring will use weight redistribution');
  }

  // Determine overall data quality
  const missingCount = dealDiagnostics.missing_fields.length;
  if (missingCount >= 3) {
    dealDiagnostics.data_quality = 'low';
  } else if (missingCount >= 1) {
    dealDiagnostics.data_quality = 'medium';
  }

  console.log(`[DealDiagnostics] Deal ${listingId}: quality=${dealDiagnostics.data_quality}, missing=[${dealDiagnostics.missing_fields.join(', ')}]`);

  // Fetch universe with structured criteria
  const { data: universe, error: universeError } = await supabase
    .from("remarketing_buyer_universes")
    .select("*")
    .eq("id", universeId)
    .single();

  if (universeError || !universe) {
    throw new Error("Universe not found");
  }

  // Fetch buyers
  let buyerQuery = supabase
    .from("remarketing_buyers")
    .select("*")
    .eq("universe_id", universeId)
    .eq("archived", false);

  if (buyerIds && buyerIds.length > 0) {
    buyerQuery = buyerQuery.in("id", buyerIds);
  }

  // Filter by data completeness if specified
  if (minDataCompleteness) {
    if (minDataCompleteness === 'high') {
      buyerQuery = buyerQuery.eq('data_completeness', 'high');
    } else if (minDataCompleteness === 'medium') {
      buyerQuery = buyerQuery.in('data_completeness', ['high', 'medium']);
    }
  }

  const { data: buyers, error: buyersError } = await buyerQuery;

  if (buyersError) {
    throw new Error("Failed to fetch buyers");
  }

  if (!buyers || buyers.length === 0) {
    return new Response(
      JSON.stringify({ success: true, scores: [], message: "No buyers to score" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // If not rescoring, filter out buyers that already have scores
  let buyersToScore = buyers;
  if (!rescoreExisting) {
    const { data: existingScores } = await supabase
      .from("remarketing_scores")
      .select("buyer_id")
      .eq("listing_id", listingId);

    const scoredBuyerIds = new Set((existingScores || []).map((s: any) => s.buyer_id));
    buyersToScore = buyers.filter((b: any) => !scoredBuyerIds.has(b.id));

    if (buyersToScore.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          scores: [], 
          message: "All buyers already scored",
          totalProcessed: 0,
          totalBuyers: buyers.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // ========== BUYER READINESS STATS ==========
  const buyerReadiness = {
    total: buyersToScore.length,
    with_services: buyersToScore.filter((b: any) => b.target_services?.length > 0).length,
    with_geo: buyersToScore.filter((b: any) => b.target_geographies?.length > 0 || b.geographic_footprint?.length > 0).length,
    with_size_criteria: buyersToScore.filter((b: any) => b.target_revenue_min || b.target_revenue_max || b.target_ebitda_min).length,
    with_thesis: buyersToScore.filter((b: any) => b.thesis_summary?.trim()).length,
  };
  console.log(`[BuyerReadiness] ${JSON.stringify(buyerReadiness)}`);

  console.log(`Scoring ${buyersToScore.length} buyers for listing ${listingId} (rescore: ${rescoreExisting})`);

  // Fetch adjustments, learning patterns, and engagement signals in parallel
  const allBuyerIds = buyersToScore.map((b: any) => b.id);
  const [adjustments, learningPatterns, engagementBonuses] = await Promise.all([
    fetchScoringAdjustments(supabase, listingId),
    fetchLearningPatterns(supabase, allBuyerIds),
    fetchBulkEngagementBonuses(supabase, listingId, allBuyerIds),
  ]);

  // Process in batches to avoid rate limits
  const batchSize = 5;
  const scores: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < buyersToScore.length; i += batchSize) {
    const batch = buyersToScore.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (buyer: any) => {
      try {
        const score = await generateAIScore(listing, buyer, universe, apiKey, customInstructions);

        // Calculate thesis bonus for this buyer
        const thesisAnalysis = calculateThesisBonus(listing, buyer);

        // Apply learning adjustments
        const { adjustedScore, thesisBonus, adjustmentReason } = applyLearningAdjustment(
          score.composite_score,
          learningPatterns.get(buyer.id),
          adjustments,
          thesisAnalysis.bonus,
          thesisAnalysis.reasoning
        );

        // Apply engagement bonus
        const engagementData = engagementBonuses.get(buyer.id) || { bonus: 0, reasoning: '' };
        const finalScore = Math.min(100, adjustedScore + engagementData.bonus);
        const finalReasoning = engagementData.bonus > 0
          ? `${adjustmentReason || score.fit_reasoning}\n\n${engagementData.reasoning}`
          : (adjustmentReason || score.fit_reasoning);

        // Recalculate tier based on final score - ALIGNED WITH SPEC
        let tier: string;
        if (finalScore >= 80) tier = "A";      // Tier 1 per spec
        else if (finalScore >= 60) tier = "B"; // Tier 2 per spec
        else if (finalScore >= 40) tier = "C"; // Tier 3 per spec
        else tier = "D";                        // Pass per spec

        // Create deal snapshot for stale detection
        const dealSnapshot = {
          revenue: listing.revenue,
          ebitda: listing.ebitda,
          location: listing.location,
          category: listing.category,
          snapshot_at: new Date().toISOString(),
        };

        return {
          listing_id: listingId,
          buyer_id: buyer.id,
          universe_id: universeId,
          ...score,
          composite_score: finalScore,
          tier,
          thesis_bonus: thesisBonus,
          acquisition_score: score.acquisition_score,
          portfolio_score: score.portfolio_score,
          business_model_score: score.business_model_score,
          fit_reasoning: finalReasoning,
          scored_at: new Date().toISOString(),
          deal_snapshot: dealSnapshot,
        };
      } catch (err) {
        console.error(`Failed to score buyer ${buyer.id}:`, err);
        errors.push(`Failed to score ${buyer.company_name}`);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    const validScores = batchResults.filter(s => s !== null);

    if (validScores.length > 0) {
      const { data: savedScores, error: saveError } = await supabase
        .from("remarketing_scores")
        .upsert(validScores, { onConflict: "listing_id,buyer_id" })
        .select();

      if (saveError) {
        console.error("Failed to save batch scores:", saveError);
        errors.push("Failed to save some scores");
      } else {
        scores.push(...(savedScores || []));
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + batchSize < buyersToScore.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // ========== SCORING SUMMARY & GUARDRAILS ==========
  const qualifiedCount = scores.filter((s: any) => s.composite_score >= 55).length;
  const disqualifiedCount = scores.filter((s: any) => s.composite_score < 55).length;
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((sum: number, s: any) => sum + (s.composite_score || 0), 0) / scores.length)
    : 0;

  // Guardrail: Flag when ALL scores are disqualified — likely a data issue
  if (qualifiedCount === 0 && scores.length > 0) {
    console.warn(`[ScoringGuardrail] ALL ${scores.length} buyers disqualified for deal ${listingId}. Avg score: ${avgScore}. Deal data quality: ${dealDiagnostics.data_quality}. Missing: [${dealDiagnostics.missing_fields.join(', ')}]`);
  }

  // Guardrail: Flag tight score band (all scores within 10 points = mapping break indicator)
  if (scores.length > 5) {
    const scoreValues = scores.map((s: any) => s.composite_score || 0);
    const minScore = Math.min(...scoreValues);
    const maxScore = Math.max(...scoreValues);
    if (maxScore - minScore < 10) {
      console.warn(`[ScoringGuardrail] Tight score band detected (${minScore}-${maxScore}). Possible mapping break or defaulting.`);
      dealDiagnostics.warnings.push(`All scores clustered in tight band (${minScore}-${maxScore}) — possible data issue`);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      scores,
      errors: errors.length > 0 ? errors : undefined,
      totalProcessed: scores.length,
      totalBuyers: buyersToScore.length,
      diagnostics: {
        deal: dealDiagnostics,
        buyers: buyerReadiness,
        scoring_summary: {
          qualified: qualifiedCount,
          disqualified: disqualifiedCount,
          avg_score: avgScore,
        }
      }
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Parse and apply scoring behavior from universe configuration
interface ScoringBehavior {
  industry_preset?: 'collision_repair' | 'software' | 'hvac' | 'pest_control' | 'custom';
  geography_strictness?: 'strict' | 'moderate' | 'flexible';
  single_location_matching?: 'exact_state' | 'adjacent_states' | 'same_region' | 'national';
  multi_location_matching?: 'same_region' | 'national' | 'any';
  allow_national_buyers?: boolean;
  size_strictness?: 'strict' | 'moderate' | 'flexible';
  below_minimum_handling?: 'disqualify' | 'penalize' | 'allow';
  penalize_single_location?: boolean;
  service_matching_mode?: 'keyword' | 'semantic' | 'hybrid';
  require_primary_focus?: boolean;
  excluded_services_dealbreaker?: boolean;
  can_override_geography?: boolean;
  can_override_size?: boolean;
  engagement_weight_multiplier?: number;
  boost_adjacency?: boolean;
  penalize_distance?: boolean;
  require_thesis_match?: boolean;
  minimum_data_completeness?: 'high' | 'medium' | 'low';
}

interface SizeCriteria {
  revenue_min?: number;
  revenue_max?: number;
  ebitda_min?: number;
  ebitda_max?: number;
  locations_min?: number;
  locations_max?: number;
}

interface GeographyCriteria {
  target_states?: string[];
  target_regions?: string[];
  exclude_states?: string[];
  coverage?: 'local' | 'regional' | 'national';
}

interface ServiceCriteria {
  required_services?: string[];
  preferred_services?: string[];
  excluded_services?: string[];
  business_model?: string;
}

// Build scoring rules text for the AI prompt based on behavior configuration
function buildScoringRulesPrompt(behavior: ScoringBehavior): string {
  const rules: string[] = [];
  
  // Geography Rules
  rules.push("GEOGRAPHY SCORING RULES:");
  switch (behavior.geography_strictness) {
    case 'strict':
      rules.push("- Strictness: STRICT - Location is a critical factor. Penalize heavily if outside target geography.");
      rules.push("- Score 90-100 only if deal is in buyer's exact target states.");
      rules.push("- Score 50-70 for adjacent states.");
      rules.push("- Score 20-40 for same region but not adjacent.");
      rules.push("- Score 0-20 for completely outside target region.");
      break;
    case 'flexible':
      rules.push("- Strictness: FLEXIBLE - Location is a secondary factor.");
      rules.push("- Geography should not heavily penalize otherwise good matches.");
      rules.push("- National buyers can match deals anywhere if other factors align.");
      break;
    default:
      rules.push("- Strictness: MODERATE - Location matters but isn't a dealbreaker.");
      rules.push("- Score based on proximity to target geography with reasonable flexibility.");
  }
  
  if (behavior.allow_national_buyers) {
    rules.push("- EXCEPTION: National buyers (with national footprint) can score well on geography for attractive deals.");
  }
  
  // Size/Revenue Rules
  rules.push("\nSIZE/REVENUE SCORING RULES:");
  switch (behavior.size_strictness) {
    case 'strict':
      rules.push("- Strictness: STRICT - Size is a gating factor.");
      rules.push("- If deal revenue is below buyer's minimum, size_score should be ≤30.");
      rules.push("- If deal revenue is above buyer's maximum, size_score should be ≤50.");
      break;
    case 'flexible':
      rules.push("- Strictness: FLEXIBLE - Size is informational, not a hard filter.");
      rules.push("- Slight mismatch in revenue should not heavily penalize.");
      break;
    default:
      rules.push("- Strictness: MODERATE - Size matters and influences score proportionally.");
  }
  
  switch (behavior.below_minimum_handling) {
    case 'disqualify':
      rules.push("- CRITICAL: If deal revenue is below buyer's stated minimum, size_score MUST be ≤25 and overall match should be poor.");
      break;
    case 'penalize':
      rules.push("- If deal revenue is below buyer's minimum, apply a significant penalty but don't completely disqualify.");
      break;
    case 'allow':
      rules.push("- Below-minimum deals can still score reasonably if other factors are strong.");
      break;
  }
  
  if (behavior.penalize_single_location) {
    rules.push("- PENALTY: Single-location deals should receive lower scores for buyers seeking multi-location platforms.");
  }
  
  // Service Matching Rules
  rules.push("\nSERVICE MATCHING RULES:");
  switch (behavior.service_matching_mode) {
    case 'semantic':
      rules.push("- Mode: SEMANTIC (AI-powered) - Use conceptual similarity, not just exact keyword matches.");
      rules.push("- 'Auto body repair' and 'collision repair' should match even without exact wording.");
      rules.push("- Consider industry synonyms and related services.");
      break;
    case 'keyword':
      rules.push("- Mode: KEYWORD - Match based on explicit service keywords only.");
      rules.push("- Require clear overlap between deal services and buyer target services.");
      break;
    default:
      rules.push("- Mode: HYBRID - Start with keyword matching, use semantic understanding for gaps.");
  }
  
  if (behavior.require_primary_focus) {
    rules.push("- IMPORTANT: Deal's primary service must match buyer's primary focus area for high scores.");
  }
  
  if (behavior.excluded_services_dealbreaker) {
    rules.push("- DEALBREAKER: If deal offers services the buyer explicitly excludes, service_score MUST be ≤20.");
  }
  
  // Thesis Match
  if (behavior.require_thesis_match) {
    rules.push("\nTHESIS REQUIREMENT:");
    rules.push("- Deal must align with buyer's stated investment thesis for scores above 70.");
  }
  
  // Data Completeness
  if (behavior.minimum_data_completeness) {
    rules.push("\nDATA QUALITY:");
    rules.push(`- Minimum data completeness expected: ${behavior.minimum_data_completeness.toUpperCase()}`);
    rules.push("- Factor data quality into confidence of scores.");
  }
  
  return rules.join("\n");
}

// Build structured criteria context for the AI prompt
function buildStructuredCriteriaPrompt(
  sizeCriteria: SizeCriteria | null,
  geoCriteria: GeographyCriteria | null,
  serviceCriteria: ServiceCriteria | null
): string {
  const parts: string[] = [];
  
  if (sizeCriteria) {
    parts.push("SIZE CRITERIA:");
    if (sizeCriteria.revenue_min) parts.push(`- Min Revenue: $${sizeCriteria.revenue_min.toLocaleString()}`);
    if (sizeCriteria.revenue_max) parts.push(`- Max Revenue: $${sizeCriteria.revenue_max.toLocaleString()}`);
    if (sizeCriteria.ebitda_min) parts.push(`- Min EBITDA: $${sizeCriteria.ebitda_min.toLocaleString()}`);
    if (sizeCriteria.ebitda_max) parts.push(`- Max EBITDA: $${sizeCriteria.ebitda_max.toLocaleString()}`);
    if (sizeCriteria.locations_min) parts.push(`- Min Locations: ${sizeCriteria.locations_min}`);
    if (sizeCriteria.locations_max) parts.push(`- Max Locations: ${sizeCriteria.locations_max}`);
  }
  
  if (geoCriteria) {
    parts.push("\nGEOGRAPHY CRITERIA:");
    if (geoCriteria.target_states?.length) parts.push(`- Target States: ${geoCriteria.target_states.join(", ")}`);
    if (geoCriteria.target_regions?.length) parts.push(`- Target Regions: ${geoCriteria.target_regions.join(", ")}`);
    if (geoCriteria.exclude_states?.length) parts.push(`- Excluded States: ${geoCriteria.exclude_states.join(", ")}`);
    if (geoCriteria.coverage) parts.push(`- Coverage Mode: ${geoCriteria.coverage}`);
  }
  
  if (serviceCriteria) {
    parts.push("\nSERVICE CRITERIA:");
    if (serviceCriteria.required_services?.length) parts.push(`- Required Services: ${serviceCriteria.required_services.join(", ")}`);
    if (serviceCriteria.preferred_services?.length) parts.push(`- Preferred Services: ${serviceCriteria.preferred_services.join(", ")}`);
    if (serviceCriteria.excluded_services?.length) parts.push(`- EXCLUDED Services: ${serviceCriteria.excluded_services.join(", ")}`);
    if (serviceCriteria.business_model) parts.push(`- Business Model: ${serviceCriteria.business_model}`);
  }
  
  return parts.length > 0 ? parts.join("\n") : "";
}

// Post-process scores to enforce hard rules that can't be left to AI interpretation
function enforceHardRules(
  scores: {
    geography_score: number;
    size_score: number;
    service_score: number;
    owner_goals_score: number;
    acquisition_score: number;
    portfolio_score: number;
    business_model_score: number;
    reasoning: string;
  },
  listing: any,
  buyer: any,
  behavior: ScoringBehavior,
  serviceCriteria: ServiceCriteria | null
): { 
  scores: typeof scores; 
  enforcements: string[];
  forceDisqualify: boolean;
} {
  const enforcements: string[] = [];
  let forceDisqualify = false;
  const adjustedScores = { ...scores };
  
  // 1. Below Minimum Revenue - DISQUALIFY (only when we have actual data)
  if (behavior.below_minimum_handling === 'disqualify') {
    const buyerMinRevenue = buyer.target_revenue_min;
    const dealRevenue = listing.revenue;

    // Only disqualify if we have actual revenue data showing it's below minimum
    if (buyerMinRevenue && dealRevenue !== null && dealRevenue !== undefined && dealRevenue < buyerMinRevenue) {
      adjustedScores.size_score = Math.min(adjustedScores.size_score, 25);
      enforcements.push(`Disqualified: Deal revenue ($${dealRevenue.toLocaleString()}) below buyer minimum ($${buyerMinRevenue.toLocaleString()})`);
      forceDisqualify = true;
    }
  }

  // 2. Below Minimum Revenue - PENALIZE (only when we have actual data)
  if (behavior.below_minimum_handling === 'penalize') {
    const buyerMinRevenue = buyer.target_revenue_min;
    const dealRevenue = listing.revenue;

    // Only penalize if we have actual revenue data showing it's below minimum
    if (buyerMinRevenue && dealRevenue !== null && dealRevenue !== undefined && dealRevenue < buyerMinRevenue) {
      const penaltyFactor = Math.max(0.5, dealRevenue / buyerMinRevenue);
      adjustedScores.size_score = Math.round(adjustedScores.size_score * penaltyFactor);
      enforcements.push(`Size penalized: Deal below minimum (${Math.round(penaltyFactor * 100)}% factor applied)`);
    }
  }
  
  // 3. Excluded Services - DEALBREAKER
  if (behavior.excluded_services_dealbreaker && serviceCriteria?.excluded_services?.length) {
    const dealServices = (listing.services || listing.categories || [listing.category]).map((s: string) => s?.toLowerCase());
    const excludedServices = serviceCriteria.excluded_services.map(s => s.toLowerCase());
    
    const hasExcluded = dealServices.some((ds: string) => 
      excludedServices.some(es => ds?.includes(es) || es.includes(ds || ''))
    );
    
    if (hasExcluded) {
      adjustedScores.service_score = Math.min(adjustedScores.service_score, 20);
      enforcements.push("Dealbreaker: Deal includes excluded services");
      forceDisqualify = true;
    }
  }
  
  // 4. Strict Geography - Enforce state matching
  if (behavior.geography_strictness === 'strict') {
    const buyerTargetStates = buyer.target_geographies || [];
    const dealLocation = listing.location || "";
    const dealState = dealLocation.match(/,\s*([A-Z]{2})\s*$/i)?.[1]?.toUpperCase();
    
    if (dealState && buyerTargetStates.length > 0) {
      const normalizedTargets = buyerTargetStates.map((s: string) => s.toUpperCase());
      
      if (!normalizedTargets.includes(dealState)) {
        // Check if national buyer exception applies
        const isNationalBuyer = buyer.geographic_footprint?.length >= 5 || 
                                buyer.geographic_footprint?.some((f: string) => f.toLowerCase().includes('national'));
        
        if (!(behavior.allow_national_buyers && isNationalBuyer)) {
          adjustedScores.geography_score = Math.min(adjustedScores.geography_score, 40);
          enforcements.push(`Geography strict: Deal state (${dealState}) not in buyer targets`);
        }
      }
    }
  }
  
  // 5. Penalize single-location deals
  if (behavior.penalize_single_location) {
    const locationCount = listing.location_count || 1;
    if (locationCount === 1) {
      adjustedScores.size_score = Math.round(adjustedScores.size_score * 0.85);
      enforcements.push("Single-location penalty applied");
    }
  }
  
  // 6. Apply engagement weight multiplier (for buyer engagement data if available)
  // This would be applied in the learning adjustment phase
  
  return {
    scores: adjustedScores,
    enforcements,
    forceDisqualify
  };
}

async function generateAIScore(
  listing: any,
  buyer: any,
  universe: any,
  apiKey: string,
  customInstructions?: string
): Promise<{
  composite_score: number;
  geography_score: number;
  size_score: number;
  service_score: number;
  owner_goals_score: number;
  acquisition_score: number;
  portfolio_score: number;
  business_model_score: number;
  tier: string;
  fit_reasoning: string;
  data_completeness: string;
  status: string;
}> {
  // Parse scoring behavior from universe
  const scoringBehavior: ScoringBehavior = universe.scoring_behavior || {};
  const sizeCriteria: SizeCriteria | null = universe.size_criteria || null;
  const geoCriteria: GeographyCriteria | null = universe.geography_criteria || null;
  const serviceCriteria: ServiceCriteria | null = universe.service_criteria || null;
  
  // Build scoring rules based on configuration
  const scoringRules = buildScoringRulesPrompt(scoringBehavior);
  const structuredCriteria = buildStructuredCriteriaPrompt(sizeCriteria, geoCriteria, serviceCriteria);
  
  // Industry preset context
  const industryPresetContext = scoringBehavior.industry_preset && scoringBehavior.industry_preset !== 'custom'
    ? `\nINDUSTRY CONTEXT: This is a ${scoringBehavior.industry_preset.replace('_', ' ')} deal. Apply industry-specific matching patterns.`
    : '';
  
  // Custom instructions from admin
  const customInstructionsContext = customInstructions
    ? `\n\nCUSTOM SCORING INSTRUCTIONS (FROM ADMIN - HIGH PRIORITY):
The admin has provided these specific instructions for scoring this deal. Apply them with HIGH priority and adjust scores accordingly:
"${customInstructions}"

Examples of how to interpret these instructions:
- "Owner wants to stay and retain equity rollover" → Boost owner_goals_score for buyers who support equity rollovers and owner transitions
- "Quick close needed (60 days or less)" → Prioritize buyers with fast close track records, penalize slow-moving buyers
- "Key employees must be retained" → Favor buyers known to retain management teams
- "Single location is acceptable" → Do not apply single-location penalties in size_score
- "No DRP relationships" → Prioritize buyers comfortable with non-DRP shops

Always mention how you applied these instructions in your reasoning.`
    : '';

const systemPrompt = `You are an M&A advisor scoring buyer-deal fits for automotive aftermarket businesses. Analyze the match between a business listing and a potential buyer (PE firm/platform/strategic acquirer).

CRITICAL: You MUST follow the SCORING RULES provided below. These are hard constraints that override general matching logic. Apply them strictly.

Score each category from 0-100 based on fit quality:
- Geography: How well does the deal's location match the buyer's target geography or existing footprint?
- Size: Does the deal's revenue/EBITDA fit the buyer's investment criteria?
- Service: How aligned are the deal's services with the buyer's focus areas?
- Owner Goals: How compatible is the deal based on seller motivation, timeline, and buyer acquisition strategies?
- Acquisition Fit: How well does this deal fit the buyer's recent acquisition pattern and appetite?
- Portfolio Synergy: How well does this deal complement the buyer's existing portfolio companies?
- Business Model: How aligned is the deal's business model (service mix, customer base) with buyer preferences?

MISSING DATA HANDLING (CRITICAL):
- When deal services/categories are "Unknown", score service_score at 60 (neutral-pass). Do NOT penalize for missing data.
- When buyer has no target_services, score service_score at 60.
- When deal or buyer location data is missing, score geography_score at 60.
- When buyer has no financial targets (revenue/EBITDA ranges), score size_score at 65 (benefit of the doubt).
- Explicitly note in reasoning when a dimension was scored as "insufficient data" so the system can track it.
- Use the label "[INSUFFICIENT_DATA: service]" or "[INSUFFICIENT_DATA: geography]" in your reasoning for affected dimensions.

DEAL BREAKER EVALUATION (CRITICAL):
- If buyer has deal_breakers listed (e.g., "Avoids DRP", "No shops under $1M"), check if deal violates ANY of them
- If deal VIOLATES a deal breaker, heavily penalize owner_goals_score (-30 to -50 points) and note it explicitly
- If deal ALIGNS with buyer preferences (e.g., "owner avoids DRP" matches buyer who "avoids DRP"), this is positive
- Always mention deal breaker context in reasoning when relevant

REVENUE/EBITDA SWEET SPOT:
- If buyer has revenue_sweet_spot or ebitda_sweet_spot, deals matching within 20% should get +5 size_score bonus
- Mention "sweet spot match" in reasoning when applicable

STRATEGIC PRIORITIES:
- Consider buyer's strategic_priorities when evaluating service and acquisition fit
- Deals aligning with strategic priorities should get service_score boost

REASONING FORMAT REQUIREMENTS:
1. Start with a fit label based on composite score:
   - Score ≥70: "✅ Strong fit:"
   - Score 55-69: "⚠️ Moderate fit:"
   - Score <55: "❌ Poor fit:" or if disqualified: "🚫 DISQUALIFIED:"
2. Include geographic context: "Buyer operates in [STATE] (adjacent)" or "(direct overlap)" or "(no nearby presence)"
3. Calculate and report service overlap as percentage: "Strong service alignment (67% overlap): [services]" or "Weak service alignment (20% overlap)"
4. Mention deal breaker context: "Owner avoids DRP - deal aligns." or "⚠️ Violates: [deal breaker]"
5. Mention bonus points when applicable: "+10pt primary focus bonus" or "+5pt sweet spot bonus"
6. End reasoning with footprint context: "Buyer footprint: [BUYER_STATES] → Deal: [DEAL_STATE]"

Example reasoning:
"✅ Strong fit: Buyer operates in TX (adjacent). Strong service alignment (67% overlap): collision, repair. Owner avoids DRP - deal aligns. +10pt primary focus bonus. Buyer footprint: TX, OK, AR → Deal: MO"

Provide scores and reasoning following the format above. Be specific about which rules affected your scoring.${customInstructionsContext}`;

  // Get listing description with fallback chain
  const getDescription = () => {
    if (listing.hero_description?.trim()) return listing.hero_description;
    if (listing.description?.trim()) return listing.description;
    if (listing.description_html?.trim()) {
      return listing.description_html.replace(/<[^>]*>/g, ' ').trim();
    }
    return "No description available";
  };

  // Get service categories from array or fallback to single category
  const getServices = () => {
    if (listing.services && Array.isArray(listing.services) && listing.services.length > 0) {
      return listing.services.join(", ");
    }
    if (listing.categories && Array.isArray(listing.categories) && listing.categories.length > 0) {
      return listing.categories.join(", ");
    }
    return listing.category || "Unknown";
  };

  // Get seller goals context
  const getSellerGoals = () => {
    const parts: string[] = [];
    if (listing.seller_motivation?.trim()) parts.push(`Motivation: ${listing.seller_motivation}`);
    if (listing.timeline_preference?.trim()) parts.push(`Timeline: ${listing.timeline_preference}`);
    if (listing.ideal_buyer?.trim()) parts.push(`Ideal buyer: ${listing.ideal_buyer}`);
    return parts.length > 0 ? parts.join("; ") : "Not specified";
  };

  // Normalize location to state/region for better matching
  const getNormalizedLocation = () => {
    const location = listing.location || "";
    const stateMatch = location.match(/,\s*([A-Z]{2}|\w+)$/i);
    return stateMatch ? `${location} (State: ${stateMatch[1].toUpperCase()})` : location || "Unknown";
  };

  // Get buyer acquisition history context
  const getAcquisitionContext = () => {
    const acquisitions = buyer.recent_acquisitions || [];
    if (acquisitions.length === 0) return "No recent acquisitions on record";
    
    const summary = acquisitions.slice(0, 3).map((a: any) => 
      `${a.company_name || 'Unknown'}${a.date ? ` (${a.date})` : ''}${a.revenue ? ` - $${a.revenue}` : ''}`
    ).join("; ");
    return `Recent: ${summary}`;
  };

  // Get portfolio context
  const getPortfolioContext = () => {
    const portfolio = buyer.portfolio_companies || [];
    if (portfolio.length === 0) return "No portfolio companies on record";
    
    const names = portfolio.slice(0, 5).map((p: any) => p.name || 'Unknown').join(", ");
    return `Portfolio: ${names}`;
  };

  // Calculate geography score using adjacency intelligence
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geoScore = await calculateGeographyScore(listing, buyer, supabaseUrl, supabaseKey);

  // Calculate service overlap for prompt context
  const serviceOverlap = calculateServiceOverlap(listing, buyer);

  const userPrompt = `DEAL:
- Title: ${listing.title || "Unknown"}
- Services/Categories: ${getServices()}
- Location: ${getNormalizedLocation()}
- Revenue: ${listing.revenue ? `$${listing.revenue.toLocaleString()}` : "Unknown"}
- EBITDA: ${listing.ebitda ? `$${listing.ebitda.toLocaleString()}` : "Unknown"}
- Location Count: ${listing.location_count || 1}
- Description: ${getDescription()}
- Seller Goals: ${getSellerGoals()}

BUYER:
- Company: ${buyer.company_name}
- Type: ${buyer.buyer_type || "Unknown"}
- PE Firm: ${buyer.pe_firm_name || "N/A"}
- HQ Location: ${buyer.hq_city && buyer.hq_state ? `${buyer.hq_city}, ${buyer.hq_state}` : "Unknown"}
- Target Revenue: ${buyer.target_revenue_min ? `$${buyer.target_revenue_min.toLocaleString()}` : "?"} - ${buyer.target_revenue_max ? `$${buyer.target_revenue_max.toLocaleString()}` : "?"}
- Target EBITDA: ${buyer.target_ebitda_min ? `$${buyer.target_ebitda_min.toLocaleString()}` : "?"} - ${buyer.target_ebitda_max ? `$${buyer.target_ebitda_max.toLocaleString()}` : "?"}
- Revenue Sweet Spot: ${buyer.revenue_sweet_spot ? `$${buyer.revenue_sweet_spot.toLocaleString()}` : "Not specified"}
- EBITDA Sweet Spot: ${buyer.ebitda_sweet_spot ? `$${buyer.ebitda_sweet_spot.toLocaleString()}` : "Not specified"}
- Target Geographies: ${buyer.target_geographies?.join(", ") || "Unknown"}
- Target Services: ${buyer.target_services?.join(", ") || "Unknown"}
- Target Industries: ${buyer.target_industries?.join(", ") || "Unknown"}
- Current Footprint: ${buyer.geographic_footprint?.join(", ") || "Unknown"}
- Investment Thesis: ${buyer.thesis_summary || "Unknown"}
- Deal Breakers: ${buyer.deal_breakers?.join(", ") || "None specified"}
- Strategic Priorities: ${buyer.strategic_priorities?.join(", ") || "Not defined"}
- Deal Preferences: ${buyer.deal_preferences || "Unknown"}
- Specialized Focus: ${buyer.specialized_focus || "Unknown"}
- Acquisition Timeline: ${buyer.acquisition_timeline || "Unknown"}
- ${getAcquisitionContext()}
- ${getPortfolioContext()}
- Acquisition Appetite: ${buyer.acquisition_appetite || "Unknown"}
- Total Acquisitions: ${buyer.total_acquisitions || "Unknown"}
${industryPresetContext}

SERVICE OVERLAP CONTEXT:
- Calculated overlap: ${serviceOverlap.percentage}%
- Matching services: ${serviceOverlap.matchingServices.length > 0 ? serviceOverlap.matchingServices.join(', ') : 'None identified'}
- Deal services: ${serviceOverlap.allDealServices.join(', ') || 'Unknown'}

GEOGRAPHIC ADJACENCY INTELLIGENCE (Use this as primary guidance for geography_score):
- Proximity Score: ${geoScore.score}/100
- Proximity Tier: ${geoScore.tier.toUpperCase()} (exact/adjacent/regional/distant)
- Analysis: ${geoScore.reasoning}
- IMPORTANT: Your geography_score should align closely with this calculated score (${geoScore.score}) unless there are compelling reasons to deviate.
- Scoring breakdown:
  * Exact state match: 90-100 points
  * Adjacent state (~100 miles): 60-80 points
  * Same region: 40-60 points
  * Different region: 0-30 points

${structuredCriteria ? `\nUNIVERSE STRUCTURED CRITERIA:\n${structuredCriteria}` : ''}

UNIVERSE FIT CRITERIA:
${universe.fit_criteria || "General buyer-deal matching"}

WEIGHTS:
- Geography: ${universe.geography_weight}%
- Size: ${universe.size_weight}%
- Service: ${universe.service_weight}%
- Owner Goals: ${universe.owner_goals_weight}%

${scoringRules}

Analyze this buyer-deal fit. Use the SERVICE OVERLAP CONTEXT in your reasoning. Apply the scoring rules strictly and explain which rules affected your assessment.`;

  console.log("Scoring with behavior:", JSON.stringify(scoringBehavior));

  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: getGeminiHeaders(apiKey),
    body: JSON.stringify({
      model: DEFAULT_GEMINI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      tools: [{
        type: "function",
        function: {
          name: "score_buyer_deal",
          description: "Score the buyer-deal fit across categories including acquisition, portfolio, and business model factors",
          parameters: {
            type: "object",
            properties: {
              geography_score: { 
                type: "number", 
                description: "Score 0-100 for geographic fit" 
              },
              size_score: { 
                type: "number", 
                description: "Score 0-100 for size/financial fit" 
              },
              service_score: { 
                type: "number", 
                description: "Score 0-100 for service/industry fit" 
              },
              owner_goals_score: { 
                type: "number", 
                description: "Score 0-100 for owner goals compatibility" 
              },
              acquisition_score: {
                type: "number",
                description: "Score 0-100 for fit with buyer's acquisition pattern and appetite"
              },
              portfolio_score: {
                type: "number",
                description: "Score 0-100 for synergy with buyer's existing portfolio"
              },
              business_model_score: {
                type: "number",
                description: "Score 0-100 for business model alignment"
              },
              reasoning: { 
                type: "string", 
                description: "2-3 sentence explanation following this format: [FIT_LABEL]: [Geographic context]. [Service overlap %]. [Any bonuses]. Must end with 'Buyer footprint: [STATES] → Deal: [STATE]'. Example: 'Strong fit: Buyer operates in TX (adjacent). Strong service alignment (67% overlap): collision, repair. Buyer footprint: TX, OK → Deal: MO'" 
              }
            },
            required: ["geography_score", "size_score", "service_score", "owner_goals_score", "acquisition_score", "portfolio_score", "business_model_score", "reasoning"],
            additionalProperties: false
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "score_buyer_deal" } }
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded");
    }
    if (response.status === 402) {
      throw new Error("Payment required");
    }
    const text = await response.text();
    console.error("AI Gateway error:", response.status, text);
    throw new Error("AI scoring failed");
  }

  const result = await response.json();
  
  // Parse the tool call response
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.error("No tool call in response:", JSON.stringify(result));
    throw new Error("Invalid AI response format");
  }

  let scores;
  try {
    scores = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error("Failed to parse AI response:", toolCall.function.arguments);
    throw new Error("Failed to parse AI scores");
  }

  // Validate and align geography score with calculated adjacency score
  // If AI score deviates significantly (>20 points) from calculated score, use calculated score
  if (Math.abs(scores.geography_score - geoScore.score) > 20) {
    console.log(`[GeographyValidation] AI score (${scores.geography_score}) deviates from calculated (${geoScore.score}), using calculated score`);
    scores.geography_score = geoScore.score;
    scores.reasoning = `${geoScore.reasoning}. ${scores.reasoning}`;
  }

  // Apply post-processing enforcement of hard rules
  const { scores: enforcedScores, enforcements, forceDisqualify } = enforceHardRules(
    scores,
    listing,
    buyer,
    scoringBehavior,
    serviceCriteria
  );

  // ========== SIZE MULTIPLIER CALCULATION (KEY INNOVATION FROM SPEC) ==========
  // Size acts as a GATE on final score - wrong size = low score regardless of other factors
  const sizeMultiplier = calculateSizeMultiplier(
    listing,
    buyer,
    scoringBehavior,
    enforcedScores.size_score
  );
  
  console.log(`[SizeMultiplier] Deal ${listing.id}: size_score=${enforcedScores.size_score}, multiplier=${sizeMultiplier}`);

  // ========== CRITICAL FIX: CORRECT CALCULATION ORDER ==========
  // Issue #9 Fix: Size multiplier should apply ONLY to base score, not bonuses
  // Correct order:
  // 1. Detect missing data dimensions and redistribute weights
  // 2. Calculate base weighted score (4 core categories)
  // 3. Apply size multiplier to base score (gates based on size fit)
  // 4. Add bonuses (primary focus, sweet spot, thesis, engagement)
  // 5. Cap at 100

  // Step 0: Detect missing data dimensions for weight redistribution
  // When a dimension has insufficient data, its score is meaningless noise.
  // Rather than penalizing with a neutral 50, redistribute that weight to dimensions we CAN evaluate.
  const dealHasServices = !!(
    (listing.services && Array.isArray(listing.services) && listing.services.length > 0) ||
    (listing.categories && Array.isArray(listing.categories) && listing.categories.length > 0) ||
    (listing.category && listing.category.trim())
  );
  const buyerHasServiceTargets = !!(buyer.target_services && buyer.target_services.length > 0);
  const dealHasLocation = !!(listing.location && listing.location.trim());
  const buyerHasGeoTargets = !!(
    (buyer.target_geographies && buyer.target_geographies.length > 0) ||
    (buyer.geographic_footprint && buyer.geographic_footprint.length > 0)
  );
  const buyerHasSizeTargets = !!(buyer.target_revenue_min || buyer.target_revenue_max || buyer.target_ebitda_min);
  const dealHasFinancials = !!(listing.revenue || listing.ebitda);

  // Determine which dimensions have sufficient data for meaningful scoring
  const serviceDataSufficient = dealHasServices || buyerHasServiceTargets;
  const geoDataSufficient = dealHasLocation && buyerHasGeoTargets;
  const sizeDataSufficient = dealHasFinancials || buyerHasSizeTargets;
  // Owner goals always scored (AI can infer from buyer thesis + deal context)

  // Calculate effective weights with redistribution for missing data
  let effectiveGeoWeight = universe.geography_weight;
  let effectiveSizeWeight = universe.size_weight;
  let effectiveServiceWeight = universe.service_weight;
  let effectiveOwnerWeight = universe.owner_goals_weight;
  const missingDimensions: string[] = [];

  // Redistribute weights from insufficient dimensions to sufficient ones
  let totalRedistribute = 0;
  let totalSufficientWeight = 0;

  if (!serviceDataSufficient) {
    totalRedistribute += effectiveServiceWeight;
    effectiveServiceWeight = 0;
    missingDimensions.push('services');
  } else {
    totalSufficientWeight += effectiveServiceWeight;
  }

  if (!geoDataSufficient) {
    totalRedistribute += effectiveGeoWeight;
    effectiveGeoWeight = 0;
    missingDimensions.push('geography');
  } else {
    totalSufficientWeight += effectiveGeoWeight;
  }

  if (!sizeDataSufficient) {
    totalRedistribute += effectiveSizeWeight;
    effectiveSizeWeight = 0;
    missingDimensions.push('size');
  } else {
    totalSufficientWeight += effectiveSizeWeight;
  }

  // Owner goals always contribute
  totalSufficientWeight += effectiveOwnerWeight;

  // Redistribute missing weight proportionally to sufficient dimensions
  if (totalRedistribute > 0 && totalSufficientWeight > 0) {
    const redistributionFactor = totalRedistribute / totalSufficientWeight;
    if (effectiveGeoWeight > 0) effectiveGeoWeight += effectiveGeoWeight * redistributionFactor;
    if (effectiveSizeWeight > 0) effectiveSizeWeight += effectiveSizeWeight * redistributionFactor;
    if (effectiveServiceWeight > 0) effectiveServiceWeight += effectiveServiceWeight * redistributionFactor;
    effectiveOwnerWeight += effectiveOwnerWeight * redistributionFactor;

    console.log(`[WeightRedistribution] Missing: [${missingDimensions.join(', ')}]. Effective weights: geo=${effectiveGeoWeight.toFixed(1)}, size=${effectiveSizeWeight.toFixed(1)}, svc=${effectiveServiceWeight.toFixed(1)}, owner=${effectiveOwnerWeight.toFixed(1)}`);
  }

  // For dimensions with insufficient data, apply a floor of 60 (neutral-pass)
  // This prevents AI noise on unknown data from dragging scores below qualification
  const effectiveGeoScore = geoDataSufficient ? enforcedScores.geography_score : Math.max(enforcedScores.geography_score, 60);
  const effectiveSizeScore = sizeDataSufficient ? enforcedScores.size_score : Math.max(enforcedScores.size_score, 60);
  const effectiveServiceScore = serviceDataSufficient ? enforcedScores.service_score : Math.max(enforcedScores.service_score, 60);
  const effectiveOwnerScore = enforcedScores.owner_goals_score;

  // Step 1: Calculate base composite score using effective weights
  const totalWeight = effectiveGeoWeight + effectiveSizeWeight + effectiveServiceWeight + effectiveOwnerWeight;
  const baseComposite = Math.round(
    (effectiveGeoScore * effectiveGeoWeight +
     effectiveSizeScore * effectiveSizeWeight +
     effectiveServiceScore * effectiveServiceWeight +
     effectiveOwnerScore * effectiveOwnerWeight) / totalWeight
  );

  // Bonus from secondary scores (up to +5 points per spec) - added to base before multiplier
  const secondaryAvg = (enforcedScores.acquisition_score + enforcedScores.portfolio_score + enforcedScores.business_model_score) / 3;
  const secondaryBonus = forceDisqualify ? 0 : (secondaryAvg >= 80 ? 5 : secondaryAvg >= 60 ? 2 : 0);
  const baseWithSecondary = Math.min(100, baseComposite + secondaryBonus);

  // Step 2: Apply size multiplier to base score ONLY (this gates the match)
  let sizeGatedScore = Math.round(baseWithSecondary * sizeMultiplier);
  sizeGatedScore = Math.min(100, Math.max(0, sizeGatedScore));

  // Step 3: Calculate all bonuses (applied AFTER size multiplier)
  let totalBonuses = 0;

  // Primary focus bonus (+10pt when deal's primary service matches buyer's primary focus)
  const primaryFocusBonus = applyPrimaryFocusBonus(
    listing,
    buyer,
    scoringBehavior,
    0 // Pass 0 since we're just checking if bonus applies, not adding to score
  );
  if (primaryFocusBonus.bonusApplied && !forceDisqualify) {
    totalBonuses += 10;
  }

  // Sweet spot bonus (+5pt when deal revenue/EBITDA matches buyer's sweet spot)
  const { score: sweetSpotSizeScore, bonusApplied: sweetSpotApplied, bonusReason: sweetSpotReason } =
    applySweetSpotBonus(listing, buyer, enforcedScores.size_score);
  if (sweetSpotApplied && !forceDisqualify) {
    totalBonuses += 5;
  }

  // Step 4: Apply bonuses and cap at 100
  let finalComposite = Math.min(100, sizeGatedScore + totalBonuses);

  console.log(`[CompositeCalc] Base: ${baseWithSecondary}, After multiplier (×${sizeMultiplier}): ${sizeGatedScore}, With bonuses (+${totalBonuses}): ${finalComposite}`);

  // Apply engagement weight multiplier for priority buyers (0.5x to 2.0x)
  let engagementMultiplierApplied = false;
  if (scoringBehavior.engagement_weight_multiplier && 
      scoringBehavior.engagement_weight_multiplier !== 1.0 &&
      !forceDisqualify) {
    const multiplier = Math.max(0.5, Math.min(2.0, scoringBehavior.engagement_weight_multiplier));
    finalComposite = Math.round(finalComposite * multiplier);
    finalComposite = Math.min(100, Math.max(0, finalComposite));
    engagementMultiplierApplied = multiplier !== 1.0;
  }
  
  // If force disqualified, score is 0 per spec (not capped at 45)
  if (forceDisqualify) {
    finalComposite = 0;
  }

  // Determine tier - ALIGNED WITH SPEC: Tier1=80+, Tier2=60-79, Tier3=40-59, Pass<40
  let tier: string;
  if (finalComposite >= 80) tier = "A";      // Tier 1 per spec
  else if (finalComposite >= 60) tier = "B"; // Tier 2 per spec  
  else if (finalComposite >= 40) tier = "C"; // Tier 3 per spec
  else tier = "D";                            // Pass per spec

  // Determine data completeness based on buyer data
  const hasThesis = !!buyer.thesis_summary;
  const hasTargets = buyer.target_geographies?.length > 0 || buyer.target_services?.length > 0;
  const hasFinancials = buyer.target_revenue_min || buyer.target_ebitda_min;
  const hasAcquisitions = buyer.recent_acquisitions?.length > 0;
  const hasPortfolio = buyer.portfolio_companies?.length > 0;
  
  let dataCompleteness: string;
  if (hasThesis && hasTargets && hasFinancials && (hasAcquisitions || hasPortfolio)) {
    dataCompleteness = "high";
  } else if (hasThesis || (hasTargets && hasFinancials)) {
    dataCompleteness = "medium";
  } else {
    dataCompleteness = "low";
  }

  // Build final reasoning with enforcement notes, size multiplier, and bonuses
  let finalReasoning = enforcedScores.reasoning;

  // Add missing data note (helps frontend extract accurate disqualification reasons)
  if (missingDimensions.length > 0) {
    finalReasoning += ` [MISSING_DATA: ${missingDimensions.join(', ')}] Weights redistributed.`;
  }

  // Add size multiplier note (KEY SPEC REQUIREMENT)
  if (sizeMultiplier < 1.0 && !forceDisqualify) {
    finalReasoning += ` Size Multiplier: ${(sizeMultiplier * 100).toFixed(0)}%.`;
  }

  // Add bonus notes if applied
  if (primaryFocusBonus.bonusApplied && !forceDisqualify) {
    finalReasoning += " +10pt primary focus bonus.";
  }
  if (sweetSpotApplied && !forceDisqualify) {
    finalReasoning += ` ${sweetSpotReason}.`;
  }
  if (engagementMultiplierApplied) {
    finalReasoning += ` (${scoringBehavior.engagement_weight_multiplier}x priority multiplier)`;
  }

  if (enforcements.length > 0) {
    finalReasoning += `\n\nRule Enforcements: ${enforcements.join("; ")}`;
  }

  return {
    composite_score: finalComposite,
    geography_score: enforcedScores.geography_score,
    size_score: enforcedScores.size_score,
    service_score: enforcedScores.service_score,
    owner_goals_score: enforcedScores.owner_goals_score,
    acquisition_score: enforcedScores.acquisition_score || 50,
    portfolio_score: enforcedScores.portfolio_score || 50,
    business_model_score: enforcedScores.business_model_score || 50,
    tier,
    fit_reasoning: finalReasoning,
    data_completeness: dataCompleteness,
    status: "pending"
  };
}
