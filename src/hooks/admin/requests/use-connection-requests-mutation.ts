
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AdminConnectionRequest } from '@/types/admin';

/**
 * Hook for managing connection request mutations in the admin dashboard
 * @returns Mutation hook for updating connection requests
 */
export function useConnectionRequestsMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      admin_comment 
    }: { 
      id: string; 
      status: 'approved' | 'rejected'; 
      admin_comment?: string;
    }) => {
      console.log("Updating connection request:", { id, status, admin_comment });
      
      // Update the request status in the database
      const { data, error } = await supabase
        .from('connection_requests')
        .update({ status, admin_comment })
        .eq('id', id)
        .select('*, user:user_id(*), listing:listing_id(*)');
      
      if (error) {
        console.error("Error updating connection request:", error);
        throw error;
      }
      
      console.log("Connection request updated:", data?.[0]);
      
      // If approved, log the connection in user_activity
      if (status === 'approved' && data?.[0]) {
        const request = data[0];
        try {
          await supabase
            .from('user_activity')
            .insert({
              user_id: request.user_id,
              activity_type: 'connection_approved',
              metadata: { 
                listing_id: request.listing_id,
                listing_title: request.listing?.title || 'Unknown listing'
              }
            });
        } catch (activityError) {
          console.error("Error logging activity:", activityError);
          // Don't throw here, we still want to continue even if activity logging fails
        }
      }
      
      // Handle potential relationship issues by converting safely to AdminConnectionRequest
      if (data?.[0]) {
        const item = data[0];
        const result: AdminConnectionRequest = {
          id: item.id,
          user_id: item.user_id,
          listing_id: item.listing_id,
          status: item.status as 'pending' | 'approved' | 'rejected',
          admin_comment: item.admin_comment,
          created_at: item.created_at,
          updated_at: item.updated_at,
          user: null,
          listing: null
        };
        
        // Only set user if it exists and is not an error
        if (item.user && typeof item.user === 'object' && !('error' in item.user)) {
          result.user = item.user;
        }
        
        // Only set listing if it exists and is not an error
        if (item.listing && typeof item.listing === 'object' && !('error' in item.listing)) {
          result.listing = item.listing;
        }
        
        return result;
      }
      throw new Error("Failed to update connection request");
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['admin', 'connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      
      // Show success toast
      toast({
        title: `Connection request ${data.status}`,
        description: `The connection request has been ${data.status}.`,
      });
    },
    onError: (error: any) => {
      console.error('Error updating connection request:', error);
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error.message || 'Failed to update connection request.',
      });
    }
  });
}
