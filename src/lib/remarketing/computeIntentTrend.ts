import type { RecommendedBuyer } from '@/hooks/admin/use-recommended-buyers';

export type IntentTrend = 'increasing' | 'stable' | 'cooling';

/**
 * Compute the intent trend for a buyer by comparing
 * engagement activity in the last 30 days vs the prior 30 days.
 *
 * Shared utility used by both Top5Panel and BuyerRecommendationCard
 * to ensure consistent trend computation.
 */
export function computeIntentTrend(buyer: RecommendedBuyer): IntentTrend {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

  let recentSignals = 0;
  let priorSignals = 0;

  if (buyer.last_engagement) {
    const engDate = new Date(buyer.last_engagement).getTime();
    if (engDate > thirtyDaysAgo) recentSignals += 2;
    else if (engDate > sixtyDaysAgo) priorSignals += 2;
  }

  if (buyer.transcript_insights.latest_call_date) {
    const callDate = new Date(buyer.transcript_insights.latest_call_date).getTime();
    if (callDate > thirtyDaysAgo) recentSignals += 1;
    else if (callDate > sixtyDaysAgo) priorSignals += 1;
  }

  if (buyer.outreach_info.meeting_scheduled) recentSignals += 1;
  if (buyer.engagement_signals.message_count > 0) recentSignals += 1;

  if (recentSignals > priorSignals) return 'increasing';
  if (recentSignals < priorSignals) return 'cooling';
  return 'stable';
}
