import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { DealStage } from './deal-types';

export function useCreateDealStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (stage: Omit<DealStage, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('deal_stages').insert(stage).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-stages'] });
      toast({
        title: 'Stage Created',
        description: 'Deal stage has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create stage: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateDealStageData() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      stageId,
      updates,
    }: {
      stageId: string;
      updates: Partial<Omit<DealStage, 'id' | 'created_at' | 'updated_at'>>;
    }) => {
      const { data, error } = await supabase
        .from('deal_stages')
        .update(updates)
        .eq('id', stageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-stages'] });
      toast({
        title: 'Stage Updated',
        description: 'Deal stage has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update stage: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteDealStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase.from('deal_stages').delete().eq('id', stageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-stages'] });
      toast({
        title: 'Stage Deleted',
        description: 'Deal stage has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete stage: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}
