/**
 * useTaskActions — v3.1 task mutations
 *
 * Extends the existing useDailyTasks hooks with:
 * - Snooze/unsnooze
 * - Confirm/dismiss AI tasks
 * - Task templates
 * - Activity logging on mutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { addDays, format } from 'date-fns';
import type { TaskTemplateStage, TaskEntityType } from '@/types/daily-tasks';

/**
 * Helper for accessing Supabase tables whose columns are not fully
 * represented in the generated Database type (daily_standup_tasks has
 * extra v3.1 columns) or that are missing entirely (rm_task_activity_log).
 *
 * A single cast here keeps every call-site free of inline `any`.
 */
const fromTable = supabase.from.bind(supabase) as (
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => ReturnType<typeof supabase.from<any, any>>;

const QUERY_KEY = 'daily-standup-tasks';
const ENTITY_TASKS_KEY = 'entity-tasks';

// ─── Snooze a task ───

export function useSnoozeTask() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, days }: { taskId: string; days: number }) => {
      const snoozedUntil = format(addDays(new Date(), days), 'yyyy-MM-dd');

      const { error } = await supabase
        .from('daily_standup_tasks' as any)
        .update({
          status: 'snoozed',
          snoozed_until: snoozedUntil,
        })
        .eq('id', taskId);

      if (error) throw error;

      // Log activity
      await supabase.from('rm_task_activity_log' as any).insert({
        task_id: taskId,
        user_id: user?.id,
        action: 'snoozed',
        new_value: { snoozed_until: snoozedUntil, days },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [ENTITY_TASKS_KEY] });
    },
  });
}

// ─── Unsnooze a task ───

export function useUnsnoozeTask() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('daily_standup_tasks' as any)
        .update({
          status: 'pending',
          snoozed_until: null,
        })
        .eq('id', taskId);

      if (error) throw error;

      await supabase.from('rm_task_activity_log' as any).insert({
        task_id: taskId,
        user_id: user?.id,
        action: 'status_changed',
        old_value: { status: 'snoozed' },
        new_value: { status: 'pending' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [ENTITY_TASKS_KEY] });
    },
  });
}

// ─── Confirm an AI-suggested task ───

export function useConfirmAITask() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, dueDate }: { taskId: string; dueDate?: string }) => {
      const updates: Record<string, unknown> = {
        confirmed_at: new Date().toISOString(),
        status: 'pending',
      };
      if (dueDate) updates.due_date = dueDate;

      const { error } = await supabase
        .from('daily_standup_tasks' as any)
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      await supabase.from('rm_task_activity_log' as any).insert({
        task_id: taskId,
        user_id: user?.id,
        action: 'confirmed',
        new_value: updates,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [ENTITY_TASKS_KEY] });
    },
  });
}

// ─── Dismiss an AI-suggested task ───

export function useDismissAITask() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('daily_standup_tasks' as any)
        .update({
          dismissed_at: new Date().toISOString(),
          status: 'cancelled',
        })
        .eq('id', taskId);

      if (error) throw error;

      await supabase.from('rm_task_activity_log' as any).insert({
        task_id: taskId,
        user_id: user?.id,
        action: 'dismissed',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [ENTITY_TASKS_KEY] });
    },
  });
}

// ─── Cancel a task ───

export function useCancelTask() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('daily_standup_tasks' as any)
        .update({ status: 'cancelled' })
        .eq('id', taskId);

      if (error) throw error;

      await supabase.from('rm_task_activity_log' as any).insert({
        task_id: taskId,
        user_id: user?.id,
        action: 'cancelled',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [ENTITY_TASKS_KEY] });
    },
  });
}

// ─── Apply task template to a listing ───

export function useApplyTaskTemplate() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      listingId,
      assigneeId,
      template,
    }: {
      listingId: string;
      assigneeId: string;
      template: TaskTemplateStage;
    }) => {
      const createdTaskIds: string[] = [];

      for (const task of template.tasks) {
        const dueDate = format(addDays(new Date(), task.due_offset_days), 'yyyy-MM-dd');

        const insertData: Record<string, unknown> = {
          title: task.title,
          description: task.description || null,
          task_type: task.task_type,
          due_date: dueDate,
          assignee_id: assigneeId,
          entity_type: 'listing' as TaskEntityType,
          entity_id: listingId,
          source: 'template',
          priority: 'medium',
          status: 'pending',
          is_manual: false,
          priority_score: 50,
          extraction_confidence: 'high',
          needs_review: false,
          created_by: user?.id,
        };

        // Set depends_on from previously created task
        if (task.depends_on_index !== undefined && createdTaskIds[task.depends_on_index]) {
          insertData.depends_on = createdTaskIds[task.depends_on_index];
        }

        const { data, error } = await supabase
          .from('daily_standup_tasks' as any)
          .insert(insertData)
          .select('id')
          .single();

        if (error) throw error;
        createdTaskIds.push((data as any).id);

        // Log activity
        await supabase.from('rm_task_activity_log' as any).insert({
          task_id: (data as any).id,
          user_id: user?.id,
          action: 'created',
          new_value: { source: 'template', template_stage: template.name },
        });
      }

      return createdTaskIds;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [ENTITY_TASKS_KEY] });
    },
  });
}

// ─── Add task with entity linking (enhanced manual task) ───

export function useAddEntityTask() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (task: {
      title: string;
      description?: string | null;
      assignee_id?: string | null;
      task_type: string;
      due_date: string;
      priority?: string;
      entity_type: TaskEntityType;
      entity_id: string;
      secondary_entity_type?: TaskEntityType | null;
      secondary_entity_id?: string | null;
      deal_reference?: string | null;
      deal_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('daily_standup_tasks' as any)
        .insert({
          title: task.title,
          description: task.description || null,
          assignee_id: task.assignee_id || null,
          task_type: task.task_type,
          due_date: task.due_date,
          priority: task.priority || 'medium',
          entity_type: task.entity_type,
          entity_id: task.entity_id,
          secondary_entity_type: task.secondary_entity_type || null,
          secondary_entity_id: task.secondary_entity_id || null,
          deal_reference: task.deal_reference || null,
          deal_id: task.deal_id || null,
          source: 'manual',
          is_manual: true,
          status: 'pending',
          priority_score: 50,
          extraction_confidence: 'high',
          needs_review: false,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('rm_task_activity_log' as any).insert({
        task_id: (data as any).id,
        user_id: user?.id,
        action: 'created',
        new_value: { entity_type: task.entity_type, entity_id: task.entity_id },
      });

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [ENTITY_TASKS_KEY] });
    },
  });
}
