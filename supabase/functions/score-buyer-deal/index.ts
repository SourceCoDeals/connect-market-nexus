import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const isBulk = body.bulk === true;

    if (isBulk) {
      return await handleBulkScore(supabase, body as BulkScoreRequest, LOVABLE_API_KEY, corsHeaders);
    } else {
      return await handleSingleScore(supabase, body as ScoreRequest, LOVABLE_API_KEY, corsHeaders);
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

// Calculate service overlap percentage for context
function calculateServiceOverlap(
  listing: any,
  buyer: any
): { percentage: number; matchingServices: string[]; allDealServices: string[] } {
  const dealServices = (listing.categories || [listing.category])
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
  
  const percentage = Math.round((matching.length / Math.max(dealServices.length, buyerServices.length)) * 100);
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
  
  const dealPrimaryService = (listing.category || listing.categories?.[0])?.toLowerCase().trim();
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

// Apply learning adjustments to score
function applyLearningAdjustment(
  baseScore: number, 
  pattern: LearningPattern | undefined,
  adjustments: ScoringAdjustment[]
): { adjustedScore: number; thesisBonus: number; adjustmentReason?: string; learningNote?: string } {
  let adjustedScore = baseScore;
  let thesisBonus = 0;
  const reasons: string[] = [];
  let learningNote: string | undefined;

  // Apply deal-level adjustments
  for (const adj of adjustments) {
    if (adj.adjustment_type === 'boost') {
      adjustedScore += adj.adjustment_value;
      reasons.push(`+${adj.adjustment_value} (${adj.reason || 'boost'})`);
    } else if (adj.adjustment_type === 'penalize') {
      adjustedScore -= adj.adjustment_value;
      reasons.push(`-${adj.adjustment_value} (${adj.reason || 'penalty'})`);
    } else if (adj.adjustment_type === 'thesis_match') {
      thesisBonus = adj.adjustment_value;
      reasons.push(`+${adj.adjustment_value} thesis bonus`);
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

  // Fetch adjustments and learning patterns
  const [adjustments, learningPatterns] = await Promise.all([
    fetchScoringAdjustments(supabase, listingId),
    fetchLearningPatterns(supabase, [buyerId]),
  ]);

  // Generate score using AI
  const score = await generateAIScore(listing, buyer, universe, apiKey);

  // Apply learning adjustments
  const { adjustedScore, thesisBonus, adjustmentReason } = applyLearningAdjustment(
    score.composite_score,
    learningPatterns.get(buyerId),
    adjustments
  );

  // Recalculate tier based on adjusted score
  let tier: string;
  if (adjustedScore >= 85) tier = "A";
  else if (adjustedScore >= 70) tier = "B";
  else if (adjustedScore >= 55) tier = "C";
  else tier = "D";

  // Upsert score with new fields
  const { data: savedScore, error: saveError } = await supabase
    .from("remarketing_scores")
    .upsert({
      listing_id: listingId,
      buyer_id: buyerId,
      universe_id: universeId,
      ...score,
      composite_score: adjustedScore,
      tier,
      thesis_bonus: thesisBonus,
      acquisition_score: score.acquisition_score,
      portfolio_score: score.portfolio_score,
      business_model_score: score.business_model_score,
      fit_reasoning: adjustmentReason 
        ? `${score.fit_reasoning}\n\nAdjustments: ${adjustmentReason}`
        : score.fit_reasoning,
      scored_at: new Date().toISOString(),
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
  const { listingId, universeId, buyerIds, options } = request;
  const rescoreExisting = options?.rescoreExisting ?? false;
  const minDataCompleteness = options?.minDataCompleteness;

  // Fetch listing
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    throw new Error("Listing not found");
  }

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

  console.log(`Scoring ${buyersToScore.length} buyers for listing ${listingId} (rescore: ${rescoreExisting})`);

  // Fetch adjustments and learning patterns in parallel
  const allBuyerIds = buyersToScore.map((b: any) => b.id);
  const [adjustments, learningPatterns] = await Promise.all([
    fetchScoringAdjustments(supabase, listingId),
    fetchLearningPatterns(supabase, allBuyerIds),
  ]);

  // Process in batches to avoid rate limits
  const batchSize = 5;
  const scores: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < buyersToScore.length; i += batchSize) {
    const batch = buyersToScore.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (buyer: any) => {
      try {
        const score = await generateAIScore(listing, buyer, universe, apiKey);
        
        // Apply learning adjustments
        const { adjustedScore, thesisBonus, adjustmentReason } = applyLearningAdjustment(
          score.composite_score,
          learningPatterns.get(buyer.id),
          adjustments
        );

        // Recalculate tier
        let tier: string;
        if (adjustedScore >= 85) tier = "A";
        else if (adjustedScore >= 70) tier = "B";
        else if (adjustedScore >= 55) tier = "C";
        else tier = "D";

        return {
          listing_id: listingId,
          buyer_id: buyer.id,
          universe_id: universeId,
          ...score,
          composite_score: adjustedScore,
          tier,
          thesis_bonus: thesisBonus,
          acquisition_score: score.acquisition_score,
          portfolio_score: score.portfolio_score,
          business_model_score: score.business_model_score,
          fit_reasoning: adjustmentReason 
            ? `${score.fit_reasoning}\n\nAdjustments: ${adjustmentReason}`
            : score.fit_reasoning,
          scored_at: new Date().toISOString(),
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

  return new Response(
    JSON.stringify({ 
      success: true, 
      scores, 
      errors: errors.length > 0 ? errors : undefined,
      totalProcessed: scores.length,
      totalBuyers: buyersToScore.length 
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
  
  // 1. Below Minimum Revenue - DISQUALIFY
  if (behavior.below_minimum_handling === 'disqualify') {
    const buyerMinRevenue = buyer.target_revenue_min;
    const dealRevenue = listing.revenue;
    
    if (buyerMinRevenue && dealRevenue && dealRevenue < buyerMinRevenue) {
      adjustedScores.size_score = Math.min(adjustedScores.size_score, 25);
      enforcements.push(`Disqualified: Deal revenue ($${dealRevenue.toLocaleString()}) below buyer minimum ($${buyerMinRevenue.toLocaleString()})`);
      forceDisqualify = true;
    }
  }
  
  // 2. Below Minimum Revenue - PENALIZE
  if (behavior.below_minimum_handling === 'penalize') {
    const buyerMinRevenue = buyer.target_revenue_min;
    const dealRevenue = listing.revenue;
    
    if (buyerMinRevenue && dealRevenue && dealRevenue < buyerMinRevenue) {
      const penaltyFactor = Math.max(0.5, dealRevenue / buyerMinRevenue);
      adjustedScores.size_score = Math.round(adjustedScores.size_score * penaltyFactor);
      enforcements.push(`Size penalized: Deal below minimum (${Math.round(penaltyFactor * 100)}% factor applied)`);
    }
  }
  
  // 3. Excluded Services - DEALBREAKER
  if (behavior.excluded_services_dealbreaker && serviceCriteria?.excluded_services?.length) {
    const dealServices = (listing.categories || [listing.category]).map((s: string) => s?.toLowerCase());
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
  apiKey: string
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

const systemPrompt = `You are an M&A advisor scoring buyer-deal fits. Analyze the match between a business listing and a potential buyer (PE firm/platform/strategic acquirer).

CRITICAL: You MUST follow the SCORING RULES provided below. These are hard constraints that override general matching logic. Apply them strictly.

Score each category from 0-100 based on fit quality:
- Geography: How well does the deal's location match the buyer's target geography or existing footprint?
- Size: Does the deal's revenue/EBITDA fit the buyer's investment criteria?
- Service: How aligned are the deal's services with the buyer's focus areas?
- Owner Goals: How compatible is the deal based on seller motivation, timeline, and buyer acquisition strategies?
- Acquisition Fit: How well does this deal fit the buyer's recent acquisition pattern and appetite?
- Portfolio Synergy: How well does this deal complement the buyer's existing portfolio companies?
- Business Model: How aligned is the deal's business model (service mix, customer base) with buyer preferences?

REASONING FORMAT REQUIREMENTS:
1. Start with a fit label based on composite score:
   - Score ≥70: "Strong fit:"
   - Score 55-69: "Moderate fit:"
   - Score <55: "Poor fit:" or if disqualified: "DISQUALIFIED:"
2. Include geographic context: "Buyer operates in [STATE] (adjacent)" or "(direct overlap)" or "(no nearby presence)"
3. Calculate and report service overlap as percentage: "Strong service alignment (67% overlap): [services]" or "Weak service alignment (20% overlap)"
4. Mention bonus points when applicable: "+10pt primary focus bonus" when deal's primary service matches buyer's primary focus
5. End reasoning with footprint context: "Buyer footprint: [BUYER_STATES] → Deal: [DEAL_STATE]"

Example reasoning:
"Strong fit: Buyer operates in TX (adjacent). Strong service alignment (67% overlap): collision, repair, service +10pt primary focus bonus. Buyer footprint: TX, OK, AR → Deal: MO"

Provide scores and reasoning following the format above. Be specific about which rules affected your scoring.`;

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
- Target Revenue: ${buyer.target_revenue_min ? `$${buyer.target_revenue_min.toLocaleString()}` : "?"} - ${buyer.target_revenue_max ? `$${buyer.target_revenue_max.toLocaleString()}` : "?"}
- Target EBITDA: ${buyer.target_ebitda_min ? `$${buyer.target_ebitda_min.toLocaleString()}` : "?"} - ${buyer.target_ebitda_max ? `$${buyer.target_ebitda_max.toLocaleString()}` : "?"}
- Target Geographies: ${buyer.target_geographies?.join(", ") || "Unknown"}
- Target Services: ${buyer.target_services?.join(", ") || "Unknown"}
- Target Industries: ${buyer.target_industries?.join(", ") || "Unknown"}
- Current Footprint: ${buyer.geographic_footprint?.join(", ") || "Unknown"}
- Investment Thesis: ${buyer.thesis_summary || "Unknown"}
- ${getAcquisitionContext()}
- ${getPortfolioContext()}
- Acquisition Appetite: ${buyer.acquisition_appetite || "Unknown"}
- Total Acquisitions: ${buyer.total_acquisitions || "Unknown"}
${industryPresetContext}

SERVICE OVERLAP CONTEXT:
- Calculated overlap: ${serviceOverlap.percentage}%
- Matching services: ${serviceOverlap.matchingServices.length > 0 ? serviceOverlap.matchingServices.join(', ') : 'None identified'}
- Deal services: ${serviceOverlap.allDealServices.join(', ') || 'Unknown'}

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

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
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

  // Apply post-processing enforcement of hard rules
  const { scores: enforcedScores, enforcements, forceDisqualify } = enforceHardRules(
    scores,
    listing,
    buyer,
    scoringBehavior,
    serviceCriteria
  );

  // Calculate composite score using universe weights (core 4 categories)
  const composite = Math.round(
    (enforcedScores.geography_score * universe.geography_weight +
     enforcedScores.size_score * universe.size_weight +
     enforcedScores.service_score * universe.service_weight +
     enforcedScores.owner_goals_score * universe.owner_goals_weight) / 100
  );

  // Bonus from secondary scores (up to +10 points) - but not if disqualified
  const secondaryAvg = (enforcedScores.acquisition_score + enforcedScores.portfolio_score + enforcedScores.business_model_score) / 3;
  const secondaryBonus = forceDisqualify ? 0 : (secondaryAvg >= 80 ? 5 : secondaryAvg >= 60 ? 2 : 0);
  let finalComposite = Math.min(100, composite + secondaryBonus);
  
  // Apply primary focus bonus (+10pt when deal's primary service matches buyer's primary focus)
  const { score: primaryFocusScore, bonusApplied: primaryBonusApplied } = applyPrimaryFocusBonus(
    listing,
    buyer,
    scoringBehavior,
    finalComposite
  );
  
  if (primaryBonusApplied && !forceDisqualify) {
    finalComposite = primaryFocusScore;
  }
  
  // If force disqualified, cap the composite score
  if (forceDisqualify) {
    finalComposite = Math.min(finalComposite, 45);
  }

  // Determine tier
  let tier: string;
  if (finalComposite >= 85) tier = "A";
  else if (finalComposite >= 70) tier = "B";
  else if (finalComposite >= 55) tier = "C";
  else tier = "D";

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

  // Build final reasoning with enforcement notes and bonuses
  let finalReasoning = enforcedScores.reasoning;
  
  // Add primary focus bonus note if applied
  if (primaryBonusApplied && !forceDisqualify) {
    finalReasoning += " +10pt primary focus bonus.";
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
