import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL, ANTHROPIC_API_URL, getAnthropicHeaders, DEFAULT_CLAUDE_FAST_MODEL, callClaudeWithTool } from "../_shared/ai-providers.ts";
import { calculateProximityScore, getProximityTier, normalizeStateCode } from "../_shared/geography-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// TYPES
// ============================================================================

interface ScoreRequest {
  listingId: string;
  buyerId: string;
  universeId: string;
  customInstructions?: string;
  geographyMode?: 'critical' | 'preferred' | 'minimal';
}

interface BulkScoreRequest {
  listingId: string;
  universeId: string;
  buyerIds?: string[];
  customInstructions?: string;
  geographyMode?: 'critical' | 'preferred' | 'minimal';
  options?: {
    rescoreExisting?: boolean;
    minDataCompleteness?: 'high' | 'medium' | 'low';
  };
}

interface ScoringBehavior {
  industry_preset?: string;
  geography_strictness?: 'strict' | 'moderate' | 'flexible';
  single_location_matching?: string;
  multi_location_matching?: string;
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
  minimum_data_completeness?: string;
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
  coverage?: string;
}

interface ServiceCriteria {
  required_services?: string[];
  preferred_services?: string[];
  excluded_services?: string[];
  business_model?: string;
}

interface LearningPattern {
  buyer_id: string;
  approvalRate: number;
  avgScoreOnApproved: number;
  avgScoreOnPassed: number;
  totalActions: number;
  passCategories: Record<string, number>;
}

interface ScoredResult {
  listing_id: string;
  buyer_id: string;
  universe_id: string;
  composite_score: number;
  geography_score: number;
  size_score: number;
  service_score: number;
  owner_goals_score: number;
  acquisition_score: number;
  portfolio_score: number;
  business_model_score: number;
  size_multiplier: number;
  service_multiplier: number;
  geography_mode_factor: number;
  thesis_alignment_bonus: number;
  data_quality_bonus: number;
  custom_bonus: number;
  learning_penalty: number;
  tier: string;
  is_disqualified: boolean;
  disqualification_reason: string | null;
  needs_review: boolean;
  missing_fields: string[];
  confidence_level: string;
  fit_reasoning: string;
  data_completeness: string;
  status: string;
  scored_at: string;
  deal_snapshot: object;
}

// ============================================================================
// DEFAULT SERVICE ADJACENCY MAP
// ============================================================================

const DEFAULT_SERVICE_ADJACENCY: Record<string, string[]> = {
  "fire restoration": ["water restoration", "mold remediation", "contents cleaning", "roofing", "reconstruction", "smoke damage", "restoration"],
  "water restoration": ["fire restoration", "mold remediation", "plumbing", "flood cleanup", "dehumidification", "restoration"],
  "restoration": ["fire restoration", "water restoration", "mold remediation", "reconstruction", "mitigation", "contents cleaning"],
  "mold remediation": ["water restoration", "fire restoration", "indoor air quality", "restoration"],
  "commercial hvac": ["residential hvac", "mechanical contracting", "plumbing", "building automation", "refrigeration", "controls", "hvac"],
  "residential hvac": ["commercial hvac", "plumbing", "electrical", "home services", "indoor air quality", "hvac"],
  "hvac": ["commercial hvac", "residential hvac", "mechanical contracting", "plumbing", "electrical"],
  "collision repair": ["auto body", "paintless dent repair", "auto glass", "fleet maintenance", "calibration", "automotive"],
  "auto body": ["collision repair", "paint", "auto glass", "fleet services", "automotive"],
  "landscaping": ["hardscaping", "irrigation", "tree care", "snow removal", "lawn maintenance"],
  "plumbing": ["hvac", "mechanical contracting", "water restoration", "drain cleaning", "septic"],
  "electrical": ["hvac", "low voltage", "fire alarm", "building automation", "solar"],
  "roofing": ["siding", "gutters", "exterior restoration", "storm damage", "waterproofing", "restoration"],
  "pest control": ["wildlife removal", "termite", "lawn care", "mosquito control"],
  "janitorial": ["commercial cleaning", "facility maintenance", "carpet cleaning", "window cleaning"],
  "mitigation": ["restoration", "water restoration", "fire restoration", "mold remediation"],
  "disaster recovery": ["restoration", "fire restoration", "water restoration", "mitigation", "mold remediation", "reconstruction"],
  "reconstruction": ["restoration", "fire restoration", "water restoration", "general contracting", "disaster recovery"],
  "contents cleaning": ["restoration", "fire restoration", "water restoration", "pack-out"],
  "automotive": ["auto body", "collision repair", "auto glass", "fleet maintenance", "calibration"],
  "auto glass": ["collision repair", "auto body", "calibration", "automotive"],
  "healthcare": ["medical", "dental", "urgent care", "physical therapy", "home health", "behavioral health"],
  "medical": ["healthcare", "dental", "urgent care", "home health", "physician services"],
  "dental": ["healthcare", "medical", "orthodontics"],
  "it services": ["managed services", "cybersecurity", "cloud", "msp", "technology"],
  "managed services": ["it services", "msp", "cybersecurity", "cloud", "saas"],
  "msp": ["managed services", "it services", "cybersecurity"],
  "accounting": ["tax", "bookkeeping", "financial services", "cpa", "advisory"],
  "engineering": ["consulting", "environmental", "surveying", "architecture"],
  "staffing": ["recruiting", "temp services", "workforce", "hr services"],
  "insurance": ["benefits", "risk management", "brokerage"],
  "home services": ["residential hvac", "plumbing", "electrical", "roofing", "landscaping", "pest control"],
  "solar": ["electrical", "renewable energy", "energy services"],
};

// ============================================================================
// AI CALL RETRY HELPER
// ============================================================================

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 1,
  baseDelayMs: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) return response;
      // Server error — retry
      lastError = new Error(`HTTP ${response.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
    }
  }
  throw lastError || new Error("fetchWithRetry failed");
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
    if (!GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is not configured — AI scoring will use deterministic fallbacks");
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

// ============================================================================
// PHASE 2: SIZE SCORING (Deterministic)
// ============================================================================
// Returns BOTH a size_score (0-100) AND a size_multiplier (0.0-1.0)
// The size_multiplier is a GATE applied to the ENTIRE composite score.

function calculateSizeScore(
  listing: any,
  buyer: any,
  behavior: ScoringBehavior
): { score: number; multiplier: number; reasoning: string } {
  const dealRevenue = listing.revenue;
  const dealEbitda = listing.ebitda;
  const buyerMinRevenue = buyer.target_revenue_min;
  const buyerMaxRevenue = buyer.target_revenue_max;
  const buyerMinEbitda = buyer.target_ebitda_min;
  const buyerMaxEbitda = buyer.target_ebitda_max;
  const revenueSweetSpot = buyer.revenue_sweet_spot;
  const ebitdaSweetSpot = buyer.ebitda_sweet_spot;

  // Both deal revenue AND EBITDA are missing — differentiate by buyer flexibility
  if (dealRevenue == null && dealEbitda == null) {
    // No buyer size criteria either — both sides unknown, neutral
    if (buyerMinRevenue == null && buyerMaxRevenue == null && buyerMinEbitda == null && buyerMaxEbitda == null) {
      return {
        score: 55,
        multiplier: 0.8,
        reasoning: "Deal missing financials, buyer has no size criteria — moderate neutral"
      };
    }
    // Buyer has wide criteria range (max >= 3x min) — flexible buyer, better chance of fit
    const rangeRatio = (buyerMinRevenue && buyerMaxRevenue) ? buyerMaxRevenue / buyerMinRevenue : 0;
    if (rangeRatio >= 3) {
      return {
        score: 50,
        multiplier: 0.75,
        reasoning: "Deal missing financials — buyer has wide size range, moderate fit assumed"
      };
    }
    // Buyer has narrow or specific criteria — can't verify, higher risk of mismatch
    return {
      score: 35,
      multiplier: 0.6,
      reasoning: "Deal missing financials — buyer has specific size criteria, fit uncertain"
    };
  }

  // No buyer size criteria at all — use moderate default
  if (buyerMinRevenue == null && buyerMaxRevenue == null && buyerMinEbitda == null && buyerMaxEbitda == null) {
    return {
      score: 60,
      multiplier: 1.0,
      reasoning: "No buyer size criteria available — neutral scoring"
    };
  }

  let score = 60; // default
  let multiplier = 1.0;
  let reasoning = "";

  // === Revenue-based scoring ===
  if (dealRevenue != null && dealRevenue > 0) {
    // Sweet spot match (±10%)
    if (revenueSweetSpot && Math.abs(dealRevenue - revenueSweetSpot) / revenueSweetSpot <= 0.1) {
      score = 97;
      multiplier = 1.0;
      reasoning = `Revenue $${(dealRevenue/1e6).toFixed(1)}M — exact sweet spot match`;
    }
    // Sweet spot match (±20%)
    else if (revenueSweetSpot && Math.abs(dealRevenue - revenueSweetSpot) / revenueSweetSpot <= 0.2) {
      score = 90;
      multiplier = 0.95;
      reasoning = `Revenue $${(dealRevenue/1e6).toFixed(1)}M — near sweet spot ($${(revenueSweetSpot/1e6).toFixed(1)}M)`;
    }
    // Within buyer's stated range
    else if (buyerMinRevenue && buyerMaxRevenue && dealRevenue >= buyerMinRevenue && dealRevenue <= buyerMaxRevenue) {
      score = 80;
      multiplier = 1.0;
      reasoning = `Revenue $${(dealRevenue/1e6).toFixed(1)}M — within buyer range ($${(buyerMinRevenue/1e6).toFixed(1)}M-$${(buyerMaxRevenue/1e6).toFixed(1)}M)`;
    }
    // 1-10% below minimum
    else if (buyerMinRevenue && dealRevenue < buyerMinRevenue && dealRevenue >= buyerMinRevenue * 0.9) {
      const percentBelow = Math.round(((buyerMinRevenue - dealRevenue) / buyerMinRevenue) * 100);
      score = 62;
      multiplier = 0.7;
      reasoning = `Revenue ${percentBelow}% below minimum — slight undersize`;
    }
    // 10-30% below minimum
    else if (buyerMinRevenue && dealRevenue < buyerMinRevenue * 0.9 && dealRevenue >= buyerMinRevenue * 0.7) {
      const percentBelow = Math.round(((buyerMinRevenue - dealRevenue) / buyerMinRevenue) * 100);
      score = 45;
      multiplier = 0.5;
      reasoning = `Revenue ${percentBelow}% below minimum — undersized`;
    }
    // >30% below minimum
    else if (buyerMinRevenue && dealRevenue < buyerMinRevenue * 0.7) {
      const percentBelow = Math.round(((buyerMinRevenue - dealRevenue) / buyerMinRevenue) * 100);
      if (behavior.below_minimum_handling === 'disqualify') {
        score = 0;
        multiplier = 0.0;
        reasoning = `DISQUALIFIED: Revenue ${percentBelow}% below minimum — hard disqualify`;
      } else if (behavior.below_minimum_handling === 'penalize') {
        score = 15;
        multiplier = 0.3;
        reasoning = `Revenue ${percentBelow}% below minimum — heavy penalty`;
      } else {
        score = 30;
        multiplier = 0.5;
        reasoning = `Revenue ${percentBelow}% below minimum — allowed with penalty`;
      }
    }
    // >50% above maximum
    else if (buyerMaxRevenue && dealRevenue > buyerMaxRevenue * 1.5) {
      score = 0;
      multiplier = 0.0;
      reasoning = `DISQUALIFIED: Revenue $${(dealRevenue/1e6).toFixed(1)}M — way above buyer max ($${(buyerMaxRevenue/1e6).toFixed(1)}M)`;
    }
    // Above maximum but within 50%
    else if (buyerMaxRevenue && dealRevenue > buyerMaxRevenue) {
      const percentAbove = Math.round(((dealRevenue - buyerMaxRevenue) / buyerMaxRevenue) * 100);
      score = 50;
      multiplier = 0.7;
      reasoning = `Revenue ${percentAbove}% above max — oversized`;
    }
    // Only has min, deal is above it
    else if (buyerMinRevenue && !buyerMaxRevenue && dealRevenue >= buyerMinRevenue) {
      score = 80;
      multiplier = 1.0;
      reasoning = `Revenue $${(dealRevenue/1e6).toFixed(1)}M — above buyer minimum`;
    }
    // Only has max, deal is below it
    else if (!buyerMinRevenue && buyerMaxRevenue && dealRevenue <= buyerMaxRevenue) {
      score = 75;
      multiplier = 1.0;
      reasoning = `Revenue $${(dealRevenue/1e6).toFixed(1)}M — within buyer max`;
    }
  }

  // === EBITDA-based scoring (sweet spot, supplement, or fallback) ===
  if (dealEbitda != null && dealEbitda <= 0) {
    // Negative or zero EBITDA — note in reasoning but don't use for size scoring
    reasoning += `. Note: EBITDA is ${dealEbitda <= 0 ? 'negative' : 'zero'} ($${(dealEbitda/1e6).toFixed(1)}M) — excluded from size scoring`;
  }
  if (dealEbitda != null && dealEbitda > 0) {
    // EBITDA sweet spot match (boost if revenue didn't already match)
    if (ebitdaSweetSpot && score < 90) {
      if (Math.abs(dealEbitda - ebitdaSweetSpot) / ebitdaSweetSpot <= 0.1) {
        score = Math.max(score, 95);
        multiplier = Math.max(multiplier, 1.0);
        reasoning += `. EBITDA $${(dealEbitda/1e6).toFixed(1)}M — exact EBITDA sweet spot`;
      } else if (Math.abs(dealEbitda - ebitdaSweetSpot) / ebitdaSweetSpot <= 0.2) {
        score = Math.max(score, 88);
        multiplier = Math.max(multiplier, 0.95);
        reasoning += `. EBITDA $${(dealEbitda/1e6).toFixed(1)}M — near EBITDA sweet spot`;
      }
    }
    // EBITDA below minimum — penalize
    if (buyerMinEbitda) {
      if (dealEbitda < buyerMinEbitda * 0.5) {
        if (score > 20) {
          score = 20;
          multiplier = Math.min(multiplier, 0.25);
          reasoning += `. EBITDA $${(dealEbitda/1e6).toFixed(1)}M — far below buyer min ($${(buyerMinEbitda/1e6).toFixed(1)}M)`;
        }
      } else if (dealEbitda < buyerMinEbitda) {
        if (score > 40) {
          score = Math.min(score, 40);
          multiplier = Math.min(multiplier, 0.6);
          reasoning += `. EBITDA below buyer minimum`;
        }
      }
    }
  }

  // === Single-location penalty ===
  if (behavior.penalize_single_location) {
    const locationCount = listing.location_count || 1;
    if (locationCount === 1) {
      score = Math.round(score * 0.85);
      reasoning += ". Single-location penalty applied";
    }
  }

  return { score: Math.max(0, Math.min(100, score)), multiplier, reasoning };
}

// ============================================================================
// PHASE 3: GEOGRAPHY SCORING (Deterministic + Adjacency Intelligence)
// ============================================================================

async function calculateGeographyScore(
  listing: any,
  buyer: any,
  tracker: any,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ score: number; modeFactor: number; reasoning: string; tier: string }> {
  // Determine geography mode from tracker (defaults to 'critical')
  const geographyMode: string = tracker?.geography_mode || 'critical';

  // Determine mode factor and floor
  let modeFactor = 1.0;
  let scoreFloor = 0;
  switch (geographyMode) {
    case 'preferred':
      modeFactor = 0.6;
      scoreFloor = 30;
      break;
    case 'minimal':
      modeFactor = 0.25;
      scoreFloor = 50;
      break;
    default: // critical
      modeFactor = 1.0;
      scoreFloor = 0;
  }

  // Extract deal state — try regex first, then normalizeStateCode fallback
  const dealLocation = listing.location || "";
  let dealState = dealLocation.match(/,\s*([A-Z]{2})\s*$/i)?.[1]?.toUpperCase() || null;
  if (!dealState) {
    // Fallback: try to extract state from "City, State Name" or "City, ST ZIP" patterns
    const stateMatch = dealLocation.match(/,\s*([A-Za-z\s]+?)(?:\s+\d{5})?$/);
    if (stateMatch) {
      dealState = normalizeStateCode(stateMatch[1].trim());
    }
  }

  // Get buyer geographic data (priority order per spec)
  let buyerStates: string[] = [];

  // Helper: normalize a state entry to a 2-letter code (handles full names like "Georgia" → "GA")
  const normalizeEntry = (s: string): string | null => {
    const trimmed = s.trim().toUpperCase();
    // Already a 2-letter code
    if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
    // Try normalizing full state name to code
    return normalizeStateCode(s);
  };

  // 1. target_geographies (strongest signal)
  const targetGeos = (buyer.target_geographies || []).filter(Boolean)
    .map((s: string) => normalizeEntry(s)).filter((s: string | null): s is string => s !== null);
  if (targetGeos.length > 0) {
    buyerStates = targetGeos;
  }
  // 2. geographic_footprint (fallback)
  else {
    const footprint = (buyer.geographic_footprint || []).filter(Boolean)
      .map((s: string) => normalizeEntry(s)).filter((s: string | null): s is string => s !== null);
    if (footprint.length > 0) {
      buyerStates = footprint;
    }
    // 3. HQ state (weakest signal)
    else if (buyer.hq_state) {
      const normalized = normalizeEntry(buyer.hq_state);
      if (normalized) buyerStates = [normalized];
    }
  }

  // Check hard disqualifiers FIRST
  // 1. Deal state in buyer's explicit geographic_exclusions
  const geoExclusions = (buyer.geographic_exclusions || []).map((s: string) => s?.toUpperCase().trim()).filter(Boolean);
  if (dealState && geoExclusions.includes(dealState)) {
    return {
      score: 0,
      modeFactor,
      reasoning: `DISQUALIFIED: Deal state ${dealState} in buyer's geographic exclusions`,
      tier: 'distant'
    };
  }

  // 2. Hard thesis geographic constraint
  const thesisGeoResult = parseThesisGeographicConstraint(buyer.thesis_summary, dealState);
  if (thesisGeoResult.hardDisqualify) {
    return {
      score: 0,
      modeFactor,
      reasoning: `DISQUALIFIED: ${thesisGeoResult.reasoning}`,
      tier: 'distant'
    };
  }

  // No deal state or no buyer states — limited data
  if (!dealState || buyerStates.length === 0) {
    const limitedScore = Math.max(scoreFloor, 50);
    return {
      score: limitedScore,
      modeFactor,
      reasoning: "Limited geography data available",
      tier: 'regional'
    };
  }

  // Calculate proximity using adjacency intelligence
  const { score: baseScore, reasoning: baseReasoning } = await calculateProximityScore(
    dealState,
    buyerStates,
    supabaseUrl,
    supabaseKey
  );

  const tier = await getProximityTier(dealState, buyerStates, supabaseUrl, supabaseKey);

  // Apply score floor from geography mode
  const finalScore = Math.max(scoreFloor, baseScore);

  const modeNote = geographyMode !== 'critical' ? ` [${geographyMode} mode, floor=${scoreFloor}]` : '';

  return {
    score: finalScore,
    modeFactor,
    reasoning: `${baseReasoning}${modeNote}`,
    tier
  };
}

// Parse thesis_summary for geographic focus patterns
function parseThesisGeographicConstraint(
  thesis: string | null | undefined,
  dealState: string | null | undefined
): { hardDisqualify: boolean; reasoning: string } {
  if (!thesis || !dealState) return { hardDisqualify: false, reasoning: '' };

  const thesisLower = thesis.toLowerCase();

  // Regional patterns
  const regionPatterns: Array<{ pattern: RegExp; states: string[] }> = [
    { pattern: /pacific\s+northwest/i, states: ['WA', 'OR', 'ID'] },
    { pattern: /southeast\b/i, states: ['FL', 'GA', 'AL', 'MS', 'SC', 'NC', 'TN', 'VA', 'LA', 'AR'] },
    { pattern: /sun\s*belt/i, states: ['FL', 'GA', 'TX', 'AZ', 'NV', 'CA', 'SC', 'NC', 'TN'] },
    { pattern: /midwest/i, states: ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'] },
    { pattern: /northeast/i, states: ['NY', 'NJ', 'PA', 'CT', 'MA', 'RI', 'VT', 'NH', 'ME'] },
    { pattern: /southwest/i, states: ['TX', 'OK', 'NM', 'AZ'] },
    { pattern: /mid[\s-]?atlantic/i, states: ['MD', 'DE', 'DC', 'VA', 'WV', 'NJ', 'PA'] },
  ];

  // Hard constraint language
  // Only truly exclusive language triggers hard disqualification ("focused on" is too broad)
  const hardPatterns = [/\bonly\s+in\b/i, /\bexclusively\b/i, /\blimited\s+to\b/i];

  for (const { pattern, states } of regionPatterns) {
    if (pattern.test(thesisLower)) {
      const isHard = hardPatterns.some(hp => hp.test(thesisLower));
      if (isHard && !states.includes(dealState)) {
        return {
          hardDisqualify: true,
          reasoning: `Buyer thesis has hard geographic constraint ("${thesisLower.match(pattern)?.[0]}") and deal state ${dealState} is outside`
        };
      }
    }
  }

  return { hardDisqualify: false, reasoning: '' };
}

// ============================================================================
// PHASE 4: SERVICE SCORING + SERVICE GATE
// ============================================================================

async function calculateServiceScore(
  listing: any,
  buyer: any,
  tracker: any,
  behavior: ScoringBehavior,
  serviceCriteria: ServiceCriteria | null,
  apiKey: string,
  customInstructions?: string
): Promise<{ score: number; multiplier: number; reasoning: string }> {
  const dealServices = (listing.services || listing.categories || [listing.category])
    .filter(Boolean).map((s: string) => s?.toLowerCase().trim());

  const buyerTargetServices = (buyer.target_services || [])
    .filter(Boolean).map((s: string) => s?.toLowerCase().trim());

  const buyerServicesOffered = (buyer.services_offered || '')
    .toLowerCase().split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);

  const buyerTargetIndustries = (buyer.target_industries || [])
    .filter(Boolean).map((s: string) => s?.toLowerCase().trim());

  const buyerSpecializedFocus = (buyer.specialized_focus || '')
    .toLowerCase().split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);

  // Combine buyer services for matching (include industries and focus as signals)
  const allBuyerServices = [...new Set([...buyerTargetServices, ...buyerServicesOffered, ...buyerTargetIndustries, ...buyerSpecializedFocus])];

  // STEP 1: Check hard disqualifiers
  const excludedServices = [
    ...(serviceCriteria?.excluded_services || []),
    ...(buyer.industry_exclusions || [])
  ].map(s => s?.toLowerCase().trim()).filter(Boolean);

  const dealPrimaryService = dealServices[0] || '';
  for (const excluded of excludedServices) {
    if (dealPrimaryService && (dealPrimaryService.includes(excluded) || excluded.includes(dealPrimaryService))) {
      return {
        score: 0,
        multiplier: 0.0,
        reasoning: `DISQUALIFIED: Deal primary service "${dealPrimaryService}" matches excluded service "${excluded}"`
      };
    }
  }

  // STEP 2: Try AI-powered semantic matching (primary path)
  let aiScore: { score: number; reasoning: string } | null = null;
  if (behavior.service_matching_mode !== 'keyword') {
    try {
      aiScore = await callServiceFitAI(listing, buyer, tracker, apiKey, customInstructions);
    } catch (e) {
      console.warn("Service fit AI call failed, falling back to keyword+adjacency:", e);
    }
  }

  let score: number;
  let reasoning: string;

  if (aiScore) {
    score = aiScore.score;
    reasoning = aiScore.reasoning;
  } else {
    // STEP 3: Keyword + adjacency fallback
    const { percentage, matchingServices } = calculateServiceOverlap(listing, buyer);

    if (percentage >= 80) {
      score = 90;
      reasoning = `Strong service alignment (${percentage}% overlap): ${matchingServices.join(', ')}`;
    } else if (percentage >= 50) {
      score = 75;
      reasoning = `Good service alignment (${percentage}% overlap): ${matchingServices.join(', ')}`;
    } else if (percentage >= 25) {
      score = 55;
      reasoning = `Partial service alignment (${percentage}% overlap): ${matchingServices.join(', ')}`;
    } else if (percentage > 0) {
      score = 40;
      reasoning = `Weak service alignment (${percentage}% overlap)`;
    } else {
      // 0% keyword overlap — check adjacency map
      const adjacencyMap = tracker?.service_adjacency_map || DEFAULT_SERVICE_ADJACENCY;
      const adjacencyResult = checkServiceAdjacency(dealServices, allBuyerServices, adjacencyMap);

      if (adjacencyResult.hasAdjacency) {
        score = 45;
        reasoning = `Adjacent service match: ${adjacencyResult.matches.join(', ')}`;
      } else {
        score = 22;
        reasoning = `No service overlap or adjacency detected`;
      }
    }
  }

  // STEP 4: Primary focus bonus
  const trackerPrimaryFocus = tracker?.service_criteria?.required_services?.[0]?.toLowerCase();
  if (trackerPrimaryFocus && dealPrimaryService.includes(trackerPrimaryFocus)) {
    score = Math.min(100, score + 10);
    reasoning += ". +10pt primary focus match";
  } else if (buyerTargetServices.length > 0 && dealPrimaryService) {
    const matchesBuyerTarget = buyerTargetServices.some((bs: string) =>
      dealPrimaryService.includes(bs) || bs.includes(dealPrimaryService)
    );
    if (matchesBuyerTarget) {
      score = Math.min(100, score + 5);
      reasoning += ". +5pt buyer target match";
    }
  }

  // Calculate service multiplier from score
  const multiplier = getServiceMultiplier(score);

  return { score, multiplier, reasoning };
}

function getServiceMultiplier(serviceScore: number): number {
  if (serviceScore === 0) return 0.0;
  if (serviceScore <= 20) return 0.15;
  if (serviceScore <= 40) return 0.4;
  if (serviceScore <= 60) return 0.7;
  if (serviceScore <= 80) return 0.9;
  return 1.0;
}

function checkServiceAdjacency(
  dealServices: string[],
  buyerServices: string[],
  adjacencyMap: Record<string, string[]>
): { hasAdjacency: boolean; matches: string[] } {
  const matches: string[] = [];

  for (const ds of dealServices) {
    if (!ds) continue;
    // Check if deal service appears as adjacency for any buyer service
    for (const bs of buyerServices) {
      if (!bs) continue;
      const adjacent = adjacencyMap[bs] || [];
      if (adjacent.some(adj => ds.includes(adj) || adj.includes(ds))) {
        matches.push(`${ds} ↔ ${bs}`);
      }
    }
    // Also check if buyer service appears as adjacency for deal service
    const dealAdjacent = adjacencyMap[ds] || [];
    for (const bs of buyerServices) {
      if (!bs) continue;
      if (dealAdjacent.some(adj => bs.includes(adj) || adj.includes(bs))) {
        if (!matches.some(m => m.includes(ds) && m.includes(bs))) {
          matches.push(`${ds} ↔ ${bs}`);
        }
      }
    }
  }

  return { hasAdjacency: matches.length > 0, matches: matches.slice(0, 3) };
}

async function callServiceFitAI(
  listing: any,
  buyer: any,
  tracker: any,
  apiKey: string,
  customInstructions?: string
): Promise<{ score: number; reasoning: string }> {
  const dealServices = (listing.services || listing.categories || [listing.category]).filter(Boolean).join(', ');
  const buyerServices = (buyer.target_services || []).filter(Boolean).join(', ');
  const buyerOffered = buyer.services_offered || '';
  const buyerIndustries = (buyer.target_industries || []).filter(Boolean).join(', ');
  const buyerFocus = buyer.specialized_focus || '';
  const buyerCompanyName = buyer.company_name || buyer.pe_firm_name || '';
  const buyerWebsite = buyer.company_website || '';
  const universeIndustry = tracker?.industry || tracker?.name || '';

  const customContext = customInstructions ? `\nADDITIONAL SCORING INSTRUCTIONS: ${customInstructions}` : '';
  const prompt = `Score 0-100 how well these services align:
DEAL SERVICES: ${dealServices}
DEAL INDUSTRY: ${listing.category || 'Unknown'}
BUYER COMPANY: ${buyerCompanyName}
BUYER WEBSITE: ${buyerWebsite}
BUYER TARGET SERVICES: ${buyerServices || 'Not specified'}
BUYER CURRENT SERVICES: ${buyerOffered || 'Not specified'}
BUYER TARGET INDUSTRIES: ${buyerIndustries || 'Not specified'}
BUYER SPECIALIZED FOCUS: ${buyerFocus || 'Not specified'}
BUYER THESIS: ${(buyer.thesis_summary || '').substring(0, 200)}
UNIVERSE INDUSTRY CONTEXT: ${universeIndustry || 'Not specified'}${customContext}

IMPORTANT: If buyer services are "Not specified" but the buyer company name or website suggests they operate in the same industry as the deal, score 55-70 (inferred match). Only score 20-40 if company name/website clearly suggest a different industry. Do NOT default to 50 for all unknown cases — use company name and context to differentiate.
Score guide: 85-100 = exact match, 60-84 = strong overlap, 40-59 = partial/adjacent, 20-39 = weak adjacency, 0-19 = unrelated.
Return JSON: {"score": number, "reasoning": "one sentence"}`;

  const response = await fetchWithRetry(GEMINI_API_URL, {
    method: "POST",
    headers: getGeminiHeaders(apiKey),
    body: JSON.stringify({
      model: DEFAULT_GEMINI_MODEL,
      messages: [
        { role: "system", content: "You are an M&A service alignment scorer. Return ONLY valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`Service AI failed: ${response.status}`);
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in service AI response");
  const parsed = JSON.parse(content);
  return { score: Math.max(0, Math.min(100, parsed.score || 50)), reasoning: parsed.reasoning || '' };
}

// Service overlap (keyword matching)
function calculateServiceOverlap(
  listing: any,
  buyer: any
): { percentage: number; matchingServices: string[]; allDealServices: string[] } {
  const dealServices = (listing.services || listing.categories || [listing.category])
    .filter(Boolean).map((s: string) => s?.toLowerCase().trim());

  // Include target_industries and specialized_focus as additional buyer service signals
  const buyerServices = [
    ...(buyer.target_services || []),
    ...(buyer.target_industries || []),
    ...(buyer.services_offered || '').split(/[,;]/).filter(Boolean),
    ...(buyer.specialized_focus || '').split(/[,;]/).filter(Boolean),
  ].map((s: string) => s?.toLowerCase().trim()).filter(Boolean);

  if (buyerServices.length === 0 || dealServices.length === 0) {
    return { percentage: 0, matchingServices: [], allDealServices: dealServices };
  }

  // Tokenize for word-level matching (e.g., "fire restoration" matches "restoration")
  const tokenize = (s: string) => s.split(/[\s\-\/&]+/).filter(w => w.length > 2);

  const matching = dealServices.filter((ds: string) =>
    buyerServices.some((bs: string) => {
      // Direct substring match
      if (ds?.includes(bs) || bs?.includes(ds)) return true;
      // Word-level match: any significant word overlap
      const dealTokens = tokenize(ds || '');
      const buyerTokens = tokenize(bs || '');
      return dealTokens.some(dt => buyerTokens.some(bt => dt === bt || dt.includes(bt) || bt.includes(dt)));
    })
  );

  // Use deal services as denominator so data-rich buyers aren't penalized
  const denominator = Math.max(dealServices.length, 1);
  const percentage = Math.round((matching.length / denominator) * 100);
  return { percentage, matchingServices: matching, allDealServices: dealServices };
}

// ============================================================================
// PHASE 5: OWNER GOALS SCORING (AI-powered with fallback)
// ============================================================================

async function calculateOwnerGoalsScore(
  listing: any,
  buyer: any,
  apiKey: string,
  customInstructions?: string
): Promise<{ score: number; confidence: string; reasoning: string }> {
  // Try AI scoring first
  try {
    return await callOwnerGoalsFitAI(listing, buyer, apiKey, customInstructions);
  } catch (e) {
    console.warn("Owner goals AI call failed, using fallback:", e);
  }

  // Fallback: buyer-type norms lookup
  return ownerGoalsFallback(listing, buyer);
}

async function callOwnerGoalsFitAI(
  listing: any,
  buyer: any,
  apiKey: string,
  customInstructions?: string
): Promise<{ score: number; confidence: string; reasoning: string }> {
  const customContext = customInstructions ? `\nADDITIONAL SCORING INSTRUCTIONS: ${customInstructions}` : '';
  const prompt = `Score 0-100 how well this buyer aligns with what the seller wants:

DEAL:
- Owner Goals: ${listing.owner_goals || listing.seller_motivation || 'Not specified'}
- Transition Preferences: ${listing.transition_preferences || listing.timeline_preference || 'Not specified'}
- Special Requirements: ${listing.special_requirements || 'None'}
- Ownership Structure: ${listing.ownership_structure || 'Unknown'}

BUYER:
- Type: ${buyer.buyer_type || 'Unknown'}
- Thesis: ${(buyer.thesis_summary || '').substring(0, 300)}
- Deal Preferences: ${buyer.deal_preferences || 'Not specified'}
- Buyer Type Norms: PE=majority recap+rollover+1-2yr transition, Platform=operators stay, Strategic=full buyout, Family Office=flexible${customContext}

If buyer data is sparse, score based on buyer TYPE norms vs seller goals.
Conflicts (exit timing, structure mismatch) pull score down 25-35.
Alignment (growth partner+PE platform, stay on+platform wants operators) push score up 75-90.
If cannot evaluate, score 50 with confidence low.

Return JSON: {"score": number, "confidence": "high"|"medium"|"low", "reasoning": "one sentence"}`;

  const response = await fetchWithRetry(GEMINI_API_URL, {
    method: "POST",
    headers: getGeminiHeaders(apiKey),
    body: JSON.stringify({
      model: DEFAULT_GEMINI_MODEL,
      messages: [
        { role: "system", content: "You are an M&A owner-goals alignment scorer. Return ONLY valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`Owner goals AI failed: ${response.status}`);
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content");
  const parsed = JSON.parse(content);
  return {
    score: Math.max(0, Math.min(100, parsed.score || 50)),
    confidence: parsed.confidence || 'low',
    reasoning: parsed.reasoning || ''
  };
}

function ownerGoalsFallback(listing: any, buyer: any): { score: number; confidence: string; reasoning: string } {
  const ownerGoals = (listing.owner_goals || listing.seller_motivation || '').toLowerCase();
  const buyerType = (buyer.buyer_type || '').toLowerCase();
  const thesis = (buyer.thesis_summary || '').toLowerCase();
  const dealPrefs = (buyer.deal_preferences || '').toLowerCase();

  // Buyer-type norms lookup table
  const norms: Record<string, Record<string, number>> = {
    'pe_firm': { base: 55, cash_exit: 40, growth_partner: 75, quick_exit: 50, stay_long: 60, retain_employees: 65, keep_autonomy: 50 },
    'platform': { base: 65, cash_exit: 50, growth_partner: 80, quick_exit: 40, stay_long: 85, retain_employees: 75, keep_autonomy: 60 },
    'strategic': { base: 50, cash_exit: 70, growth_partner: 50, quick_exit: 65, stay_long: 45, retain_employees: 45, keep_autonomy: 30 },
    'family_office': { base: 60, cash_exit: 60, growth_partner: 65, quick_exit: 55, stay_long: 70, retain_employees: 70, keep_autonomy: 80 },
    'independent_sponsor': { base: 58, cash_exit: 55, growth_partner: 70, quick_exit: 60, stay_long: 55, retain_employees: 60, keep_autonomy: 55 },
  };

  const typeNorms = norms[buyerType] || norms['platform'];

  if (!ownerGoals) {
    // No owner goals — differentiate by buyer type and data richness
    let score = typeNorms.base;
    // Buyers with explicit deal preferences or thesis get a slight edge (more data = more signal)
    if (thesis.length > 50) score += 5;
    if (dealPrefs.length > 10) score += 3;
    // Check deal_breakers for any red flags
    const dealBreakers = buyer.deal_breakers || [];
    if (dealBreakers.length > 0) score -= 5;
    return { score: Math.max(30, Math.min(85, score)), confidence: 'low', reasoning: `No owner goals — ${buyerType || 'unknown'} type base score` };
  }

  // Match owner goals to categories using word-boundary-safe checks
  let score = typeNorms.base;
  let matchedCategory = '';
  if (ownerGoals.includes('cash') && ownerGoals.includes('exit')) { score = typeNorms.cash_exit; matchedCategory = 'cash exit'; }
  else if (ownerGoals.includes('growth') || ownerGoals.includes('partner') || ownerGoals.includes('rollover')) { score = typeNorms.growth_partner; matchedCategory = 'growth/partner'; }
  else if (ownerGoals.includes('quick') || ownerGoals.includes('fast') || ownerGoals.includes('30 day') || ownerGoals.includes('60 day')) { score = typeNorms.quick_exit; matchedCategory = 'quick exit'; }
  else if (/\bstay\b/.test(ownerGoals) || /\bcontinue\b/.test(ownerGoals) || /\blong[\s-]?term\b/.test(ownerGoals)) { score = typeNorms.stay_long; matchedCategory = 'stay/continue'; }
  else if (/\bemployee/.test(ownerGoals) || /\bretain\b/.test(ownerGoals) || /\bteam\b/.test(ownerGoals)) { score = typeNorms.retain_employees; matchedCategory = 'retain employees'; }
  else if (/\bautonom/.test(ownerGoals) || /\bindependen/.test(ownerGoals)) { score = typeNorms.keep_autonomy; matchedCategory = 'autonomy'; }

  // Check special_requirements for deal-breaker conflicts
  const specialReqs = (listing.special_requirements || '').toLowerCase();
  if (specialReqs) {
    if (specialReqs.includes('no pe') && buyerType === 'pe_firm') score = Math.max(0, score - 25);
    else if (specialReqs.includes('no strategic') && buyerType === 'strategic') score = Math.max(0, score - 25);
    else if (specialReqs.includes('no family office') && buyerType === 'family_office') score = Math.max(0, score - 25);
  }

  // Bonus/penalty from buyer-specific data
  if (thesis) {
    const goalKeywords = ownerGoals.split(/\s+/).filter(w => w.length > 3);
    const thesisAligns = goalKeywords.some(gw => thesis.includes(gw));
    if (thesisAligns) score = Math.min(100, score + 8);
  }

  // Confidence is 'medium' when we matched a specific keyword category, 'low' when using base only
  const confidence = matchedCategory ? 'medium' : 'low';

  return {
    score: Math.max(0, Math.min(100, score)),
    confidence,
    reasoning: matchedCategory
      ? `Fallback: ${buyerType || 'unknown'} norms for "${matchedCategory}" goals`
      : `Fallback: ${buyerType || 'unknown'} buyer type base score`
  };
}

// ============================================================================
// PHASE 6: THESIS ALIGNMENT BONUS (AI-scored) + DATA QUALITY BONUS
// ============================================================================

async function calculateThesisAlignmentBonus(
  listing: any,
  buyer: any,
  apiKey: string
): Promise<{ bonus: number; reasoning: string }> {
  const thesis = buyer.thesis_summary || '';
  if (thesis.length <= 30) {
    return { bonus: 0, reasoning: '' };
  }

  try {
    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_KEY) {
      // Fall back to pattern matching if no Anthropic key
      return calculateThesisBonusFallback(listing, buyer);
    }

    const tool = {
      type: "function",
      function: {
        name: "score_thesis_alignment",
        description: "Score thesis-deal alignment 0-20",
        parameters: {
          type: "object",
          properties: {
            score: { type: "number", description: "0-20 alignment score" },
            reasoning: { type: "string", description: "Brief explanation" }
          },
          required: ["score", "reasoning"]
        }
      }
    };

    const systemPrompt = "Score 0-20 how well this deal matches the buyer's thesis. ONLY score based on explicit thesis statements. 16-20=exact match, 11-15=strong, 6-10=partial, 1-5=minimal, 0=none.";
    const userPrompt = `THESIS: ${thesis.substring(0, 500)}
BUYER TARGETS: ${(buyer.target_services || []).join(', ')}
DEAL: ${listing.title}, Services: ${(listing.services || []).join(', ')}, Location: ${listing.location}, Revenue: ${listing.revenue ? `$${listing.revenue.toLocaleString()}` : 'Unknown'}`;

    const result = await callClaudeWithTool(systemPrompt, userPrompt, tool, ANTHROPIC_KEY, DEFAULT_CLAUDE_FAST_MODEL, 10000, 500);
    if (result.data) {
      return {
        bonus: Math.max(0, Math.min(20, result.data.score || 0)),
        reasoning: result.data.reasoning || ''
      };
    }
  } catch (e) {
    console.warn("Thesis alignment AI call failed:", e);
  }

  // Fallback to pattern matching
  return calculateThesisBonusFallback(listing, buyer);
}

function calculateThesisBonusFallback(listing: any, buyer: any): { bonus: number; reasoning: string } {
  const thesis = (buyer.thesis_summary || '').toLowerCase();
  if (!thesis || thesis.length < 10) return { bonus: 0, reasoning: '' };

  const dealText = [
    listing.description || '',
    listing.executive_summary || '',
    (listing.services || []).join(' ')
  ].join(' ').toLowerCase();

  let points = 0;
  const matches: string[] = [];

  const patterns = [
    { pattern: /roll[\s-]?up/i, value: 3, label: 'roll-up' },
    { pattern: /platform/i, value: 3, label: 'platform' },
    { pattern: /add[\s-]?on|bolt[\s-]?on/i, value: 3, label: 'add-on' },
    { pattern: /recurring\s+revenue|subscription/i, value: 2, label: 'recurring revenue' },
    { pattern: /multi[\s-]?location/i, value: 2, label: 'multi-location' },
    { pattern: /restoration|collision|hvac|plumbing/i, value: 2, label: 'industry match' },
  ];

  for (const { pattern, value, label } of patterns) {
    if (pattern.test(thesis) && pattern.test(dealText)) {
      points += value;
      matches.push(label);
    }
  }

  return {
    bonus: Math.min(20, points),
    reasoning: matches.length > 0 ? `Thesis patterns: ${matches.join(', ')}` : ''
  };
}

function calculateDataQualityBonus(buyer: any): { bonus: number; details: string[] } {
  let bonus = 0;
  const details: string[] = [];

  if (buyer.thesis_summary && buyer.thesis_summary.length > 50) {
    bonus += 3;
    details.push('+3 thesis');
  }
  if (buyer.target_services && buyer.target_services.length > 0) {
    bonus += 2;
    details.push('+2 target_services');
  }
  if (buyer.target_geographies && buyer.target_geographies.length > 0) {
    bonus += 2;
    details.push('+2 target_geographies');
  }
  if (buyer.target_revenue_min || buyer.target_revenue_max) {
    bonus += 2;
    details.push('+2 revenue_range');
  }
  if (buyer.key_quotes && buyer.key_quotes.length > 0) {
    bonus += 1;
    details.push('+1 key_quotes');
  }

  return { bonus: Math.min(10, bonus), details };
}

// ============================================================================
// PHASE 7: LEARNING PATTERNS
// ============================================================================

async function fetchLearningPatterns(supabase: any, buyerIds: string[]): Promise<Map<string, LearningPattern>> {
  const patterns = new Map<string, LearningPattern>();
  if (buyerIds.length === 0) return patterns;

  const { data: history, error } = await supabase
    .from("buyer_learning_history")
    .select("buyer_id, action, composite_score, pass_category")
    .in("buyer_id", buyerIds);

  if (error || !history) return patterns;

  const buyerHistory = new Map<string, any[]>();
  for (const record of history) {
    if (!buyerHistory.has(record.buyer_id)) {
      buyerHistory.set(record.buyer_id, []);
    }
    buyerHistory.get(record.buyer_id)!.push(record);
  }

  for (const [buyerId, records] of buyerHistory) {
    const approved = records.filter((r: any) => r.action === 'approved');
    const passed = records.filter((r: any) => r.action === 'passed' || r.action === 'not_a_fit');

    const passCategories: Record<string, number> = {};
    for (const p of passed) {
      if (p.pass_category) {
        passCategories[p.pass_category] = (passCategories[p.pass_category] || 0) + 1;
      }
    }

    patterns.set(buyerId, {
      buyer_id: buyerId,
      approvalRate: records.length > 0 ? approved.length / records.length : 0,
      avgScoreOnApproved: approved.length > 0
        ? approved.reduce((sum: number, r: any) => sum + (r.composite_score || 0), 0) / approved.length
        : 0,
      avgScoreOnPassed: passed.length > 0
        ? passed.reduce((sum: number, r: any) => sum + (r.composite_score || 0), 0) / passed.length
        : 0,
      totalActions: records.length,
      passCategories,
    });
  }

  return patterns;
}

function calculateLearningPenalty(pattern: LearningPattern | undefined): { penalty: number; note: string } {
  if (!pattern || pattern.totalActions < 3) return { penalty: 0, note: '' };

  let penalty = 0;
  const notes: string[] = [];

  // Size rejections
  if ((pattern.passCategories['size'] || 0) >= 2) {
    penalty += 10;
    notes.push('-10 size rejection pattern');
  }
  // Geography rejections
  if ((pattern.passCategories['geography'] || 0) >= 2) {
    penalty += 8;
    notes.push('-8 geography rejection pattern');
  }
  // Service rejections
  if ((pattern.passCategories['services'] || 0) >= 2) {
    penalty += 8;
    notes.push('-8 service rejection pattern');
  }
  // Timing rejections
  if ((pattern.passCategories['timing'] || 0) >= 3) {
    penalty += 5;
    notes.push('-5 timing rejection pattern');
  }
  // Portfolio conflicts
  if ((pattern.passCategories['portfolio_conflict'] || 0) >= 1) {
    penalty += 3;
    notes.push('-3 portfolio conflict');
  }

  // Positive learning boost
  if (pattern.approvalRate >= 0.7 && pattern.totalActions >= 3) {
    penalty -= 5; // Reduce penalty (net boost)
    notes.push('+5 high approval rate');
  } else if (pattern.approvalRate < 0.3 && pattern.totalActions >= 3) {
    penalty += 3;
    notes.push('-3 low approval pattern');
  }

  return {
    penalty: Math.max(-5, Math.min(25, penalty)), // Cap -5 to 25
    note: notes.join('; ')
  };
}

// ============================================================================
// DATA COMPLETENESS & MISSING FIELDS
// ============================================================================

function assessDataCompleteness(buyer: any): { level: string; missingFields: string[] } {
  const missing: string[] = [];

  if (!buyer.thesis_summary || buyer.thesis_summary.length < 20) missing.push('Investment thesis');
  if (!buyer.target_services || buyer.target_services.length === 0) missing.push('Target services');
  if (!buyer.target_geographies || buyer.target_geographies.length === 0) missing.push('Target geographies');
  if (!buyer.target_revenue_min && !buyer.target_revenue_max) missing.push('Target revenue range');
  if (!buyer.target_ebitda_min && !buyer.target_ebitda_max) missing.push('Target EBITDA range');
  if (!buyer.key_quotes || buyer.key_quotes.length === 0) missing.push('Key quotes');
  if (!buyer.hq_state && !buyer.hq_city) missing.push('HQ location');
  if (!buyer.buyer_type) missing.push('Buyer type');

  let level: string;
  const hasThesis = buyer.thesis_summary && buyer.thesis_summary.length > 50;
  const hasTargets = buyer.target_geographies?.length > 0 || buyer.target_services?.length > 0;
  const hasFinancials = buyer.target_revenue_min || buyer.target_ebitda_min;
  const hasAcquisitions = buyer.recent_acquisitions?.length > 0;
  const hasPortfolio = buyer.portfolio_companies?.length > 0;

  if (hasThesis && hasTargets && hasFinancials && (hasAcquisitions || hasPortfolio)) {
    level = 'high';
  } else if (hasThesis || (hasTargets && hasFinancials)) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return { level, missingFields: missing };
}

// ============================================================================
// FETCH SCORING ADJUSTMENTS
// ============================================================================

async function fetchScoringAdjustments(supabase: any, listingId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("deal_scoring_adjustments")
    .select("*")
    .eq("listing_id", listingId);

  if (error) {
    console.warn("Failed to fetch scoring adjustments:", error);
    return [];
  }
  return data || [];
}

function applyCustomInstructionBonus(adjustments: any[]): { bonus: number; reasoning: string; disqualify?: boolean } {
  let bonus = 0;
  const reasons: string[] = [];
  let disqualify = false;

  for (const adj of adjustments) {
    if (adj.adjustment_type === 'boost') {
      bonus += adj.adjustment_value;
      reasons.push(`+${adj.adjustment_value} (${adj.reason || 'boost'})`);
    } else if (adj.adjustment_type === 'penalize') {
      bonus -= adj.adjustment_value;
      reasons.push(`-${adj.adjustment_value} (${adj.reason || 'penalty'})`);
    } else if (adj.adjustment_type === 'disqualify') {
      disqualify = true;
      reasons.push(`DISQUALIFIED (${adj.reason || 'custom rule'})`);
    }
  }

  return { bonus, reasoning: reasons.join('; '), disqualify };
}

// ============================================================================
// COMPOSITE ASSEMBLY (Phase 7)
// ============================================================================

async function scoreSingleBuyer(
  listing: any,
  buyer: any,
  universe: any,
  tracker: any,
  adjustments: any[],
  learningPattern: LearningPattern | undefined,
  apiKey: string,
  supabaseUrl: string,
  supabaseKey: string,
  customInstructions?: string
): Promise<ScoredResult> {
  const behavior: ScoringBehavior = universe.scoring_behavior || {};
  const serviceCriteria: ServiceCriteria | null = universe.service_criteria || null;

  // Default weights per spec: Services 45%, Size 30%, Geography 20%, Owner Goals 5%
  let sizeWeight = universe.size_weight || 30;
  let geoWeight = universe.geography_weight || 20;
  let serviceWeight = universe.service_weight || 45;
  let ownerGoalsWeight = universe.owner_goals_weight || 5;

  // === Steps a-e: Score all dimensions (parallelize ALL independent calls including thesis) ===
  const sizeResult = calculateSizeScore(listing, buyer, behavior);

  const [geoResult, serviceResult, ownerGoalsResult, thesisResult] = await Promise.all([
    calculateGeographyScore(listing, buyer, tracker, supabaseUrl, supabaseKey),
    calculateServiceScore(listing, buyer, tracker, behavior, serviceCriteria, apiKey, customInstructions),
    calculateOwnerGoalsScore(listing, buyer, apiKey, customInstructions),
    calculateThesisAlignmentBonus(listing, buyer, apiKey),
  ]);

  // === Weight Redistribution for Missing Data ===
  // When buyer lacks data for a dimension, that dimension produces a flat neutral score.
  // To prevent clustering, redistribute its weight to dimensions that CAN differentiate.
  const buyerHasSizeData = buyer.target_revenue_min != null || buyer.target_revenue_max != null ||
    buyer.target_ebitda_min != null || buyer.target_ebitda_max != null ||
    buyer.revenue_sweet_spot != null || buyer.ebitda_sweet_spot != null;
  
  const buyerHasGeoData = (buyer.target_geographies?.length > 0) ||
    (buyer.geographic_footprint?.length > 0) || buyer.hq_state;
  
  const buyerHasServiceData = (buyer.target_services?.length > 0) ||
    (buyer.services_offered && buyer.services_offered.trim().length > 0);

  let effectiveSizeWeight = sizeWeight;
  let effectiveServiceWeight = serviceWeight;
  let effectiveGeoWeight = geoWeight;
  let effectiveOwnerWeight = ownerGoalsWeight;

  // Collect weight from insufficient dimensions
  let pooledWeight = 0;
  if (!buyerHasSizeData) {
    pooledWeight += effectiveSizeWeight;
    effectiveSizeWeight = 0;
  }
  if (!buyerHasGeoData) {
    pooledWeight += effectiveGeoWeight;
    effectiveGeoWeight = 0;
  }
  if (!buyerHasServiceData) {
    pooledWeight += effectiveServiceWeight;
    effectiveServiceWeight = 0;
  }

  // Redistribute pooled weight proportionally among dimensions that DO have data
  if (pooledWeight > 0) {
    const scoredWeight = effectiveSizeWeight + effectiveGeoWeight + effectiveServiceWeight + effectiveOwnerWeight;
    if (scoredWeight > 0) {
      const scale = (scoredWeight + pooledWeight) / scoredWeight;
      effectiveSizeWeight = Math.round(effectiveSizeWeight * scale);
      effectiveGeoWeight = Math.round(effectiveGeoWeight * scale);
      effectiveServiceWeight = Math.round(effectiveServiceWeight * scale);
      effectiveOwnerWeight = Math.round(effectiveOwnerWeight * scale);
    }
    console.log(`[Weight Redistribution] Buyer ${buyer.id}: missing [${!buyerHasSizeData ? 'size' : ''}${!buyerHasGeoData ? ' geo' : ''}${!buyerHasServiceData ? ' svc' : ''}]. Effective: size=${effectiveSizeWeight}, geo=${effectiveGeoWeight}, svc=${effectiveServiceWeight}, owner=${effectiveOwnerWeight}`);
  }

  // === Step f: Weighted composite ===
  // Use effective weight sum as divisor so reduced geography mode doesn't systematically lower all scores
  const effectiveWeightSum = effectiveSizeWeight + effectiveGeoWeight * geoResult.modeFactor + effectiveServiceWeight + effectiveOwnerWeight;
  const weightedBase = Math.round(
    (sizeResult.score * effectiveSizeWeight +
     geoResult.score * effectiveGeoWeight * geoResult.modeFactor +
     serviceResult.score * effectiveServiceWeight +
     ownerGoalsResult.score * effectiveOwnerWeight) / effectiveWeightSum
  );

  // === Step g+h: Apply BOTH gates ===
  let gatedScore = Math.round(weightedBase * sizeResult.multiplier * serviceResult.multiplier);
  gatedScore = Math.max(0, Math.min(100, gatedScore));

  // === Step i: Data quality bonus ===
  const dataQualityResult = calculateDataQualityBonus(buyer);

  // === Step j: Custom instruction adjustments ===
  const customResult = applyCustomInstructionBonus(adjustments);

  // === Step k: Learning penalty ===
  const learningResult = calculateLearningPenalty(learningPattern);

  // === Step l: Final assembly ===
  let finalScore = gatedScore
    + thesisResult.bonus
    + dataQualityResult.bonus
    + customResult.bonus
    - learningResult.penalty;

  finalScore = Math.max(0, Math.min(100, finalScore));

  // === Check for hard disqualification ===
  let isDisqualified = false;
  let disqualificationReason: string | null = null;

  if (sizeResult.multiplier === 0.0) {
    isDisqualified = true;
    disqualificationReason = sizeResult.reasoning;
    finalScore = 0;
  }
  if (serviceResult.multiplier === 0.0) {
    isDisqualified = true;
    disqualificationReason = serviceResult.reasoning;
    finalScore = 0;
  }
  if (geoResult.score === 0 && geoResult.reasoning.includes('DISQUALIFIED')) {
    isDisqualified = true;
    disqualificationReason = geoResult.reasoning;
    finalScore = 0;
  }
  if (customResult.disqualify) {
    isDisqualified = true;
    disqualificationReason = customResult.reasoning;
    finalScore = 0;
  }

  // === Step o: Determine tier ===
  let tier: string;
  if (isDisqualified) tier = "F";
  else if (finalScore >= 80) tier = "A";
  else if (finalScore >= 65) tier = "B";
  else if (finalScore >= 50) tier = "C";
  else if (finalScore >= 35) tier = "D";
  else tier = "F";

  // === Data completeness ===
  const { level: dataCompleteness, missingFields } = assessDataCompleteness(buyer);

  // === Confidence level ===
  let confidenceLevel = 'medium';
  if (dataCompleteness === 'high' && ownerGoalsResult.confidence !== 'low') confidenceLevel = 'high';
  else if (dataCompleteness === 'low') confidenceLevel = 'low';

  // === Needs review flag (only in ambiguous score zone with low-quality data) ===
  const needsReview = (
    finalScore >= 50 && finalScore <= 65 &&
    (confidenceLevel === 'low' || dataCompleteness === 'low')
  );

  // === Build reasoning (aligned with frontend tier bands) ===
  let fitLabel: string;
  if (isDisqualified) fitLabel = "DISQUALIFIED";
  else if (finalScore >= 80) fitLabel = "Strong fit";
  else if (finalScore >= 65) fitLabel = "Good fit";
  else if (finalScore >= 50) fitLabel = "Fair fit";
  else fitLabel = "Poor fit";

  const reasoningParts = [
    `${fitLabel}: ${geoResult.reasoning}`,
    serviceResult.reasoning,
    sizeResult.reasoning,
  ];

  if (!buyerHasSizeData) {
    reasoningParts.push(`Size weight redistributed (no buyer size criteria — pre-conversation)`);
  } else if (sizeResult.multiplier < 1.0 && !isDisqualified) {
    reasoningParts.push(`Size gate: ${Math.round(sizeResult.multiplier * 100)}%`);
  }
  if (serviceResult.multiplier < 1.0 && !isDisqualified) {
    reasoningParts.push(`Service gate: ${Math.round(serviceResult.multiplier * 100)}%`);
  }
  if (thesisResult.bonus > 0) {
    reasoningParts.push(`+${thesisResult.bonus}pt thesis alignment`);
  }
  if (learningResult.penalty > 0) {
    reasoningParts.push(`-${learningResult.penalty}pt learning penalty`);
  }

  const fitReasoning = reasoningParts.filter(Boolean).join('. ');

  // Deal snapshot for stale detection
  const dealSnapshot = {
    revenue: listing.revenue,
    ebitda: listing.ebitda,
    location: listing.location,
    category: listing.category,
    services: listing.services || listing.categories || [listing.category].filter(Boolean),
    owner_goals: listing.asking_price ? 'has_asking_price' : listing.seller_motivation || null,
    snapshot_at: new Date().toISOString(),
  };

  return {
    listing_id: listing.id,
    buyer_id: buyer.id,
    universe_id: universe.id,
    composite_score: finalScore,
    geography_score: geoResult.score,
    size_score: sizeResult.score,
    service_score: serviceResult.score,
    owner_goals_score: ownerGoalsResult.score,
    acquisition_score: 0, // Not calculated — reserved for future use
    portfolio_score: 0,
    business_model_score: 0,
    size_multiplier: sizeResult.multiplier,
    service_multiplier: serviceResult.multiplier,
    geography_mode_factor: geoResult.modeFactor,
    thesis_alignment_bonus: thesisResult.bonus,
    data_quality_bonus: dataQualityResult.bonus,
    custom_bonus: customResult.bonus,
    learning_penalty: learningResult.penalty,
    tier,
    is_disqualified: isDisqualified,
    disqualification_reason: disqualificationReason,
    needs_review: needsReview,
    missing_fields: missingFields,
    confidence_level: confidenceLevel,
    fit_reasoning: fitReasoning,
    data_completeness: dataCompleteness,
    status: "pending", // Will be overridden below if existing score has approved/passed status
    scored_at: new Date().toISOString(),
    deal_snapshot: dealSnapshot,
  };
}

// ============================================================================
// SINGLE SCORE HANDLER
// ============================================================================

async function handleSingleScore(
  supabase: any,
  request: ScoreRequest,
  apiKey: string,
  corsHeaders: Record<string, string>
) {
  const { listingId, buyerId, universeId, customInstructions, geographyMode } = request;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Fetch listing, buyer, universe in parallel
  const [listingRes, buyerRes, universeRes] = await Promise.all([
    supabase.from("listings").select("*").eq("id", listingId).single(),
    supabase.from("remarketing_buyers").select("*").eq("id", buyerId).single(),
    supabase.from("remarketing_buyer_universes").select("*").eq("id", universeId).single(),
  ]);

  if (listingRes.error || !listingRes.data) throw new Error("Listing not found");
  if (buyerRes.error || !buyerRes.data) throw new Error("Buyer not found");
  if (universeRes.error || !universeRes.data) throw new Error("Universe not found");

  const listing = listingRes.data;
  const buyer = buyerRes.data;
  const universe = universeRes.data;

  // Fetch tracker if buyer has one
  let tracker = null;
  if (buyer.industry_tracker_id) {
    const { data } = await supabase.from("industry_trackers").select("*").eq("id", buyer.industry_tracker_id).single();
    tracker = data;
  }

  // Apply geography mode override from request (takes precedence over tracker)
  if (geographyMode && tracker) {
    tracker = { ...tracker, geography_mode: geographyMode };
  } else if (geographyMode && !tracker) {
    tracker = { geography_mode: geographyMode };
  }

  // Fetch adjustments and learning patterns
  const [adjustments, learningPatterns] = await Promise.all([
    fetchScoringAdjustments(supabase, listingId),
    fetchLearningPatterns(supabase, [buyerId]),
  ]);

  const score = await scoreSingleBuyer(
    listing, buyer, universe, tracker,
    adjustments, learningPatterns.get(buyerId),
    apiKey, supabaseUrl, supabaseKey, customInstructions
  );

  // Preserve existing status if buyer was already approved/passed
  const { data: existingScore } = await supabase
    .from("remarketing_scores")
    .select("status")
    .eq("listing_id", score.listing_id)
    .eq("buyer_id", score.buyer_id)
    .eq("universe_id", score.universe_id)
    .maybeSingle();

  if (existingScore?.status === 'approved' || existingScore?.status === 'passed') {
    score.status = existingScore.status;
  }

  // Upsert score
  const { data: savedScore, error: saveError } = await supabase
    .from("remarketing_scores")
    .upsert(score, { onConflict: "listing_id,buyer_id,universe_id" })
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

// ============================================================================
// BULK SCORE HANDLER
// ============================================================================

async function handleBulkScore(
  supabase: any,
  request: BulkScoreRequest,
  apiKey: string,
  corsHeaders: Record<string, string>
) {
  const { listingId, universeId, buyerIds, customInstructions, geographyMode, options } = request;
  const rescoreExisting = options?.rescoreExisting ?? false;
  const minDataCompleteness = options?.minDataCompleteness;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  console.log("Custom instructions received:", customInstructions ? "Yes" : "No");

  // Fetch listing
  const { data: listing, error: listingError } = await supabase
    .from("listings").select("*").eq("id", listingId).single();
  if (listingError || !listing) throw new Error("Listing not found");

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
    .from("remarketing_buyer_universes").select("*").eq("id", universeId).single();
  if (universeError || !universe) throw new Error("Universe not found");

  // Fetch buyers
  let buyerQuery = supabase
    .from("remarketing_buyers").select("*")
    .eq("universe_id", universeId).eq("archived", false);
  if (buyerIds && buyerIds.length > 0) buyerQuery = buyerQuery.in("id", buyerIds);
  if (minDataCompleteness === 'high') buyerQuery = buyerQuery.eq('data_completeness', 'high');
  else if (minDataCompleteness === 'medium') buyerQuery = buyerQuery.in('data_completeness', ['high', 'medium']);

  const { data: buyers, error: buyersError } = await buyerQuery;
  if (buyersError) throw new Error("Failed to fetch buyers");
  if (!buyers || buyers.length === 0) {
    return new Response(
      JSON.stringify({ success: true, scores: [], message: "No buyers to score" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Filter out already-scored buyers if not rescoring
  let buyersToScore = buyers;
  if (!rescoreExisting) {
    const { data: existingScores } = await supabase
      .from("remarketing_scores").select("buyer_id").eq("listing_id", listingId).eq("universe_id", universeId);
    const scoredIds = new Set((existingScores || []).map((s: any) => s.buyer_id));
    buyersToScore = buyers.filter((b: any) => !scoredIds.has(b.id));
    if (buyersToScore.length === 0) {
      return new Response(
        JSON.stringify({ success: true, scores: [], message: "All buyers already scored", totalProcessed: 0, totalBuyers: buyers.length }),
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

  // Fetch tracker IDs for all buyers
  const trackerIds = [...new Set(buyersToScore.map((b: any) => b.industry_tracker_id).filter(Boolean))];
  const trackerMap = new Map<string, any>();
  if (trackerIds.length > 0) {
    const { data: trackers } = await supabase.from("industry_trackers").select("*").in("id", trackerIds);
    for (const t of (trackers || [])) trackerMap.set(t.id, t);
  }

  // Fetch adjustments and learning patterns in parallel
  const allBuyerIds = buyersToScore.map((b: any) => b.id);
  const [adjustments, learningPatterns] = await Promise.all([
    fetchScoringAdjustments(supabase, listingId),
    fetchLearningPatterns(supabase, allBuyerIds),
  ]);

  // Process in batches of 5
  const batchSize = 5;
  const scores: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < buyersToScore.length; i += batchSize) {
    const batch = buyersToScore.slice(i, i + batchSize);

    const batchPromises = batch.map(async (buyer: any) => {
      try {
        let tracker = buyer.industry_tracker_id ? trackerMap.get(buyer.industry_tracker_id) : null;
        // Apply geography mode override from request
        if (geographyMode) {
          tracker = tracker ? { ...tracker, geography_mode: geographyMode } : { geography_mode: geographyMode };
        }
        return await scoreSingleBuyer(
          listing, buyer, universe, tracker,
          adjustments, learningPatterns.get(buyer.id),
          apiKey, supabaseUrl, supabaseKey, customInstructions
        );
      } catch (err) {
        console.error(`Failed to score buyer ${buyer.id}:`, err);
        errors.push(`Failed to score ${buyer.company_name}`);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    const validScores = batchResults.filter((s): s is ScoredResult => s !== null);

    if (validScores.length > 0) {
      // Preserve existing approved/passed statuses during bulk rescore
      if (rescoreExisting) {
        const scoreKeys = validScores.map((s: ScoredResult) => `${s.buyer_id}`);
        const { data: existingStatuses } = await supabase
          .from("remarketing_scores")
          .select("buyer_id, status")
          .eq("listing_id", listingId)
          .eq("universe_id", universeId)
          .in("buyer_id", scoreKeys);

        const statusMap = new Map<string, string>();
        for (const es of (existingStatuses || [])) {
          if (es.status === 'approved' || es.status === 'passed') {
            statusMap.set(es.buyer_id, es.status);
          }
        }
        for (const score of validScores) {
          const preserved = statusMap.get(score.buyer_id);
          if (preserved) score.status = preserved;
        }
      }

      const { data: savedScores, error: saveError } = await supabase
        .from("remarketing_scores")
        .upsert(validScores, { onConflict: "listing_id,buyer_id,universe_id" })
        .select();

      if (saveError) {
        console.error("Failed to save batch scores:", saveError);
        errors.push("Failed to save some scores");
      } else {
        scores.push(...(savedScores || []));
      }
    }

    // Adaptive rate limit delay — increase for large runs to avoid API rate limits
    if (i + batchSize < buyersToScore.length) {
      const delay = buyersToScore.length > 100 ? 600 : buyersToScore.length > 50 ? 400 : 300;
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // ========== SCORING SUMMARY & GUARDRAILS ==========
  const qualifiedCount = scores.filter((s: any) => s.composite_score >= 50).length;
  const disqualifiedCount = scores.filter((s: any) => s.composite_score < 50).length;
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
