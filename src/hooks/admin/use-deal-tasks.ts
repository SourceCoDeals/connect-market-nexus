import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logDealActivity } from '@/lib/deal-activity-logger';

export interface DealTask {
  id: string;
  deal_id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'reopened' | 'na' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  assigned_to?: string;
  assigned_by?: string;
  due_date?: string;
  completed_at?: string;
  completed_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskReviewer {
  id: string;
  task_id: string;
  admin_id: string;
  added_by?: string;
  added_at: string;
}

export function useDealTasks(dealId?: string) {
  return useQuery({
    queryKey: ['deal-tasks', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('deal_tasks')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DealTask[];
    },
    enabled: !!dealId,
  });
}

export function useCreateDealTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (taskData: {
      deal_id: string;
      title: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high';
      assigned_to?: string;
      due_date?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('deal_tasks')
        .insert({
          ...taskData,
          assigned_by: userData?.user?.id,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;

      // Get deal details for activity logging and notifications
      const { data: dealData } = await supabase
        .from('deals')
        .select('title, connection_request_id')
        .eq('id', taskData.deal_id)
        .single();

      // Log activity
      await logDealActivity({
        dealId: taskData.deal_id,
        activityType: 'task_created',
        title: 'Task Created',
        description: `Task "${taskData.title}" was created`,
        metadata: {
          task_id: data.id,
          task_title: taskData.title,
          priority: taskData.priority,
          assigned_to: taskData.assigned_to,
        },
      });

      // Send notification if task is assigned
      if (taskData.assigned_to && taskData.assigned_to !== userData?.user?.id) {
        // Get assignee profile
        const { data: assigneeProfile } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .eq('id', taskData.assigned_to)
          .single();

        // Get assigner profile
        const { data: assignerProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', userData?.user?.id)
          .single();

        if (assigneeProfile?.email) {
          // Create admin notification
          await supabase.from('admin_notifications').insert({
            admin_id: taskData.assigned_to,
            notification_type: 'task_assigned',
            title: 'New Task Assigned',
            message: `You have been assigned a new task: ${taskData.title}`,
            deal_id: taskData.deal_id,
            task_id: data.id,
            action_url: `/admin/deals/pipeline?deal=${taskData.deal_id}&tab=tasks`,
            metadata: {
              task_title: taskData.title,
              title: dealData?.title || 'Deal',
              assigned_by: userData?.user?.id,
              priority: taskData.priority,
            },
          });

          // Send email notification with correct parameters
          await supabase.functions.invoke('send-task-notification-email', {
            body: {
              assignee_email: assigneeProfile.email,
              assignee_name: `${assigneeProfile.first_name} ${assigneeProfile.last_name}`.trim() || assigneeProfile.email,
              assigner_name: assignerProfile ? `${assignerProfile.first_name} ${assignerProfile.last_name}`.trim() : 'Admin',
              task_title: taskData.title,
              task_description: taskData.description,
              task_priority: taskData.priority || 'medium',
              task_due_date: taskData.due_date,
              title: dealData?.title || 'Deal',
              deal_id: taskData.deal_id,
            },
          });
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast({
        title: 'Task created',
        description: 'The task has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create task: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateDealTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<DealTask> }) => {
      const { data: currentTask } = await supabase
        .from('deal_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('deal_tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      // Get deal details
      const { data: dealData } = await supabase
        .from('deals')
        .select('title')
        .eq('id', currentTask.deal_id)
        .single();

      // Log assignment changes and send notifications
      if (updates.assigned_to && currentTask && updates.assigned_to !== currentTask.assigned_to) {
        // Get assignee profile
        const { data: assigneeProfile } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .eq('id', updates.assigned_to)
          .single();

        // Get assigner profile
        const { data: assignerProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', userData?.user?.id)
          .single();

        await logDealActivity({
          dealId: currentTask.deal_id,
          activityType: 'task_assigned',
          title: 'Task Reassigned',
          description: `Task "${currentTask.title}" was reassigned`,
          metadata: {
            task_id: taskId,
            old_assignee: currentTask.assigned_to,
            new_assignee: updates.assigned_to,
          },
        });

        // Send notification to new assignee if different from current user
        if (updates.assigned_to !== userData?.user?.id && assigneeProfile?.email) {
          await supabase.from('admin_notifications').insert({
            admin_id: updates.assigned_to,
            notification_type: 'task_assigned',
            title: 'Task Assigned to You',
            message: `You have been assigned a task: ${currentTask.title}`,
            deal_id: currentTask.deal_id,
            task_id: taskId,
            action_url: `/admin/deals/pipeline?deal=${currentTask.deal_id}&tab=tasks`,
            metadata: {
              task_title: currentTask.title,
              title: dealData?.title || 'Deal',
              assigned_by: userData?.user?.id,
              priority: currentTask.priority,
            },
          });

          // Send email notification with correct parameters
          await supabase.functions.invoke('send-task-notification-email', {
            body: {
              assignee_email: assigneeProfile.email,
              assignee_name: `${assigneeProfile.first_name} ${assigneeProfile.last_name}`.trim() || assigneeProfile.email,
              assigner_name: assignerProfile ? `${assignerProfile.first_name} ${assignerProfile.last_name}`.trim() : 'Admin',
              task_title: currentTask.title,
              task_description: currentTask.description,
              task_priority: currentTask.priority || 'medium',
              task_due_date: currentTask.due_date,
              title: dealData?.title || 'Deal',
              deal_id: currentTask.deal_id,
            },
          });
        }
      }

      // Notify reviewers when task is resolved
      if (updates.status === 'resolved' && currentTask?.status !== 'resolved') {
        // Get all reviewers for this task
        const { data: reviewers } = await supabase
          .from('deal_task_reviewers')
          .select('admin_id')
          .eq('task_id', taskId);

        if (reviewers && reviewers.length > 0) {
          // Send notification to each reviewer (except the person who resolved it)
          const notifications = reviewers
            .filter(r => r.admin_id !== userData?.user?.id)
            .map(reviewer => ({
              admin_id: reviewer.admin_id,
              notification_type: 'task_resolved',
              title: 'Task Ready for Review',
              message: `Task "${currentTask.title}" has been resolved and is ready for your review`,
              deal_id: currentTask.deal_id,
              task_id: taskId,
              action_url: `/admin/deals/pipeline?deal=${currentTask.deal_id}&tab=tasks`,
              metadata: {
                task_title: currentTask.title,
                title: dealData?.title || 'Deal',
                resolved_by: userData?.user?.id,
                priority: currentTask.priority,
              },
            }));

          if (notifications.length > 0) {
            await supabase.from('admin_notifications').insert(notifications);
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast({
        title: 'Task updated',
        description: 'The task has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update task: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useCompleteDealTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data: currentTask } = await supabase
        .from('deal_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      const { data, error } = await supabase
        .from('deal_tasks')
        .update({
          status: 'resolved',
          completed_at: new Date().toISOString(),
          completed_by: userData?.user?.id,
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      if (currentTask) {
        await logDealActivity({
          dealId: currentTask.deal_id,
          activityType: 'task_completed',
          title: 'Task Completed',
          description: `Task "${currentTask.title}" was marked as resolved`,
          metadata: {
            task_id: taskId,
            task_title: currentTask.title,
          },
        });

        // Notify task creator if different from completer
        if (currentTask.assigned_by && currentTask.assigned_by !== userData?.user?.id) {
          const { data: dealData } = await supabase
            .from('deals')
            .select('title')
            .eq('id', currentTask.deal_id)
            .single();

          await supabase.from('admin_notifications').insert({
            admin_id: currentTask.assigned_by,
            notification_type: 'task_completed',
            title: 'Task Completed',
            message: `Task "${currentTask.title}" was marked as resolved`,
            deal_id: currentTask.deal_id,
            task_id: taskId,
            action_url: `/admin/deals/pipeline?deal=${currentTask.deal_id}&tab=tasks`,
            metadata: {
              task_title: currentTask.title,
              title: dealData?.title || 'Deal',
              completed_by: userData?.user?.id,
            },
          });
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast({
        title: 'Task completed',
        description: 'The task has been marked as resolved.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to complete task: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteDealTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('deal_tasks')
        .delete()
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      toast({
        title: 'Task deleted',
        description: 'The task has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete task: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

// Get task reviewers
export function useTaskReviewers(taskId?: string) {
  return useQuery({
    queryKey: ['task-reviewers', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('deal_task_reviewers')
        .select('*')
        .eq('task_id', taskId);
      if (error) throw error;
      return data as TaskReviewer[];
    },
    enabled: !!taskId,
  });
}

// Add reviewer to task
export function useAddTaskReviewer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ taskId, adminId }: { taskId: string; adminId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('deal_task_reviewers')
        .insert({
          task_id: taskId,
          admin_id: adminId,
          added_by: userData?.user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-reviewers'] });
    },
  });
}

// Remove reviewer from task
export function useRemoveTaskReviewer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ taskId, adminId }: { taskId: string; adminId: string }) => {
      const { error } = await supabase
        .from('deal_task_reviewers')
        .delete()
        .eq('task_id', taskId)
        .eq('admin_id', adminId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-reviewers'] });
    },
  });
}
