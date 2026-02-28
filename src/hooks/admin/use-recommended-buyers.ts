import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RecommendedBuyer {
  buyer_id: string;
  company_name: string;
  pe_firm_name: string | null;
  buyer_type: string | null;
  hq_state: string | null;
  hq_city: string | null;
  has_fee_agreement: boolean;
  acquisition_appetite: string | null;
  thesis_summary: string | null;
  total_acquisitions: number;
  // Scores
  composite_fit_score: number;
  geography_score: number;
  size_score: number;
  service_score: number;
  owner_goals_score: number;
  fit_reasoning: string | null;
  score_status: string | null;
  // Tier
  tier: 'move_now' | 'strong_candidate' | 'speculative';
  tier_label: string;
  // Fit signals
  fit_signals: string[];
  // Engagement
  last_engagement: string | null;
  last_engagement_type: string | null;
  days_since_engagement: number | null;
  engagement_cold: boolean;
}

export interface RecommendedBuyersResult {
  buyers: RecommendedBuyer[];
  total: number;
  totalScored: number;
  tierSummary: {
    move_now: number;
    strong_candidate: number;
    speculative: number;
  };
  cachedAt: string;
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

function computeFitSignals(
  buyer: Record<string, unknown>,
  score: Record<string, unknown>,
): string[] {
  const signals: string[] = [];

  const geoScore = Number(score.geography_score || 0);
  if (geoScore >= 80) {
    signals.push('Strong geographic footprint overlap');
  } else if (geoScore >= 60) {
    signals.push('Regional geographic proximity');
  }

  const sizeScore = Number(score.size_score || 0);
  if (sizeScore >= 80) {
    signals.push('EBITDA and revenue within target range');
  } else if (sizeScore >= 60) {
    signals.push('Size within broader acquisition criteria');
  }

  const svcScore = Number(score.service_score || 0);
  if (svcScore >= 80) {
    signals.push('Core service/sector alignment');
  } else if (svcScore >= 60) {
    signals.push('Related service/sector match');
  }

  const appetite = (buyer.acquisition_appetite as string) || '';
  if (['aggressive', 'active'].includes(appetite.toLowerCase())) {
    signals.push(`${appetite.charAt(0).toUpperCase() + appetite.slice(1)} acquisition mandate`);
  }

  if (buyer.has_fee_agreement) {
    signals.push('Fee agreement signed');
  }

  const totalAcqs = Number(buyer.total_acquisitions || 0);
  if (totalAcqs >= 5) {
    signals.push(`${totalAcqs} prior acquisitions`);
  }

  return signals.slice(0, 3);
}

export function useRecommendedBuyers(listingId: string | undefined, limit = 25) {
  return useQuery<RecommendedBuyersResult>({
    queryKey: ['recommended-buyers', listingId, limit],
    queryFn: async () => {
      if (!listingId) {
        return {
          buyers: [],
          total: 0,
          totalScored: 0,
          tierSummary: { move_now: 0, strong_candidate: 0, speculative: 0 },
          cachedAt: new Date().toISOString(),
        };
      }

      // 1. Fetch scores for this listing
      const { data: scores, error: scoresError } = await supabase
        .from('remarketing_scores')
        .select(
          `
          buyer_id, composite_score, geography_score, service_score, size_score, owner_goals_score,
          tier, status, fit_reasoning, human_override_score, is_disqualified
        `,
        )
        .eq('listing_id', listingId)
        .or('is_disqualified.eq.false,is_disqualified.is.null')
        .order('composite_score', { ascending: false })
        .limit(limit * 2);

      if (scoresError) throw scoresError;
      if (!scores || scores.length === 0) {
        return {
          buyers: [],
          total: 0,
          totalScored: 0,
          tierSummary: { move_now: 0, strong_candidate: 0, speculative: 0 },
          cachedAt: new Date().toISOString(),
        };
      }

      const totalScored = scores.length;

      // 2. Fetch buyer details
      const buyerIds = scores.map((s) => s.buyer_id);
      const { data: buyers, error: buyersError } = await supabase
        .from('remarketing_buyers')
        .select(
          `
          id, company_name, pe_firm_name, buyer_type, hq_state, hq_city,
          acquisition_appetite, has_fee_agreement, thesis_summary, total_acquisitions, archived
        `,
        )
        .in('id', buyerIds)
        .eq('archived', false);

      if (buyersError) throw buyersError;

      const buyerMap = new Map((buyers || []).map((b) => [b.id, b]));

      // 3. Fetch engagement data (connection requests on this listing)
      const { data: connections } = await supabase
        .from('connection_requests')
        .select('buyer_profile_id, status, updated_at, created_at')
        .eq('listing_id', listingId)
        .in('buyer_profile_id', buyerIds)
        .order('updated_at', { ascending: false });

      const engagementMap = new Map<string, { last_date: string; type: string }>();
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

      // 4. Build ranked list
      const now = Date.now();
      const ranked: RecommendedBuyer[] = [];

      for (const score of scores) {
        const buyer = buyerMap.get(score.buyer_id);
        if (!buyer) continue;

        const compositeScore = Number(score.human_override_score ?? score.composite_score ?? 0);
        const appetite = (buyer.acquisition_appetite as string) || '';
        const hasFee = !!buyer.has_fee_agreement;
        const { tier, label } = classifyTier(compositeScore, hasFee, appetite);
        const fitSignals = computeFitSignals(
          buyer as Record<string, unknown>,
          score as Record<string, unknown>,
        );

        const engagement = engagementMap.get(score.buyer_id);
        let daysSinceEngagement: number | null = null;
        if (engagement) {
          daysSinceEngagement = Math.floor(
            (now - new Date(engagement.last_date).getTime()) / (1000 * 60 * 60 * 24),
          );
        }

        ranked.push({
          buyer_id: score.buyer_id,
          company_name: buyer.company_name,
          pe_firm_name: buyer.pe_firm_name || null,
          buyer_type: buyer.buyer_type || null,
          hq_state: buyer.hq_state || null,
          hq_city: buyer.hq_city || null,
          has_fee_agreement: hasFee,
          acquisition_appetite: buyer.acquisition_appetite || null,
          thesis_summary: buyer.thesis_summary || null,
          total_acquisitions: Number(buyer.total_acquisitions || 0),
          composite_fit_score: compositeScore,
          geography_score: Number(score.geography_score || 0),
          size_score: Number(score.size_score || 0),
          service_score: Number(score.service_score || 0),
          owner_goals_score: Number(score.owner_goals_score || 0),
          fit_reasoning: score.fit_reasoning || null,
          score_status: score.status || null,
          tier,
          tier_label: label,
          fit_signals: fitSignals,
          last_engagement: engagement?.last_date || null,
          last_engagement_type: engagement?.type || null,
          days_since_engagement: daysSinceEngagement,
          engagement_cold: daysSinceEngagement !== null ? daysSinceEngagement > 90 : true,
        });
      }

      // Sort: composite score desc, then fee agreement, then appetite
      ranked.sort((a, b) => {
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

      const finalBuyers = ranked.slice(0, limit);

      return {
        buyers: finalBuyers,
        total: finalBuyers.length,
        totalScored,
        tierSummary: {
          move_now: finalBuyers.filter((b) => b.tier === 'move_now').length,
          strong_candidate: finalBuyers.filter((b) => b.tier === 'strong_candidate').length,
          speculative: finalBuyers.filter((b) => b.tier === 'speculative').length,
        },
        cachedAt: new Date().toISOString(),
      };
    },
    enabled: !!listingId,
    staleTime: 4 * 60 * 60 * 1000, // 4 hours cache as per spec
  });
}
