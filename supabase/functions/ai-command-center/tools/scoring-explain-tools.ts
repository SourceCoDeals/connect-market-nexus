/**
 * Explainable Scoring Tools
 * Provides detailed score breakdowns with human-readable explanations,
 * weight citations, and data provenance for every score dimension.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- Tool definitions ----------

export const scoringExplainTools: ClaudeTool[] = [
  {
    name: 'explain_buyer_score',
    description: `Get a fully explainable score breakdown for a buyer-deal pair. Returns:
- Each scoring dimension (geography, service, size, owner goals, acquisition, business model, portfolio) with its raw score, weight, weighted contribution, and human-readable explanation
- The scoring weights used (from deal scoring adjustments or tracker defaults)
- Data citations showing which buyer fields drove each dimension
- Confidence assessment and missing data flags
Use this when the user asks "why did this buyer score 87?" or "explain the score"`,
    input_schema: {
      type: 'object',
      properties: {
        buyer_id: { type: 'string', description: 'The remarketing buyer UUID' },
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
      },
      required: ['buyer_id', 'deal_id'],
    },
  },
];

// ---------- Executor ----------

export async function executeScoringExplainTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'explain_buyer_score': return explainBuyerScore(supabase, args);
    default: return { error: `Unknown scoring explain tool: ${toolName}` };
  }
}

// ---------- Score dimension metadata ----------

const DIMENSION_LABELS: Record<string, { label: string; description: string }> = {
  geography_score: { label: 'Geography Fit', description: 'How well the buyer\'s HQ and operating locations overlap with the deal\'s geography' },
  service_score: { label: 'Service/Industry Fit', description: 'Alignment between buyer\'s target services/industries and the deal\'s offerings' },
  size_score: { label: 'Size Fit', description: 'Whether the deal\'s revenue and EBITDA fall within the buyer\'s target ranges' },
  owner_goals_score: { label: 'Owner Goals Alignment', description: 'How well the buyer\'s acquisition model aligns with the seller\'s goals (e.g., management retention, growth plans)' },
  acquisition_score: { label: 'Acquisition Track Record', description: 'Buyer\'s historical acquisition activity and appetite' },
  business_model_score: { label: 'Business Model Fit', description: 'Compatibility of business models (recurring vs. project, B2B vs. B2C)' },
  portfolio_score: { label: 'Portfolio Synergy', description: 'How the deal fits with the buyer\'s existing portfolio companies' },
};

// ---------- Implementation ----------

async function explainBuyerScore(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const buyerId = args.buyer_id as string;
  const dealId = args.deal_id as string;

  // Parallel fetch: score, buyer, deal, scoring adjustments
  const [scoreResult, buyerResult, dealResult, adjustmentsResult] = await Promise.all([
    supabase
      .from('remarketing_scores')
      .select('*')
      .eq('buyer_id', buyerId)
      .eq('listing_id', dealId)
      .single(),
    supabase
      .from('remarketing_buyers')
      .select(`
        id, company_name, pe_firm_name, buyer_type,
        hq_city, hq_state, hq_country,
        geographic_footprint, target_services, target_industries,
        target_revenue_min, target_revenue_max, target_ebitda_min, target_ebitda_max,
        acquisition_appetite, total_acquisitions, num_employees, number_of_locations,
        thesis_summary, data_completeness, confidence_level
      `)
      .eq('id', buyerId)
      .single(),
    supabase
      .from('listings')
      .select(`
        id, title, industry, services, revenue, ebitda,
        location, address_state, geographic_states,
        num_employees, number_of_locations
      `)
      .eq('id', dealId)
      .single(),
    supabase
      .from('deal_scoring_adjustments')
      .select('*')
      .eq('listing_id', dealId)
      .maybeSingle(),
  ]);

  if (scoreResult.error) return { error: `Score not found: ${scoreResult.error.message}` };
  if (buyerResult.error) return { error: `Buyer not found: ${buyerResult.error.message}` };

  const score = scoreResult.data;
  const buyer = buyerResult.data;
  const deal = dealResult.data;
  const adjustments = adjustmentsResult.data;

  // Build dimension breakdowns
  const dimensions = [];
  const scoreFields = ['geography_score', 'service_score', 'size_score', 'owner_goals_score', 'acquisition_score', 'business_model_score', 'portfolio_score'];

  // Get weights (from adjustments or defaults)
  const weights: Record<string, number> = {
    geography_score: adjustments?.geography_weight ?? 25,
    service_score: adjustments?.service_mix_weight ?? 25,
    size_score: adjustments?.size_weight ?? 25,
    owner_goals_score: adjustments?.owner_goals_weight ?? 25,
    acquisition_score: 10,
    business_model_score: 10,
    portfolio_score: 5,
  };

  for (const field of scoreFields) {
    const rawScore = score[field] as number | null;
    if (rawScore == null) continue;

    const meta = DIMENSION_LABELS[field] || { label: field, description: '' };
    const weight = weights[field] || 0;
    const citation = buildCitation(field, buyer, deal);

    dimensions.push({
      dimension: meta.label,
      raw_score: rawScore,
      weight_pct: weight,
      weighted_contribution: Math.round((rawScore * weight) / 100),
      description: meta.description,
      explanation: buildExplanation(field, rawScore, buyer, deal),
      data_citations: citation,
    });
  }

  // Sort by weighted contribution descending
  dimensions.sort((a, b) => b.weighted_contribution - a.weighted_contribution);

  // Identify missing data
  const missingFields: string[] = [];
  if (!buyer.geographic_footprint?.length) missingFields.push('buyer geographic footprint');
  if (!buyer.target_services?.length) missingFields.push('buyer target services');
  if (buyer.target_revenue_min == null && buyer.target_revenue_max == null) missingFields.push('buyer revenue range');
  if (!buyer.total_acquisitions) missingFields.push('buyer acquisition history');

  return {
    data: {
      summary: {
        composite_score: score.composite_score,
        tier: score.tier || score.score_tier,
        status: score.status,
        confidence: score.confidence_level || buyer.confidence_level,
        buyer_name: buyer.company_name || buyer.pe_firm_name,
        deal_name: deal?.title || dealId,
        fit_reasoning: score.fit_reasoning,
      },
      dimensions,
      weights_source: adjustments ? 'custom_deal_adjustments' : 'default_weights',
      custom_weights: adjustments ? {
        geography: adjustments.geography_weight,
        service: adjustments.service_mix_weight,
        size: adjustments.size_weight,
        owner_goals: adjustments.owner_goals_weight,
      } : null,
      bonuses: {
        thesis_alignment: score.thesis_alignment_bonus || score.thesis_bonus || 0,
        data_quality: score.data_quality_bonus || 0,
        kpi: score.kpi_bonus || 0,
        custom: score.custom_bonus || 0,
      },
      penalties: {
        learning_penalty: score.learning_penalty || 0,
      },
      multipliers: {
        size_multiplier: score.size_multiplier || 1,
        service_multiplier: score.service_multiplier || 1,
        geography_mode_factor: score.geography_mode_factor || 1,
      },
      missing_data: missingFields,
      data_completeness: buyer.data_completeness || score.data_completeness,
      source_tables: ['remarketing_scores', 'remarketing_buyers', 'listings', 'deal_scoring_adjustments'],
    },
  };
}

// ---------- Helpers ----------

function buildExplanation(field: string, score: number, buyer: any, deal: any): string {
  const tier = score >= 80 ? 'Strong' : score >= 60 ? 'Moderate' : score >= 40 ? 'Weak' : 'Poor';

  switch (field) {
    case 'geography_score': {
      const buyerHQ = [buyer.hq_city, buyer.hq_state].filter(Boolean).join(', ') || 'unknown';
      const dealLoc = deal?.address_state || deal?.location || 'unknown';
      const footprint = buyer.geographic_footprint?.join(', ') || 'none listed';
      return `${tier} match (${score}/100). Buyer HQ: ${buyerHQ}. Deal location: ${dealLoc}. Buyer footprint: ${footprint}.`;
    }
    case 'service_score': {
      const buyerSvcs = buyer.target_services?.slice(0, 5).join(', ') || 'none listed';
      const dealSvcs = deal?.services || deal?.industry || 'unknown';
      return `${tier} match (${score}/100). Buyer targets: ${buyerSvcs}. Deal offers: ${dealSvcs}.`;
    }
    case 'size_score': {
      const range = buyer.target_revenue_min || buyer.target_revenue_max
        ? `$${(buyer.target_revenue_min || 0) / 1e6}M–$${(buyer.target_revenue_max || 999) / 1e6}M`
        : 'no range set';
      const dealRev = deal?.revenue ? `$${(deal.revenue / 1e6).toFixed(1)}M` : 'unknown';
      return `${tier} match (${score}/100). Buyer revenue range: ${range}. Deal revenue: ${dealRev}.`;
    }
    case 'owner_goals_score':
      return `${tier} alignment (${score}/100). Based on buyer acquisition model vs. seller goals.`;
    case 'acquisition_score': {
      const acqs = buyer.total_acquisitions || 0;
      const appetite = buyer.acquisition_appetite || 'unknown';
      return `${tier} (${score}/100). ${acqs} total acquisitions. Appetite: ${appetite}.`;
    }
    case 'business_model_score':
      return `${tier} match (${score}/100). Business model compatibility assessment.`;
    case 'portfolio_score':
      return `${tier} synergy (${score}/100). Portfolio fit based on existing holdings.`;
    default:
      return `${tier} (${score}/100).`;
  }
}

function buildCitation(field: string, buyer: any, deal: any): Record<string, unknown> {
  switch (field) {
    case 'geography_score':
      return {
        buyer_hq: [buyer.hq_city, buyer.hq_state, buyer.hq_country].filter(Boolean).join(', '),
        buyer_footprint: buyer.geographic_footprint || [],
        deal_state: deal?.address_state,
        deal_geo_states: deal?.geographic_states || [],
      };
    case 'service_score':
      return {
        buyer_target_services: buyer.target_services || [],
        buyer_target_industries: buyer.target_industries || [],
        deal_industry: deal?.industry,
        deal_services: deal?.services,
      };
    case 'size_score':
      return {
        buyer_revenue_range: { min: buyer.target_revenue_min, max: buyer.target_revenue_max },
        buyer_ebitda_range: { min: buyer.target_ebitda_min, max: buyer.target_ebitda_max },
        deal_revenue: deal?.revenue,
        deal_ebitda: deal?.ebitda,
        deal_employees: deal?.num_employees,
        deal_locations: deal?.number_of_locations,
      };
    case 'acquisition_score':
      return {
        buyer_total_acquisitions: buyer.total_acquisitions,
        buyer_appetite: buyer.acquisition_appetite,
        buyer_employees: buyer.num_employees,
        buyer_locations: buyer.number_of_locations,
      };
    default:
      return {};
  }
}
