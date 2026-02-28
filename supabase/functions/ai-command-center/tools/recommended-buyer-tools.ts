/**
 * Recommended Buyer Tools
 * Feature 1: Recommended Buyers & Strategy Narrative
 *
 * get_recommended_buyers — returns a ranked buyer list with composite scoring,
 *   fit reasons, engagement data, and agreement status for a given deal.
 *
 * generate_buyer_narrative — returns a structured written strategy narrative
 *   suitable for strategy calls, team alignment, and deal notes.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from '../../_shared/claude-client.ts';
import type { ToolResult } from './index.ts';

// ---------- Tool definitions ----------

export const recommendedBuyerTools: ClaudeTool[] = [
  {
    name: 'get_recommended_buyers',
    description: `Get AI-ranked recommended buyers for a specific deal. Returns buyers sorted by a composite fit score based on alignment score, sector match, geographic overlap, size fit, acquisition appetite, fee agreement status, recent engagement, and past deal history.
USE WHEN: "who should we target for this deal?", "recommended buyers for [deal]", "show me the best buyers for [deal]", "buyer shortlist".
Returns ranked buyer cards with: fit score (0-100), top fit signals, fee agreement status, last engagement, and tier classification (Move Now / Strong Candidates / Speculative).`,
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
    description: `Generate a written buyer strategy narrative for a deal — a structured document suitable for reading in strategy calls, saving to deal notes, or sharing with the team.
USE WHEN: "write a buyer strategy for [deal]", "generate buyer narrative", "prepare buyer briefing", "strategy narrative for [deal]".
Returns: deal framing paragraph, ranked buyer entries with 3-5 sentence rationale each, tier summary (Move Now / Strong Candidates / Speculative), and top 5 recommended actions.
The narrative references specific data points (scores, engagement dates, agreement status) rather than generic statements.`,
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

// ---------- Helpers ----------

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
}

function computeFitSignals(
  buyer: Record<string, unknown>,
  deal: Record<string, unknown>,
  score: Record<string, unknown>,
): string[] {
  const signals: string[] = [];

  // Geographic match
  const geoScore = Number(score.geography_score || 0);
  if (geoScore >= 80) {
    const buyerState = buyer.hq_state as string;
    const dealLocation = (deal.location as string) || '';
    if (buyerState && dealLocation.toLowerCase().includes(buyerState.toLowerCase())) {
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

  // Total acquisitions
  const totalAcqs = Number(buyer.total_acquisitions || 0);
  if (totalAcqs >= 5) {
    signals.push(`${totalAcqs} prior acquisitions — proven acquirer`);
  }

  // Limit to top 3
  return signals.slice(0, 3);
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

// ---------- Implementations ----------

async function getRecommendedBuyers(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const minScore = Number(args.min_score || 0);
  const limit = Math.min(Number(args.limit) || 25, 100);

  // 1. Get deal/listing info for context
  const { data: dealData, error: dealError } = await supabase
    .from('listings')
    .select(
      'id, title, revenue, ebitda, location, category, categories, services, address_state, geographic_states, internal_company_name',
    )
    .eq('id', dealId)
    .single();

  if (dealError) {
    return { error: `Could not find deal: ${dealError.message}` };
  }

  // 2. Get scored buyers for this deal, ordered by composite score
  let scoreQuery = supabase
    .from('remarketing_scores')
    .select(
      `
      buyer_id, composite_score, geography_score, service_score, size_score, owner_goals_score,
      tier, status, fit_reasoning, pass_reason, human_override_score,
      is_disqualified, disqualification_reason
    `,
    )
    .eq('listing_id', dealId)
    .eq('is_disqualified', false)
    .order('composite_score', { ascending: false })
    .limit(limit * 2); // Fetch extra to account for filtering

  if (minScore > 0) {
    scoreQuery = scoreQuery.gte('composite_score', minScore);
  }

  const { data: scores, error: scoresError } = await scoreQuery;
  if (scoresError) {
    return { error: `Failed to fetch scores: ${scoresError.message}` };
  }

  if (!scores || scores.length === 0) {
    return {
      data: {
        buyers: [],
        total: 0,
        deal: {
          id: dealData.id,
          title: dealData.title,
          revenue: dealData.revenue,
          ebitda: dealData.ebitda,
          location: dealData.location,
          category: dealData.category,
        },
        suggestion:
          'No scored buyers found for this deal. The deal may not have a buyer universe built yet. Check remarketing matching to score buyers.',
      },
    };
  }

  // 3. Fetch buyer details for all scored buyer IDs
  const buyerIds = scores.map((s: Record<string, unknown>) => s.buyer_id as string);

  let buyerQuery = supabase
    .from('remarketing_buyers')
    .select(
      `
      id, company_name, pe_firm_name, buyer_type, hq_state, hq_city,
      geographic_footprint, target_services, target_industries,
      target_revenue_min, target_revenue_max, target_ebitda_min, target_ebitda_max,
      acquisition_appetite, has_fee_agreement, thesis_summary, alignment_score,
      total_acquisitions, archived
    `,
    )
    .in('id', buyerIds)
    .eq('archived', false);

  if (args.buyer_type) {
    buyerQuery = buyerQuery.eq('buyer_type', args.buyer_type as string);
  }
  if (args.has_fee_agreement === true) {
    buyerQuery = buyerQuery.eq('has_fee_agreement', true);
  }

  const { data: buyers, error: buyersError } = await buyerQuery;
  if (buyersError) {
    return { error: `Failed to fetch buyers: ${buyersError.message}` };
  }

  const buyerMap = new Map((buyers || []).map((b: Record<string, unknown>) => [b.id, b]));

  // 4. Fetch recent engagement signals for these buyers on this deal
  // Check deal_activities, connection_requests, and engagement tracking
  const engagementMap = new Map<string, { last_date: string; type: string }>();

  // Check connection_requests for engagement
  const { data: connections } = await supabase
    .from('connection_requests')
    .select('id, buyer_profile_id, status, updated_at, created_at')
    .eq('listing_id', dealId)
    .in('buyer_profile_id', buyerIds)
    .order('updated_at', { ascending: false });

  if (connections) {
    for (const conn of connections) {
      const buyerId = conn.buyer_profile_id as string;
      if (!engagementMap.has(buyerId)) {
        engagementMap.set(buyerId, {
          last_date: conn.updated_at || conn.created_at,
          type: `Connection request (${conn.status})`,
        });
      }
    }
  }

  // 5. Build ranked buyer list
  const now = Date.now();
  const rankedBuyers: RankedBuyer[] = [];

  for (const score of scores) {
    const buyer = buyerMap.get(score.buyer_id);
    if (!buyer) continue; // Buyer was filtered out or archived

    const compositeScore = Number(score.human_override_score ?? score.composite_score ?? 0);
    const appetite = (buyer.acquisition_appetite as string) || '';
    const hasFee = !!buyer.has_fee_agreement;
    const { tier, label } = classifyTier(compositeScore, hasFee, appetite);
    const fitSignals = computeFitSignals(buyer, dealData, score);

    const engagement = engagementMap.get(score.buyer_id as string);
    let daysSinceEngagement: number | null = null;
    if (engagement) {
      daysSinceEngagement = Math.floor(
        (now - new Date(engagement.last_date).getTime()) / (1000 * 60 * 60 * 24),
      );
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
      last_engagement: engagement?.last_date || null,
      last_engagement_type: engagement?.type || null,
      days_since_engagement: daysSinceEngagement,
      engagement_cold: daysSinceEngagement !== null ? daysSinceEngagement > 90 : true,
      score_status: score.status,
      fit_reasoning: score.fit_reasoning,
      human_override_score: score.human_override_score,
      pass_reason: score.pass_reason,
    });
  }

  // Sort by composite fit score (descending), then by fee agreement, then by appetite
  rankedBuyers.sort((a, b) => {
    if (b.composite_fit_score !== a.composite_fit_score)
      return b.composite_fit_score - a.composite_fit_score;
    if (a.has_fee_agreement !== b.has_fee_agreement) return a.has_fee_agreement ? -1 : 1;
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

  // Apply limit
  const finalBuyers = rankedBuyers.slice(0, limit);

  // Tier counts
  const tierCounts = {
    move_now: finalBuyers.filter((b) => b.tier === 'move_now').length,
    strong_candidate: finalBuyers.filter((b) => b.tier === 'strong_candidate').length,
    speculative: finalBuyers.filter((b) => b.tier === 'speculative').length,
  };

  return {
    data: {
      buyers: finalBuyers,
      total: finalBuyers.length,
      total_scored: scores.length,
      deal: {
        id: dealData.id,
        title: dealData.title,
        internal_company_name: dealData.internal_company_name,
        revenue: dealData.revenue,
        ebitda: dealData.ebitda,
        location: dealData.location,
        category: dealData.category,
        services: dealData.services,
      },
      tier_summary: tierCounts,
      filters_applied: {
        ...(args.min_score ? { min_score: args.min_score } : {}),
        ...(args.buyer_type ? { buyer_type: args.buyer_type } : {}),
        ...(args.has_fee_agreement ? { has_fee_agreement: args.has_fee_agreement } : {}),
      },
      cached_at: new Date().toISOString(),
    },
  };
}

async function generateBuyerNarrative(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const topN = Math.min(Number(args.top_n) || 10, 25);
  const includeSpeculative = args.include_speculative === true;

  // Reuse get_recommended_buyers to get the ranked list
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

  // Limit to topN buyers
  const narrativeBuyers = buyers.slice(0, topN);

  // Build structured narrative sections
  const dealTitle = (deal.internal_company_name || deal.title) as string;
  const revenue = deal.revenue
    ? `$${(Number(deal.revenue) / 1_000_000).toFixed(1)}M`
    : 'undisclosed';
  const ebitda = deal.ebitda ? `$${(Number(deal.ebitda) / 1_000_000).toFixed(1)}M` : 'undisclosed';
  const location = (deal.location as string) || 'location undisclosed';
  const category = (deal.category as string) || 'general services';

  // Section 1: Deal framing
  const dealFraming = `${dealTitle} is a ${category} business based in ${location} with approximately ${revenue} in revenue and ${ebitda} in EBITDA. The deal presents an opportunity for acquirers with ${category.toLowerCase()} sector experience, particularly those with existing geographic presence in the region or an active mandate to expand. Based on alignment scoring across ${(resultData.total_scored as number) || buyers.length} evaluated buyers, ${tierSummary.move_now || 0} are classified as "Move Now" candidates, ${tierSummary.strong_candidate || 0} as "Strong Candidates", and ${tierSummary.speculative || 0} as "Speculative".`;

  // Section 2: Per-buyer entries
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
      text: `**#${rank}. ${name}** — Score: ${b.composite_fit_score}/100 [${b.tier_label}]\n${typeLabel} headquartered in ${hq}. ${feeStatus}. Key fit signals: ${signals}. ${engagementNote}${reasoning}${caveat}${overrideNote}`,
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

  // Section 4: Top 5 recommended actions
  const actions: string[] = [];
  for (const b of narrativeBuyers.slice(0, 5)) {
    const name = b.pe_firm_name ? `${b.company_name} (${b.pe_firm_name})` : b.company_name;
    if (b.has_fee_agreement && b.composite_fit_score >= 80) {
      actions.push(
        `Send CIM to ${name} — score ${b.composite_fit_score}, fee agreement signed, ${b.acquisition_appetite || 'active'} buyer`,
      );
    } else if (b.has_fee_agreement && b.engagement_cold) {
      actions.push(
        `Re-engage ${name} — fee agreement in place but no activity in ${b.days_since_engagement || '90+'}  days`,
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

  const fullNarrative = `# Buyer Strategy — ${dealTitle}
*Generated ${new Date().toISOString().split('T')[0]}*

## Deal Overview
${dealFraming}

## Ranked Buyer Shortlist

${buyerEntries.map((e) => e.text).join('\n\n')}

## Tier Summary
${tierText}

## Recommended Actions
${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

---
*AI-generated buyer strategy. Review before treating as authoritative.*`;

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
      actions,
      generated_at: new Date().toISOString(),
    },
  };
}
