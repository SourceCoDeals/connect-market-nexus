import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PipelineView {
  id: string;
  name: string;
  description?: string;
  stage_config: any[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function usePipelineViews() {
  return useQuery({
    queryKey: ['pipeline-views'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_views')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return data as PipelineView[];
    },
  });
}

export function useCreatePipelineView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (view: {
      name: string;
      description?: string;
      stage_config: any[];
      is_default?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('pipeline_views')
        .insert(view)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-views'] });
      toast({
        title: 'Pipeline view created',
        description: 'Your pipeline view has been created successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating view',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdatePipelineView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PipelineView> }) => {
      const { data, error } = await supabase
        .from('pipeline_views')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-views'] });
      toast({
        title: 'View updated',
        description: 'Pipeline view updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating view',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeletePipelineView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pipeline_views')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-views'] });
      toast({
        title: 'View deleted',
        description: 'Pipeline view deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting view',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}