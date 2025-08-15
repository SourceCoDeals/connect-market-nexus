import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { createQueryKey } from '@/lib/query-keys';

interface BulkFollowupParams {
  requestIds: string[];
  isFollowedUp: boolean;
  followupType: 'positive' | 'negative';
}

export const useBulkFollowup = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestIds, isFollowedUp, followupType }: BulkFollowupParams) => {
      const updates = requestIds.map(async (requestId) => {
        if (followupType === 'positive') {
          const { data, error } = await supabase.rpc('update_connection_request_followup', {
            request_id: requestId,
            is_followed_up: isFollowedUp,
          });
          if (error) throw error;
          return data;
        } else {
          const { data, error } = await (supabase as any).rpc('update_connection_request_negative_followup', {
            request_id: requestId,
            is_followed_up: isFollowedUp,
          });
          if (error) throw error;
          return data;
        }
      });

      return Promise.all(updates);
    },
    onMutate: async ({ requestIds, isFollowedUp, followupType }) => {
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });

      const previousRequests = queryClient.getQueryData(['connection-requests']);

      // Optimistically update connection requests
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((request: any) => {
          if (requestIds.includes(request.id)) {
            if (followupType === 'positive') {
              return {
                ...request,
                followed_up: isFollowedUp,
                followed_up_at: isFollowedUp ? new Date().toISOString() : null
              };
            } else {
              return {
                ...request,
                negative_followed_up: isFollowedUp,
                negative_followed_up_at: isFollowedUp ? new Date().toISOString() : null
              };
            }
          }
          return request;
        });
      });

      return { previousRequests };
    },
    onSuccess: (data, variables) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: createQueryKey.userConnectionRequests() });
      
      const count = variables.requestIds.length;
      const type = variables.followupType === 'positive' ? 'follow-up' : 'rejection notice';
      
      toast({
        title: `Bulk ${type} update completed`,
        description: `Successfully updated ${count} connection request${count !== 1 ? 's' : ''}.`,
      });
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['connection-requests'], context?.previousRequests);
      toast({
        variant: "destructive",
        title: "Bulk update failed",
        description: "Could not update connection requests",
      });
    },
  });
};