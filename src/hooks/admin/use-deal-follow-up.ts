import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useUpdateFollowupStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      dealId,
      followed_up,
      notes,
    }: {
      dealId: string;
      followed_up: boolean;
      notes?: string;
    }) => {
      const updateData: any = {
        followed_up,
        updated_at: new Date().toISOString(),
      };

      if (followed_up) {
        updateData.followed_up_at = new Date().toISOString();
        updateData.followed_up_by = (await supabase.auth.getUser()).data.user?.id;
      } else {
        updateData.followed_up_at = null;
        updateData.followed_up_by = null;
      }

      const { data, error } = await supabase
        .from('deals')
        .update(updateData)
        .eq('id', dealId)
        .select()
        .single();

      if (error) throw error;

      // Add activity log if notes provided
      if (notes && notes.trim()) {
        await supabase.from('deal_activities').insert({
          deal_id: dealId,
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          activity_type: 'follow_up',
          title: followed_up ? 'Follow-up completed' : 'Follow-up status reset',
          description: notes,
          metadata: { followed_up },
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: 'Follow-up Updated',
        description: 'Deal follow-up status has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update follow-up status: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useMarkFollowupOverdue() {
  const queryClient = useQueryClient();
  const { toast: _toast } = useToast();

  return useMutation({
    mutationFn: async (dealId: string) => {
      // This would be used for batch operations to mark overdue deals
      const { data, error } = await supabase
        .from('deals')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}

export function useCreateStageTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      dealId,
      stageId: _stageId,
      taskTemplate,
    }: {
      dealId: string;
      stageId: string;
      taskTemplate: {
        title: string;
        description?: string;
        priority: 'low' | 'medium' | 'high' | 'urgent';
        due_days?: number;
      };
    }) => {
      const currentUser = await supabase.auth.getUser();

      const taskData = {
        title: taskTemplate.title,
        description: taskTemplate.description,
        priority: taskTemplate.priority,
        status: 'pending' as const,
        task_type: 'other' as const,
        entity_type: 'deal' as const,
        entity_id: dealId,
        deal_id: dealId,
        assignee_id: currentUser.data.user?.id,
        created_by: currentUser.data.user?.id,
        source: 'manual' as const,
        is_manual: true,
        priority_score: 50,
        extraction_confidence: 'high' as const,
        needs_review: false,
        due_date: taskTemplate.due_days
          ? new Date(Date.now() + taskTemplate.due_days * 24 * 60 * 60 * 1000).toISOString()
          : null,
      };

      const { data, error } = await supabase
        .from('daily_standup_tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['daily-standup-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['entity-tasks'] });
      toast({
        title: 'Task Created',
        description: 'Stage-specific task has been created successfully.',
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
