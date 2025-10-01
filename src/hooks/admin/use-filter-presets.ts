import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FilterPreset {
  id: string;
  user_id: string;
  name: string;
  filters: Record<string, any>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useFilterPresets() {
  return useQuery({
    queryKey: ['filter-presets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('filter_presets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FilterPreset[];
    },
  });
}

export function useCreateFilterPreset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (preset: { name: string; filters: Record<string, any>; is_default?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('filter_presets')
        .insert({
          user_id: user.id,
          name: preset.name,
          filters: preset.filters,
          is_default: preset.is_default || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      toast({
        title: 'Filter preset saved',
        description: 'Your filter preset has been saved successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error saving preset',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateFilterPreset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FilterPreset> }) => {
      const { data, error } = await supabase
        .from('filter_presets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      toast({
        title: 'Preset updated',
        description: 'Filter preset updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating preset',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteFilterPreset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('filter_presets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      toast({
        title: 'Preset deleted',
        description: 'Filter preset deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting preset',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}