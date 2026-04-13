import { useQuery } from '@tanstack/react-query';
import { untypedFrom } from '@/integrations/supabase/client';
import type { PassReasonCategory } from '@/types/portal';

export interface PassReasonRow {
  portal_org_id: string;
  pass_reason_category: PassReasonCategory;
  pass_count: number;
  most_recent_at: string;
}

/**
 * Aggregate client pass reasons for a single portal.
 * Backed by the `portal_pass_reason_summary` view.
 */
export function usePortalPassReasons(portalOrgId: string | undefined) {
  return useQuery({
    queryKey: ['portal-pass-reasons', portalOrgId],
    queryFn: async (): Promise<PassReasonRow[]> => {
      if (!portalOrgId) return [];
      const { data, error } = await untypedFrom('portal_pass_reason_summary')
        .select('*')
        .eq('portal_org_id', portalOrgId)
        .order('pass_count', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PassReasonRow[];
    },
    enabled: !!portalOrgId,
    staleTime: 60_000,
  });
}
