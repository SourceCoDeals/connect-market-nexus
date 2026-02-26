import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  TaskAnalytics,
  TeamAnalytics,
  MeetingQualityAnalytics,
  TaskTimeRange,
} from '@/types/daily-tasks';
import { getDateFromRange } from '@/types/daily-tasks';

export function useTaskAnalytics(params: {
  assigneeId?: string | null;
  timeRange?: TaskTimeRange;
}) {
  const { assigneeId, timeRange = '30d' } = params;
  const fromDate = getDateFromRange(timeRange);

  return useQuery({
    queryKey: ['daily-task-analytics', assigneeId, timeRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_daily_task_analytics', {
        p_from_date: fromDate ?? undefined,
        p_to_date: new Date().toISOString().split('T')[0],
        p_assignee_id: assigneeId ?? undefined,
      });
      if (error) throw error;
      return (data || {}) as TaskAnalytics;
    },
    staleTime: 30_000,
  });
}

export function useTeamAnalytics(timeRange: TaskTimeRange = '30d') {
  const fromDate = getDateFromRange(timeRange);

  return useQuery({
    queryKey: ['daily-task-team-analytics', timeRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_daily_task_team_analytics', {
        p_from_date: fromDate ?? undefined,
        p_to_date: new Date().toISOString().split('T')[0],
      });
      if (error) throw error;
      return (data || {}) as TeamAnalytics;
    },
    staleTime: 30_000,
  });
}

export function useMeetingQualityAnalytics(timeRange: TaskTimeRange = '30d') {
  const fromDate = getDateFromRange(timeRange);

  return useQuery({
    queryKey: ['meeting-quality-analytics', timeRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_meeting_quality_analytics', {
        p_from_date: fromDate ?? undefined,
        p_to_date: new Date().toISOString().split('T')[0],
      });
      if (error) throw error;
      return (data || {}) as MeetingQualityAnalytics;
    },
    staleTime: 60_000,
  });
}
