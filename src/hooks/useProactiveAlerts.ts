/**
 * Proactive Alerts Hook (Feature 2)
 *
 * Fetches alert counts from live data to display a badge on the AI panel button.
 * Uses lightweight head-only count queries against the same data sources as
 * the backend get_proactive_alerts tool.
 *
 * Polls every 5 minutes for fresh alert counts. Uses React Query for caching.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fromTable = supabase.from.bind(supabase) as (
  table: string,
) => ReturnType<typeof supabase.from>;

export interface AlertCounts {
  total: number;
  critical: number;
  warning: number;
  info: number;
}

async function fetchAlertCounts(): Promise<AlertCounts> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return { total: 0, critical: 0, warning: 0, info: 0 };

  const now = Date.now();
  const fourteenDaysAgo = new Date(now - 14 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString();

  // Run parallel lightweight count queries matching backend alert types
  const [overdueRes, signalsRes, staleRes, veryStalRes] = await Promise.all([
    // Overdue tasks for this user
    supabase
      .from('daily_standup_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', userId)
      .eq('status', 'overdue'),

    // Unacknowledged critical/warning signals
    fromTable('rm_deal_signals')
      .select('id', { count: 'exact', head: true })
      .in('signal_type', ['critical', 'warning'])
      .is('acknowledged_at', null),

    // Stale active deals (14+ days = warning)
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'new', 'under_review'])
      .lt('updated_at', fourteenDaysAgo),

    // Very stale deals (30+ days = critical)
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'new', 'under_review'])
      .lt('updated_at', thirtyDaysAgo),
  ]);

  const overdueCount = overdueRes.count || 0;
  const signalCount = signalsRes.count || 0;
  const staleCount = staleRes.count || 0;
  const veryStaleCount = veryStalRes.count || 0;

  // Map to severities matching backend logic:
  // - critical: very stale deals (30+ days) + unacknowledged critical signals
  // - warning: overdue tasks + moderately stale deals (14-29 days)
  const critical = veryStaleCount + signalCount;
  const warning = overdueCount + Math.max(0, staleCount - veryStaleCount);
  const total = critical + warning;

  return {
    total,
    critical,
    warning,
    info: 0, // Info alerts (transcripts, unsigned agreements) omitted from badge
  };
}

export function useProactiveAlerts() {
  return useQuery<AlertCounts>({
    queryKey: ['proactive-alert-counts'],
    queryFn: fetchAlertCounts,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
