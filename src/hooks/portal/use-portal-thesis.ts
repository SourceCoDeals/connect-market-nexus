import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { untypedFrom } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PortalThesisCriteria, CreateThesisCriteriaInput } from '@/types/portal';

const QUERY_KEY = 'portal-thesis-criteria';

export function usePortalThesisCriteria(portalOrgId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, portalOrgId],
    queryFn: async () => {
      if (!portalOrgId) return [];
      const { data, error } = await untypedFrom('portal_thesis_criteria')
        .select('*')
        .eq('portal_org_id', portalOrgId)
        .order('priority', { ascending: true })
        .order('industry_label', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PortalThesisCriteria[];
    },
    enabled: !!portalOrgId,
    staleTime: 30_000,
  });
}

export function useCreateThesisCriteria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateThesisCriteriaInput) => {
      const { data, error } = await untypedFrom('portal_thesis_criteria')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as PortalThesisCriteria;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, data.portal_org_id] });
      toast.success('Thesis criterion added');
    },
    onError: (err: Error) => {
      toast.error('Failed to add criterion', { description: err.message });
    },
  });
}

export function useUpdateThesisCriteria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      portalOrgId,
      ...updates
    }: { id: string; portalOrgId: string } & Partial<CreateThesisCriteriaInput>) => {
      const { data, error } = await untypedFrom('portal_thesis_criteria')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { ...data, portalOrgId } as PortalThesisCriteria & { portalOrgId: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, data.portalOrgId] });
      toast.success('Thesis criterion updated');
    },
    onError: (err: Error) => {
      toast.error('Failed to update criterion', { description: err.message });
    },
  });
}

export function useDeleteThesisCriteria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, portalOrgId }: { id: string; portalOrgId: string }) => {
      const { error } = await untypedFrom('portal_thesis_criteria').delete().eq('id', id);
      if (error) throw error;
      return { portalOrgId };
    },
    onSuccess: ({ portalOrgId }) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, portalOrgId] });
      toast.success('Thesis criterion removed');
    },
    onError: (err: Error) => {
      toast.error('Failed to remove criterion', { description: err.message });
    },
  });
}
