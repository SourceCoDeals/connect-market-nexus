
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';
import { AdminConnectionRequest, AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';

/**
 * Hook for managing connection requests in admin dashboard
 */
export function useAdminRequests() {
  const queryClient = useQueryClient();

  // Fetch connection requests
  const useConnectionRequests = () => {
    return useQuery({
      queryKey: ['admin-connection-requests'],
      queryFn: async () => {
        try {
          // First try to get connection requests with user and listing data
          const { data: requestsData, error: requestsError } = await supabase
            .from('connection_requests')
            .select('*')
            .order('created_at', { ascending: false });

          if (requestsError) {
            console.error("Error fetching connection requests:", requestsError);
            throw requestsError;
          }

          // If we successfully got the requests, now get the users and listings separately
          const requests = requestsData as AdminConnectionRequest[];
          
          // Get unique user IDs from requests
          const userIds = [...new Set(requests.map(r => r.user_id))];
          
          // Fetch user data
          const { data: usersData, error: usersError } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);
            
          if (usersError) {
            console.error("Error fetching users for requests:", usersError);
          }
          
          // Get unique listing IDs from requests
          const listingIds = [...new Set(requests.map(r => r.listing_id))];
          
          // Fetch listing data
          const { data: listingsData, error: listingsError } = await supabase
            .from('listings')
            .select('*')
            .in('id', listingIds);
            
          if (listingsError) {
            console.error("Error fetching listings for requests:", listingsError);
          }

          // Create a map for quick user lookup with transformed User data
          const usersMap = (usersData || []).reduce((acc, profile) => {
            acc[profile.id] = {
              ...profile,
              role: profile.is_admin ? 'admin' : 'buyer',
              firstName: profile.first_name,
              lastName: profile.last_name,
              phoneNumber: profile.phone_number,
              isAdmin: profile.is_admin,
              buyerType: profile.buyer_type,
              emailVerified: profile.email_verified,
              isApproved: profile.approval_status === 'approved',
              createdAt: profile.created_at,
              updatedAt: profile.updated_at,
            } as User;
            return acc;
          }, {} as Record<string, User>);
          
          // Create a map for quick listing lookup
          const listingsMap = (listingsData || []).reduce((acc, listing) => {
            acc[listing.id] = listing;
            return acc;
          }, {} as Record<string, AdminListing>);
          
          // Combine the data
          return requests.map(request => ({
            ...request,
            user: usersMap[request.user_id] || null,
            listing: listingsMap[request.listing_id] || null
          }));
          
        } catch (error: any) {
          console.error("Detailed error in connection requests:", error);
          toast({
            variant: 'destructive',
            title: 'Error fetching connection requests',
            description: error.message,
          });
          return [];
        }
      },
    });
  };

  // Update connection request status
  const useUpdateConnectionRequest = () => {
    return useMutation({
      mutationFn: async ({
        id,
        status,
        comment,
      }: {
        id: string;
        status: 'approved' | 'rejected';
        comment?: string;
      }) => {
        const updateData: { status: string; admin_comment?: string; updated_at: string } = {
          status,
          updated_at: new Date().toISOString(),
        };
        
        if (comment) {
          updateData.admin_comment = comment;
        }
        
        const { data, error } = await supabase
          .from('connection_requests')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] });
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Failed to update connection request',
          description: error.message,
        });
      },
    });
  };

  return {
    useConnectionRequests,
    useUpdateConnectionRequest,
  };
}
