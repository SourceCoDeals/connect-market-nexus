import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logDealActivity } from '@/lib/deal-activity-logger';

export interface DealTask {
  id: string;
  deal_id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assigned_to?: string;
  assigned_by?: string;
  due_date?: string;
  completed_at?: string;
  completed_by?: string;
  created_at: string;
  updated_at: string;
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
      const { data, error } = await supabase
        .from('deal_tasks')
        .insert({
          ...taskData,
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
          status: 'pending'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: async (taskData) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['deal-tasks', taskData.deal_id] });
      await queryClient.cancelQueries({ queryKey: ['deals'] });

      // Snapshot previous data
      const previousTasks = queryClient.getQueryData(['deal-tasks', taskData.deal_id]);
      const previousDeals = queryClient.getQueryData(['deals']);

      // Optimistically add new task
      const optimisticTask = {
        id: `temp-${Date.now()}`,
        ...taskData,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData(['deal-tasks', taskData.deal_id], (old: any) => 
        old ? [optimisticTask, ...old] : [optimisticTask]
      );

      // Update deal task count
      queryClient.setQueryData(['deals'], (old: any) => {
        if (!old) return old;
        return old.map((deal: any) => 
          deal.deal_id === taskData.deal_id 
            ? { ...deal, pending_task_count: (deal.pending_task_count || 0) + 1 }
            : deal
        );
      });

      return { previousTasks, previousDeals };
    },
    onSuccess: async (data, variables) => {
      queryClient.refetchQueries({ queryKey: ['deal-tasks', variables.deal_id], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['deals'], type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      
      // Log activity
      await logDealActivity({
        dealId: variables.deal_id,
        activityType: 'task_created',
        title: 'Task Created',
        description: `Created task: ${variables.title}`,
        metadata: { 
          task_id: data.id,
          priority: variables.priority,
          assigned_to: variables.assigned_to 
        }
      });

      // Create notification if task is assigned
      if (variables.assigned_to) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const assignerId = user?.id;

          // Get assigner and assignee profiles
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name')
            .in('id', [assignerId, variables.assigned_to].filter(Boolean) as string[]);

          const assignerProfile = profiles?.find(p => p.id === assignerId);
          const assigneeProfile = profiles?.find(p => p.id === variables.assigned_to);

          // Get deal details
          const { data: deal } = await supabase
            .from('deals')
            .select('title, id')
            .eq('id', variables.deal_id)
            .single();

          const assignerName = assignerProfile 
            ? `${assignerProfile.first_name} ${assignerProfile.last_name}`.trim() 
            : 'Someone';
          const dealTitle = deal?.title || 'Unknown Deal';

          // Create in-app notification
          const { error: notificationError } = await supabase
            .from('admin_notifications')
            .insert({
              admin_id: variables.assigned_to,
              notification_type: 'task_assigned',
              title: 'New Task Assigned',
              message: `${assignerName} assigned you: ${variables.title}`,
              deal_id: variables.deal_id,
              task_id: data.id,
              action_url: `/admin/pipeline?deal=${variables.deal_id}&tab=tasks`,
              metadata: {
                priority: variables.priority || 'medium',
                due_date: variables.due_date,
                deal_title: dealTitle,
                assigner_name: assignerName,
              },
            });

          if (notificationError) {
            console.error('Failed to create notification:', notificationError);
          }

          // Send email notification
          if (assigneeProfile?.email) {
            await supabase.functions.invoke('send-task-notification-email', {
              body: {
                assignee_email: assigneeProfile.email,
                assignee_name: `${assigneeProfile.first_name} ${assigneeProfile.last_name}`.trim(),
                assigner_name: assignerName,
                task_title: variables.title,
                task_description: variables.description,
                task_priority: variables.priority || 'medium',
                task_due_date: variables.due_date,
                deal_title: dealTitle,
                deal_id: variables.deal_id,
              },
            });
          }
        } catch (error) {
          console.error('Failed to send task notification:', error);
          // Don't fail the task creation if notification fails
        }
      }
      
      toast({
        title: 'Task Created',
        description: 'Task has been created successfully.',
      });
    },
    onError: (error, variables, context) => {
      // Rollback optimistic updates
      if (context?.previousTasks) {
        queryClient.setQueryData(['deal-tasks', variables.deal_id], context.previousTasks);
      }
      if (context?.previousDeals) {
        queryClient.setQueryData(['deals'], context.previousDeals);
      }
      
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
      const { data, error } = await supabase
        .from('deal_tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (data, { taskId, updates }) => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      
      // Log assignment changes and create notifications
      if (updates.assigned_to !== undefined) {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .in('id', [user?.id, updates.assigned_to].filter(Boolean) as string[]);
        
        const assignerProfile = adminProfiles?.find(p => p.id === user?.id);
        const assigneeProfile = adminProfiles?.find(p => p.id === updates.assigned_to);
        
        const assignedToName = assigneeProfile 
          ? `${assigneeProfile.first_name} ${assigneeProfile.last_name}` 
          : 'Unassigned';
        
        await logDealActivity({
          dealId: data.deal_id,
          activityType: 'task_assigned',
          title: 'Task Reassigned',
          description: `Task "${data.title}" assigned to ${assignedToName}`,
          metadata: { task_id: taskId, assigned_to: updates.assigned_to }
        });

        // Create notification for reassignment
        if (updates.assigned_to && assigneeProfile) {
          const assignerName = assignerProfile 
            ? `${assignerProfile.first_name} ${assignerProfile.last_name}`.trim() 
            : 'Someone';

          const { data: deal } = await supabase
            .from('deals')
            .select('title')
            .eq('id', data.deal_id)
            .single();

          await supabase
            .from('admin_notifications')
            .insert({
              admin_id: updates.assigned_to,
              notification_type: 'task_assigned',
              title: 'Task Reassigned to You',
              message: `${assignerName} reassigned you: ${data.title}`,
              deal_id: data.deal_id,
              task_id: taskId,
              action_url: `/admin/pipeline?deal=${data.deal_id}&tab=tasks`,
              metadata: {
                priority: data.priority || 'medium',
                due_date: data.due_date,
                deal_title: deal?.title || 'Unknown Deal',
                assigner_name: assignerName,
              },
            });

          // Send email for reassignment
          await supabase.functions.invoke('send-task-notification-email', {
            body: {
              assignee_email: assigneeProfile.email,
              assignee_name: assignedToName,
              assigner_name: assignerName,
              task_title: data.title,
              task_description: data.description,
              task_priority: data.priority || 'medium',
              task_due_date: data.due_date,
              deal_title: deal?.title || 'Unknown Deal',
              deal_id: data.deal_id,
            },
          });
        }
      }
      
      toast({
        title: 'Task Updated',
        description: 'Task has been updated successfully.',
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
      const { data, error } = await supabase
        .from('deal_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: async (taskId) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['deal-tasks'] });
      await queryClient.cancelQueries({ queryKey: ['deals'] });

      // Snapshot previous data
      const previousTasksCache: any = {};
      queryClient.getQueriesData({ queryKey: ['deal-tasks'] }).forEach(([key, data]) => {
        previousTasksCache[JSON.stringify(key)] = data;
      });
      const previousDeals = queryClient.getQueryData(['deals']);

      // Optimistically update task status
      queryClient.getQueriesData({ queryKey: ['deal-tasks'] }).forEach(([key, data]) => {
        queryClient.setQueryData(key, (old: any) => {
          if (!old) return old;
          return old.map((task: any) =>
            task.id === taskId
              ? {
                  ...task,
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              : task
          );
        });
      });

      return { previousTasksCache, previousDeals };
    },
    onSuccess: async (data) => {
      queryClient.refetchQueries({ queryKey: ['deal-tasks'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['deals'], type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      
      // Log activity
      await logDealActivity({
        dealId: data.deal_id,
        activityType: 'task_completed',
        title: 'Task Completed',
        description: `Completed task: ${data.title}`,
        metadata: { task_id: data.id }
      });

      // Notify task creator if different from completer
      if (data.assigned_by && data.assigned_by !== data.completed_by) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name')
            .in('id', [data.assigned_by, user?.id].filter(Boolean) as string[]);

          const creatorProfile = profiles?.find(p => p.id === data.assigned_by);
          const completerProfile = profiles?.find(p => p.id === user?.id);

          if (creatorProfile) {
            const completerName = completerProfile 
              ? `${completerProfile.first_name} ${completerProfile.last_name}`.trim()
              : 'Someone';

            const { data: deal } = await supabase
              .from('deals')
              .select('title')
              .eq('id', data.deal_id)
              .single();

            await supabase
              .from('admin_notifications')
              .insert({
                admin_id: data.assigned_by,
                notification_type: 'task_completed',
                title: 'Task Completed',
                message: `${completerName} completed: ${data.title}`,
                deal_id: data.deal_id,
                task_id: data.id,
                action_url: `/admin/pipeline?deal=${data.deal_id}&tab=tasks`,
                metadata: {
                  deal_title: deal?.title || 'Unknown Deal',
                  completed_by: completerName,
                },
              });
          }
        } catch (error) {
          console.error('Failed to send completion notification:', error);
        }
      }
      
      toast({
        title: 'Task Completed',
        description: 'Task has been marked as completed.',
      });
    },
    onError: (error, taskId, context) => {
      // Rollback optimistic updates
      if (context?.previousTasksCache) {
        Object.entries(context.previousTasksCache).forEach(([key, data]) => {
          queryClient.setQueryData(JSON.parse(key), data);
        });
      }
      if (context?.previousDeals) {
        queryClient.setQueryData(['deals'], context.previousDeals);
      }
      
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
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: 'Task Deleted',
        description: 'Task has been deleted successfully.',
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