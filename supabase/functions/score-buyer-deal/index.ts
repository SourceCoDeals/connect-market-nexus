import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL, ANTHROPIC_API_URL, getAnthropicHeaders, DEFAULT_CLAUDE_FAST_MODEL, callClaudeWithTool } from "../_shared/ai-providers.ts";
import { calculateProximityScore, getProximityTier } from "../_shared/geography-utils.ts";

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
}

interface BulkScoreRequest {
  listingId: string;
  universeId: string;
  buyerIds?: string[];
  customInstructions?: string;
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
  kpi_bonus: number;
  custom_bonus: number;
  learning_penalty: number;
  thesis_bonus: number;
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
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

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

  // Both deal revenue AND EBITDA are null — can't evaluate
  if (dealRevenue === null && dealEbitda === null) {
    return {
      score: 40,
      multiplier: 0.7,
      reasoning: "Deal missing revenue and EBITDA — penalty for unknown size"
    };
  }

  // No buyer size criteria at all — use moderate default
  if (!buyerMinRevenue && !buyerMaxRevenue && !buyerMinEbitda && !buyerMaxEbitda) {
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
  if (dealRevenue !== null && dealRevenue > 0) {
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

  // === EBITDA-based scoring (supplement or fallback) ===
  if (dealEbitda !== null && dealEbitda > 0 && buyerMinEbitda) {
    if (dealEbitda < buyerMinEbitda * 0.5) {
      // EBITDA way below minimum — override if worse
      if (score > 20) {
        score = 20;
        multiplier = Math.min(multiplier, 0.25);
        reasoning += `. EBITDA $${(dealEbitda/1e6).toFixed(1)}M — far below buyer min ($${(buyerMinEbitda/1e6).toFixed(1)}M)`;
      }
    } else if (dealEbitda < buyerMinEbitda) {
      // EBITDA below minimum — penalize
      if (score > 40) {
        score = Math.min(score, 40);
        multiplier = Math.min(multiplier, 0.6);
        reasoning += `. EBITDA below buyer minimum`;
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

  // Extract deal state
  const dealLocation = listing.location || "";
  const dealState = dealLocation.match(/,\s*([A-Z]{2})\s*$/i)?.[1]?.toUpperCase();

  // Get buyer geographic data (priority order per spec)
  let buyerStates: string[] = [];

  // 1. target_geographies (strongest signal)
  const targetGeos = (buyer.target_geographies || []).filter(Boolean).map((s: string) => s.toUpperCase().trim());
  if (targetGeos.length > 0) {
    buyerStates = targetGeos;
  }
  // 2. geographic_footprint (fallback)
  else {
    const footprint = (buyer.geographic_footprint || []).filter(Boolean).map((s: string) => s.toUpperCase().trim());
    if (footprint.length > 0) {
      buyerStates = footprint;
    }
    // 3. HQ state (weakest signal)
    else if (buyer.hq_state) {
      buyerStates = [buyer.hq_state.toUpperCase().trim()];
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
  const hardPatterns = [/\bonly\s+in\b/i, /\bexclusively\b/i, /\blimited\s+to\b/i, /\bfocused\s+on\b/i];

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
  apiKey: string
): Promise<{ score: number; multiplier: number; reasoning: string }> {
  const dealServices = (listing.services || listing.categories || [listing.category])
    .filter(Boolean).map((s: string) => s?.toLowerCase().trim());

  const buyerTargetServices = (buyer.target_services || [])
    .filter(Boolean).map((s: string) => s?.toLowerCase().trim());

  const buyerServicesOffered = (buyer.services_offered || '')
    .toLowerCase().split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);

  // Combine buyer services for matching
  const allBuyerServices = [...new Set([...buyerTargetServices, ...buyerServicesOffered])];

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
      aiScore = await callServiceFitAI(listing, buyer, tracker, apiKey);
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
  apiKey: string
): Promise<{ score: number; reasoning: string }> {
  const dealServices = (listing.services || listing.categories || [listing.category]).filter(Boolean).join(', ');
  const buyerServices = (buyer.target_services || []).filter(Boolean).join(', ');
  const buyerOffered = buyer.services_offered || '';

  const prompt = `Score 0-100 how well these services align:
DEAL SERVICES: ${dealServices}
DEAL INDUSTRY: ${listing.category || 'Unknown'}
BUYER TARGET SERVICES: ${buyerServices || 'Not specified'}
BUYER CURRENT SERVICES: ${buyerOffered || 'Not specified'}
BUYER THESIS: ${(buyer.thesis_summary || '').substring(0, 200)}

Score guide: 85-100 = exact match, 60-84 = strong overlap, 40-59 = partial/adjacent, 20-39 = weak adjacency, 0-19 = unrelated.
Return JSON: {"score": number, "reasoning": "one sentence"}`;

  const response = await fetch(GEMINI_API_URL, {
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
  const buyerServices = [
    ...(buyer.target_services || []),
    ...(buyer.services_offered || '').split(/[,;]/).filter(Boolean)
  ].map((s: string) => s?.toLowerCase().trim()).filter(Boolean);

  if (buyerServices.length === 0 || dealServices.length === 0) {
    return { percentage: 0, matchingServices: [], allDealServices: dealServices };
  }

  const matching = dealServices.filter((ds: string) =>
    buyerServices.some((bs: string) =>
      ds?.includes(bs) || bs?.includes(ds) ||
      (ds?.includes('collision') && bs?.includes('body')) ||
      (ds?.includes('body') && bs?.includes('collision')) ||
      (ds?.includes('restoration') && bs?.includes('restoration')) ||
      (ds?.includes('repair') && bs?.includes('service')) ||
      (ds?.includes('auto') && bs?.includes('automotive'))
    )
  );

  const denominator = Math.max(dealServices.length, buyerServices.length, 1);
  const percentage = Math.round((matching.length / denominator) * 100);
  return { percentage, matchingServices: matching, allDealServices: dealServices };
}

// ============================================================================
// PHASE 5: OWNER GOALS SCORING (AI-powered with fallback)
// ============================================================================

async function calculateOwnerGoalsScore(
  listing: any,
  buyer: any,
  apiKey: string
): Promise<{ score: number; confidence: string; reasoning: string }> {
  // Try AI scoring first
  try {
    return await callOwnerGoalsFitAI(listing, buyer, apiKey);
  } catch (e) {
    console.warn("Owner goals AI call failed, using fallback:", e);
  }

  // Fallback: buyer-type norms lookup
  return ownerGoalsFallback(listing, buyer);
}

async function callOwnerGoalsFitAI(
  listing: any,
  buyer: any,
  apiKey: string
): Promise<{ score: number; confidence: string; reasoning: string }> {
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
- Buyer Type Norms: PE=majority recap+rollover+1-2yr transition, Platform=operators stay, Strategic=full buyout, Family Office=flexible

If buyer data is sparse, score based on buyer TYPE norms vs seller goals.
Conflicts (exit timing, structure mismatch) pull score down 25-35.
Alignment (growth partner+PE platform, stay on+platform wants operators) push score up 75-90.
If cannot evaluate, score 50 with confidence low.

Return JSON: {"score": number, "confidence": "high"|"medium"|"low", "reasoning": "one sentence"}`;

  const response = await fetch(GEMINI_API_URL, {
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

  if (!ownerGoals) {
    return { score: 50, confidence: 'low', reasoning: 'No owner goals data available' };
  }

  // Buyer-type norms lookup table
  const norms: Record<string, Record<string, number>> = {
    'pe_firm': { cash_exit: 40, growth_partner: 75, quick_exit: 50, stay_long: 60, retain_employees: 65, keep_autonomy: 50 },
    'platform': { cash_exit: 50, growth_partner: 80, quick_exit: 40, stay_long: 85, retain_employees: 75, keep_autonomy: 60 },
    'strategic': { cash_exit: 70, growth_partner: 50, quick_exit: 65, stay_long: 45, retain_employees: 45, keep_autonomy: 30 },
    'family_office': { cash_exit: 60, growth_partner: 65, quick_exit: 55, stay_long: 70, retain_employees: 70, keep_autonomy: 80 },
  };

  const typeNorms = norms[buyerType] || norms['platform']; // default to platform norms

  // Match owner goals to categories
  let score = 50;
  if (ownerGoals.includes('cash') && ownerGoals.includes('exit')) score = typeNorms.cash_exit;
  else if (ownerGoals.includes('growth') || ownerGoals.includes('partner') || ownerGoals.includes('rollover')) score = typeNorms.growth_partner;
  else if (ownerGoals.includes('quick') || ownerGoals.includes('fast') || ownerGoals.includes('30 day') || ownerGoals.includes('60 day')) score = typeNorms.quick_exit;
  else if (ownerGoals.includes('stay') || ownerGoals.includes('continue') || ownerGoals.includes('long')) score = typeNorms.stay_long;
  else if (ownerGoals.includes('employee') || ownerGoals.includes('retain') || ownerGoals.includes('team')) score = typeNorms.retain_employees;
  else if (ownerGoals.includes('autonom') || ownerGoals.includes('independen')) score = typeNorms.keep_autonomy;

  return {
    score,
    confidence: 'low',
    reasoning: `Fallback: ${buyerType || 'unknown'} buyer type norms vs owner goals`
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
  if (thesis.length <= 50) {
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

function applyCustomInstructionBonus(adjustments: any[]): { bonus: number; reasoning: string } {
  let bonus = 0;
  const reasons: string[] = [];

  for (const adj of adjustments) {
    if (adj.adjustment_type === 'boost') {
      bonus += adj.adjustment_value;
      reasons.push(`+${adj.adjustment_value} (${adj.reason || 'boost'})`);
    } else if (adj.adjustment_type === 'penalize') {
      bonus -= adj.adjustment_value;
      reasons.push(`-${adj.adjustment_value} (${adj.reason || 'penalty'})`);
    }
  }

  return { bonus, reasoning: reasons.join('; ') };
}

// ============================================================================
// ENGAGEMENT BONUS (DISABLED in scoring pipeline per spec — kept for future)
// ============================================================================

// Engagement bonus code is kept but NOT called during scoring.
// To re-enable, uncomment the engagement bonus application in the composite assembly.

async function fetchEngagementBonus(
  supabase: any,
  listingId: string,
  buyerId: string
): Promise<{ bonus: number; reasoning: string }> {
  // DISABLED per spec — scoring happens pre-engagement
  return { bonus: 0, reasoning: '' };
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

  // Default weights per spec: Services 35%, Size 25%, Geography 25%, Owner Goals 15%
  const sizeWeight = universe.size_weight || 25;
  const geoWeight = universe.geography_weight || 25;
  const serviceWeight = universe.service_weight || 35;
  const ownerGoalsWeight = universe.owner_goals_weight || 15;

  // === Step a: Size score + multiplier (deterministic) ===
  const sizeResult = calculateSizeScore(listing, buyer, behavior);

  // === Step b: Geography score (deterministic + adjacency) ===
  const geoResult = await calculateGeographyScore(listing, buyer, tracker, supabaseUrl, supabaseKey);

  // === Step d: Service score + multiplier (AI → keyword+adjacency fallback) ===
  const serviceResult = await calculateServiceScore(listing, buyer, tracker, behavior, serviceCriteria, apiKey);

  // === Step e: Owner Goals score (AI → buyer-type norms fallback) ===
  const ownerGoalsResult = await calculateOwnerGoalsScore(listing, buyer, apiKey);

  // === Step f: Weighted composite ===
  const weightedBase = Math.round(
    (sizeResult.score * sizeWeight +
     geoResult.score * geoWeight * geoResult.modeFactor +
     serviceResult.score * serviceWeight +
     ownerGoalsResult.score * ownerGoalsWeight) / 100
  );

  // === Step g+h: Apply BOTH gates ===
  let gatedScore = Math.round(weightedBase * sizeResult.multiplier * serviceResult.multiplier);
  gatedScore = Math.max(0, Math.min(100, gatedScore));

  // === Step i: Thesis alignment bonus ===
  const thesisResult = await calculateThesisAlignmentBonus(listing, buyer, apiKey);

  // === Step j: Data quality bonus ===
  const dataQualityResult = calculateDataQualityBonus(buyer);

  // === Step k: KPI bonus (keep existing logic — deterministic from tracker config) ===
  const kpiBonus = 0; // TODO: implement from tracker.kpi_scoring_config if present

  // === Step l: Custom instruction adjustments ===
  const customResult = applyCustomInstructionBonus(adjustments);

  // === Step m: Learning penalty ===
  const learningResult = calculateLearningPenalty(learningPattern);

  // === Step n: Final assembly ===
  let finalScore = gatedScore
    + thesisResult.bonus
    + dataQualityResult.bonus
    + kpiBonus
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

  // === Needs review flag ===
  const needsReview = (
    (finalScore >= 50 && finalScore <= 65 && confidenceLevel === 'low') ||
    dataCompleteness === 'low'
  );

  // === Build reasoning ===
  let fitLabel: string;
  if (isDisqualified) fitLabel = "DISQUALIFIED";
  else if (finalScore >= 70) fitLabel = "Strong fit";
  else if (finalScore >= 55) fitLabel = "Moderate fit";
  else fitLabel = "Weak fit";

  const reasoningParts = [
    `${fitLabel}: ${geoResult.reasoning}`,
    serviceResult.reasoning,
    sizeResult.reasoning,
  ];

  if (sizeResult.multiplier < 1.0 && !isDisqualified) {
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
    acquisition_score: 50, // Secondary — kept at neutral default
    portfolio_score: 50,
    business_model_score: 50,
    size_multiplier: sizeResult.multiplier,
    service_multiplier: serviceResult.multiplier,
    geography_mode_factor: geoResult.modeFactor,
    thesis_alignment_bonus: thesisResult.bonus,
    data_quality_bonus: dataQualityResult.bonus,
    kpi_bonus: kpiBonus,
    custom_bonus: customResult.bonus,
    learning_penalty: learningResult.penalty,
    thesis_bonus: thesisResult.bonus, // Keep backward compat
    tier,
    is_disqualified: isDisqualified,
    disqualification_reason: disqualificationReason,
    needs_review: needsReview,
    missing_fields: missingFields,
    confidence_level: confidenceLevel,
    fit_reasoning: fitReasoning,
    data_completeness: dataCompleteness,
    status: "pending",
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
  const { listingId, buyerId, universeId } = request;
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

  // Fetch adjustments and learning patterns
  const [adjustments, learningPatterns] = await Promise.all([
    fetchScoringAdjustments(supabase, listingId),
    fetchLearningPatterns(supabase, [buyerId]),
  ]);

  const score = await scoreSingleBuyer(
    listing, buyer, universe, tracker,
    adjustments, learningPatterns.get(buyerId),
    apiKey, supabaseUrl, supabaseKey
  );

  // Upsert score
  const { data: savedScore, error: saveError } = await supabase
    .from("remarketing_scores")
    .upsert(score, { onConflict: "listing_id,buyer_id" })
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
  const { listingId, universeId, buyerIds, customInstructions, options } = request;
  const rescoreExisting = options?.rescoreExisting ?? false;
  const minDataCompleteness = options?.minDataCompleteness;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  console.log("Custom instructions received:", customInstructions ? "Yes" : "No");

  // Fetch listing
  const { data: listing, error: listingError } = await supabase
    .from("listings").select("*").eq("id", listingId).single();
  if (listingError || !listing) throw new Error("Listing not found");

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
      .from("remarketing_scores").select("buyer_id").eq("listing_id", listingId);
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
        const tracker = buyer.industry_tracker_id ? trackerMap.get(buyer.industry_tracker_id) : null;
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

    // Rate limit delay between batches
    if (i + batchSize < buyersToScore.length) {
      await new Promise(r => setTimeout(r, 300));
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
