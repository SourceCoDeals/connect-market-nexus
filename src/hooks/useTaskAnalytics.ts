/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  TaskType,
  TaskAnalyticsSummary,
  TeamMemberScorecard,
  MeetingQualityMetrics,
} from '@/types/daily-tasks';

// ─── Team-wide analytics ───

export function useTaskAnalytics(dateFrom: string | null, dateTo: string | null) {
  return useQuery({
    queryKey: ['task-analytics', 'team', dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('daily_standup_tasks' as any)
        .select(
          'id, status, task_type, assignee_id, created_at, completed_at, due_date, priority_rank',
        );

      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo);

      const { data: tasks, error } = await query;
      if (error) throw error;

      const all = (tasks || []) as any[];
      const completed = all.filter((t) => t.status === 'completed');
      const overdue = all.filter((t) => t.status === 'overdue');

      // Completion times
      const completionTimes = completed
        .filter((t) => t.completed_at && t.created_at)
        .map((t) => {
          const diff = new Date(t.completed_at).getTime() - new Date(t.created_at).getTime();
          return diff / (1000 * 60 * 60); // hours
        });

      const avgTimeToComplete =
        completionTimes.length > 0
          ? completionTimes.reduce((s, v) => s + v, 0) / completionTimes.length
          : null;

      // By task type
      const byTaskType: Record<string, { assigned: number; completed: number; overdue: number }> =
        {};
      for (const t of all) {
        const type = t.task_type as TaskType;
        if (!byTaskType[type]) byTaskType[type] = { assigned: 0, completed: 0, overdue: 0 };
        byTaskType[type].assigned++;
        if (t.status === 'completed') byTaskType[type].completed++;
        if (t.status === 'overdue') byTaskType[type].overdue++;
      }

      const summary: TaskAnalyticsSummary = {
        total_assigned: all.length,
        total_completed: completed.length,
        total_overdue: overdue.length,
        completion_rate: all.length > 0 ? (completed.length / all.length) * 100 : 0,
        avg_time_to_complete_hours: avgTimeToComplete,
        by_task_type: byTaskType as any,
      };

      return summary;
    },
    staleTime: 60_000,
  });
}

// ─── Individual scorecards ───

export function useTeamScorecards(dateFrom: string | null, dateTo: string | null) {
  return useQuery({
    queryKey: ['task-analytics', 'scorecards', dateFrom, dateTo],
    queryFn: async () => {
      // Get all tasks with assignee info
      let query = supabase.from('daily_standup_tasks' as any).select(`
          id, status, task_type, assignee_id, created_at, completed_at, due_date, priority_rank,
          assignee:profiles!daily_standup_tasks_assignee_id_fkey(id, first_name, last_name)
        `);

      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo);

      const { data: tasks, error } = await query;
      if (error) throw error;

      const all = (tasks || []) as any[];

      // Group by assignee
      const byMember = new Map<string, { name: string; tasks: any[] }>();

      for (const t of all) {
        if (!t.assignee_id) continue;
        if (!byMember.has(t.assignee_id)) {
          const name = t.assignee
            ? `${t.assignee.first_name || ''} ${t.assignee.last_name || ''}`.trim()
            : 'Unknown';
          byMember.set(t.assignee_id, { name, tasks: [] });
        }
        byMember.get(t.assignee_id)!.tasks.push(t);
      }

      const scorecards: TeamMemberScorecard[] = [];

      for (const [memberId, { name, tasks: memberTasks }] of byMember) {
        const completed = memberTasks.filter((t: any) => t.status === 'completed');
        const overdue = memberTasks.filter((t: any) => t.status === 'overdue');

        const completionTimes = completed
          .filter((t: any) => t.completed_at && t.created_at)
          .map((t: any) => {
            const diff = new Date(t.completed_at).getTime() - new Date(t.created_at).getTime();
            return diff / (1000 * 60 * 60);
          });

        const avgTime =
          completionTimes.length > 0
            ? completionTimes.reduce((s: number, v: number) => s + v, 0) / completionTimes.length
            : null;

        // Priority discipline: did they complete tasks in rank order?
        const completedWithRanks = completed
          .filter((t: any) => t.priority_rank != null && t.completed_at)
          .sort(
            (a: any, b: any) =>
              new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime(),
          );

        let inOrderCount = 0;
        for (let i = 1; i < completedWithRanks.length; i++) {
          if (completedWithRanks[i].priority_rank >= completedWithRanks[i - 1].priority_rank) {
            inOrderCount++;
          }
        }
        const priorityDiscipline =
          completedWithRanks.length > 1
            ? (inOrderCount / (completedWithRanks.length - 1)) * 100
            : 100;

        // Completion trend (group by date)
        const trendMap = new Map<string, { total: number; completed: number }>();
        for (const t of memberTasks) {
          const date = t.due_date?.split('T')[0] || t.created_at?.split('T')[0];
          if (!date) continue;
          if (!trendMap.has(date)) trendMap.set(date, { total: 0, completed: 0 });
          trendMap.get(date)!.total++;
          if (t.status === 'completed') trendMap.get(date)!.completed++;
        }
        const completionTrend = Array.from(trendMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, { total, completed: comp }]) => ({
            date,
            rate: total > 0 ? (comp / total) * 100 : 0,
          }));

        // By task type
        const byType: Record<string, { assigned: number; completed: number; overdue: number }> = {};
        for (const t of memberTasks) {
          const type = t.task_type;
          if (!byType[type]) byType[type] = { assigned: 0, completed: 0, overdue: 0 };
          byType[type].assigned++;
          if (t.status === 'completed') byType[type].completed++;
          if (t.status === 'overdue') byType[type].overdue++;
        }

        scorecards.push({
          member_id: memberId,
          member_name: name,
          total_assigned: memberTasks.length,
          total_completed: completed.length,
          total_overdue: overdue.length,
          completion_rate:
            memberTasks.length > 0 ? (completed.length / memberTasks.length) * 100 : 0,
          avg_time_to_complete_hours: avgTime,
          priority_discipline_score: priorityDiscipline,
          completion_trend: completionTrend,
          by_task_type: byType as any,
        });
      }

      // Sort by completion rate descending (leaderboard)
      scorecards.sort((a, b) => b.completion_rate - a.completion_rate);

      return scorecards;
    },
    staleTime: 60_000,
  });
}

// ─── Meeting quality analytics ───

export function useMeetingQualityMetrics(dateFrom: string | null, dateTo: string | null) {
  return useQuery({
    queryKey: ['task-analytics', 'meeting-quality', dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('standup_meetings' as any)
        .select('*')
        .order('meeting_date', { ascending: false });

      if (dateFrom) query = query.gte('meeting_date', dateFrom);
      if (dateTo) query = query.lte('meeting_date', dateTo);

      const { data: meetings, error: meetingsError } = await query;
      if (meetingsError) throw meetingsError;

      // For each meeting, get task details
      const metrics: MeetingQualityMetrics[] = [];

      for (const meeting of (meetings || []) as any[]) {
        const { data: tasks } = await supabase
          .from('daily_standup_tasks' as any)
          .select('id, assignee_id, extraction_confidence, needs_review')
          .eq('source_meeting_id', meeting.id);

        const taskList = (tasks || []) as any[];
        const total = taskList.length;

        if (total === 0) {
          metrics.push({
            meeting_id: meeting.id,
            meeting_date: meeting.meeting_date,
            extraction_confidence_rate: 0,
            needs_review_rate: 0,
            tasks_per_meeting: 0,
            assignee_match_rate: 0,
            meeting_duration_minutes: meeting.meeting_duration_minutes,
          });
          continue;
        }

        const highConfidence = taskList.filter(
          (t: any) => t.extraction_confidence === 'high',
        ).length;
        const needsReview = taskList.filter((t: any) => t.needs_review).length;
        const assigned = taskList.filter((t: any) => t.assignee_id != null).length;

        metrics.push({
          meeting_id: meeting.id,
          meeting_date: meeting.meeting_date,
          extraction_confidence_rate: (highConfidence / total) * 100,
          needs_review_rate: (needsReview / total) * 100,
          tasks_per_meeting: total,
          assignee_match_rate: (assigned / total) * 100,
          meeting_duration_minutes: meeting.meeting_duration_minutes,
        });
      }

      return metrics;
    },
    staleTime: 60_000,
  });
}

// ─── Standup meetings list ───

export function useStandupMeetings(limit = 30) {
  return useQuery({
    queryKey: ['standup-meetings', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('standup_meetings' as any)
        .select('*')
        .order('meeting_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });
}

// ─── Task volume per day ───

export function useTaskVolumeTrend(dateFrom: string | null, dateTo: string | null) {
  return useQuery({
    queryKey: ['task-analytics', 'volume-trend', dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('daily_standup_tasks' as any)
        .select('id, created_at, status')
        .order('created_at', { ascending: true });

      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo);

      const { data, error } = await query;
      if (error) throw error;

      const byDate = new Map<string, { created: number; completed: number }>();
      for (const t of (data || []) as any[]) {
        const date = t.created_at?.split('T')[0];
        if (!date) continue;
        if (!byDate.has(date)) byDate.set(date, { created: 0, completed: 0 });
        byDate.get(date)!.created++;
        if (t.status === 'completed') byDate.get(date)!.completed++;
      }

      return Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({ date, ...counts }));
    },
    staleTime: 60_000,
  });
}
