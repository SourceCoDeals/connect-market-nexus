import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TaskType, DailyTask } from '@/types/daily-tasks';

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('daily_tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
  });
}

export function useUncompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('daily_tasks')
        .update({ status: 'pending', completed_at: null })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
  });
}

export function useReassignTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, newAssigneeId }: { taskId: string; newAssigneeId: string }) => {
      const { error } = await supabase
        .from('daily_tasks')
        .update({ assignee_id: newAssigneeId, needs_review: false })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
  });
}

export function useEditTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      updates,
    }: {
      taskId: string;
      updates: Partial<
        Pick<DailyTask, 'title' | 'description' | 'task_type' | 'due_date' | 'deal_reference'>
      >;
    }) => {
      const { error } = await supabase.from('daily_tasks').update(updates).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
  });
}

export function useAddManualTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: {
      title: string;
      description?: string;
      assignee_id: string;
      task_type: TaskType;
      due_date: string;
      deal_reference?: string;
      deal_id?: string;
    }) => {
      const { error } = await supabase.from('daily_tasks').insert({
        ...task,
        is_manual: true,
        extraction_confidence: 'high',
        needs_review: false,
        priority_score: 50,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('daily_tasks').delete().eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
  });
}

export function usePinTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      rank,
      reason,
      performedBy,
    }: {
      taskId: string;
      rank: number;
      reason?: string;
      performedBy: string;
    }) => {
      // Update the task
      const { error: updateError } = await supabase
        .from('daily_tasks')
        .update({
          is_pinned: true,
          pinned_rank: rank,
          pinned_by: performedBy,
          pinned_at: new Date().toISOString(),
          pin_reason: reason || null,
        })
        .eq('id', taskId);
      if (updateError) throw updateError;

      // Log the action
      const { error: logError } = await supabase.from('daily_task_pin_log').insert({
        task_id: taskId,
        action: 'pinned',
        new_rank: rank,
        reason: reason || null,
        performed_by: performedBy,
      });
      if (logError) console.error('Failed to log pin action:', logError);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
  });
}

export function useUnpinTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, performedBy }: { taskId: string; performedBy: string }) => {
      const { error: updateError } = await supabase
        .from('daily_tasks')
        .update({
          is_pinned: false,
          pinned_rank: null,
          pinned_by: null,
          pinned_at: null,
          pin_reason: null,
        })
        .eq('id', taskId);
      if (updateError) throw updateError;

      const { error: logError } = await supabase.from('daily_task_pin_log').insert({
        task_id: taskId,
        action: 'unpinned',
        performed_by: performedBy,
      });
      if (logError) console.error('Failed to log unpin action:', logError);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
  });
}

export function useProcessStandup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      fireflies_transcript_id?: string;
      transcript_text?: string;
      meeting_title?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('process-standup-tasks', {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
      qc.invalidateQueries({ queryKey: ['standup-meetings'] });
    },
  });
}
