
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminConnectionRequest } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { createUserObject } from '@/lib/auth-helpers';
import { createListingFromData } from '@/utils/user-helpers';
import { createQueryKey } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import { useTabAwareQuery } from '@/hooks/use-tab-aware-query';

/**
 * Hook for fetching connection requests in admin dashboard
 */
export function useConnectionRequestsQuery() {
  const { user, authChecked } = useAuth();

  // Get cached auth state for more stable query enabling
  const cachedAuthState = (() => {
    try {
      const cached = localStorage.getItem('user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  })();

  const isAdminUser = user?.is_admin === true || cachedAuthState?.is_admin === true;
  const shouldEnable = (authChecked || cachedAuthState) && isAdminUser;

  return useTabAwareQuery(
    createQueryKey.adminConnectionRequests(),
    async () => {
      try {
        console.time('fetch-connection-requests');

        if (!isAdminUser) {
          throw new Error('Admin authentication required');
        }

        // Order by most recent activity (decision, update, or creation)
        // This ensures updated requests bubble to the top
        const { data: requests, error } = await supabase
          .from('connection_requests')
          .select(`
            *,
            source_lead:inbound_leads!source_lead_id (
              id,
              name,
              email,
              company_name,
              message,
              priority_score,
              source,
              source_form_name
            )
          `)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        if (!requests || requests.length === 0) {
          console.timeEnd('fetch-connection-requests');
          return [] as AdminConnectionRequest[];
        }

        // Collect unique IDs for batch fetching (avoid N+1 queries)
        // Filter out null user_ids for lead-only requests
        const userIds = Array.from(new Set(requests.map((r: any) => r.user_id).filter(Boolean)));
        const listingIds = Array.from(new Set(requests.map((r: any) => r.listing_id).filter(Boolean)));
        const followedIds = Array.from(new Set(requests.map((r: any) => (r as any).followed_up_by).filter(Boolean)));
        const negativeFollowedIds = Array.from(new Set(requests.map((r: any) => (r as any).negative_followed_up_by).filter(Boolean)));
        const approvedIds = Array.from(new Set(requests.map((r: any) => (r as any).approved_by).filter(Boolean)));
        const rejectedIds = Array.from(new Set(requests.map((r: any) => (r as any).rejected_by).filter(Boolean)));
        const onHoldIds = Array.from(new Set(requests.map((r: any) => (r as any).on_hold_by).filter(Boolean)));
        const profileIds = Array.from(new Set([...userIds, ...followedIds, ...negativeFollowedIds, ...approvedIds, ...rejectedIds, ...onHoldIds]));

        // Batch fetch related data in parallel
        const [profilesRes, listingsRes] = await Promise.all([
          profileIds.length
            ? supabase.from('profiles').select('*').in('id', profileIds)
            : Promise.resolve({ data: [] as any[], error: null } as any),
          listingIds.length
            ? supabase.from('listings').select('*').in('id', listingIds)
            : Promise.resolve({ data: [] as any[], error: null } as any),
        ]);

        if (profilesRes.error) console.error('Error fetching profiles batch:', profilesRes.error);
        if (listingsRes.error) console.error('Error fetching listings batch:', listingsRes.error);

        const profilesById = new Map<string, any>();
        (profilesRes.data ?? []).forEach((p: any) => profilesById.set(p.id, p));

        const listingsById = new Map<string, any>();
        (listingsRes.data ?? []).forEach((l: any) => listingsById.set(l.id, l));

        const enhancedRequests: AdminConnectionRequest[] = requests.map((request: any) => {
          const userData = profilesById.get(request.user_id);
          const listingData = listingsById.get(request.listing_id);

          const followedAdminProfile = profilesById.get((request as any).followed_up_by);
          const negativeFollowedAdminProfile = profilesById.get((request as any).negative_followed_up_by);
          const approvedAdminProfile = profilesById.get((request as any).approved_by);
          const rejectedAdminProfile = profilesById.get((request as any).rejected_by);
          const onHoldAdminProfile = profilesById.get((request as any).on_hold_by);

          const user = userData ? createUserObject(userData) : null;
          const listing = listingData ? createListingFromData(listingData) : null;

          // Debug logging for processed listing
          console.log('🔍 Processed listing data:', listing);
          const status = request.status as 'pending' | 'approved' | 'rejected' | 'on_hold';

          return {
            ...request,
            status,
            user,
            listing,
            followedUpByAdmin: followedAdminProfile ? createUserObject(followedAdminProfile) : null,
            negativeFollowedUpByAdmin: negativeFollowedAdminProfile ? createUserObject(negativeFollowedAdminProfile) : null,
            approvedByAdmin: approvedAdminProfile ? createUserObject(approvedAdminProfile) : null,
            rejectedByAdmin: rejectedAdminProfile ? createUserObject(rejectedAdminProfile) : null,
            onHoldByAdmin: onHoldAdminProfile ? createUserObject(onHoldAdminProfile) : null,
            sourceLead: (request as any).source_lead || null,
          } as AdminConnectionRequest;
        });

        console.timeEnd('fetch-connection-requests');
        return enhancedRequests;
      } catch (error: any) {
        console.error("❌ Error fetching connection requests:", error);
        toast({
          variant: 'destructive',
          title: 'Error fetching connection requests',
          description: error.message,
        });
        return [] as AdminConnectionRequest[];
      }
    },
    {
      enabled: shouldEnable,
      staleTime: 1000 * 60 * 2,
      // Remove refetchOnWindowFocus - let global settings handle this
    }
  );
}
