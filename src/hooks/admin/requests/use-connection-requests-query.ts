
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminConnectionRequest } from '@/types/admin';
import { Listing, ListingStatus } from '@/types';

/**
 * Hook for fetching connection requests in the admin dashboard
 * @returns Query object with connection requests data
 */
export function useConnectionRequestsQuery() {
  return useQuery({
    queryKey: ['admin', 'connection-requests'],
    queryFn: async () => {
      try {
        console.log("Fetching connection requests...");
        
        const { data, error } = await supabase
          .from('connection_requests')
          .select(`
            *,
            user:user_id(*),
            listing:listing_id(*)
          `)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error("Error fetching connection requests:", error);
          throw error;
        }
        
        console.log("Connection requests fetched:", data?.length || 0, "requests");
        
        // Handle potential relationship issues by safely converting to AdminConnectionRequest
        if (data) {
          // Handle case where relationships might be missing
          const mappedData = data.map(item => {
            const request: AdminConnectionRequest = {
              id: item.id,
              user_id: item.user_id,
              listing_id: item.listing_id,
              status: item.status as 'pending' | 'approved' | 'rejected',
              admin_comment: item.admin_comment,
              created_at: item.created_at,
              updated_at: item.updated_at,
              user: null,  // Default to null, will be overridden if exists
              listing: null // Default to null, will be overridden if exists
            };
            
            // Only set user if it exists and is not an error
            if (item.user && typeof item.user === 'object' && !('error' in item.user)) {
              // Use type assertion to assure TypeScript the user object is valid
              const user = item.user as Record<string, any>;
              request.user = user as any;
            }
            
            // Only set listing if it exists and is not an error
            if (item.listing && typeof item.listing === 'object' && !('error' in item.listing)) {
              // Convert database listing to Listing type with computed properties
              const listing = item.listing;
              request.listing = {
                ...listing,
                ownerNotes: listing.owner_notes || '',
                multiples: {
                  revenue: ((listing.revenue > 0) ? (listing.ebitda / listing.revenue).toFixed(2) : '0'),
                  value: '0',
                },
                revenueFormatted: `$${listing.revenue.toLocaleString()}`,
                ebitdaFormatted: `$${listing.ebitda.toLocaleString()}`,
                createdAt: listing.created_at,
                updatedAt: listing.updated_at,
                status: listing.status as ListingStatus, // Explicitly cast status to ListingStatus type
              };
            }
            
            return request;
          });
          
          return mappedData;
        }
        
        return [] as AdminConnectionRequest[];
      } catch (error) {
        console.error("Error in useConnectionRequestsQuery:", error);
        return [] as AdminConnectionRequest[];
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
