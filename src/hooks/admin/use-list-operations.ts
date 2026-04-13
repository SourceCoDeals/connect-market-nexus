import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const LISTS_KEY = ['admin', 'contact-lists'];

export function useMergeLists() {
  const qc = useQueryClient();
  const nav = useNavigate();

  return useMutation({
    mutationFn: async ({
      listIds,
      name,
      listType = 'mixed',
    }: {
      listIds: string[];
      name: string;
      listType?: string;
    }) => {
      const { data, error } = await supabase.rpc('merge_lists', {
        p_list_ids: listIds,
        p_new_name: name,
        p_list_type: listType,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (newListId) => {
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      toast.success('Lists merged');
      nav(`/admin/lists/${newListId}`);
    },
    onError: (err: Error) => {
      toast.error('Failed to merge lists', { description: err.message });
    },
  });
}

export function useSubtractLists() {
  const qc = useQueryClient();
  const nav = useNavigate();

  return useMutation({
    mutationFn: async ({
      primaryId,
      excludeIds,
      name,
    }: {
      primaryId: string;
      excludeIds: string[];
      name: string;
    }) => {
      const { data, error } = await supabase.rpc('subtract_lists', {
        p_primary_id: primaryId,
        p_exclude_ids: excludeIds,
        p_new_name: name,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (newListId) => {
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      toast.success('List subtracted');
      nav(`/admin/lists/${newListId}`);
    },
    onError: (err: Error) => {
      toast.error('Failed to subtract lists', { description: err.message });
    },
  });
}

export function useIntersectLists() {
  const qc = useQueryClient();
  const nav = useNavigate();

  return useMutation({
    mutationFn: async ({
      listIds,
      name,
      listType = 'mixed',
    }: {
      listIds: string[];
      name: string;
      listType?: string;
    }) => {
      const { data, error } = await supabase.rpc('intersect_lists', {
        p_list_ids: listIds,
        p_new_name: name,
        p_list_type: listType,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (newListId) => {
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      toast.success('Lists intersected');
      nav(`/admin/lists/${newListId}`);
    },
    onError: (err: Error) => {
      toast.error('Failed to intersect lists', { description: err.message });
    },
  });
}

export function useCloneList() {
  const qc = useQueryClient();
  const nav = useNavigate();

  return useMutation({
    mutationFn: async ({ sourceId, name }: { sourceId: string; name: string }) => {
      const { data, error } = await supabase.rpc('clone_list', {
        p_source_id: sourceId,
        p_new_name: name,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (newListId) => {
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      toast.success('List cloned');
      nav(`/admin/lists/${newListId}`);
    },
    onError: (err: Error) => {
      toast.error('Failed to clone list', { description: err.message });
    },
  });
}
