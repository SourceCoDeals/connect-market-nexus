import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: 'Task Created',
        description: 'Task has been created successfully.',
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: 'Task Completed',
        description: 'Task has been marked as completed.',
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