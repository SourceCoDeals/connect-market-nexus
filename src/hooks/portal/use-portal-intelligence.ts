import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, untypedFrom } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PortalIntelligenceDoc, CreateIntelligenceDocInput } from '@/types/portal';

const QUERY_KEY = 'portal-intelligence-docs';

export function usePortalIntelligenceDocs(portalOrgId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, portalOrgId],
    queryFn: async () => {
      if (!portalOrgId) return [];
      const { data, error } = await untypedFrom('portal_intelligence_docs')
        .select('*')
        .eq('portal_org_id', portalOrgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalIntelligenceDoc[];
    },
    enabled: !!portalOrgId,
    staleTime: 30_000,
  });
}

export function useCreateIntelligenceDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateIntelligenceDocInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await untypedFrom('portal_intelligence_docs')
        .insert({ ...input, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as PortalIntelligenceDoc;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, data.portal_org_id] });
      toast.success('Intelligence doc added');
    },
    onError: (err: Error) => {
      toast.error('Failed to add doc', { description: err.message });
    },
  });
}

export function useDeleteIntelligenceDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, portalOrgId }: { id: string; portalOrgId: string }) => {
      const { error } = await untypedFrom('portal_intelligence_docs').delete().eq('id', id);
      if (error) throw error;
      return { portalOrgId };
    },
    onSuccess: ({ portalOrgId }) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, portalOrgId] });
      toast.success('Doc removed');
    },
    onError: (err: Error) => {
      toast.error('Failed to remove doc', { description: err.message });
    },
  });
}
