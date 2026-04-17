/**
 * useIntrosMetrics.ts
 *
 * Data hook for the Introductions & Meetings tab. Queries buyer_introductions
 * and buyer_transcripts to answer "are we actually connecting buyers to deals,
 * and are those introductions leading to progression?".
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getFromDate, type Timeframe } from '../useDashboardData';

interface IntroRow {
  id: string;
  listing_id: string | null;
  introduction_status: string;
  introduction_date: string | null;
  created_at: string;
  archived_at: string | null;
}

interface MeetingRow {
  id: string;
  buyer_id: string;
  title: string | null;
  call_date: string | null;
  duration_minutes: number | null;
  key_points: string[] | null;
}

export interface IntroStatusCount {
  status: string;
  label: string;
  count: number;
}

export interface IntroKPIs {
  totalIntros: number;
  introductionsInPeriod: number;
  meetingsHeld: number;
  totalMeetingMinutes: number;
  introToMeetingRate: number; // 0-100
}

export interface WeeklyIntroPoint {
  week: string;
  intros: number;
  meetings: number;
}

// Production introduction_status values (verified against live DB 2026-04-14).
// The spec referenced not_introduced/introduction_scheduled/introduced/passed/rejected
// which don't exist in production.
const STATUS_LABELS: Record<string, string> = {
  need_to_show_deal: 'Need to Show Deal',
  outreach_initiated: 'Outreach Initiated',
  meeting_scheduled: 'Meeting Scheduled',
  fit_and_interested: 'Fit & Interested',
  not_a_fit: 'Not a Fit',
  // Legacy values (back-compat if any old rows still exist)
  not_introduced: 'Not Yet Introduced',
  introduction_scheduled: 'Scheduled',
  introduced: 'Introduced',
  passed: 'Passed',
  rejected: 'Rejected',
};

/**
 * Statuses that represent an introduction that has actually made contact with
 * the buyer and moved beyond initial outreach. Used for the "Introductions in
 * period" KPI and the intro→meeting conversion rate. Tuned to production:
 * `fit_and_interested` and `meeting_scheduled` are the closest thing to a
 * "buyer-engaged" state.
 */
const ENGAGED_STATUSES = new Set([
  'fit_and_interested',
  'meeting_scheduled',
  // Legacy
  'introduced',
]);

export function useIntrosMetrics(timeframe: Timeframe) {
  const fromDate = getFromDate(timeframe);

  const { data: intros, isLoading: introsLoading } = useQuery({
    queryKey: ['intros', 'all'],
    queryFn: async (): Promise<IntroRow[]> => {
      const { data, error } = await (supabase as any)
        .from('buyer_introductions')
        .select('id, listing_id, introduction_status, introduction_date, created_at, archived_at')
        .is('archived_at', null);
      if (error) throw error;
      return (data || []) as IntroRow[];
    },
    staleTime: 2 * 60_000,
  });

  const { data: meetings, isLoading: meetingsLoading } = useQuery({
    queryKey: ['intros', 'meetings'],
    queryFn: async (): Promise<MeetingRow[]> => {
      const { data, error } = await (supabase as any)
        .from('buyer_transcripts')
        .select('id, buyer_id, title, call_date, duration_minutes, key_points')
        .not('call_date', 'is', null);
      if (error) throw error;
      return (data || []) as MeetingRow[];
    },
    staleTime: 2 * 60_000,
  });

  // "In period" for introductions = intros whose created_at (not
  // introduction_date, which is only set on a subset of statuses) falls in
  // the timeframe. This is the honest definition of "introductions created".
  const fromDateTs = fromDate ? new Date(fromDate).getTime() : null;
  const introsInPeriod = (intros || []).filter(
    (i) => !fromDateTs || new Date(i.created_at).getTime() >= fromDateTs,
  );

  // "Engaged" = reached one of the statuses that indicate actual buyer
  // contact (fit_and_interested / meeting_scheduled / legacy introduced).
  const engagedInPeriod = introsInPeriod.filter((i) => ENGAGED_STATUSES.has(i.introduction_status));

  const meetingsInPeriod = (meetings || []).filter(
    (m) => !fromDateTs || (m.call_date && new Date(m.call_date).getTime() >= fromDateTs),
  );

  const totalMeetingMinutes = meetingsInPeriod.reduce(
    (sum, m) => sum + (m.duration_minutes || 0),
    0,
  );

  // Intro → Meeting rate: honest ratio of meetings to engaged intros in the
  // period. Not a per-intro join — we don't have a direct FK between
  // buyer_introductions and buyer_transcripts — so this can exceed 100%
  // if a single intro spawned multiple meetings. We let it exceed 100%
  // rather than capping with min(), which is mathematically honest: a rate
  // of 150% signals "most intros get multiple follow-ups". The UI can
  // display it clamped at 100% for readability.
  const introToMeetingRate =
    engagedInPeriod.length > 0
      ? Math.round((meetingsInPeriod.length / engagedInPeriod.length) * 1000) / 10
      : 0;

  // Status breakdown (all, not just in-period, so the distribution doesn't warp)
  const statusMap = new Map<string, number>();
  for (const i of intros || []) {
    statusMap.set(i.introduction_status, (statusMap.get(i.introduction_status) || 0) + 1);
  }
  const statusBreakdown: IntroStatusCount[] = Array.from(statusMap.entries())
    .map(([status, count]) => ({
      status,
      label: STATUS_LABELS[status] || status,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Weekly trend (12 weeks), UTC bucketed so users in different timezones
  // see the same week boundaries.
  const weeklyBuckets = new Map<string, { intros: number; meetings: number }>();
  const weekKey = (dateStr: string) => {
    const d = new Date(dateStr);
    const utcDay = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - utcDay);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  };
  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
  for (const i of intros || []) {
    if (!i.introduction_date) continue;
    if (new Date(i.introduction_date) < twelveWeeksAgo) continue;
    const k = weekKey(i.introduction_date);
    const entry = weeklyBuckets.get(k) || { intros: 0, meetings: 0 };
    entry.intros++;
    weeklyBuckets.set(k, entry);
  }
  for (const m of meetings || []) {
    if (!m.call_date) continue;
    if (new Date(m.call_date) < twelveWeeksAgo) continue;
    const k = weekKey(m.call_date);
    const entry = weeklyBuckets.get(k) || { intros: 0, meetings: 0 };
    entry.meetings++;
    weeklyBuckets.set(k, entry);
  }
  const weeklyTrend: WeeklyIntroPoint[] = Array.from(weeklyBuckets.entries())
    .map(([week, v]) => ({ week, ...v }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // Recent meetings (most recent 10)
  const recentMeetings = [...(meetings || [])]
    .sort((a, b) => (b.call_date || '').localeCompare(a.call_date || ''))
    .slice(0, 10);

  const kpis: IntroKPIs = {
    totalIntros: (intros || []).length,
    introductionsInPeriod: engagedInPeriod.length,
    meetingsHeld: meetingsInPeriod.length,
    totalMeetingMinutes,
    introToMeetingRate,
  };

  return {
    loading: introsLoading || meetingsLoading,
    kpis,
    statusBreakdown,
    weeklyTrend,
    recentMeetings,
  };
}
