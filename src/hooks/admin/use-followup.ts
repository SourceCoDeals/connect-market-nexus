import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UpdateFollowupParams {
  requestId: string;
  isFollowedUp: boolean;
  notes?: string;
}

export const useUpdateFollowup = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, isFollowedUp, notes }: UpdateFollowupParams) => {
      const { data, error } = await supabase.rpc('update_connection_request_followup', {
        request_id: requestId,
        is_followed_up: isFollowedUp,
        admin_notes: notes
      });

      if (error) throw error;
      return data;
    },
    onMutate: async ({ requestId, isFollowedUp }) => {
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });

      const previousRequests = queryClient.getQueryData(['connection-requests']);

      // Optimistically update connection requests
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((request: any) => 
          request.id === requestId 
            ? { 
                ...request, 
                followed_up: isFollowedUp,
                followed_up_at: isFollowedUp ? new Date().toISOString() : null 
              }
            : request
        );
      });

      return { previousRequests };
    },
    onSuccess: () => {
      // Invalidate to sync across all instances immediately
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({
        title: "Follow-up status updated",
        description: "The follow-up status has been successfully updated.",
      });
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['connection-requests'], context?.previousRequests);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not update follow-up status",
      });
    },
  });
};