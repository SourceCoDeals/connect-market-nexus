
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminConnectionRequest } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { useAdminEmail } from './use-admin-email';

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
              .select('id, email, first_name, last_name, company, phone_number')
              .eq('id', request.user_id)
              .single();
            
            // Get listing details
            const { data: listingData, error: listingError } = await supabase
              .from('listings')
              .select('id, title, category')
              .eq('id', request.listing_id)
              .single();
            
            return {
              ...request,
              user: userError ? null : userData,
              listing: listingError ? null : listingData
            } as AdminConnectionRequest;
          }));

          return enhancedRequests;
        } catch (error: any) {
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
        // Update the request status
        const { data, error } = await supabase
          .from('connection_requests')
          .update({ 
            status, 
            admin_comment: adminComment,
            updated_at: new Date().toISOString()
          })
          .eq('id', requestId)
          .select()
          .single();

        if (error) throw error;
        
        // Get request details with user and listing for email notification
        const { data: requestData } = await supabase
          .from('connection_requests')
          .select('*')
          .eq('id', requestId)
          .single();
        
        if (!requestData) throw new Error('Request not found');
        
        // Get user details
        const { data: userData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', requestData.user_id)
          .single();
        
        // Get listing details
        const { data: listingData } = await supabase
          .from('listings')
          .select('*')
          .eq('id', requestData.listing_id)
          .single();
        
        const fullRequestData: AdminConnectionRequest = {
          ...requestData,
          user: userData,
          listing: listingData
        } as AdminConnectionRequest;
        
        // Send email notification based on status
        if (status === 'approved') {
          await sendConnectionApprovalEmail(fullRequestData);
        } else if (status === 'rejected') {
          await sendConnectionRejectionEmail(fullRequestData);
        }
        
        return fullRequestData;
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
