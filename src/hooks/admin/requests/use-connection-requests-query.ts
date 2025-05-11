
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminConnectionRequest } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { createUserObject } from '@/lib/auth-helpers';
import { ListingStatus } from '@/types';

/**
 * Hook for fetching connection requests in admin dashboard
 */
export function useConnectionRequestsQuery() {
  return useQuery({
    queryKey: ['admin-connection-requests'],
    queryFn: async () => {
      try {
        // First get all connection requests
        const { data: requests, error } = await supabase
          .from('connection_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // For each request, fetch user and listing details separately 
        // to avoid the relation error
        const enhancedRequests = await Promise.all(requests.map(async (request) => {
          // Get user details
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('*')  // Select all fields to get complete user data
            .eq('id', request.user_id)
            .maybeSingle();  // Use maybeSingle instead of single to prevent errors
          
          if (userError) console.error("Error fetching user data:", userError);
          
          // Get listing details
          const { data: listingData, error: listingError } = await supabase
            .from('listings')
            .select('id, title, category, location, revenue, ebitda, status')
            .eq('id', request.listing_id)
            .maybeSingle();  // Use maybeSingle instead of single to prevent errors
          
          if (listingError) console.error("Error fetching listing data:", listingError);
          
          // Transform the user data using createUserObject to ensure it matches the User type
          const user = userError || !userData ? null : createUserObject(userData);
          
          // Ensure listing status is properly typed
          const listingWithStatus = listingData ? {
            ...listingData,
            status: listingData.status as ListingStatus
          } : null;
          
          // Explicitly cast the request status to the expected union type
          const status = request.status as "pending" | "approved" | "rejected";
          
          // Create the final object with explicit type safety
          const result: AdminConnectionRequest = {
            ...request,
            status, // Use the explicitly typed status
            user,
            listing: listingWithStatus
          };

          return result;
        }));

        console.log("Sample connection request data:", enhancedRequests[0]);
        return enhancedRequests;
      } catch (error: any) {
        console.error("Error fetching connection requests:", error);
        toast({
          variant: 'destructive',
          title: 'Error fetching connection requests',
          description: error.message,
        });
        return [] as AdminConnectionRequest[];
      }
    },
  });
}
