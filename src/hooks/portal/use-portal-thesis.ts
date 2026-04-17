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

/**
 * Clone all active thesis criteria from one portal org to another.
 * Used by the "Clone from another portal" feature on new clients —
 * saves typing the same HVAC/plumbing/electrical thesis from scratch.
 */
export function useCloneThesisCriteria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sourcePortalOrgId,
      targetPortalOrgId,
    }: {
      sourcePortalOrgId: string;
      targetPortalOrgId: string;
    }) => {
      // 1. Fetch the source criteria
      const { data: source, error: fetchErr } = await untypedFrom('portal_thesis_criteria')
        .select('*')
        .eq('portal_org_id', sourcePortalOrgId)
        .eq('is_active', true);
      if (fetchErr) throw fetchErr;
      if (!source || source.length === 0) {
        throw new Error('Source portal has no active thesis criteria to clone');
      }

      // 2. Fetch existing industry_labels in the target to skip dupes —
      // the DB-level unique index would raise otherwise.
      const { data: existing } = await untypedFrom('portal_thesis_criteria')
        .select('industry_label')
        .eq('portal_org_id', targetPortalOrgId);
      const existingLabels = new Set(
        ((existing ?? []) as { industry_label: string }[]).map((r) =>
          r.industry_label.toLowerCase(),
        ),
      );

      // 3. Strip ids + timestamps, rewrite portal_org_id. Drop
      // portfolio_buyer_id — a portco linked on the source portal doesn't
      // belong to the target fund's portfolio (per audit UC-14).
      const rows = (source as PortalThesisCriteria[])
        .filter((row) => !existingLabels.has(row.industry_label.toLowerCase()))
        .map((row) => ({
          portal_org_id: targetPortalOrgId,
          industry_label: row.industry_label,
          industry_keywords: row.industry_keywords,
          excluded_keywords: row.excluded_keywords ?? [],
          ebitda_min: row.ebitda_min,
          ebitda_max: row.ebitda_max,
          revenue_min: row.revenue_min,
          revenue_max: row.revenue_max,
          employee_min: row.employee_min,
          employee_max: row.employee_max,
          target_states: row.target_states,
          portfolio_buyer_id: null, // never carry cross-portal
          priority: row.priority,
          is_active: true,
          notes: row.notes,
        }));

      if (rows.length === 0) {
        throw new Error(
          'Every criterion in the source portal already exists in the target — nothing to clone.',
        );
      }

      const { error: insertErr } = await untypedFrom('portal_thesis_criteria').insert(rows);
      if (insertErr) throw insertErr;

      return { targetPortalOrgId, count: rows.length };
    },
    onSuccess: ({ targetPortalOrgId, count }) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, targetPortalOrgId] });
      toast.success(`Cloned ${count} thesis criteria`);
    },
    onError: (err: Error) => {
      toast.error('Failed to clone thesis', { description: err.message });
    },
  });
}
