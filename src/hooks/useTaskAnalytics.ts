import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  TaskType,
  TaskAnalyticsSummary,
  TeamMemberScorecard,
  MeetingQualityMetrics,
} from '@/types/daily-tasks';

interface AnalyticsTaskRow {
  id: string;
  status: string;
  task_type: string;
  assignee_id: string | null;
  created_at: string;
  completed_at: string | null;
  due_date: string;
  priority_rank: number | null;
  assignee?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

interface MeetingRow {
  id: string;
  meeting_date: string;
  meeting_duration_minutes: number | null;
}

interface MeetingTaskRow {
  id: string;
  source_meeting_id: string;
  assignee_id: string | null;
  extraction_confidence: string;
  needs_review: boolean;
}

// ─── Team-wide analytics ───

export function useTaskAnalytics(dateFrom: string | null, dateTo: string | null) {
  return useQuery({
    queryKey: ['task-analytics', 'team', dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('daily_standup_tasks' as never)
        .select(
          'id, status, task_type, assignee_id, created_at, completed_at, due_date, priority_rank',
        );

      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo);

      const { data: tasks, error } = await query;
      if (error) throw error;

      const all = (tasks || []) as AnalyticsTaskRow[];
      const completed = all.filter((t) => t.status === 'completed');
      const overdue = all.filter((t) => t.status === 'overdue');

      // Completion times
      const completionTimes = completed
        .filter((t) => t.completed_at && t.created_at)
        .map((t) => {
          const diff = new Date(t.completed_at!).getTime() - new Date(t.created_at!).getTime();
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
        by_task_type: byTaskType as Record<
          TaskType,
          { assigned: number; completed: number; overdue: number }
        >,
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
      let query = supabase.from('daily_standup_tasks' as never).select(`
          id, status, task_type, assignee_id, created_at, completed_at, due_date, priority_rank,
          assignee:profiles!daily_standup_tasks_assignee_id_fkey(id, first_name, last_name)
        `);

      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo);

      const { data: tasks, error } = await query;
      if (error) throw error;

      const all = (tasks || []) as AnalyticsTaskRow[];

      const byMember = new Map<string, { name: string; tasks: AnalyticsTaskRow[] }>();

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
        const completed = memberTasks.filter((t) => t.status === 'completed');
        const overdue = memberTasks.filter((t) => t.status === 'overdue');

        const completionTimes = completed
          .filter((t) => t.completed_at && t.created_at)
          .map((t) => {
            const diff = new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime();
            return diff / (1000 * 60 * 60);
          });

        const avgTime =
          completionTimes.length > 0
            ? completionTimes.reduce((s, v) => s + v, 0) / completionTimes.length
            : null;

        const completedWithRanks = completed
          .filter((t) => t.priority_rank != null && t.completed_at)
          .sort(
            (a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime(),
          );

        let inOrderCount = 0;
        for (let i = 1; i < completedWithRanks.length; i++) {
          if (completedWithRanks[i].priority_rank! >= completedWithRanks[i - 1].priority_rank!) {
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
          by_task_type: byType as Record<
            TaskType,
            { assigned: number; completed: number; overdue: number }
          >,
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
        .from('standup_meetings' as never)
        .select('*')
        .order('meeting_date', { ascending: false });

      if (dateFrom) query = query.gte('meeting_date', dateFrom);
      if (dateTo) query = query.lte('meeting_date', dateTo);

      const { data: meetings, error: meetingsError } = await query;
      if (meetingsError) throw meetingsError;

      const meetingList = (meetings || []) as MeetingRow[];
      if (meetingList.length === 0) return [];

      const meetingIds = meetingList.map((m) => m.id);
      const { data: allTasks } = await supabase
        .from('daily_standup_tasks' as never)
        .select('id, source_meeting_id, assignee_id, extraction_confidence, needs_review')
        .in('source_meeting_id', meetingIds);

      const tasksByMeeting = new Map<string, MeetingTaskRow[]>();
      for (const t of (allTasks || []) as MeetingTaskRow[]) {
        const list = tasksByMeeting.get(t.source_meeting_id) || [];
        list.push(t);
        tasksByMeeting.set(t.source_meeting_id, list);
      }

      const metrics: MeetingQualityMetrics[] = [];

      for (const meeting of meetingList) {
        const taskList = tasksByMeeting.get(meeting.id) || [];
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

        const highConfidence = taskList.filter((t) => t.extraction_confidence === 'high').length;
        const needsReview = taskList.filter((t) => t.needs_review).length;
        const assigned = taskList.filter((t) => t.assignee_id != null).length;

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
        .from('standup_meetings' as never)
        .select('*')
        .order('meeting_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as MeetingRow[];
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
        .from('daily_standup_tasks' as never)
        .select('id, created_at, status')
        .order('created_at', { ascending: true });

      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo);

      const { data, error } = await query;
      if (error) throw error;

      const byDate = new Map<string, { created: number; completed: number }>();
      for (const t of (data || []) as Array<{ id: string; created_at: string; status: string }>) {
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
