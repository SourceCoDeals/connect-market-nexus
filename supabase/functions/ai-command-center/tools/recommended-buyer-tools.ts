/**
 * Recommended Buyer Tools
 * Feature 1: Recommended Buyers & Strategy Narrative
 *
 * get_recommended_buyers — returns a ranked buyer list synthesized from:
 *   - remarketing_scores (composite fit scoring)
 *   - remarketing_buyers (buyer profile, thesis, targets)
 *   - remarketing_buyer_universes (universe context, fit criteria, M&A guide)
 *   - call_transcripts (buyer-deal call insights, CEO detection, key quotes)
 *   - buyer_transcripts (buyer's own Fireflies call attachments)
 *   - deal_transcripts (deal meeting context, extracted data)
 *   - outreach_records (NDA/memo/meeting funnel status)
 *   - connection_requests (engagement tracking)
 *   - listings (full deal context: thesis, owner goals, business model)
 *
 * generate_buyer_narrative — returns a structured written strategy narrative
 *   suitable for strategy calls, team alignment, and deal notes.
 *   Includes transcript insights, universe context, and outreach status.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from '../../_shared/claude-client.ts';
import type { ToolResult } from './index.ts';

// ---------- Tool definitions ----------

export const recommendedBuyerTools: ClaudeTool[] = [
  {
    name: 'get_recommended_buyers',
    description: `Get AI-ranked recommended buyers for a specific deal. Synthesizes data across ALL sources: remarketing scores, buyer profiles, buyer universes, Fireflies transcripts, call recordings, outreach funnel status, deal signals, and marketplace listing details.
USE WHEN: "who should we target for this deal?", "recommended buyers for [deal]", "show me the best buyers for [deal]", "buyer shortlist".
Returns ranked buyer cards with: fit score (0-100), top fit signals, fee agreement status, last engagement, tier classification (Move Now / Strong Candidates / Speculative), transcript insights (CEO detected, key quotes, call count), outreach funnel status (NDA/memo/meeting), and universe context.`,
    input_schema: {
      type: 'object',
      properties: {
        deal_id: {
          type: 'string',
          description: 'The deal/listing UUID to get recommended buyers for',
        },
        min_score: {
          type: 'number',
          description: 'Minimum composite fit score threshold (default 0)',
        },
        buyer_type: {
          type: 'string',
          description:
            'Filter by buyer type (e.g. "pe_platform", "strategic", "independent_sponsor")',
        },
        has_fee_agreement: {
          type: 'boolean',
          description: 'Filter to only buyers with signed fee agreements',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 25, max 100)',
        },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'generate_buyer_narrative',
    description: `Generate a written buyer strategy narrative for a deal — a structured document suitable for reading in strategy calls, saving to deal notes, or sharing with the team. Synthesizes across Fireflies transcripts, buyer universes, marketplace listings, and scoring data.
USE WHEN: "write a buyer strategy for [deal]", "generate buyer narrative", "prepare buyer briefing", "strategy narrative for [deal]".
Returns: deal framing (with investment thesis and owner goals), ranked buyer entries with 3-5 sentence rationale including transcript quotes, tier summary, outreach funnel status, and top 5 recommended actions.
The narrative references specific data points (scores, engagement dates, agreement status, call quotes) rather than generic statements.`,
    input_schema: {
      type: 'object',
      properties: {
        deal_id: {
          type: 'string',
          description: 'The deal/listing UUID to generate narrative for',
        },
        top_n: {
          type: 'number',
          description: 'Number of top buyers to include in the narrative (default 10)',
        },
        include_speculative: {
          type: 'boolean',
          description: 'Include speculative tier buyers below score 60 (default false)',
        },
      },
      required: ['deal_id'],
    },
  },
];

// ---------- Executor ----------

export async function executeRecommendedBuyerTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_recommended_buyers':
      return getRecommendedBuyers(supabase, args);
    case 'generate_buyer_narrative':
      return generateBuyerNarrative(supabase, args);
    default:
      return { error: `Unknown recommended buyer tool: ${toolName}` };
  }
}

// ---------- Types ----------

interface TranscriptInsight {
  call_count: number;
  ceo_detected: boolean;
  key_quotes: string[];
  call_types: string[];
  latest_call_date: string | null;
  buyer_transcript_count: number;
  buyer_thesis_from_calls: string | null;
}

interface OutreachStatus {
  contacted: boolean;
  contacted_at: string | null;
  nda_sent: boolean;
  nda_signed: boolean;
  cim_sent: boolean;
  meeting_scheduled: boolean;
  outcome: string | null;
  next_action: string | null;
  next_action_date: string | null;
}

interface RankedBuyer {
  buyer_id: string;
  company_name: string;
  pe_firm_name: string | null;
  buyer_type: string | null;
  hq_state: string | null;
  hq_city: string | null;
  geographic_footprint: string[];
  target_services: string[];
  target_industries: string[];
  target_revenue_min: number | null;
  target_revenue_max: number | null;
  target_ebitda_min: number | null;
  target_ebitda_max: number | null;
  acquisition_appetite: string | null;
  has_fee_agreement: boolean;
  thesis_summary: string | null;
  alignment_score: number | null;
  // Score components
  composite_fit_score: number;
  geography_score: number;
  size_score: number;
  service_score: number;
  owner_goals_score: number;
  // Computed
  fit_signals: string[];
  tier: 'move_now' | 'strong_candidate' | 'speculative';
  tier_label: string;
  // Engagement
  last_engagement: string | null;
  last_engagement_type: string | null;
  days_since_engagement: number | null;
  engagement_cold: boolean;
  // Score metadata
  score_status: string | null;
  fit_reasoning: string | null;
  human_override_score: number | null;
  pass_reason: string | null;
  // NEW: Transcript insights
  transcript_insights: TranscriptInsight;
  // NEW: Outreach funnel status
  outreach_status: OutreachStatus;
  // NEW: Universe context
  universe_name: string | null;
}

// ---------- Helpers ----------

function computeFitSignals(
  buyer: Record<string, unknown>,
  deal: Record<string, unknown>,
  score: Record<string, unknown>,
  transcriptInsight: TranscriptInsight,
  outreach: OutreachStatus,
): string[] {
  const signals: string[] = [];

  // CEO detection from transcript — highest priority signal
  if (transcriptInsight.ceo_detected) {
    signals.push('CEO/owner participated in buyer call');
  }

  // Geographic match
  const geoScore = Number(score.geography_score || 0);
  if (geoScore >= 80) {
    const buyerState = buyer.hq_state as string;
    const dealStates = (deal.geographic_states as string[]) || [];
    const dealLocation = (deal.location as string) || '';
    if (
      buyerState &&
      (dealLocation.toLowerCase().includes(buyerState.toLowerCase()) ||
        dealStates.some((s: string) => s === buyerState))
    ) {
      signals.push(`HQ in ${buyerState} — direct geographic match`);
    } else {
      signals.push('Strong geographic footprint overlap');
    }
  } else if (geoScore >= 60) {
    signals.push('Regional geographic proximity');
  }

  // Size fit
  const sizeScore = Number(score.size_score || 0);
  if (sizeScore >= 80) {
    signals.push('EBITDA and revenue within target range');
  } else if (sizeScore >= 60) {
    signals.push('Size within broader acquisition criteria');
  }

  // Service/sector match
  const svcScore = Number(score.service_score || 0);
  if (svcScore >= 80) {
    signals.push('Core service/sector alignment');
  } else if (svcScore >= 60) {
    signals.push('Related service/sector match');
  }

  // Acquisition appetite
  const appetite = (buyer.acquisition_appetite as string) || '';
  if (['aggressive', 'active'].includes(appetite.toLowerCase())) {
    signals.push(`${appetite.charAt(0).toUpperCase() + appetite.slice(1)} acquisition mandate`);
  }

  // Fee agreement
  if (buyer.has_fee_agreement) {
    signals.push('Fee agreement signed');
  }

  // NDA signed (from outreach)
  if (outreach.nda_signed) {
    signals.push('NDA executed');
  }

  // Call engagement
  if (transcriptInsight.call_count > 0) {
    signals.push(`${transcriptInsight.call_count} call(s) on record`);
  }

  // Total acquisitions
  const totalAcqs = Number(buyer.total_acquisitions || 0);
  if (totalAcqs >= 5) {
    signals.push(`${totalAcqs} prior acquisitions — proven acquirer`);
  }

  // Limit to top 5 (increased from 3 with richer data)
  return signals.slice(0, 5);
}

function classifyTier(
  score: number,
  hasFeeAgreement: boolean,
  appetite: string,
): { tier: 'move_now' | 'strong_candidate' | 'speculative'; label: string } {
  const isActive = ['aggressive', 'active'].includes((appetite || '').toLowerCase());

  if (score >= 80 && (hasFeeAgreement || isActive)) {
    return { tier: 'move_now', label: 'Move Now' };
  }
  if (score >= 60) {
    return { tier: 'strong_candidate', label: 'Strong Candidate' };
  }
  return { tier: 'speculative', label: 'Speculative' };
}

const EMPTY_TRANSCRIPT_INSIGHT: TranscriptInsight = {
  call_count: 0,
  ceo_detected: false,
  key_quotes: [],
  call_types: [],
  latest_call_date: null,
  buyer_transcript_count: 0,
  buyer_thesis_from_calls: null,
};

const EMPTY_OUTREACH: OutreachStatus = {
  contacted: false,
  contacted_at: null,
  nda_sent: false,
  nda_signed: false,
  cim_sent: false,
  meeting_scheduled: false,
  outcome: null,
  next_action: null,
  next_action_date: null,
};

// ---------- Implementations ----------

async function getRecommendedBuyers(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const minScore = Number(args.min_score || 0);
  const limit = Math.min(Number(args.limit) || 25, 100);

  // ──────────────────────────────────────────────
  // Phase 1: Get deal, scores, and universe context in parallel
  // ──────────────────────────────────────────────

  let scoreQuery = supabase
    .from('remarketing_scores')
    .select(
      `buyer_id, composite_score, geography_score, service_score, size_score, owner_goals_score,
       tier, status, fit_reasoning, pass_reason, human_override_score,
       is_disqualified, disqualification_reason, universe_id`,
    )
    .eq('listing_id', dealId)
    .or('is_disqualified.eq.false,is_disqualified.is.null')
    .order('composite_score', { ascending: false })
    .limit(limit * 2);

  if (minScore > 0) {
    scoreQuery = scoreQuery.gte('composite_score', minScore);
  }

  const [dealResult, scoresResult, universeDealsResult, dealTranscriptsResult] = await Promise.all([
    // 1a. Full deal/listing context (enriched fields)
    supabase
      .from('listings')
      .select(
        `id, title, revenue, ebitda, ebitda_margin, location, category, categories, services,
         address_state, geographic_states, internal_company_name,
         investment_thesis, executive_summary, business_model, owner_goals,
         customer_concentration, customer_geography, growth_trajectory, key_risks,
         status, deal_source`,
      )
      .eq('id', dealId)
      .single(),

    // 1b. Scored buyers
    scoreQuery,

    // 1c. Universe-deal mappings (which universes is this deal in?)
    supabase
      .from('remarketing_universe_deals')
      .select(
        `universe_id, status,
         remarketing_buyer_universes(id, name, fit_criteria, size_criteria, geography_criteria, service_criteria)`,
      )
      .eq('listing_id', dealId)
      .eq('status', 'active'),

    // 1d. Deal transcripts (Fireflies recordings for this deal)
    supabase
      .from('deal_transcripts')
      .select(
        `id, title, duration_minutes, meeting_attendees, extracted_data,
         source, call_date, created_at`,
      )
      .eq('listing_id', dealId)
      .eq('has_content', true)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const dealData = dealResult.data;
  const dealError = dealResult.error;
  const scores = scoresResult.data;
  const scoresError = scoresResult.error;
  const universeDeals = universeDealsResult.data;
  const dealTranscripts = dealTranscriptsResult.data;

  if (dealError) {
    return { error: `Could not find deal: ${dealError.message}` };
  }
  if (scoresError) {
    return { error: `Failed to fetch scores: ${scoresError.message}` };
  }

  if (!scores || scores.length === 0) {
    return {
      data: {
        buyers: [],
        total: 0,
        deal: buildDealContext(dealData),
        universe_context: buildUniverseContext(universeDeals),
        deal_transcripts_count: (dealTranscripts || []).length,
        suggestion:
          'No scored buyers found for this deal. The deal may not have a buyer universe built yet. Check remarketing matching to score buyers.',
      },
    };
  }

  // ──────────────────────────────────────────────
  // Phase 2: Fetch buyer details and cross-source data in parallel
  // ──────────────────────────────────────────────

  const buyerIds = scores.map((s: Record<string, unknown>) => s.buyer_id as string);

  // Build universe context map (universe_id → universe info)
  const universeMap = new Map<string, Record<string, unknown>>();
  if (universeDeals) {
    for (const ud of universeDeals) {
      const universe = ud.remarketing_buyer_universes as Record<string, unknown>;
      if (universe) {
        universeMap.set(ud.universe_id as string, universe);
      }
    }
  }

  let buyerQuery = supabase
    .from('remarketing_buyers')
    .select(
      `id, company_name, pe_firm_name, buyer_type, hq_state, hq_city,
       geographic_footprint, target_services, target_industries,
       target_revenue_min, target_revenue_max, target_ebitda_min, target_ebitda_max,
       acquisition_appetite, has_fee_agreement, thesis_summary, alignment_score,
       total_acquisitions, archived, universe_id`,
    )
    .in('id', buyerIds)
    .eq('archived', false);

  if (args.buyer_type) {
    buyerQuery = buyerQuery.eq('buyer_type', args.buyer_type as string);
  }
  if (args.has_fee_agreement === true) {
    buyerQuery = buyerQuery.eq('has_fee_agreement', true);
  }

  const [
    buyersResult,
    connectionsResult,
    callTranscriptsResult,
    buyerTranscriptsResult,
    outreachResult,
  ] = await Promise.all([
    // 2a. Buyer profiles
    buyerQuery,

    // 2b. Connection requests (engagement)
    supabase
      .from('connection_requests')
      .select('id, buyer_profile_id, status, updated_at, created_at')
      .eq('listing_id', dealId)
      .in('buyer_profile_id', buyerIds)
      .order('updated_at', { ascending: false }),

    // 2c. Call transcripts — buyer-specific calls for this deal
    supabase
      .from('call_transcripts')
      .select(
        `id, buyer_id, call_date, call_type, call_duration_minutes,
         ceo_detected, key_quotes, extracted_insights, processing_status`,
      )
      .eq('listing_id', dealId)
      .in('buyer_id', buyerIds)
      .order('call_date', { ascending: false }),

    // 2d. Buyer transcripts — Fireflies calls buyers manually attached
    supabase
      .from('buyer_transcripts')
      .select(
        `id, buyer_id, title, call_date, summary, key_points,
         extracted_insights, extraction_status`,
      )
      .in('buyer_id', buyerIds)
      .order('call_date', { ascending: false }),

    // 2e. Outreach records — NDA/memo/meeting funnel
    supabase
      .from('outreach_records')
      .select(
        `id, buyer_id, contacted_at, nda_sent_at, nda_signed_at,
         cim_sent_at, meeting_scheduled_at, outcome, outcome_notes,
         next_action, next_action_date, priority`,
      )
      .eq('listing_id', dealId)
      .in('buyer_id', buyerIds)
      .order('updated_at', { ascending: false }),
  ]);

  const buyers = buyersResult.data;
  const buyersError = buyersResult.error;
  if (buyersError) {
    return { error: `Failed to fetch buyers: ${buyersError.message}` };
  }

  // deno-lint-ignore no-explicit-any
  const buyerMap = new Map((buyers || []).map((b: any) => [b.id, b as Record<string, unknown>]));

  // ──────────────────────────────────────────────
  // Phase 3: Build enrichment maps
  // ──────────────────────────────────────────────

  // 3a. Engagement map from connection_requests
  const engagementMap = new Map<string, { last_date: string; type: string }>();
  if (connectionsResult.data) {
    for (const conn of connectionsResult.data) {
      const buyerId = conn.buyer_profile_id as string;
      if (!engagementMap.has(buyerId)) {
        engagementMap.set(buyerId, {
          last_date: conn.updated_at || conn.created_at,
          type: `Connection request (${conn.status})`,
        });
      }
    }
  }

  // 3b. Transcript insights map (buyer_id → insights from all transcript sources)
  const transcriptMap = new Map<string, TranscriptInsight>();

  // Process call_transcripts (buyer-specific calls on this deal)
  if (callTranscriptsResult.data) {
    for (const ct of callTranscriptsResult.data) {
      const buyerId = ct.buyer_id as string;
      const existing = transcriptMap.get(buyerId) || { ...EMPTY_TRANSCRIPT_INSIGHT };

      existing.call_count++;
      if (ct.ceo_detected) existing.ceo_detected = true;
      if (ct.call_type) existing.call_types.push(ct.call_type as string);
      if (
        ct.call_date &&
        (!existing.latest_call_date || ct.call_date > existing.latest_call_date)
      ) {
        existing.latest_call_date = ct.call_date as string;
      }

      // Extract key quotes (limit to 3 most recent)
      const quotes = (ct.key_quotes as string[]) || [];
      for (const q of quotes) {
        if (existing.key_quotes.length < 3 && q.length > 10) {
          existing.key_quotes.push(q.length > 200 ? q.slice(0, 200) + '...' : q);
        }
      }

      // Extract buyer thesis/criteria from call insights
      const insights = ct.extracted_insights as Record<string, unknown> | null;
      if (insights?.buyer_criteria && !existing.buyer_thesis_from_calls) {
        const criteria = insights.buyer_criteria;
        existing.buyer_thesis_from_calls =
          typeof criteria === 'string'
            ? criteria.slice(0, 300)
            : JSON.stringify(criteria).slice(0, 300);
      }

      transcriptMap.set(buyerId, existing);
    }
  }

  // Process buyer_transcripts (Fireflies calls buyers manually attached)
  if (buyerTranscriptsResult.data) {
    for (const bt of buyerTranscriptsResult.data) {
      const buyerId = bt.buyer_id as string;
      const existing = transcriptMap.get(buyerId) || { ...EMPTY_TRANSCRIPT_INSIGHT };

      existing.buyer_transcript_count++;

      // If we don't have a thesis from call transcripts, try buyer transcripts
      if (!existing.buyer_thesis_from_calls) {
        const insights = bt.extracted_insights as Record<string, unknown> | null;
        if (insights?.buyer_preferences) {
          const prefs = insights.buyer_preferences;
          existing.buyer_thesis_from_calls =
            typeof prefs === 'string' ? prefs.slice(0, 300) : JSON.stringify(prefs).slice(0, 300);
        }
      }

      // Add key points as supplementary quotes
      const keyPoints = (bt.key_points as string[]) || [];
      for (const kp of keyPoints) {
        if (existing.key_quotes.length < 3 && kp.length > 10) {
          existing.key_quotes.push(kp.length > 200 ? kp.slice(0, 200) + '...' : kp);
        }
      }

      transcriptMap.set(buyerId, existing);
    }
  }

  // 3c. Outreach funnel map
  const outreachMap = new Map<string, OutreachStatus>();
  if (outreachResult.data) {
    for (const or of outreachResult.data) {
      const buyerId = or.buyer_id as string;
      if (!outreachMap.has(buyerId)) {
        outreachMap.set(buyerId, {
          contacted: !!or.contacted_at,
          contacted_at: (or.contacted_at as string) || null,
          nda_sent: !!or.nda_sent_at,
          nda_signed: !!or.nda_signed_at,
          cim_sent: !!or.cim_sent_at,
          meeting_scheduled: !!or.meeting_scheduled_at,
          outcome: (or.outcome as string) || null,
          next_action: (or.next_action as string) || null,
          next_action_date: (or.next_action_date as string) || null,
        });
      }
    }
  }

  // ──────────────────────────────────────────────
  // Phase 4: Build ranked buyer list with all enrichments
  // ──────────────────────────────────────────────

  const now = Date.now();
  const rankedBuyers: RankedBuyer[] = [];

  for (const score of scores) {
    const buyer = buyerMap.get(score.buyer_id);
    if (!buyer) continue;

    const compositeScore = Number(score.human_override_score ?? score.composite_score ?? 0);
    const appetite = (buyer.acquisition_appetite as string) || '';
    const hasFee = !!buyer.has_fee_agreement;
    const { tier, label } = classifyTier(compositeScore, hasFee, appetite);

    const transcriptInsight =
      transcriptMap.get(score.buyer_id as string) || EMPTY_TRANSCRIPT_INSIGHT;
    const outreach = outreachMap.get(score.buyer_id as string) || EMPTY_OUTREACH;
    const fitSignals = computeFitSignals(buyer, dealData, score, transcriptInsight, outreach);

    // Engagement: combine connection_requests with outreach/transcript dates
    const engagement = engagementMap.get(score.buyer_id as string);
    let lastEngDate = engagement?.last_date || null;
    let lastEngType = engagement?.type || null;

    // Check if outreach or transcript has more recent engagement
    if (outreach.contacted_at && (!lastEngDate || outreach.contacted_at > lastEngDate)) {
      lastEngDate = outreach.contacted_at;
      lastEngType = outreach.outcome ? `Outreach (${outreach.outcome})` : 'Outreach initiated';
    }
    if (
      transcriptInsight.latest_call_date &&
      (!lastEngDate || transcriptInsight.latest_call_date > lastEngDate)
    ) {
      lastEngDate = transcriptInsight.latest_call_date;
      lastEngType = `Call (${transcriptInsight.call_types[0] || 'recorded'})`;
    }

    let daysSinceEngagement: number | null = null;
    if (lastEngDate) {
      daysSinceEngagement = Math.floor(
        (now - new Date(lastEngDate).getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    // Resolve universe name from score's universe_id
    let universeName: string | null = null;
    const scoreUniverseId = score.universe_id as string | null;
    if (scoreUniverseId && universeMap.has(scoreUniverseId)) {
      universeName = (universeMap.get(scoreUniverseId) as Record<string, unknown>).name as string;
    } else if (buyer.universe_id) {
      // Fallback: check if buyer's universe is in our map
      const buyerUniverse = universeMap.get(buyer.universe_id as string);
      if (buyerUniverse) universeName = buyerUniverse.name as string;
    }

    rankedBuyers.push({
      buyer_id: score.buyer_id,
      company_name: buyer.company_name,
      pe_firm_name: buyer.pe_firm_name,
      buyer_type: buyer.buyer_type,
      hq_state: buyer.hq_state,
      hq_city: buyer.hq_city,
      geographic_footprint: buyer.geographic_footprint || [],
      target_services: buyer.target_services || [],
      target_industries: buyer.target_industries || [],
      target_revenue_min: buyer.target_revenue_min,
      target_revenue_max: buyer.target_revenue_max,
      target_ebitda_min: buyer.target_ebitda_min,
      target_ebitda_max: buyer.target_ebitda_max,
      acquisition_appetite: buyer.acquisition_appetite,
      has_fee_agreement: hasFee,
      thesis_summary: buyer.thesis_summary,
      alignment_score: buyer.alignment_score,
      composite_fit_score: compositeScore,
      geography_score: Number(score.geography_score || 0),
      size_score: Number(score.size_score || 0),
      service_score: Number(score.service_score || 0),
      owner_goals_score: Number(score.owner_goals_score || 0),
      fit_signals: fitSignals,
      tier,
      tier_label: label,
      last_engagement: lastEngDate,
      last_engagement_type: lastEngType,
      days_since_engagement: daysSinceEngagement,
      engagement_cold: daysSinceEngagement !== null ? daysSinceEngagement > 90 : true,
      score_status: score.status,
      fit_reasoning: score.fit_reasoning,
      human_override_score: score.human_override_score,
      pass_reason: score.pass_reason,
      transcript_insights: transcriptInsight,
      outreach_status: outreach,
      universe_name: universeName,
    });
  }

  // Sort: composite score desc → fee agreement → appetite → transcript engagement
  rankedBuyers.sort((a, b) => {
    if (b.composite_fit_score !== a.composite_fit_score)
      return b.composite_fit_score - a.composite_fit_score;
    if (a.has_fee_agreement !== b.has_fee_agreement) return a.has_fee_agreement ? -1 : 1;
    // Buyers with transcript engagement rank higher at same score
    if (a.transcript_insights.call_count !== b.transcript_insights.call_count)
      return b.transcript_insights.call_count - a.transcript_insights.call_count;
    const appetiteOrder: Record<string, number> = {
      aggressive: 0,
      active: 1,
      selective: 2,
      opportunistic: 3,
    };
    return (
      (appetiteOrder[(a.acquisition_appetite || '').toLowerCase()] ?? 4) -
      (appetiteOrder[(b.acquisition_appetite || '').toLowerCase()] ?? 4)
    );
  });

  const finalBuyers = rankedBuyers.slice(0, limit);

  // Tier counts
  const tierCounts = {
    move_now: finalBuyers.filter((b) => b.tier === 'move_now').length,
    strong_candidate: finalBuyers.filter((b) => b.tier === 'strong_candidate').length,
    speculative: finalBuyers.filter((b) => b.tier === 'speculative').length,
  };

  // Aggregate stats
  const withTranscripts = finalBuyers.filter((b) => b.transcript_insights.call_count > 0).length;
  const withOutreach = finalBuyers.filter((b) => b.outreach_status.contacted).length;
  const withCeoEngagement = finalBuyers.filter((b) => b.transcript_insights.ceo_detected).length;

  return {
    data: {
      buyers: finalBuyers,
      total: finalBuyers.length,
      total_scored: scores.length,
      deal: buildDealContext(dealData),
      universe_context: buildUniverseContext(universeDeals),
      deal_transcripts_summary: buildDealTranscriptsSummary(dealTranscripts),
      tier_summary: tierCounts,
      data_source_stats: {
        buyers_with_call_transcripts: withTranscripts,
        buyers_with_outreach_records: withOutreach,
        buyers_with_ceo_engagement: withCeoEngagement,
        deal_transcripts_count: (dealTranscripts || []).length,
        universes_linked: universeMap.size,
      },
      filters_applied: {
        ...(args.min_score ? { min_score: args.min_score } : {}),
        ...(args.buyer_type ? { buyer_type: args.buyer_type } : {}),
        ...(args.has_fee_agreement ? { has_fee_agreement: args.has_fee_agreement } : {}),
      },
      cached_at: new Date().toISOString(),
    },
  };
}

// ---------- Context builders ----------

function buildDealContext(deal: Record<string, unknown>): Record<string, unknown> {
  return {
    id: deal.id,
    title: deal.title,
    internal_company_name: deal.internal_company_name,
    revenue: deal.revenue,
    ebitda: deal.ebitda,
    ebitda_margin: deal.ebitda_margin,
    location: deal.location,
    address_state: deal.address_state,
    geographic_states: deal.geographic_states,
    category: deal.category,
    categories: deal.categories,
    services: deal.services,
    investment_thesis: deal.investment_thesis,
    executive_summary: deal.executive_summary,
    business_model: deal.business_model,
    owner_goals: deal.owner_goals,
    customer_concentration: deal.customer_concentration,
    customer_geography: deal.customer_geography,
    growth_trajectory: deal.growth_trajectory,
    key_risks: deal.key_risks,
    status: deal.status,
    deal_source: deal.deal_source,
  };
}

function buildUniverseContext(
  universeDeals: Array<Record<string, unknown>> | null,
): Array<Record<string, unknown>> {
  if (!universeDeals || universeDeals.length === 0) return [];

  return universeDeals.map((ud) => {
    const universe = ud.remarketing_buyer_universes as Record<string, unknown>;
    return {
      universe_id: ud.universe_id,
      name: universe?.name || 'Unknown',
      fit_criteria: universe?.fit_criteria || null,
      size_criteria: universe?.size_criteria || null,
      geography_criteria: universe?.geography_criteria || null,
      service_criteria: universe?.service_criteria || null,
    };
  });
}

function buildDealTranscriptsSummary(
  transcripts: Array<Record<string, unknown>> | null,
): Record<string, unknown> {
  if (!transcripts || transcripts.length === 0) {
    return { count: 0, recordings: [] };
  }

  return {
    count: transcripts.length,
    recordings: transcripts.slice(0, 5).map((t) => {
      const extracted = t.extracted_data as Record<string, unknown> | null;
      return {
        id: t.id,
        title: t.title,
        duration_minutes: t.duration_minutes,
        source: t.source,
        date: t.call_date || t.created_at,
        has_extracted_data: !!extracted,
        buyer_criteria_extracted: !!extracted?.buyer_criteria,
        summarized: !!extracted?.ai_summarized_at,
      };
    }),
  };
}

// ---------- Narrative generation ----------

async function generateBuyerNarrative(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const topN = Math.min(Number(args.top_n) || 10, 25);
  const includeSpeculative = args.include_speculative === true;

  // Reuse get_recommended_buyers which now pulls all data sources
  const buyersResult = await getRecommendedBuyers(supabase, {
    deal_id: dealId,
    limit: includeSpeculative ? topN + 10 : topN,
    min_score: includeSpeculative ? 0 : 40,
  });

  if (buyersResult.error) {
    return { error: buyersResult.error };
  }

  const resultData = buyersResult.data as Record<string, unknown>;
  const buyers = (resultData.buyers || []) as RankedBuyer[];
  const deal = resultData.deal as Record<string, unknown>;
  const tierSummary = resultData.tier_summary as Record<string, number>;
  const universeContext = (resultData.universe_context || []) as Array<Record<string, unknown>>;
  const dealTranscripts = resultData.deal_transcripts_summary as Record<string, unknown>;
  const dataStats = resultData.data_source_stats as Record<string, number>;

  if (buyers.length === 0) {
    return {
      data: {
        narrative:
          'No scored buyers are available for this deal. A buyer universe needs to be built and scored before generating a strategy narrative.',
        deal,
        buyer_count: 0,
      },
    };
  }

  const narrativeBuyers = buyers.slice(0, topN);

  // Build structured narrative
  const dealTitle = (deal.internal_company_name || deal.title) as string;
  const revenue = deal.revenue
    ? `$${(Number(deal.revenue) / 1_000_000).toFixed(1)}M`
    : 'undisclosed';
  const ebitda = deal.ebitda ? `$${(Number(deal.ebitda) / 1_000_000).toFixed(1)}M` : 'undisclosed';
  const location = (deal.location as string) || 'location undisclosed';
  const category = (deal.category as string) || 'general services';

  // Section 1: Deal framing (enriched with thesis, owner goals, universe context)
  let dealFraming = `${dealTitle} is a ${category} business based in ${location} with approximately ${revenue} in revenue and ${ebitda} in EBITDA.`;

  if (deal.investment_thesis) {
    dealFraming += ` Investment thesis: ${(deal.investment_thesis as string).slice(0, 300)}.`;
  }
  if (deal.owner_goals) {
    dealFraming += ` Owner goals: ${(deal.owner_goals as string).slice(0, 200)}.`;
  }
  if (deal.business_model) {
    dealFraming += ` Business model: ${(deal.business_model as string).slice(0, 200)}.`;
  }

  dealFraming += ` Based on alignment scoring across ${(resultData.total_scored as number) || buyers.length} evaluated buyers, ${tierSummary.move_now || 0} are classified as "Move Now" candidates, ${tierSummary.strong_candidate || 0} as "Strong Candidates", and ${tierSummary.speculative || 0} as "Speculative".`;

  // Universe context line
  if (universeContext.length > 0) {
    const universeNames = universeContext.map((u) => u.name as string).join(', ');
    dealFraming += ` This deal is part of the ${universeNames} universe(s).`;
  }

  // Data sources line
  const sourceParts: string[] = [];
  if (dataStats.buyers_with_call_transcripts > 0) {
    sourceParts.push(`${dataStats.buyers_with_call_transcripts} buyers with call transcripts`);
  }
  if (dataStats.buyers_with_ceo_engagement > 0) {
    sourceParts.push(`${dataStats.buyers_with_ceo_engagement} with CEO engagement`);
  }
  if (dataStats.buyers_with_outreach_records > 0) {
    sourceParts.push(`${dataStats.buyers_with_outreach_records} with outreach on record`);
  }
  if ((dealTranscripts.count as number) > 0) {
    sourceParts.push(`${dealTranscripts.count} deal recordings`);
  }
  if (sourceParts.length > 0) {
    dealFraming += ` Data synthesized from: ${sourceParts.join(', ')}.`;
  }

  // Section 2: Per-buyer entries (enriched with transcript quotes, outreach status)
  const buyerEntries = narrativeBuyers.map((b, idx) => {
    const rank = idx + 1;
    const name = b.pe_firm_name ? `${b.company_name} (${b.pe_firm_name})` : b.company_name;
    const typeLabel = (b.buyer_type || 'buyer').replace(/_/g, ' ');
    const hq = [b.hq_city, b.hq_state].filter(Boolean).join(', ') || 'HQ undisclosed';
    const feeStatus = b.has_fee_agreement ? 'Fee agreement signed' : 'No fee agreement';

    const signals =
      b.fit_signals.length > 0
        ? b.fit_signals.join('; ')
        : 'General alignment based on sector and geography criteria';

    const engagementNote = b.last_engagement
      ? `Last engaged ${b.days_since_engagement} days ago (${b.last_engagement_type}).`
      : 'No recent engagement recorded.';

    // Outreach funnel status
    let outreachNote = '';
    if (b.outreach_status.contacted) {
      const stages: string[] = [];
      if (b.outreach_status.nda_signed) stages.push('NDA signed');
      else if (b.outreach_status.nda_sent) stages.push('NDA sent');
      if (b.outreach_status.cim_sent) stages.push('Memo sent');
      if (b.outreach_status.meeting_scheduled) stages.push('Meeting scheduled');
      if (b.outreach_status.outcome) stages.push(`Outcome: ${b.outreach_status.outcome}`);
      if (stages.length > 0) {
        outreachNote = ` Outreach status: ${stages.join(', ')}.`;
      }
    }

    // Transcript insights
    let transcriptNote = '';
    if (b.transcript_insights.call_count > 0) {
      const parts: string[] = [];
      parts.push(`${b.transcript_insights.call_count} call(s) on record`);
      if (b.transcript_insights.ceo_detected) parts.push('CEO/owner participated');
      if (b.transcript_insights.call_types.length > 0) {
        const uniqueTypes = [...new Set(b.transcript_insights.call_types)];
        parts.push(`Types: ${uniqueTypes.join(', ')}`);
      }
      transcriptNote = ` Call intelligence: ${parts.join('; ')}.`;
    }

    // Key quote (if available)
    let quoteNote = '';
    if (b.transcript_insights.key_quotes.length > 0) {
      const quote = b.transcript_insights.key_quotes[0];
      quoteNote = ` Key quote: "${quote}"`;
    }

    // Buyer thesis from transcripts
    let thesisNote = '';
    if (b.transcript_insights.buyer_thesis_from_calls) {
      thesisNote = ` From calls: ${b.transcript_insights.buyer_thesis_from_calls.slice(0, 200)}.`;
    } else if (b.thesis_summary) {
      thesisNote = ` Thesis: ${b.thesis_summary.slice(0, 200)}.`;
    }

    // Universe context
    const universeNote = b.universe_name ? ` Universe: ${b.universe_name}.` : '';

    const caveat = b.pass_reason
      ? ` Note: ${b.pass_reason}.`
      : b.engagement_cold && b.last_engagement
        ? ' Note: Buyer has been cold for 90+ days — may require re-engagement.'
        : '';

    const overrideNote =
      b.human_override_score !== null
        ? ` (Score manually adjusted to ${b.human_override_score}.)`
        : '';

    const reasoning = b.fit_reasoning ? ` ${b.fit_reasoning}` : '';

    return {
      rank,
      name,
      buyer_id: b.buyer_id,
      score: b.composite_fit_score,
      tier: b.tier_label,
      text: `**#${rank}. ${name}** — Score: ${b.composite_fit_score}/100 [${b.tier_label}]\n${typeLabel} headquartered in ${hq}. ${feeStatus}.${universeNote} Key fit signals: ${signals}. ${engagementNote}${outreachNote}${transcriptNote}${quoteNote}${thesisNote}${reasoning}${caveat}${overrideNote}`,
    };
  });

  // Section 3: Tier summary
  const moveNow = narrativeBuyers.filter((b) => b.tier === 'move_now');
  const strong = narrativeBuyers.filter((b) => b.tier === 'strong_candidate');
  const spec = narrativeBuyers.filter((b) => b.tier === 'speculative');

  const tierText = [
    moveNow.length > 0
      ? `**Move Now** (score 80+, active mandate or agreement in place): ${moveNow.map((b) => b.company_name).join(', ')}`
      : null,
    strong.length > 0
      ? `**Strong Candidates** (score 60-79, worth personalised outreach): ${strong.map((b) => b.company_name).join(', ')}`
      : null,
    spec.length > 0
      ? `**Speculative** (below 60, exploratory outreach): ${spec.map((b) => b.company_name).join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  // Section 4: Top 5 recommended actions (enriched with outreach/transcript context)
  const actions: string[] = [];
  for (const b of narrativeBuyers.slice(0, 5)) {
    const name = b.pe_firm_name ? `${b.company_name} (${b.pe_firm_name})` : b.company_name;

    if (b.outreach_status.nda_signed && !b.outreach_status.cim_sent) {
      actions.push(
        `Send deal memo to ${name} — NDA signed, score ${b.composite_fit_score}, ready for materials`,
      );
    } else if (b.has_fee_agreement && b.composite_fit_score >= 80 && !b.outreach_status.contacted) {
      actions.push(
        `Initiate outreach to ${name} — score ${b.composite_fit_score}, fee agreement signed, ${b.acquisition_appetite || 'active'} buyer`,
      );
    } else if (b.outreach_status.meeting_scheduled) {
      actions.push(
        `Prepare for scheduled meeting with ${name} — score ${b.composite_fit_score}${b.transcript_insights.ceo_detected ? ', CEO previously engaged' : ''}`,
      );
    } else if (b.has_fee_agreement && b.engagement_cold) {
      actions.push(
        `Re-engage ${name} — fee agreement in place but no activity in ${b.days_since_engagement || '90+'} days`,
      );
    } else if (!b.has_fee_agreement && b.composite_fit_score >= 70) {
      actions.push(
        `Initiate fee agreement with ${name} — score ${b.composite_fit_score}, strong fit but no agreement yet`,
      );
    } else if (b.engagement_cold) {
      actions.push(
        `Send introductory outreach to ${name} — score ${b.composite_fit_score}, no recent engagement`,
      );
    } else {
      actions.push(
        `Follow up with ${name} — score ${b.composite_fit_score}, ${b.last_engagement_type || 'outreach recommended'}`,
      );
    }
  }

  // Section 5: Key risks from deal context
  let riskNote = '';
  if (deal.key_risks) {
    riskNote = `\n\n## Key Risk Factors\n${(deal.key_risks as string).slice(0, 500)}`;
  }

  const fullNarrative = `# Buyer Strategy — ${dealTitle}
*Generated ${new Date().toISOString().split('T')[0]}*

## Deal Overview
${dealFraming}

## Ranked Buyer Shortlist

${buyerEntries.map((e) => e.text).join('\n\n')}

## Tier Summary
${tierText}

## Recommended Actions
${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}${riskNote}

---
*AI-generated buyer strategy synthesized from: remarketing scores, buyer profiles, ${dataStats.buyers_with_call_transcripts || 0} call transcripts, ${(dealTranscripts.count as number) || 0} deal recordings, ${universeContext.length} universe(s), and outreach records. Review before treating as authoritative.*`;

  return {
    data: {
      narrative: fullNarrative,
      deal,
      buyer_entries: buyerEntries.map((e) => ({
        rank: e.rank,
        name: e.name,
        buyer_id: e.buyer_id,
        score: e.score,
        tier: e.tier,
      })),
      tier_summary: tierSummary,
      total_buyers_analyzed: (resultData.total_scored as number) || buyers.length,
      data_source_stats: dataStats,
      universe_context: universeContext,
      actions,
      generated_at: new Date().toISOString(),
    },
  };
}
