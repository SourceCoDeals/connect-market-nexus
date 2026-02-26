/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type {
  DailyStandupTask,
  DailyStandupTaskWithRelations,
  TaskStatus,
} from '@/types/daily-tasks';

const QUERY_KEY = 'daily-standup-tasks';

// ─── Fetch tasks with relations ───

interface UseDailyTasksOptions {
  view: 'my' | 'all';
  includeCompleted?: boolean;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export function useDailyTasks(options: UseDailyTasksOptions) {
  const { user } = useAuth();

  // Don't run the 'my' view query until the user is loaded — otherwise the
  // filter `.eq('assignee_id', user.id)` can't be applied and the query
  // either returns all tasks (leaking data) or returns nothing once the
  // correct key is set.
  const isMyView = options.view === 'my';

  return useQuery({
    queryKey: [QUERY_KEY, options, user?.id],
    enabled: !isMyView || !!user?.id,
    queryFn: async () => {
      // Mark overdue tasks first
      await supabase.rpc('mark_overdue_standup_tasks' as any);

      let query = supabase
        .from('daily_standup_tasks' as any)
        .select(
          `
          *,
          assignee:profiles!daily_standup_tasks_assignee_id_fkey(id, first_name, last_name, email),
          deal:deals!daily_standup_tasks_deal_id_fkey(id, listing_id, listings(title, internal_company_name, ebitda), deal_stages(name)),
          source_meeting:standup_meetings(id, meeting_title, meeting_date, transcript_url)
        `,
        )
        .order('priority_rank', { ascending: true, nullsFirst: false })
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: true });

      if (isMyView && user?.id) {
        query = query.eq('assignee_id', user.id);
      }

      if (!options.includeCompleted) {
        query = query.in('status', ['pending_approval', 'pending', 'overdue']);
      }

      if (options.dateFrom) {
        query = query.gte('due_date', options.dateFrom);
      }
      if (options.dateTo) {
        query = query.lte('due_date', options.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as DailyStandupTaskWithRelations[];
    },
    staleTime: 30_000,
  });
}

// ─── Complete/uncomplete a task ───

export function useToggleTaskComplete() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const updates: Record<string, unknown> = completed
        ? {
            status: 'completed' as TaskStatus,
            completed_at: new Date().toISOString(),
            completed_by: user?.id,
          }
        : {
            status: 'pending' as TaskStatus,
            completed_at: null,
            completed_by: null,
          };

      const { error } = await supabase
        .from('daily_standup_tasks' as any)
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      // Recompute ranks whenever task status changes
      await recomputeRanks();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ─── Approve a task (leadership only) ───

export function useApproveTask() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('daily_standup_tasks' as any)
        .update({
          status: 'pending' as TaskStatus,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('status', 'pending_approval');

      if (error) throw error;
      await recomputeRanks();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ─── Approve all pending tasks at once (leadership only) ───

export function useApproveAllTasks() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('daily_standup_tasks' as any)
        .update({
          status: 'pending' as TaskStatus,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('status', 'pending_approval');

      if (error) throw error;
      await recomputeRanks();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ─── Reassign a task ───

export function useReassignTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, newAssigneeId }: { taskId: string; newAssigneeId: string }) => {
      const { error } = await supabase
        .from('daily_standup_tasks' as any)
        .update({ assignee_id: newAssigneeId, needs_review: false })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ─── Edit a task ───

export function useEditTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      updates,
    }: {
      taskId: string;
      updates: Partial<
        Pick<
          DailyStandupTask,
          'title' | 'description' | 'task_type' | 'due_date' | 'deal_id' | 'deal_reference'
        >
      >;
    }) => {
      const { error } = await supabase
        .from('daily_standup_tasks' as any)
        .update(updates)
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ─── Add a manual task ───

export function useAddManualTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      task: Pick<
        DailyStandupTask,
        | 'title'
        | 'description'
        | 'assignee_id'
        | 'task_type'
        | 'due_date'
        | 'deal_id'
        | 'deal_reference'
      >,
    ) => {
      const { data, error } = await supabase
        .from('daily_standup_tasks' as any)
        .insert({
          ...task,
          is_manual: true,
          status: 'pending_approval',
          priority_score: 50, // default mid-range for manual tasks
          extraction_confidence: 'high',
          needs_review: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Recompute ranks
      await recomputeRanks();

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ─── Delete a task ───

export function useDeleteTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('daily_standup_tasks' as any)
        .delete()
        .eq('id', taskId);
      if (error) throw error;
      await recomputeRanks();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ─── Pin/unpin a task (leadership only) ───

export function usePinTask() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      taskId,
      rank,
      reason,
    }: {
      taskId: string;
      rank: number | null;
      reason?: string;
    }) => {
      const isPinning = rank !== null;

      // Update the task
      const { error } = await supabase
        .from('daily_standup_tasks' as any)
        .update({
          is_pinned: isPinning,
          pinned_rank: rank,
          pinned_by: isPinning ? user?.id : null,
          pinned_at: isPinning ? new Date().toISOString() : null,
          pin_reason: isPinning ? reason || null : null,
        })
        .eq('id', taskId);
      if (error) throw error;

      // Log the action
      await supabase.from('task_pin_log' as any).insert({
        task_id: taskId,
        action: isPinning ? 'pinned' : 'unpinned',
        pinned_rank: rank,
        reason: reason || null,
        performed_by: user?.id,
      });

      await recomputeRanks();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ─── Trigger extraction from a Fireflies transcript ───

export function useTriggerExtraction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      fireflies_transcript_id?: string;
      transcript_text?: string;
      meeting_title?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('extract-standup-tasks', {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['standup-meetings'] });
    },
  });
}

// ─── Recompute ranks (client helper) ───

async function recomputeRanks() {
  const { data: tasks } = await supabase
    .from('daily_standup_tasks' as any)
    .select('id, priority_score, is_pinned, pinned_rank, created_at')
    .in('status', ['pending_approval', 'pending', 'overdue'])
    .order('priority_score', { ascending: false })
    .order('created_at', { ascending: true });

  if (!tasks || tasks.length === 0) return;

  const totalTasks = tasks.length;

  // Separate pinned (with valid ranks within range) and unpinned
  const validPinned = (tasks as any[]).filter(
    (t) => t.is_pinned && t.pinned_rank && t.pinned_rank <= totalTasks,
  );
  // Deduplicate: if two tasks have the same pinned_rank, only the first keeps the slot
  const pinnedSlots = new Map<number, string>();
  const pinnedTaskIds = new Set<string>();
  for (const p of validPinned) {
    if (!pinnedSlots.has(p.pinned_rank)) {
      pinnedSlots.set(p.pinned_rank, p.id);
      pinnedTaskIds.add(p.id);
    }
  }

  // Everyone not occupying a pinned slot goes into the unpinned pool (in score order)
  const unpinned = (tasks as any[]).filter((t: any) => !pinnedTaskIds.has(t.id));

  const ranked: { id: string; rank: number }[] = [];
  let unpinnedIdx = 0;

  for (let rank = 1; rank <= totalTasks; rank++) {
    if (pinnedSlots.has(rank)) {
      ranked.push({ id: pinnedSlots.get(rank)!, rank });
    } else if (unpinnedIdx < unpinned.length) {
      ranked.push({ id: (unpinned[unpinnedIdx] as any).id, rank });
      unpinnedIdx++;
    }
  }

  // Batch update ranks
  for (const { id, rank } of ranked) {
    await supabase
      .from('daily_standup_tasks' as any)
      .update({ priority_rank: rank })
      .eq('id', id);
  }
}
