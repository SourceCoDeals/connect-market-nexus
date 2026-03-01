import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TranscriptInsight {
  call_count: number;
  ceo_detected: boolean;
  latest_call_date: string | null;
}

export interface OutreachInfo {
  contacted: boolean;
  nda_signed: boolean;
  cim_sent: boolean;
  meeting_scheduled: boolean;
  outcome: string | null;
}

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
  // Transcript insights
  transcript_insights: TranscriptInsight;
  // Outreach status
  outreach_info: OutreachInfo;
  // Source indicator
  source: 'scored' | 'marketplace' | 'pipeline' | 'contact';
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
  dataStats: {
    buyers_with_transcripts: number;
    buyers_with_outreach: number;
    buyers_with_ceo_engagement: number;
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
  transcript: TranscriptInsight,
  outreach: OutreachInfo,
): string[] {
  const signals: string[] = [];

  if (transcript.ceo_detected) {
    signals.push('CEO/owner participated in call');
  }

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

  if (outreach.nda_signed) {
    signals.push('NDA executed');
  }

  if (transcript.call_count > 0) {
    signals.push(`${transcript.call_count} call(s) on record`);
  }

  const totalAcqs = Number(buyer.total_acquisitions || 0);
  if (totalAcqs >= 5) {
    signals.push(`${totalAcqs} prior acquisitions`);
  }

  return signals.slice(0, 5);
}

const EMPTY_TRANSCRIPT: TranscriptInsight = {
  call_count: 0,
  ceo_detected: false,
  latest_call_date: null,
};

const EMPTY_OUTREACH: OutreachInfo = {
  contacted: false,
  nda_signed: false,
  cim_sent: false,
  meeting_scheduled: false,
  outcome: null,
};

/**
 * Fetch marketplace buyers who submitted connection requests for this listing.
 * Returns remarketing_buyer_ids for buyers that have a linked profile.
 */
async function fetchMarketplaceBuyers(listingId: string, excludeIds: Set<string>) {
  // Get connection requests with user profiles that have a remarketing_buyer_id
  const { data: connections } = await supabase
    .from('connection_requests')
    .select('user_id, lead_company, lead_name, lead_email, status, updated_at, created_at')
    .eq('listing_id', listingId)
    .in('status', ['approved', 'converted', 'pending', 'followed_up']);

  if (!connections || connections.length === 0) return [];

  // Get profiles for these users to find remarketing_buyer_id links
  const userIds = connections.map((c) => c.user_id).filter((id): id is string => !!id);

  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'id, remarketing_buyer_id, company_name, buyer_type, buyer_quality_score, first_name, last_name',
    )
    .in('id', userIds);

  if (!profiles) return [];

  // Collect remarketing_buyer_ids that aren't already scored
  const buyerIds: string[] = [];
  const profileMap = new Map<string, (typeof profiles)[0]>();

  for (const profile of profiles) {
    if (profile.remarketing_buyer_id && !excludeIds.has(profile.remarketing_buyer_id)) {
      buyerIds.push(profile.remarketing_buyer_id);
      profileMap.set(profile.remarketing_buyer_id, profile);
    }
  }

  return { buyerIds, profileMap, connections };
}

/**
 * Fetch buyers from pipeline deals (deals table) for this listing.
 */
async function fetchPipelineBuyers(listingId: string, excludeIds: Set<string>) {
  const { data: deals } = await supabase
    .from('deals')
    .select('remarketing_buyer_id')
    .eq('listing_id', listingId)
    .not('remarketing_buyer_id', 'is', null);

  if (!deals) return [];

  return deals.map((d) => d.remarketing_buyer_id as string).filter((id) => !excludeIds.has(id));
}

/**
 * Fetch buyers from contacts table linked to this listing.
 */
async function fetchContactBuyers(listingId: string, excludeIds: Set<string>) {
  const { data: contacts } = await supabase
    .from('contacts')
    .select('remarketing_buyer_id')
    .eq('listing_id', listingId)
    .not('remarketing_buyer_id', 'is', null);

  if (!contacts) return [];

  return contacts.map((c) => c.remarketing_buyer_id as string).filter((id) => !excludeIds.has(id));
}

export function useRecommendedBuyers(listingId: string | null | undefined, limit = 25) {
  return useQuery<RecommendedBuyersResult>({
    queryKey: ['recommended-buyers', listingId, limit],
    queryFn: async () => {
      if (!listingId) {
        return {
          buyers: [],
          total: 0,
          totalScored: 0,
          tierSummary: { move_now: 0, strong_candidate: 0, speculative: 0 },
          dataStats: {
            buyers_with_transcripts: 0,
            buyers_with_outreach: 0,
            buyers_with_ceo_engagement: 0,
          },
          cachedAt: new Date().toISOString(),
        };
      }

      // 1. Fetch scored buyers (from remarketing_scores — universe-based)
      const { data: scores, error: scoresError } = await supabase
        .from('remarketing_scores')
        .select(
          `buyer_id, composite_score, geography_score, service_score, size_score, owner_goals_score,
           tier, status, fit_reasoning, human_override_score, is_disqualified`,
        )
        .eq('listing_id', listingId)
        .or('is_disqualified.eq.false,is_disqualified.is.null')
        .order('composite_score', { ascending: false })
        .limit(limit * 2);

      if (scoresError) throw scoresError;

      const scoredBuyerIds = new Set((scores || []).map((s) => s.buyer_id));

      // 2. Fetch additional buyers from engagement sources (in parallel)
      const [marketplaceResult, pipelineBuyerIds, contactBuyerIds] = await Promise.all([
        fetchMarketplaceBuyers(listingId, scoredBuyerIds),
        fetchPipelineBuyers(listingId, scoredBuyerIds),
        fetchContactBuyers(listingId, scoredBuyerIds),
      ]);

      // Deduplicate engagement-sourced buyer IDs
      const engagementBuyerIds = new Set<string>();
      const engagementSourceMap = new Map<string, 'marketplace' | 'pipeline' | 'contact'>();

      if (
        marketplaceResult &&
        Array.isArray(marketplaceResult) === false &&
        marketplaceResult.buyerIds
      ) {
        for (const id of marketplaceResult.buyerIds) {
          engagementBuyerIds.add(id);
          engagementSourceMap.set(id, 'marketplace');
        }
      }
      for (const id of pipelineBuyerIds) {
        if (!engagementBuyerIds.has(id)) {
          engagementBuyerIds.add(id);
          engagementSourceMap.set(id, 'pipeline');
        }
      }
      for (const id of contactBuyerIds) {
        if (!engagementBuyerIds.has(id)) {
          engagementBuyerIds.add(id);
          engagementSourceMap.set(id, 'contact');
        }
      }

      // Combine all buyer IDs
      const allBuyerIds = [...scoredBuyerIds, ...engagementBuyerIds];

      if (allBuyerIds.length === 0) {
        return {
          buyers: [],
          total: 0,
          totalScored: 0,
          tierSummary: { move_now: 0, strong_candidate: 0, speculative: 0 },
          dataStats: {
            buyers_with_transcripts: 0,
            buyers_with_outreach: 0,
            buyers_with_ceo_engagement: 0,
          },
          cachedAt: new Date().toISOString(),
        };
      }

      const totalScored = (scores || []).length;

      // 3. Fetch all enrichment data in parallel
      const [buyersResult, connectionsResult, callTranscriptsResult, outreachResult] =
        await Promise.all([
          // Buyer profiles
          supabase
            .from('remarketing_buyers')
            .select(
              `id, company_name, pe_firm_name, buyer_type, hq_state, hq_city,
               acquisition_appetite, has_fee_agreement, thesis_summary, total_acquisitions, archived`,
            )
            .in('id', allBuyerIds)
            .eq('archived', false),

          // Connection requests (engagement)
          supabase
            .from('connection_requests')
            .select('user_id, status, updated_at, created_at')
            .eq('listing_id', listingId)
            .order('updated_at', { ascending: false }),

          // Buyer transcripts
          supabase
            .from('buyer_transcripts')
            .select('buyer_id, call_date, extracted_insights')
            .in('buyer_id', allBuyerIds)
            .order('call_date', { ascending: false }),

          // Outreach records (NDA/memo/meeting funnel)
          supabase
            .from('outreach_records')
            .select(
              'buyer_id, contacted_at, nda_sent_at, nda_signed_at, cim_sent_at, meeting_scheduled_at, outcome',
            )
            .eq('listing_id', listingId)
            .in('buyer_id', allBuyerIds)
            .order('updated_at', { ascending: false }),
        ]);

      if (buyersResult.error) throw buyersResult.error;

      const buyerMap = new Map((buyersResult.data || []).map((b) => [b.id, b]));

      // Build engagement map from connection requests
      const engagementMap = new Map<string, { last_date: string; type: string }>();
      if (connectionsResult.data) {
        for (const conn of connectionsResult.data) {
          if (conn.user_id && !engagementMap.has(conn.user_id)) {
            engagementMap.set(conn.user_id, {
              last_date: conn.updated_at || conn.created_at,
              type: `Connection request (${conn.status})`,
            });
          }
        }
      }

      // Build transcript insights map
      const transcriptMap = new Map<string, TranscriptInsight>();
      if (callTranscriptsResult.data) {
        for (const ct of callTranscriptsResult.data) {
          const buyerId = ct.buyer_id as string;
          const existing = transcriptMap.get(buyerId) || { ...EMPTY_TRANSCRIPT };
          existing.call_count++;
          if (
            ct.call_date &&
            (!existing.latest_call_date || ct.call_date > existing.latest_call_date)
          ) {
            existing.latest_call_date = ct.call_date as string;
          }
          // Extract ceo_detected from the JSONB extracted_insights field
          const insights = ct.extracted_insights as Record<string, unknown> | null;
          if (insights?.ceo_detected) {
            existing.ceo_detected = true;
          }
          transcriptMap.set(buyerId, existing);
        }
      }

      // Build outreach map
      const outreachMap = new Map<string, OutreachInfo>();
      if (outreachResult.data) {
        for (const or_ of outreachResult.data) {
          const buyerId = or_.buyer_id as string;
          if (!outreachMap.has(buyerId)) {
            outreachMap.set(buyerId, {
              contacted: !!or_.contacted_at,
              nda_signed: !!or_.nda_signed_at,
              cim_sent: !!or_.cim_sent_at,
              meeting_scheduled: !!or_.meeting_scheduled_at,
              outcome: (or_.outcome as string) || null,
            });
          }
        }
      }

      // 4. Build ranked list — scored buyers first
      const now = Date.now();
      const ranked: RecommendedBuyer[] = [];

      // 4a. Scored buyers (from remarketing_scores)
      for (const score of scores || []) {
        const buyer = buyerMap.get(score.buyer_id);
        if (!buyer) continue;

        const compositeScore = Number(score.human_override_score ?? score.composite_score ?? 0);
        const appetite = (buyer.acquisition_appetite as string) || '';
        const hasFee = !!buyer.has_fee_agreement;
        const { tier, label } = classifyTier(compositeScore, hasFee, appetite);

        const transcript = transcriptMap.get(score.buyer_id) || EMPTY_TRANSCRIPT;
        const outreach = outreachMap.get(score.buyer_id) || EMPTY_OUTREACH;
        const fitSignals = computeFitSignals(
          buyer as Record<string, unknown>,
          score as Record<string, unknown>,
          transcript,
          outreach,
        );

        const engagement = engagementMap.get(score.buyer_id);
        let lastEngDate = engagement?.last_date || null;
        let lastEngType = engagement?.type || null;

        if (
          transcript.latest_call_date &&
          (!lastEngDate || transcript.latest_call_date > lastEngDate)
        ) {
          lastEngDate = transcript.latest_call_date;
          lastEngType = 'Call recording';
        }

        let daysSinceEngagement: number | null = null;
        if (lastEngDate) {
          daysSinceEngagement = Math.floor(
            (now - new Date(lastEngDate).getTime()) / (1000 * 60 * 60 * 24),
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
          last_engagement: lastEngDate,
          last_engagement_type: lastEngType,
          days_since_engagement: daysSinceEngagement,
          engagement_cold: daysSinceEngagement !== null ? daysSinceEngagement > 90 : true,
          transcript_insights: transcript,
          outreach_info: outreach,
          source: 'scored',
        });
      }

      // 4b. Engagement-sourced buyers (not in remarketing_scores)
      for (const buyerId of engagementBuyerIds) {
        const buyer = buyerMap.get(buyerId);
        if (!buyer) continue;

        const transcript = transcriptMap.get(buyerId) || EMPTY_TRANSCRIPT;
        const outreach = outreachMap.get(buyerId) || EMPTY_OUTREACH;
        const appetite = (buyer.acquisition_appetite as string) || '';
        const hasFee = !!buyer.has_fee_agreement;

        // Compute a lightweight engagement-based score for sorting
        let engagementScore = 30; // Base score for being engaged with this deal
        if (transcript.call_count > 0) engagementScore += 15;
        if (transcript.ceo_detected) engagementScore += 10;
        if (outreach.contacted) engagementScore += 5;
        if (outreach.nda_signed) engagementScore += 10;
        if (outreach.meeting_scheduled) engagementScore += 10;
        if (hasFee) engagementScore += 10;
        if (['aggressive', 'active'].includes(appetite.toLowerCase())) engagementScore += 10;
        engagementScore = Math.min(engagementScore, 100);

        const { tier, label } = classifyTier(engagementScore, hasFee, appetite);
        const source = engagementSourceMap.get(buyerId) || 'contact';

        // Build fit signals based on engagement
        const fitSignals: string[] = [];
        if (source === 'marketplace') fitSignals.push('Marketplace buyer — expressed interest');
        if (source === 'pipeline') fitSignals.push('Active in deal pipeline');
        if (source === 'contact') fitSignals.push('Deal contact on record');
        if (transcript.call_count > 0)
          fitSignals.push(`${transcript.call_count} call(s) on record`);
        if (transcript.ceo_detected) fitSignals.push('CEO/owner participated in call');
        if (hasFee) fitSignals.push('Fee agreement signed');
        if (outreach.nda_signed) fitSignals.push('NDA executed');

        const lastEngDate: string | null = transcript.latest_call_date;
        let lastEngType: string | null = transcript.latest_call_date ? 'Call recording' : null;

        if (outreach.contacted) {
          lastEngType = lastEngType || 'Outreach';
        }
        if (source === 'marketplace') {
          lastEngType = lastEngType || 'Marketplace inquiry';
        }

        let daysSinceEngagement: number | null = null;
        if (lastEngDate) {
          daysSinceEngagement = Math.floor(
            (now - new Date(lastEngDate).getTime()) / (1000 * 60 * 60 * 24),
          );
        }

        ranked.push({
          buyer_id: buyerId,
          company_name: buyer.company_name,
          pe_firm_name: buyer.pe_firm_name || null,
          buyer_type: buyer.buyer_type || null,
          hq_state: buyer.hq_state || null,
          hq_city: buyer.hq_city || null,
          has_fee_agreement: hasFee,
          acquisition_appetite: buyer.acquisition_appetite || null,
          thesis_summary: buyer.thesis_summary || null,
          total_acquisitions: Number(buyer.total_acquisitions || 0),
          composite_fit_score: engagementScore,
          geography_score: 0,
          size_score: 0,
          service_score: 0,
          owner_goals_score: 0,
          fit_reasoning: `Engagement-based recommendation (${source}). Not yet formally scored.`,
          score_status: null,
          tier,
          tier_label: label,
          fit_signals: fitSignals.slice(0, 5),
          last_engagement: lastEngDate,
          last_engagement_type: lastEngType,
          days_since_engagement: daysSinceEngagement,
          engagement_cold: daysSinceEngagement !== null ? daysSinceEngagement > 90 : true,
          transcript_insights: transcript,
          outreach_info: outreach,
          source,
        });
      }

      // Sort: composite score desc → fee agreement → transcript engagement → appetite
      ranked.sort((a, b) => {
        if (b.composite_fit_score !== a.composite_fit_score)
          return b.composite_fit_score - a.composite_fit_score;
        if (a.has_fee_agreement !== b.has_fee_agreement) return a.has_fee_agreement ? -1 : 1;
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
        dataStats: {
          buyers_with_transcripts: finalBuyers.filter((b) => b.transcript_insights.call_count > 0)
            .length,
          buyers_with_outreach: finalBuyers.filter((b) => b.outreach_info.contacted).length,
          buyers_with_ceo_engagement: finalBuyers.filter((b) => b.transcript_insights.ceo_detected)
            .length,
        },
        cachedAt: new Date().toISOString(),
      };
    },
    enabled: !!listingId,
    retry: 1,
    staleTime: 4 * 60 * 60 * 1000, // 4 hours cache as per spec
  });
}
