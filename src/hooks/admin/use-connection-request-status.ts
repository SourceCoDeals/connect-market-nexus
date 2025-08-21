import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UpdateConnectionRequestStatusParams {
  requestId: string;
  status: 'pending' | 'approved' | 'rejected' | 'on_hold';
  notes?: string;
}

export const useUpdateConnectionRequestStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, status, notes }: UpdateConnectionRequestStatusParams) => {
      const { data, error } = await supabase.rpc('update_connection_request_status', {
        request_id: requestId,
        new_status: status,
        admin_notes: notes
      });

      if (error) throw error;
      return data;
    },
    onMutate: async ({ requestId, status }) => {
      // Cancel outgoing queries for this data
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });

      const previousRequests = queryClient.getQueryData(['connection-requests']);

      // Optimistic update
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((request: any) => 
          request.id === requestId 
            ? { 
                ...request, 
                status,
                updated_at: new Date().toISOString() 
              }
            : request
        );
      });

      return { previousRequests };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      
      const statusLabels = {
        pending: 'pending',
        approved: 'approved', 
        rejected: 'rejected',
        on_hold: 'on hold'
      };
      
      toast({
        title: "Status updated",
        description: `Connection request marked as ${statusLabels[variables.status]}.`,
      });
    },
    onError: (err, variables, context) => {
      // Rollback optimistic update
      queryClient.setQueryData(['connection-requests'], context?.previousRequests);
      
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not update request status",
      });
    },
  });
};