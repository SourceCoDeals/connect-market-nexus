
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminConnectionRequest } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { useAdminEmail } from './use-admin-email';
import { createUserObject } from '@/lib/auth-helpers';
import { ListingStatus } from '@/types';

/**
 * Hook for managing connection requests in admin dashboard
 */
export function useAdminRequests() {
  const queryClient = useQueryClient();
  const { sendConnectionApprovalEmail, sendConnectionRejectionEmail } = useAdminEmail();

  // Fetch all connection requests with user and listing details
  const useConnectionRequests = () => {
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
            
            return {
              ...request,
              user,
              listing: listingWithStatus
            } as AdminConnectionRequest;
          }));

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
  };

  // Update connection request status
  const useUpdateConnectionRequest = () => {
    return useMutation({
      mutationFn: async ({
        requestId,
        status,
        adminComment,
      }: {
        requestId: string;
        status: 'approved' | 'rejected';
        adminComment?: string;
      }) => {
        try {
          console.log(`Updating request ${requestId} to status ${status}`);
          
          // Update the request status
          const { data, error } = await supabase
            .from('connection_requests')
            .update({ 
              status, 
              admin_comment: adminComment,
              updated_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .select();

          if (error) throw error;
          
          if (!data || data.length === 0) {
            throw new Error('Update successful but no data returned');
          }
          
          console.log("Update successful:", data);
          
          // Get complete request data for email notification
          const { data: requestData, error: requestError } = await supabase
            .from('connection_requests')
            .select('*')
            .eq('id', requestId)
            .maybeSingle();
          
          if (requestError || !requestData) {
            throw new Error('Request not found after update');
          }
          
          // Get complete user details
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', requestData.user_id)
            .maybeSingle();
          
          if (userError) {
            console.error("Error fetching user data for email:", userError);
          }
          
          // Get listing details
          const { data: listingData, error: listingError } = await supabase
            .from('listings')
            .select('*')
            .eq('id', requestData.listing_id)
            .maybeSingle();
          
          if (listingError) {
            console.error("Error fetching listing data for email:", listingError);
          }
          
          // Transform the user data using createUserObject
          const user = userData ? createUserObject(userData) : null;
          
          // Ensure the status is of the correct type
          const typedStatus = requestData.status as "pending" | "approved" | "rejected";
          
          // Fix the missing properties by converting listingData to a proper Listing type
          const listing = listingData ? {
            ...listingData,
            // Add computed properties
            status: listingData.status as ListingStatus, // Cast status to ListingStatus
            ownerNotes: listingData.owner_notes || '',
            createdAt: listingData.created_at,
            updatedAt: listingData.updated_at,
            multiples: {
              revenue: listingData.revenue > 0 ? (listingData.ebitda / listingData.revenue).toFixed(2) : '0',
              value: '0'
            },
            revenueFormatted: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(listingData.revenue),
            ebitdaFormatted: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(listingData.ebitda)
          } : null;
          
          const fullRequestData: AdminConnectionRequest = {
            ...requestData,
            status: typedStatus,
            user,
            listing
          };
          
          // Send email notification based on status
          if (status === 'approved') {
            try {
              await sendConnectionApprovalEmail(fullRequestData);
              console.log("Approval email sent successfully");
            } catch (emailError) {
              console.error("Error sending approval email:", emailError);
            }
          } else if (status === 'rejected') {
            try {
              await sendConnectionRejectionEmail(fullRequestData);
              console.log("Rejection email sent successfully");
            } catch (emailError) {
              console.error("Error sending rejection email:", emailError);
            }
          }
          
          return fullRequestData;
        } catch (error: any) {
          console.error("Error updating connection request:", error);
          throw error;
        }
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] });
        queryClient.invalidateQueries({ queryKey: ['user-connection-requests'] });
        
        const status = data.status;
        const action = status === 'approved' ? 'approved' : 'rejected';
        
        toast({
          title: `Connection request ${action}`,
          description: `The connection request has been ${action} successfully.`,
        });
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: error.message || "Failed to update connection request",
        });
      },
    });
  };

  return {
    useConnectionRequests,
    useUpdateConnectionRequest,
  };
}
