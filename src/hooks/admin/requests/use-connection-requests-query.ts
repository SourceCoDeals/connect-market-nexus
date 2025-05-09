
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminConnectionRequest } from '@/types/admin';
import { ListingStatus } from '@/types';

/**
 * Hook for fetching connection requests in the admin dashboard
 * @returns Query object with connection requests data
 */
export function useConnectionRequestsQuery() {
  return useQuery({
    queryKey: ['admin', 'connection-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connection_requests')
        .select(`
          *,
          user:user_id(*),
          listing:listing_id(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data as AdminConnectionRequest[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
