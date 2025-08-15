
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
        // Fetching connection requests
        
        if (!isAdminUser) {
          throw new Error('Admin authentication required');
        }

        const { data: requests, error } = await supabase
          .from('connection_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        const enhancedRequests = await Promise.all(requests.map(async (request) => {
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', request.user_id)
            .maybeSingle();
          
          if (userError) console.error("Error fetching user data:", userError);
          
          const { data: listingData, error: listingError } = await supabase
            .from('listings')
            .select('*')
            .eq('id', request.listing_id)
            .maybeSingle();
          
          if (listingError) console.error("Error fetching listing data:", listingError);
          
          // Debug logging for listing data
          console.log('🔍 Raw listing data from Supabase:', listingData);
          
          const user = userError || !userData ? null : createUserObject(userData);
          const listing = listingData ? createListingFromData(listingData) : null;
          
          // Debug logging for processed listing
          console.log('🔍 Processed listing data:', listing);
          const status = request.status as "pending" | "approved" | "rejected";
          
          const result: AdminConnectionRequest = {
            ...request,
            status,
            user,
            listing
          };

          return result;
        }));

        // Connection requests fetched successfully
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
