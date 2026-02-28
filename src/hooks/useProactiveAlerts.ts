/**
 * Proactive Alerts Hook (Feature 2)
 *
 * Fetches alert counts from the AI Command Center edge function to display
 * a badge on the AI panel button. Uses a lightweight endpoint that returns
 * only the count of active alerts.
 *
 * Polls every 5 minutes for fresh alert counts. Uses React Query for caching.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AlertCounts {
  total: number;
  critical: number;
  warning: number;
  info: number;
}

async function fetchAlertCounts(): Promise<AlertCounts> {
  // Check for overdue tasks, unacknowledged signals, and stale deals
  // This runs client-side against Supabase for fast badge counts
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return { total: 0, critical: 0, warning: 0, info: 0 };

  const now = Date.now();
  const fourteenDaysAgo = new Date(now - 14 * 86400000).toISOString();

  // Run parallel lightweight count queries
  const [overdueRes, signalsRes, staleRes] = await Promise.all([
    // Overdue tasks for this user
    supabase
      .from('daily_standup_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', userId)
      .eq('status', 'overdue'),

    // Unacknowledged critical/warning signals
    supabase
      .from('rm_deal_signals')
      .select('id', { count: 'exact', head: true })
      .in('signal_type', ['critical', 'warning'])
      .is('acknowledged_at', null),

    // Stale active deals
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'new', 'under_review'])
      .lt('updated_at', fourteenDaysAgo),
  ]);

  const overdueCount = overdueRes.count || 0;
  const signalCount = signalsRes.count || 0;
  const staleCount = staleRes.count || 0;

  // Classify severity
  const critical = (overdueCount > 5 ? 1 : 0) + Math.min(signalCount, 3);
  const warning = Math.min(overdueCount, 5) + Math.min(staleCount, 3);
  const info = Math.max(0, staleCount - 3);

  return {
    total: critical + warning + info,
    critical,
    warning,
    info,
  };
}

export function useProactiveAlerts() {
  return useQuery<AlertCounts>({
    queryKey: ['proactive-alert-counts'],
    queryFn: fetchAlertCounts,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes
    refetchOnWindowFocus: true,
  });
}
