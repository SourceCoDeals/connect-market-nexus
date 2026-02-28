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

export interface EngagementSignals {
  message_count: number;
  has_high_intent_message: boolean;
  message_stale: boolean; // No response for 30+ days
  page_visits: number;
  recent_page_visits: number; // 3+ in 7 days = strong signal
  multi_channel_activity: boolean;
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
  // Effective score (after engagement boosts)
  effective_score: number;
  engagement_boost: number;
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
  // Extended engagement signals
  engagement_signals: EngagementSignals;
  // Profile completeness
  profile_completeness: number;
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
    buyers_with_messages: number;
    buyers_with_page_visits: number;
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

/** High-intent phrases that indicate strong buyer interest */
const HIGH_INTENT_PHRASES = [
  'fits our thesis',
  'actively looking',
  'move this week',
  'ready to proceed',
  'very interested',
  'strong fit',
  'want to discuss',
  'schedule a meeting',
  'send the cim',
  'send me the',
  'perfect match',
  'exactly what we',
];

function computeEngagementBoost(
  transcript: TranscriptInsight,
  outreach: OutreachInfo,
  engagement: EngagementSignals,
  daysSinceEngagement: number | null,
): number {
  let boost = 0;

  // Multi-channel activity (messages + calls + visits in recent period): +5 to +15
  let activeChannels = 0;
  if (transcript.call_count > 0) activeChannels++;
  if (engagement.message_count > 0) activeChannels++;
  if (engagement.recent_page_visits >= 3) activeChannels++;
  if (outreach.contacted) activeChannels++;

  if (activeChannels >= 3) {
    boost += 15;
  } else if (activeChannels >= 2) {
    boost += 10;
  } else if (activeChannels >= 1) {
    boost += 5;
  }

  // High-intent message boost
  if (engagement.has_high_intent_message) {
    boost += 5;
  }

  // Repeated page visits (3+ in 7 days) strong signal
  if (engagement.recent_page_visits >= 3) {
    boost += 5;
  }

  // CEO/decision-maker detection strengthened
  if (transcript.ceo_detected) {
    boost += 3;
  }

  // Cold penalty — reduce boost for stale engagement
  if (daysSinceEngagement !== null && daysSinceEngagement > 90) {
    boost = Math.max(0, boost - 5);
  }

  // Message stale penalty
  if (engagement.message_stale) {
    boost = Math.max(0, boost - 3);
  }

  return Math.min(boost, 15); // Cap at +15 as per PRD
}

function computeProfileCompleteness(buyer: Record<string, unknown>): number {
  let filled = 0;
  const total = 7;
  if (buyer.acquisition_appetite) filled++;
  if (buyer.thesis_summary) filled++;
  if (Number(buyer.total_acquisitions || 0) > 0) filled++;
  if (buyer.hq_state || buyer.hq_city) filled++;
  if (buyer.buyer_type) filled++;
  if (buyer.has_fee_agreement) filled++;
  if (buyer.pe_firm_name) filled++;
  return Math.round((filled / total) * 100);
}

function computeFitSignals(
  buyer: Record<string, unknown>,
  score: Record<string, unknown>,
  transcript: TranscriptInsight,
  outreach: OutreachInfo,
  engagement: EngagementSignals,
  profileCompleteness: number,
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

  // New engagement-based signals
  if (engagement.has_high_intent_message) {
    signals.push('High-intent message detected');
  }

  if (engagement.recent_page_visits >= 3) {
    signals.push('Repeated deal page visits');
  }

  if (engagement.multi_channel_activity) {
    signals.push('Multi-channel engagement');
  }

  const totalAcqs = Number(buyer.total_acquisitions || 0);
  if (totalAcqs >= 5) {
    signals.push(`${totalAcqs} prior acquisitions`);
  }

  // Profile completeness warning
  if (profileCompleteness < 60) {
    signals.push('Incomplete buyer profile — score may be imprecise');
  }

  return signals.slice(0, 6);
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

const EMPTY_ENGAGEMENT: EngagementSignals = {
  message_count: 0,
  has_high_intent_message: false,
  message_stale: false,
  page_visits: 0,
  recent_page_visits: 0,
  multi_channel_activity: false,
};

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
          dataStats: {
            buyers_with_transcripts: 0,
            buyers_with_outreach: 0,
            buyers_with_ceo_engagement: 0,
            buyers_with_messages: 0,
            buyers_with_page_visits: 0,
          },
          cachedAt: new Date().toISOString(),
        };
      }

      // 1. Fetch scores for this listing
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
      if (!scores || scores.length === 0) {
        return {
          buyers: [],
          total: 0,
          totalScored: 0,
          tierSummary: { move_now: 0, strong_candidate: 0, speculative: 0 },
          dataStats: {
            buyers_with_transcripts: 0,
            buyers_with_outreach: 0,
            buyers_with_ceo_engagement: 0,
            buyers_with_messages: 0,
            buyers_with_page_visits: 0,
          },
          cachedAt: new Date().toISOString(),
        };
      }

      const totalScored = scores.length;
      const buyerIds = scores.map((s) => s.buyer_id);

      // 2. Fetch all enrichment data in parallel (original + expanded signals)
      const [
        buyersResult,
        connectionsResult,
        callTranscriptsResult,
        outreachResult,
        messagesResult,
        pageVisitsResult,
      ] = await Promise.all([
        // Buyer profiles
        supabase
          .from('remarketing_buyers')
          .select(
            `id, company_name, pe_firm_name, buyer_type, hq_state, hq_city,
             acquisition_appetite, has_fee_agreement, thesis_summary, total_acquisitions, archived`,
          )
          .in('id', buyerIds)
          .eq('archived', false),

        // Connection requests (engagement)
        supabase
          .from('connection_requests')
          .select('id, buyer_profile_id, status, updated_at, created_at')
          .eq('listing_id', listingId)
          .in('buyer_profile_id', buyerIds)
          .order('updated_at', { ascending: false }),

        // Call transcripts (buyer-specific calls)
        supabase
          .from('call_transcripts')
          .select('buyer_id, call_date, ceo_detected')
          .eq('listing_id', listingId)
          .in('buyer_id', buyerIds)
          .order('call_date', { ascending: false }),

        // Outreach records (NDA/CIM/meeting funnel)
        supabase
          .from('outreach_records')
          .select(
            'buyer_id, contacted_at, nda_sent_at, nda_signed_at, cim_sent_at, meeting_scheduled_at, outcome',
          )
          .eq('listing_id', listingId)
          .in('buyer_id', buyerIds)
          .order('updated_at', { ascending: false }),

        // NEW: Connection messages (signal: message content & sentiment)
        // Messages are linked through connection_requests
        (async () => {
          // First get the connection request IDs for these buyer/listing combos
          const { data: connReqs } = await supabase
            .from('connection_requests')
            .select('id, buyer_profile_id')
            .eq('listing_id', listingId)
            .in('buyer_profile_id', buyerIds);

          if (!connReqs || connReqs.length === 0) return { data: [], error: null };

          const connMap = new Map<string, string>(); // connection_request_id -> buyer_id
          connReqs.forEach((cr) => connMap.set(cr.id, cr.buyer_profile_id as string));

          const connIds = connReqs.map((cr) => cr.id);
          const { data: msgs, error } = await supabase
            .from('connection_messages')
            .select('connection_request_id, body, created_at, sender_role')
            .in('connection_request_id', connIds)
            .order('created_at', { ascending: false });

          // Attach buyer_id to each message for mapping
          const enrichedMsgs = (msgs || []).map((m) => ({
            ...m,
            buyer_id: connMap.get(m.connection_request_id) || '',
          }));

          return { data: enrichedMsgs, error };
        })(),

        // NEW: Page visits / listing analytics (signal: deal page engagement)
        supabase
          .from('listing_analytics')
          .select('user_id, action_type, created_at')
          .eq('listing_id', listingId)
          .eq('action_type', 'view')
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      if (buyersResult.error) throw buyersResult.error;

      const buyerMap = new Map((buyersResult.data || []).map((b) => [b.id, b]));

      // Build engagement map
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

      // Build transcript insights map
      const transcriptMap = new Map<string, TranscriptInsight>();
      if (callTranscriptsResult.data) {
        for (const ct of callTranscriptsResult.data) {
          const buyerId = ct.buyer_id as string;
          const existing = transcriptMap.get(buyerId) || { ...EMPTY_TRANSCRIPT };
          existing.call_count++;
          if (ct.ceo_detected) existing.ceo_detected = true;
          if (
            ct.call_date &&
            (!existing.latest_call_date || ct.call_date > existing.latest_call_date)
          ) {
            existing.latest_call_date = ct.call_date as string;
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

      // NEW: Build message signals map
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      const messageSignalMap = new Map<
        string,
        { count: number; hasHighIntent: boolean; latestDate: string | null; isStale: boolean }
      >();

      if (messagesResult.data) {
        for (const msg of messagesResult.data as Array<{
          buyer_id: string;
          body: string;
          created_at: string;
          sender_role: string;
        }>) {
          if (!msg.buyer_id) continue;
          const existing = messageSignalMap.get(msg.buyer_id) || {
            count: 0,
            hasHighIntent: false,
            latestDate: null,
            isStale: false,
          };
          existing.count++;

          // Check for high-intent phrases
          if (msg.sender_role === 'buyer' && msg.body) {
            const bodyLower = msg.body.toLowerCase();
            if (HIGH_INTENT_PHRASES.some((phrase) => bodyLower.includes(phrase))) {
              existing.hasHighIntent = true;
            }
          }

          if (!existing.latestDate || msg.created_at > existing.latestDate) {
            existing.latestDate = msg.created_at;
          }

          messageSignalMap.set(msg.buyer_id, existing);
        }

        // Check for stale conversations
        for (const [buyerId, signal] of messageSignalMap.entries()) {
          if (
            signal.latestDate &&
            new Date(signal.latestDate).getTime() < thirtyDaysAgo
          ) {
            signal.isStale = true;
          }
        }
      }

      // NEW: Build page visit signals map
      // We correlate listing_analytics user_id with buyer profiles
      // This is a best-effort match since buyer_id and user_id may differ
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const pageVisitMap = new Map<string, { total: number; recentCount: number }>();

      // Build a reverse map from user_id to buyer_id via connection requests
      const userToBuyerMap = new Map<string, string>();
      if (connectionsResult.data) {
        for (const conn of connectionsResult.data) {
          // The buyer_profile_id in connection_requests maps users to buyer profiles
          // We don't have direct user_id->buyer_id here but this is a reasonable proxy
        }
      }

      // For page visits, aggregate by user_id and attempt matching
      if (pageVisitsResult.data) {
        // Group by user_id
        const visitsByUser = new Map<string, { total: number; recent: number }>();
        for (const visit of pageVisitsResult.data) {
          if (!visit.user_id) continue;
          const existing = visitsByUser.get(visit.user_id) || { total: 0, recent: 0 };
          existing.total++;
          if (visit.created_at && new Date(visit.created_at).getTime() > sevenDaysAgo) {
            existing.recent++;
          }
          visitsByUser.set(visit.user_id, existing);
        }

        // Map to buyer IDs through connection requests (buyer_profile_id)
        // Connection requests link listing_id + buyer_profile_id
        // In many cases the buyer_profile_id IS the user_id
        for (const [userId, visits] of visitsByUser.entries()) {
          // Check if this user_id is one of our buyer IDs
          if (buyerIds.includes(userId)) {
            pageVisitMap.set(userId, { total: visits.total, recentCount: visits.recent });
          }
        }
      }

      // 3. Build ranked list
      const ranked: RecommendedBuyer[] = [];

      for (const score of scores) {
        const buyer = buyerMap.get(score.buyer_id);
        if (!buyer) continue;

        const compositeScore = Number(score.human_override_score ?? score.composite_score ?? 0);
        const appetite = (buyer.acquisition_appetite as string) || '';
        const hasFee = !!buyer.has_fee_agreement;
        const { tier, label } = classifyTier(compositeScore, hasFee, appetite);

        const transcript = transcriptMap.get(score.buyer_id) || EMPTY_TRANSCRIPT;
        const outreach = outreachMap.get(score.buyer_id) || EMPTY_OUTREACH;

        // Build engagement signals
        const msgSignals = messageSignalMap.get(score.buyer_id);
        const pvSignals = pageVisitMap.get(score.buyer_id);

        let activeChannels = 0;
        if (transcript.call_count > 0) activeChannels++;
        if (msgSignals && msgSignals.count > 0) activeChannels++;
        if (pvSignals && pvSignals.recentCount >= 3) activeChannels++;
        if (outreach.contacted) activeChannels++;

        const engagementSignals: EngagementSignals = {
          message_count: msgSignals?.count ?? 0,
          has_high_intent_message: msgSignals?.hasHighIntent ?? false,
          message_stale: msgSignals?.isStale ?? false,
          page_visits: pvSignals?.total ?? 0,
          recent_page_visits: pvSignals?.recentCount ?? 0,
          multi_channel_activity: activeChannels >= 2,
        };

        const profileCompleteness = computeProfileCompleteness(
          buyer as Record<string, unknown>,
        );

        const fitSignals = computeFitSignals(
          buyer as Record<string, unknown>,
          score as Record<string, unknown>,
          transcript,
          outreach,
          engagementSignals,
          profileCompleteness,
        );

        // Combine engagement from connection requests, outreach, and transcripts
        const engagement = engagementMap.get(score.buyer_id);
        let lastEngDate = engagement?.last_date || null;
        let lastEngType = engagement?.type || null;

        if (outreach.contacted && outreach.outcome) {
          // Outreach data may have more recent info
        }
        if (
          transcript.latest_call_date &&
          (!lastEngDate || transcript.latest_call_date > lastEngDate)
        ) {
          lastEngDate = transcript.latest_call_date;
          lastEngType = 'Call recording';
        }

        // Check messages for latest engagement
        if (
          msgSignals?.latestDate &&
          (!lastEngDate || msgSignals.latestDate > lastEngDate)
        ) {
          lastEngDate = msgSignals.latestDate;
          lastEngType = 'Message';
        }

        let daysSinceEngagement: number | null = null;
        if (lastEngDate) {
          daysSinceEngagement = Math.floor(
            (now - new Date(lastEngDate).getTime()) / (1000 * 60 * 60 * 24),
          );
        }

        // Compute engagement boost for effective scoring
        const engagementBoost = computeEngagementBoost(
          transcript,
          outreach,
          engagementSignals,
          daysSinceEngagement,
        );
        const effectiveScore = Math.min(100, compositeScore + engagementBoost);

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
          effective_score: effectiveScore,
          engagement_boost: engagementBoost,
          tier,
          tier_label: label,
          fit_signals: fitSignals,
          last_engagement: lastEngDate,
          last_engagement_type: lastEngType,
          days_since_engagement: daysSinceEngagement,
          engagement_cold: daysSinceEngagement !== null ? daysSinceEngagement > 90 : true,
          transcript_insights: transcript,
          outreach_info: outreach,
          engagement_signals: engagementSignals,
          profile_completeness: profileCompleteness,
        });
      }

      // Sort: effective score (composite + engagement boost) desc → fee agreement → transcript engagement → appetite
      ranked.sort((a, b) => {
        if (b.effective_score !== a.effective_score)
          return b.effective_score - a.effective_score;
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
          buyers_with_messages: finalBuyers.filter(
            (b) => b.engagement_signals.message_count > 0,
          ).length,
          buyers_with_page_visits: finalBuyers.filter(
            (b) => b.engagement_signals.page_visits > 0,
          ).length,
        },
        cachedAt: new Date().toISOString(),
      };
    },
    enabled: !!listingId,
    staleTime: 4 * 60 * 60 * 1000, // 4 hours cache as per spec
  });
}
