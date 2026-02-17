import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminConnectionRequest } from '@/types/admin';
import { createUserObject } from '@/lib/auth-helpers';
import { createListingFromData } from '@/utils/user-helpers';
import { createQueryKey } from '@/lib/query-keys';

/**
 * Hook for fetching all connection requests by a specific user
 */
export function useUserConnectionRequests(userId: string) {
  return useQuery({
    queryKey: createQueryKey.userConnectionRequests(userId),
    queryFn: async () => {
      if (!userId) return [];

      const { data: requests, error } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'approved']) // Active requests that need follow-up tracking
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Batch-fetch all related data instead of N+1 queries per request
      const allProfileIds = new Set<string>();
      const allListingIds = new Set<string>();

      for (const req of requests) {
        allProfileIds.add(req.user_id);
        if (req.followed_up_by) allProfileIds.add(req.followed_up_by);
        if ((req as any).negative_followed_up_by) allProfileIds.add((req as any).negative_followed_up_by);
        allListingIds.add(req.listing_id);
      }

      const [{ data: allProfiles }, { data: allListings }] = await Promise.all([
        supabase.from('profiles').select('*').in('id', [...allProfileIds]),
        supabase.from('listings').select('*').in('id', [...allListingIds]),
      ]);

      const profileMap = new Map((allProfiles || []).map(p => [p.id, p]));
      const listingMap = new Map((allListings || []).map(l => [l.id, l]));

      const enhancedRequests = requests.map(request => {
        const userData = profileMap.get(request.user_id);
        const listingData = listingMap.get(request.listing_id);

        const followedUpByAdmin = request.followed_up_by
          ? (profileMap.get(request.followed_up_by) ? createUserObject(profileMap.get(request.followed_up_by)!) : null)
          : null;
        const negativeFollowedUpByAdmin = (request as any).negative_followed_up_by
          ? (profileMap.get((request as any).negative_followed_up_by) ? createUserObject(profileMap.get((request as any).negative_followed_up_by)!) : null)
          : null;

        const user = userData ? createUserObject(userData) : null;
        const listing = listingData ? createListingFromData(listingData) : null;
        const status = request.status as "pending" | "approved" | "rejected";

        const result: AdminConnectionRequest = {
          ...request,
          status,
          user,
          listing,
          source: (request.source as 'marketplace' | 'webflow' | 'manual' | 'import' | 'api' | 'website' | 'referral' | 'cold_outreach' | 'networking' | 'linkedin' | 'email') || 'marketplace',
          source_metadata: (request.source_metadata as Record<string, any>) || {},
          followedUpByAdmin,
          negativeFollowedUpByAdmin
        };

        return result;
      });

      return enhancedRequests;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}