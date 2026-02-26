import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DailyTask, TaskTimeRange } from '@/types/daily-tasks';
import { getDateFromRange, calculatePriorityScore, TASK_TYPE_CONFIG } from '@/types/daily-tasks';

export function useDailyTasks(params: {
  assigneeId?: string | null;
  timeRange?: TaskTimeRange;
  includeCompleted?: boolean;
}) {
  const { assigneeId, timeRange = 'today', includeCompleted = true } = params;

  return useQuery({
    queryKey: ['daily-tasks', assigneeId, timeRange, includeCompleted],
    queryFn: async () => {
      let query = supabase
        .from('daily_tasks')
        .select('*')
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: true });

      if (assigneeId) {
        query = query.eq('assignee_id', assigneeId);
      }

      if (timeRange === 'today') {
        const today = new Date().toISOString().split('T')[0];
        query = query.eq('due_date', today);
        // Also include overdue tasks from previous days
        if (!includeCompleted) {
          query = supabase
            .from('daily_tasks')
            .select('*')
            .order('priority_score', { ascending: false })
            .order('created_at', { ascending: true });
          if (assigneeId) query = query.eq('assignee_id', assigneeId);
          query = query.or(`due_date.eq.${today},status.eq.overdue`);
        }
      } else {
        const fromDate = getDateFromRange(timeRange);
        if (fromDate) {
          query = query.gte('due_date', fromDate);
        }
      }

      if (!includeCompleted) {
        query = query.neq('status', 'completed');
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DailyTask[];
    },
    staleTime: 15_000,
  });
}

export function useTodayTasks(assigneeId?: string | null) {
  return useQuery({
    queryKey: ['daily-tasks', 'today-with-overdue', assigneeId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      // Fetch today's tasks + any overdue tasks
      let query = supabase
        .from('daily_tasks')
        .select('*')
        .or(`due_date.eq.${today},status.eq.overdue`)
        .order('created_at', { ascending: true });

      if (assigneeId) {
        query = query.eq('assignee_id', assigneeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const tasks = (data || []) as DailyTask[];

      // Compute priority ranks client-side
      return rankTasks(tasks);
    },
    staleTime: 10_000,
  });
}

export function rankTasks(tasks: DailyTask[]): DailyTask[] {
  // Separate pinned and unpinned
  const pinned = tasks.filter((t) => t.is_pinned && t.pinned_rank != null);
  const unpinned = tasks.filter((t) => !t.is_pinned || t.pinned_rank == null);

  // Score unpinned tasks
  const scored = unpinned.map((t) => {
    const taskTypeScore = TASK_TYPE_CONFIG[t.task_type]?.score ?? 40;
    const daysOverdue =
      t.status === 'overdue'
        ? Math.max(
            0,
            Math.floor((Date.now() - new Date(t.due_date).getTime()) / (1000 * 60 * 60 * 24)),
          )
        : 0;

    const score = calculatePriorityScore({
      dealValueScore: 50, // Default for now; will be enriched with deal data
      dealStageScore: 50,
      taskTypeScore,
      daysOverdue,
    });

    return { ...t, priority_score: score };
  });

  // Sort by priority score DESC, then by created_at ASC (FIFO tiebreaker)
  scored.sort((a, b) => {
    if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // Merge pinned and unpinned into final ranked list
  const result: DailyTask[] = [];
  const pinnedByRank = new Map(pinned.map((t) => [t.pinned_rank!, t]));
  let unpinnedIdx = 0;

  // Find max rank needed
  const maxRank = Math.max(tasks.length, ...pinned.map((t) => t.pinned_rank || 0));

  for (let rank = 1; rank <= maxRank; rank++) {
    if (pinnedByRank.has(rank)) {
      result.push({ ...pinnedByRank.get(rank)!, priority_rank: rank });
    } else if (unpinnedIdx < scored.length) {
      result.push({ ...scored[unpinnedIdx], priority_rank: rank });
      unpinnedIdx++;
    }
  }

  // Add remaining unpinned tasks
  while (unpinnedIdx < scored.length) {
    result.push({
      ...scored[unpinnedIdx],
      priority_rank: result.length + 1,
    });
    unpinnedIdx++;
  }

  return result;
}

export function useStandupMeetings() {
  return useQuery({
    queryKey: ['standup-meetings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('standup_meetings')
        .select('*')
        .order('meeting_date', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['bd-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_user_roles');
      if (error) throw error;
      return (data || [])
        .filter((r: { role: string }) => ['owner', 'admin', 'moderator'].includes(r.role))
        .map(
          (r: {
            user_id: string;
            user_first_name: string | null;
            user_last_name: string | null;
            user_email: string;
            role: string;
          }) => ({
            id: r.user_id,
            name: `${r.user_first_name || ''} ${r.user_last_name || ''}`.trim() || r.user_email,
            firstName: r.user_first_name,
            lastName: r.user_last_name,
            email: r.user_email,
            role: r.role,
          }),
        );
    },
    staleTime: 60_000,
  });
}
