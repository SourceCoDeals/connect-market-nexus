
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AdminConnectionRequest } from '@/types/admin';
import { ListingStatus } from '@/types';

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
      // Update the request status in the database
      const { data, error } = await supabase
        .from('connection_requests')
        .update({ status, admin_comment })
        .eq('id', id)
        .select('*, user:user_id(*), listing:listing_id(*)');
      
      if (error) throw error;
      
      // If approved, log the connection in user_activity
      if (status === 'approved' && data?.[0]) {
        const request = data[0];
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
      }
      
      // Handle potential relationship issues by converting safely to AdminConnectionRequest
      if (data?.[0]) {
        const result = {
          ...data[0],
          user: data[0].user || null,
          listing: data[0].listing || null
        } as unknown as AdminConnectionRequest;
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
