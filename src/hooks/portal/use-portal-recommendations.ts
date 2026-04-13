import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { untypedFrom } from '@/integrations/supabase/client';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  PortalDealRecommendation,
  PortalDealRecommendationWithListing,
  RecommendationStatus,
} from '@/types/portal';

const QUERY_KEY = 'portal-recommendations';

export const DEFAULT_RECOMMENDATIONS_PAGE_SIZE = 25;

export interface UsePortalRecommendationsOptions {
  statusFilter?: RecommendationStatus | 'all';
  /** Zero-indexed page. */
  page?: number;
  pageSize?: number;
}

export function usePortalRecommendations(
  portalOrgId: string | undefined,
  options: UsePortalRecommendationsOptions = {},
) {
  const { statusFilter = 'all', page = 0, pageSize = DEFAULT_RECOMMENDATIONS_PAGE_SIZE } = options;

  return useQuery({
    queryKey: [QUERY_KEY, portalOrgId, statusFilter, page, pageSize],
    queryFn: async () => {
      if (!portalOrgId) return { rows: [] as PortalDealRecommendationWithListing[], total: 0 };

      let query = untypedFrom('portal_deal_recommendations')
        .select('*', { count: 'exact' })
        .eq('portal_org_id', portalOrgId)
        .order('match_score', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const recos = (data ?? []) as PortalDealRecommendation[];
      if (recos.length === 0) {
        return { rows: [] as PortalDealRecommendationWithListing[], total: count ?? 0 };
      }

      // Fetch listing details for this page
      const listingIds = [...new Set(recos.map((r) => r.listing_id))];
      const { data: listings } = await supabase
        .from('listings')
        .select(
          'id, title, internal_company_name, industry, address_state, ebitda, linkedin_employee_count',
        )
        .in('id', listingIds);

      const listingMap = new Map<string, typeof listings extends (infer T)[] | null ? T : never>();
      for (const l of listings ?? []) listingMap.set(l.id, l);

      // Fetch thesis criteria labels
      const criteriaIds = [
        ...new Set(recos.map((r) => r.thesis_criteria_id).filter(Boolean)),
      ] as string[];
      const criteriaMap = new Map<string, string>();
      if (criteriaIds.length > 0) {
        const { data: criteria } = await untypedFrom('portal_thesis_criteria')
          .select('id, industry_label')
          .in('id', criteriaIds);
        for (const c of (criteria ?? []) as { id: string; industry_label: string }[]) {
          criteriaMap.set(c.id, c.industry_label);
        }
      }

      const rows = recos.map((r) => {
        const listing = listingMap.get(r.listing_id);
        return {
          ...r,
          listing_title: listing?.internal_company_name || listing?.title || 'Unknown',
          listing_industry: listing?.industry ?? undefined,
          listing_state: listing?.address_state ?? undefined,
          listing_ebitda: listing?.ebitda ?? null,
          listing_employees: listing?.linkedin_employee_count ?? null,
          thesis_label: r.thesis_criteria_id ? criteriaMap.get(r.thesis_criteria_id) : undefined,
        } as PortalDealRecommendationWithListing;
      });

      return { rows, total: count ?? rows.length };
    },
    enabled: !!portalOrgId,
    staleTime: 30_000,
  });
}

/** Count of unseen strong pending recommendations for a portal.
 *  Used by the "X new strong" badge on the Recommendations tab. */
export function useUnseenStrongMatchCount(portalOrgId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'unseen-strong', portalOrgId],
    queryFn: async () => {
      if (!portalOrgId) return 0;
      const { count, error } = await untypedFrom('portal_deal_recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('portal_org_id', portalOrgId)
        .eq('status', 'pending')
        .eq('match_category', 'strong')
        .is('strong_match_alerted_at', null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!portalOrgId,
    staleTime: 15_000,
  });
}

/** Mark all unseen strong matches for a portal as seen. Call this when
 *  an admin first renders the Recommendations tab. */
export function useMarkStrongMatchesSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ portalOrgId }: { portalOrgId: string }) => {
      const { error } = await untypedFrom('portal_deal_recommendations')
        .update({ strong_match_alerted_at: new Date().toISOString() })
        .eq('portal_org_id', portalOrgId)
        .eq('status', 'pending')
        .eq('match_category', 'strong')
        .is('strong_match_alerted_at', null);
      if (error) throw error;
      return { portalOrgId };
    },
    onSuccess: ({ portalOrgId }) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'unseen-strong', portalOrgId] });
    },
  });
}

/** Lightweight count of pending recommendations per portal org.
 *  Uses portal_org_id grouping on the client, but only fetches the single
 *  column — still cheaper than pulling full rows. For very large pending
 *  backlogs, move this to a view or RPC.
 */
export function useRecommendationPendingCounts() {
  return useQuery({
    queryKey: [QUERY_KEY, 'pending-counts'],
    queryFn: async () => {
      const { data, error } = await untypedFrom('portal_deal_recommendations')
        .select('portal_org_id')
        .eq('status', 'pending');
      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of (data ?? []) as { portal_org_id: string }[]) {
        counts.set(row.portal_org_id, (counts.get(row.portal_org_id) ?? 0) + 1);
      }
      return counts;
    },
    staleTime: 60_000,
  });
}

/** Count of pending recommendations for a single portal org.
 *  Uses Postgres `count: 'exact'` with `head: true` so no rows are returned
 *  (much cheaper than pulling every id client-side). */
export function useRecommendationCount(portalOrgId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'count', portalOrgId],
    queryFn: async () => {
      if (!portalOrgId) return 0;
      const { count, error } = await untypedFrom('portal_deal_recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('portal_org_id', portalOrgId)
        .eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!portalOrgId,
    staleTime: 30_000,
  });
}

export function useDismissRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      portalOrgId,
      reason,
    }: {
      id: string;
      portalOrgId: string;
      reason?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await untypedFrom('portal_deal_recommendations')
        .update({
          status: 'dismissed',
          dismiss_reason: reason || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      return { portalOrgId };
    },
    onSuccess: ({ portalOrgId }) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, portalOrgId] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'pending-counts'] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'count', portalOrgId] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'deal'] });
      toast.success('Recommendation dismissed');
    },
    onError: (err: Error) => {
      toast.error('Failed to dismiss', { description: err.message });
    },
  });
}

/** Mark a recommendation as pushed after PushToPortalDialog completes */
export function useMarkRecommendationPushed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      portalOrgId,
      listingId,
      pushId,
    }: {
      portalOrgId: string;
      listingId: string;
      pushId?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await untypedFrom('portal_deal_recommendations')
        .update({
          status: 'pushed',
          push_id: pushId || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('portal_org_id', portalOrgId)
        .eq('listing_id', listingId);
      if (error) throw error;
      return { portalOrgId, listingId };
    },
    onSuccess: ({ portalOrgId }) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, portalOrgId] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'pending-counts'] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'count', portalOrgId] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, 'deal'] });
    },
    onError: (err: Error) => {
      toast.error('Failed to mark recommendation as pushed', { description: err.message });
    },
  });
}

/** Recommendations for a specific listing across all portals */
export function useDealPortalMatches(listingId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'deal', listingId],
    queryFn: async () => {
      if (!listingId) return [];
      const { data, error } = await untypedFrom('portal_deal_recommendations')
        .select('*')
        .eq('listing_id', listingId)
        .order('match_score', { ascending: false });
      if (error) throw error;

      const recos = (data ?? []) as PortalDealRecommendation[];
      if (recos.length === 0) return [];

      // Fetch portal org names
      const orgIds = [...new Set(recos.map((r) => r.portal_org_id))];
      const { data: orgs } = await untypedFrom('portal_organizations')
        .select('id, name')
        .in('id', orgIds);

      const orgMap = new Map<string, string>();
      for (const o of (orgs ?? []) as { id: string; name: string }[]) {
        orgMap.set(o.id, o.name);
      }

      return recos.map((r) => ({
        ...r,
        portal_org_name: orgMap.get(r.portal_org_id) ?? 'Unknown',
      }));
    },
    enabled: !!listingId,
    staleTime: 30_000,
  });
}
