
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
          const { data, error } = await supabase
            .from('connection_requests')
            .select(`
              *,
              user:user_id (
                id, email, first_name, last_name, company, phone_number
              ),
              listing:listing_id (
                id, title, category
              )
            `)
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data as AdminConnectionRequest[];
        } catch (error: any) {
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
        requestId,
        status,
        adminComment,
      }: {
        requestId: string;
        status: 'approved' | 'rejected';
        adminComment?: string;
      }) => {
        // Get the request details first for email notification
        const { data: requestData, error: requestError } = await supabase
          .from('connection_requests')
          .select(`
            *,
            user:user_id (
              id, email, first_name, last_name, company
            ),
            listing:listing_id (
              id, title, category
            )
          `)
          .eq('id', requestId)
          .single();
          
        if (requestError) throw requestError;
        
        // Now update the request
        const { data, error } = await supabase
          .from('connection_requests')
          .update({ 
            status, 
            admin_comment: adminComment,
            updated_at: new Date().toISOString()
          })
          .eq('id', requestId)
          .select(`
            *,
            user:user_id (
              id, email, first_name, last_name, company
            ),
            listing:listing_id (
              id, title, category
            )
          `)
          .single();

        if (error) throw error;
        
        // Send email notification based on status
        if (status === 'approved') {
          await sendConnectionApprovalEmail(data as AdminConnectionRequest);
        } else if (status === 'rejected') {
          await sendConnectionRejectionEmail(data as AdminConnectionRequest);
        }
        
        return data;
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
