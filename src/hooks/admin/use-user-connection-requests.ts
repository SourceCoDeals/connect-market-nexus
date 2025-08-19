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

      const enhancedRequests = await Promise.all(requests.map(async (request) => {
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', request.user_id)
          .maybeSingle();
        
        const { data: listingData, error: listingError } = await supabase
          .from('listings')
          .select('*')
          .eq('id', request.listing_id)
          .maybeSingle();
        
        // Fetch admin profiles who performed follow-ups (if available)
        let followedUpByAdmin = null;
        if (request.followed_up_by) {
          const { data: adminProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', request.followed_up_by)
            .maybeSingle();
          followedUpByAdmin = adminProfile ? createUserObject(adminProfile) : null;
        }
        
        let negativeFollowedUpByAdmin = null;
        if ((request as any).negative_followed_up_by) {
          const { data: adminProfileNeg } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', (request as any).negative_followed_up_by)
            .maybeSingle();
          negativeFollowedUpByAdmin = adminProfileNeg ? createUserObject(adminProfileNeg) : null;
        }
        
        const user = userError || !userData ? null : createUserObject(userData);
        const listing = listingData ? createListingFromData(listingData) : null;
        
        const status = request.status as "pending" | "approved" | "rejected";
        
        const result: AdminConnectionRequest = {
          ...request,
          status,
          user,
          listing,
          followedUpByAdmin,
          negativeFollowedUpByAdmin
        };

        return result;
      }));

      return enhancedRequests;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}