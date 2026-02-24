/**
 * Score Buyer-Deal — Orchestration Layer
 *
 * This is the main entry point for the scoring edge function.
 * All scoring phases have been extracted into ./phases/ modules.
 * This file contains only: HTTP handler, auth, orchestration, and handlers.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createEdgeTimeoutSignal } from '../_shared/edge-timeout.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  updateGlobalQueueProgress,
  completeGlobalQueueOperation,
  isOperationPaused,
} from '../_shared/global-activity-queue.ts';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

// Types
import type {
  SupabaseClient,
  ScoreRequest,
  BulkScoreRequest,
  ScoringBehavior,
  ServiceCriteria,
  Listing,
  Buyer,
  Universe,
  IndustryTracker,
  ScoringAdjustment,
  LearningPattern,
  ScoredResult,
} from './types.ts';

// Config
import { SCORING_CONFIG } from './config.ts';

// Phase modules
import { calculateSizeScore } from './phases/size.ts';
import { calculateGeographyScore } from './phases/geography.ts';
import { calculateServiceScore } from './phases/service.ts';
import { calculateOwnerGoalsScore } from './phases/owner-goals.ts';
import { calculateThesisAlignmentBonus, calculateDataQualityBonus } from './phases/thesis.ts';
import { fetchLearningPatterns, calculateLearningPenalty } from './phases/learning.ts';
import {
  assessProvenanceWarnings,
  fetchScoringAdjustments,
  applyCustomInstructionBonus,
} from './phases/data-completeness.ts';
import { saveScoreSnapshot } from './phases/utils.ts';

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  const _edgeStartTime = Date.now();
  const _edgeTimeout = createEdgeTimeoutSignal(_edgeStartTime);
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    // ── Auth guard: require valid JWT + admin role, OR internal service call ──
    const authHeader = req.headers.get('Authorization') || '';
    const callerToken = authHeader.replace('Bearer ', '').trim();
    if (!callerToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Allow internal service-to-service calls (e.g., from process-scoring-queue)
    const isInternalCall = callerToken === supabaseKey;

    if (!isInternalCall) {
      const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: `Bearer ${callerToken}` } },
      });
      const {
        data: { user: callerUser },
        error: callerError,
      } = await callerClient.auth.getUser();
      if (callerError || !callerUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: callerUser.id });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    // ── End auth guard ──

    const supabase = createClient(supabaseUrl, supabaseKey) as SupabaseClient;
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
    if (!GEMINI_API_KEY) {
      console.warn(
        'GEMINI_API_KEY is not configured — AI scoring will use deterministic fallbacks',
      );
    }

    const body = await req.json();
    const isBulk = body.bulk === true;

    if (isBulk) {
      return await handleBulkScore(
        supabase,
        body as BulkScoreRequest,
        GEMINI_API_KEY,
        corsHeaders,
        _edgeTimeout,
      );
    } else {
      return await handleSingleScore(supabase, body as ScoreRequest, GEMINI_API_KEY, corsHeaders);
    }
  } catch (error) {
    console.error('Score buyer-deal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// ============================================================================
// COMPOSITE ASSEMBLY — scoreSingleBuyer
// ============================================================================

async function scoreSingleBuyer(
  listing: Listing,
  buyer: Buyer,
  universe: Universe,
  tracker: IndustryTracker | null,
  adjustments: ScoringAdjustment[],
  learningPattern: LearningPattern | undefined,
  apiKey: string,
  supabaseUrl: string,
  supabaseKey: string,
  customInstructions?: string,
): Promise<ScoredResult> {
  const behavior: ScoringBehavior = universe.scoring_behavior || {};
  const serviceCriteria: ServiceCriteria | null = universe.service_criteria || null;

  // Default weights per spec: Services 45%, Size 30%, Geography 20%, Owner Goals 5%
  const sizeWeight = universe.size_weight || 30;
  const geoWeight = universe.geography_weight || 20;
  const serviceWeight = universe.service_weight || 45;
  const ownerGoalsWeight = universe.owner_goals_weight || 5;

  // === Steps a-e: Score all dimensions (parallelize ALL independent calls including thesis) ===
  const sizeResult = calculateSizeScore(listing, buyer, behavior);

  const [geoResult, serviceResult, ownerGoalsResult, thesisResult] = await Promise.all([
    calculateGeographyScore(listing, buyer, tracker, supabaseUrl, supabaseKey),
    calculateServiceScore(
      listing,
      buyer,
      tracker,
      behavior,
      serviceCriteria,
      apiKey,
      customInstructions,
    ),
    calculateOwnerGoalsScore(listing, buyer, apiKey, customInstructions),
    calculateThesisAlignmentBonus(listing, buyer, apiKey),
  ]);

  // === Weight Redistribution for Missing Data ===
  const buyerHasSizeData =
    buyer.target_revenue_min != null ||
    buyer.target_revenue_max != null ||
    buyer.target_ebitda_min != null ||
    buyer.target_ebitda_max != null;

  const buyerHasGeoData =
    (buyer.target_geographies?.length ?? 0) > 0 ||
    (buyer.geographic_footprint?.length ?? 0) > 0 ||
    (buyer.service_regions?.length ?? 0) > 0 ||
    (buyer.operating_locations?.length ?? 0) > 0 ||
    !!buyer.hq_state;

  const buyerHasServiceData =
    (buyer.target_services?.length ?? 0) > 0 ||
    !!(buyer.services_offered && buyer.services_offered.trim().length > 0);

  // Also check deal-side data availability
  const dealHasFinancials = listing.revenue != null || listing.ebitda != null;
  const dealHasLocation = !!(listing.location && listing.location.trim());
  const dealHasServices = !!(
    (listing.services && Array.isArray(listing.services) && listing.services.length > 0) ||
    (listing.categories && Array.isArray(listing.categories) && listing.categories.length > 0) ||
    (listing.category && listing.category.trim())
  );

  let effectiveSizeWeight = sizeWeight;
  let effectiveServiceWeight = serviceWeight;
  let effectiveGeoWeight = geoWeight;
  let effectiveOwnerWeight = ownerGoalsWeight;

  // Collect weight from insufficient dimensions (either side missing data)
  let pooledWeight = 0;
  if (!buyerHasSizeData || !dealHasFinancials) {
    pooledWeight += effectiveSizeWeight;
    effectiveSizeWeight = 0;
  }
  if (!buyerHasGeoData || !dealHasLocation) {
    pooledWeight += effectiveGeoWeight;
    effectiveGeoWeight = 0;
  }
  if (!buyerHasServiceData || !dealHasServices) {
    pooledWeight += effectiveServiceWeight;
    effectiveServiceWeight = 0;
  }

  // Redistribute pooled weight proportionally among dimensions that DO have data
  if (pooledWeight > 0) {
    const scoredWeight =
      effectiveSizeWeight + effectiveGeoWeight + effectiveServiceWeight + effectiveOwnerWeight;
    if (scoredWeight > 0) {
      const scale = (scoredWeight + pooledWeight) / scoredWeight;
      effectiveSizeWeight = Math.round(effectiveSizeWeight * scale);
      effectiveGeoWeight = Math.round(effectiveGeoWeight * scale);
      effectiveServiceWeight = Math.round(effectiveServiceWeight * scale);
      effectiveOwnerWeight = Math.round(effectiveOwnerWeight * scale);
    }
    const missingDims: string[] = [];
    if (!buyerHasSizeData || !dealHasFinancials) missingDims.push('size');
    if (!buyerHasGeoData || !dealHasLocation) missingDims.push('geo');
    if (!buyerHasServiceData || !dealHasServices) missingDims.push('svc');
    console.log(
      `[Weight Redistribution] Buyer ${buyer.id}: missing [${missingDims.join(', ')}]. Effective: size=${effectiveSizeWeight}, geo=${effectiveGeoWeight}, svc=${effectiveServiceWeight}, owner=${effectiveOwnerWeight}`,
    );
  }

  // === Step f: Weighted composite ===
  const effectiveWeightSum =
    effectiveSizeWeight +
    effectiveGeoWeight * geoResult.modeFactor +
    effectiveServiceWeight +
    effectiveOwnerWeight;
  const weightedBase = Math.round(
    (sizeResult.score * effectiveSizeWeight +
      geoResult.score * effectiveGeoWeight * geoResult.modeFactor +
      serviceResult.score * effectiveServiceWeight +
      ownerGoalsResult.score * effectiveOwnerWeight) /
      effectiveWeightSum,
  );

  // === Step g+h: Apply gates only for dimensions that were actually scored ===
  const effectiveSizeMultiplier =
    !buyerHasSizeData || !dealHasFinancials ? 1.0 : sizeResult.multiplier;
  const effectiveServiceMultiplier =
    !buyerHasServiceData || !dealHasServices ? 1.0 : serviceResult.multiplier;

  let gatedScore = Math.round(weightedBase * effectiveSizeMultiplier * effectiveServiceMultiplier);
  gatedScore = Math.max(0, Math.min(100, gatedScore));

  // === Step i: Data quality bonus ===
  const dataQualityResult = calculateDataQualityBonus(buyer);

  // === Step j: Custom instruction adjustments ===
  const customResult = applyCustomInstructionBonus(adjustments);

  // === Step k: Learning penalty ===
  const learningResult = calculateLearningPenalty(learningPattern);

  // === Step l: Final assembly ===
  let finalScore =
    gatedScore +
    thesisResult.bonus +
    dataQualityResult.bonus +
    customResult.bonus -
    learningResult.penalty;

  finalScore = Math.max(0, Math.min(100, finalScore));

  // === Check for hard disqualification ===
  let isDisqualified = false;
  let disqualificationReason: string | null = null;

  // Only disqualify on a zero multiplier when the dimension was actually active
  // (i.e. both buyer and deal had enough data for the gate to be meaningful).
  // Mirrors the effectiveSizeMultiplier / effectiveServiceMultiplier bypass logic above:
  //   effectiveSizeMultiplier = (!buyerHasSizeData || !dealHasFinancials) ? 1.0 : sizeResult.multiplier
  // Without this guard, a buyer with no size data could still be zeroed out because
  // calculateSizeScore() returns multiplier=0.0 for certain edge cases (e.g. narrow
  // buyer criteria + missing deal financials) even though the dimension was supposed
  // to be bypassed — producing composite=0 despite non-zero sub-scores (Kinderhook bug).
  if (sizeResult.multiplier === 0.0 && buyerHasSizeData && dealHasFinancials) {
    isDisqualified = true;
    disqualificationReason = sizeResult.reasoning;
    finalScore = 0;
  }
  if (serviceResult.multiplier === 0.0 && buyerHasServiceData && dealHasServices) {
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
  if (isDisqualified) tier = 'F';
  else if (finalScore >= SCORING_CONFIG.TIER_A_MIN) tier = 'A';
  else if (finalScore >= SCORING_CONFIG.TIER_B_MIN) tier = 'B';
  else if (finalScore >= SCORING_CONFIG.TIER_C_MIN) tier = 'C';
  else if (finalScore >= SCORING_CONFIG.TIER_D_MIN) tier = 'D';
  else tier = 'F';

  // === Provenance warnings ===
  const { provenanceWarnings } = assessProvenanceWarnings(buyer);

  // === Needs review flag (only in ambiguous score zone) ===
  const needsReview =
    finalScore >= SCORING_CONFIG.REVIEW_SCORE_LOW && finalScore <= SCORING_CONFIG.REVIEW_SCORE_HIGH;

  // === Build reasoning (aligned with frontend tier bands) ===
  let fitLabel: string;
  if (isDisqualified) fitLabel = 'DISQUALIFIED';
  else if (finalScore >= 80) fitLabel = 'Strong fit';
  else if (finalScore >= 65) fitLabel = 'Good fit';
  else if (finalScore >= 50) fitLabel = 'Fair fit';
  else fitLabel = 'Poor fit';

  const reasoningParts = [
    `${fitLabel}: ${geoResult.reasoning}`,
    serviceResult.reasoning,
    sizeResult.reasoning,
  ];

  if (!buyerHasSizeData) {
    reasoningParts.push(
      `Size weight redistributed (no buyer size criteria — insufficient data, not scored)`,
    );
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
  if (provenanceWarnings.length > 0) {
    reasoningParts.push(`⚠️ Data provenance: ${provenanceWarnings.join('; ')}`);
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
    acquisition_score: 0,
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
    fit_reasoning: fitReasoning,
    status: 'pending',
    scored_at: new Date().toISOString(),
    deal_snapshot: dealSnapshot,
  };
}

// ============================================================================
// SINGLE SCORE HANDLER
// ============================================================================

async function handleSingleScore(
  supabase: SupabaseClient,
  request: ScoreRequest,
  apiKey: string,
  corsHeaders: Record<string, string>,
) {
  const { listingId, buyerId, universeId, customInstructions, geographyMode } = request;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Fetch listing, buyer, universe in parallel
  const [listingRes, buyerRes, universeRes] = await Promise.all([
    supabase.from('listings').select('*').eq('id', listingId).single(),
    supabase.from('remarketing_buyers').select('*').eq('id', buyerId).single(),
    supabase.from('remarketing_buyer_universes').select('*').eq('id', universeId).single(),
  ]);

  if (listingRes.error || !listingRes.data) throw new Error('Listing not found');
  if (buyerRes.error || !buyerRes.data) throw new Error('Buyer not found');
  if (universeRes.error || !universeRes.data) throw new Error('Universe not found');

  const listing = listingRes.data as Listing;
  const buyer = buyerRes.data as Buyer;
  const universe = universeRes.data as Universe;

  // Fetch tracker if buyer has one
  let tracker: IndustryTracker | null = null;
  if (buyer.industry_tracker_id) {
    const { data } = await supabase
      .from('industry_trackers')
      .select('*')
      .eq('id', buyer.industry_tracker_id)
      .single();
    tracker = data as IndustryTracker | null;
  }

  // Apply geography mode override from request (takes precedence over tracker)
  if (geographyMode && tracker) {
    tracker = { ...tracker, geography_mode: geographyMode };
  } else if (geographyMode && !tracker) {
    tracker = { id: '', geography_mode: geographyMode };
  }

  // Fetch adjustments and learning patterns
  const [adjustments, learningPatterns] = await Promise.all([
    fetchScoringAdjustments(supabase, listingId),
    fetchLearningPatterns(supabase, [buyerId]),
  ]);

  const score = await scoreSingleBuyer(
    listing,
    buyer,
    universe,
    tracker,
    adjustments,
    learningPatterns.get(buyerId),
    apiKey,
    supabaseUrl,
    supabaseKey,
    customInstructions,
  );

  // Preserve existing status if buyer was already approved/passed
  const { data: existingScore } = await supabase
    .from('remarketing_scores')
    .select('status')
    .eq('listing_id', score.listing_id)
    .eq('buyer_id', score.buyer_id)
    .eq('universe_id', score.universe_id)
    .maybeSingle();

  if (existingScore?.status === 'approved' || existingScore?.status === 'passed') {
    score.status = existingScore.status;
  }

  // Upsert score
  const { data: savedScore, error: saveError } = await supabase
    .from('remarketing_scores')
    .upsert(score, { onConflict: 'listing_id,buyer_id,universe_id' })
    .select()
    .single();

  if (saveError) {
    console.error('Failed to save score:', saveError);
    throw new Error('Failed to save score');
  }

  // Save immutable score snapshot (non-blocking)
  saveScoreSnapshot(
    supabase,
    score,
    {
      geography: universe.geography_weight || 20,
      size: universe.size_weight || 30,
      service: universe.service_weight || 45,
      owner_goals: universe.owner_goals_weight || 5,
    },
    'manual',
  );

  return new Response(JSON.stringify({ success: true, score: savedScore }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// BULK SCORE HANDLER
// ============================================================================

async function handleBulkScore(
  supabase: SupabaseClient,
  request: BulkScoreRequest,
  apiKey: string,
  corsHeaders: Record<string, string>,
  edgeTimeout?: ReturnType<typeof createEdgeTimeoutSignal>,
) {
  const { listingId, universeId, buyerIds, customInstructions, geographyMode, options } = request;
  const rescoreExisting = options?.rescoreExisting ?? false;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  console.log('Custom instructions received:', customInstructions ? 'Yes' : 'No');

  // Fetch listing
  const { data: listingData, error: listingError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single();
  if (listingError || !listingData) throw new Error('Listing not found');
  const listing = listingData as Listing;

  // ========== DEAL SCORING READINESS VALIDATION ==========
  const dealDiagnostics = {
    warnings: [] as string[],
    data_quality: 'high' as 'high' | 'medium' | 'low',
  };

  const hasRevenue = listing.revenue !== null && listing.revenue !== undefined;
  const hasEbitda = listing.ebitda !== null && listing.ebitda !== undefined;
  const hasLocation = !!(listing.location && listing.location.trim());
  const hasServices = !!(
    (listing.services && Array.isArray(listing.services) && listing.services.length > 0) ||
    (listing.categories && Array.isArray(listing.categories) && listing.categories.length > 0) ||
    (listing.category && listing.category.trim())
  );
  const hasDescription = !!(listing.hero_description?.trim() || listing.description?.trim());

  const missingDealFields: string[] = [];
  if (!hasRevenue) missingDealFields.push('revenue');
  if (!hasEbitda) missingDealFields.push('ebitda');
  if (!hasLocation) missingDealFields.push('location');
  if (!hasServices) missingDealFields.push('services/category');
  if (!hasDescription) missingDealFields.push('description');
  if (!listing.seller_motivation) missingDealFields.push('seller_motivation');

  if (!hasRevenue && !hasEbitda) {
    dealDiagnostics.warnings.push('No financial data — size scoring will use proxy values');
  }
  if (!hasServices) {
    dealDiagnostics.warnings.push(
      'No services/category — service scoring will use weight redistribution',
    );
  }
  if (!hasLocation) {
    dealDiagnostics.warnings.push('No location — geography scoring will use weight redistribution');
  }

  const missingCount = missingDealFields.length;
  if (missingCount >= 3) {
    dealDiagnostics.data_quality = 'low';
  } else if (missingCount >= 1) {
    dealDiagnostics.data_quality = 'medium';
  }

  console.log(
    `[DealDiagnostics] Deal ${listingId}: quality=${dealDiagnostics.data_quality}, missing=[${missingDealFields.join(', ')}]`,
  );

  // Fetch universe with structured criteria
  const { data: universeData, error: universeError } = await supabase
    .from('remarketing_buyer_universes')
    .select('*')
    .eq('id', universeId)
    .single();
  if (universeError || !universeData) throw new Error('Universe not found');
  const universe = universeData as Universe;

  // Fetch buyers
  let buyerQuery = supabase
    .from('remarketing_buyers')
    .select('*')
    .eq('universe_id', universeId)
    .eq('archived', false);
  if (buyerIds && buyerIds.length > 0) buyerQuery = buyerQuery.in('id', buyerIds);

  const { data: buyers, error: buyersError } = await buyerQuery;
  if (buyersError) throw new Error('Failed to fetch buyers');
  if (!buyers || buyers.length === 0) {
    return new Response(
      JSON.stringify({ success: true, scores: [], message: 'No buyers to score' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Filter out already-scored buyers if not rescoring
  let buyersToScore = buyers as Buyer[];
  if (!rescoreExisting) {
    const { data: existingScores } = await supabase
      .from('remarketing_scores')
      .select('buyer_id')
      .eq('listing_id', listingId)
      .eq('universe_id', universeId)
      .limit(2000);
    const scoredIds = new Set((existingScores || []).map((s: { buyer_id: string }) => s.buyer_id));
    buyersToScore = buyersToScore.filter((b) => !scoredIds.has(b.id));
    if (buyersToScore.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          scores: [],
          message: 'All buyers already scored',
          totalProcessed: 0,
          totalBuyers: buyers.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  // ========== BUYER READINESS STATS ==========
  const buyerReadiness = {
    total: buyersToScore.length,
    with_services: buyersToScore.filter((b) => (b.target_services?.length ?? 0) > 0).length,
    with_geo: buyersToScore.filter(
      (b) => (b.target_geographies?.length ?? 0) > 0 || (b.geographic_footprint?.length ?? 0) > 0,
    ).length,
    with_size_criteria: buyersToScore.filter(
      (b) => b.target_revenue_min || b.target_revenue_max || b.target_ebitda_min,
    ).length,
    with_thesis: buyersToScore.filter((b) => b.thesis_summary?.trim()).length,
  };
  console.log(`[BuyerReadiness] ${JSON.stringify(buyerReadiness)}`);

  console.log(
    `Scoring ${buyersToScore.length} buyers for listing ${listingId} (rescore: ${rescoreExisting})`,
  );

  // Fetch tracker IDs for all buyers
  const trackerIds = [
    ...new Set(buyersToScore.map((b) => b.industry_tracker_id).filter(Boolean)),
  ] as string[];
  const trackerMap = new Map<string, IndustryTracker>();
  if (trackerIds.length > 0) {
    const { data: trackers } = await supabase
      .from('industry_trackers')
      .select('*')
      .in('id', trackerIds);
    for (const t of (trackers || []) as IndustryTracker[]) trackerMap.set(t.id, t);
  }

  // Fetch adjustments and learning patterns in parallel
  const allBuyerIds = buyersToScore.map((b) => b.id);
  const [adjustments, learningPatterns] = await Promise.all([
    fetchScoringAdjustments(supabase, listingId),
    fetchLearningPatterns(supabase, allBuyerIds),
  ]);

  const batchSize = SCORING_CONFIG.BULK_BATCH_SIZE;
  const scores: ScoredResult[] = [];
  const errors: string[] = [];

  for (let i = 0; i < buyersToScore.length; i += batchSize) {
    // Check if operation was paused by user
    if (await isOperationPaused(supabase, 'buyer_scoring')) {
      console.log('Scoring paused by user — stopping processing');
      break;
    }
    // Check edge function timeout
    if (edgeTimeout?.isTimedOut()) {
      console.warn(
        `Edge timeout reached at buyer batch ${i}/${buyersToScore.length} — returning partial results`,
      );
      errors.push('Edge function timeout — partial results returned');
      break;
    }

    const batch = buyersToScore.slice(i, i + batchSize);

    const batchPromises = batch.map(async (buyer: Buyer) => {
      try {
        let tracker = buyer.industry_tracker_id
          ? trackerMap.get(buyer.industry_tracker_id) || null
          : null;
        // Apply geography mode override from request
        if (geographyMode) {
          tracker = tracker
            ? { ...tracker, geography_mode: geographyMode }
            : { id: '', geography_mode: geographyMode };
        }
        return await scoreSingleBuyer(
          listing,
          buyer,
          universe,
          tracker,
          adjustments,
          learningPatterns.get(buyer.id),
          apiKey,
          supabaseUrl,
          supabaseKey,
          customInstructions,
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
        const scoreKeys = validScores.map((s) => s.buyer_id);
        const { data: existingStatuses } = await supabase
          .from('remarketing_scores')
          .select('buyer_id, status')
          .eq('listing_id', listingId)
          .eq('universe_id', universeId)
          .in('buyer_id', scoreKeys);

        const statusMap = new Map<string, string>();
        for (const es of (existingStatuses || []) as { buyer_id: string; status: string }[]) {
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
        .from('remarketing_scores')
        .upsert(validScores, { onConflict: 'listing_id,buyer_id,universe_id' })
        .select();

      if (saveError) {
        console.error('Failed to save batch scores:', saveError);
        errors.push('Failed to save some scores');
      } else {
        scores.push(...((savedScores || []) as ScoredResult[]));

        // Save immutable score snapshots for bulk scoring (non-blocking)
        for (const s of validScores) {
          saveScoreSnapshot(
            supabase,
            s,
            {
              geography: universe.geography_weight || 20,
              size: universe.size_weight || 30,
              service: universe.service_weight || 45,
              owner_goals: universe.owner_goals_weight || 5,
            },
            'bulk',
          );
        }
      }
    }

    // Report progress to global activity queue
    const batchSucceeded = validScores.length;
    const batchFailed =
      batch.length - batchResults.filter((s): s is NonNullable<typeof s> => s !== null).length;
    if (batchSucceeded > 0) {
      await updateGlobalQueueProgress(supabase, 'buyer_scoring', {
        completedDelta: batchSucceeded,
      });
    }
    if (batchFailed > 0) {
      await updateGlobalQueueProgress(supabase, 'buyer_scoring', { failedDelta: batchFailed });
    }

    // Adaptive rate limit delay — increase for large runs to avoid API rate limits
    if (i + batchSize < buyersToScore.length) {
      const delay =
        buyersToScore.length > 100
          ? SCORING_CONFIG.BULK_DELAY_LARGE
          : buyersToScore.length > 50
            ? SCORING_CONFIG.BULK_DELAY_MEDIUM
            : SCORING_CONFIG.BULK_DELAY_SMALL;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // ========== SCORING SUMMARY & GUARDRAILS ==========
  const qualifiedCount = scores.filter((s) => s.composite_score >= 50).length;
  const disqualifiedCount = scores.filter((s) => s.composite_score < 50).length;
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + (s.composite_score || 0), 0) / scores.length)
      : 0;

  if (qualifiedCount === 0 && scores.length > 0) {
    console.warn(
      `[ScoringGuardrail] ALL ${scores.length} buyers disqualified for deal ${listingId}. Avg score: ${avgScore}. Deal data quality: ${dealDiagnostics.data_quality}. Missing: [${missingDealFields.join(', ')}]`,
    );
  }

  if (scores.length > 5) {
    const scoreValues = scores.map((s) => s.composite_score || 0);
    const minScore = Math.min(...scoreValues);
    const maxScore = Math.max(...scoreValues);
    if (maxScore - minScore < 10) {
      console.warn(
        `[ScoringGuardrail] Tight score band detected (${minScore}-${maxScore}). Possible mapping break or defaulting.`,
      );
      dealDiagnostics.warnings.push(
        `All scores clustered in tight band (${minScore}-${maxScore}) — possible data issue`,
      );
    }
  }

  await completeGlobalQueueOperation(
    supabase,
    'buyer_scoring',
    errors.length > 0 ? 'failed' : 'completed',
  );

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
        },
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
