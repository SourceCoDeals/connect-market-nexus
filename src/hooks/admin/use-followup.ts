import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { invalidateConnectionRequests } from '@/lib/query-client-helpers';

interface UpdateFollowupParams {
  requestId: string;
  isFollowedUp: boolean;
  notes?: string;
}

interface UpdateNegativeFollowupParams {
  requestId: string;
  isFollowedUp: boolean;
  notes?: string;
}

export const useUpdateNegativeFollowup = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, isFollowedUp, notes }: UpdateNegativeFollowupParams) => {
      const { data, error } = await supabase.rpc('update_connection_request_negative_followup', {
        request_id: requestId,
        is_followed_up: isFollowedUp,
        admin_notes: notes
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      // Invalidate all related connection request caches (user/admin variants)
      await invalidateConnectionRequests(queryClient);
      toast({
        title: "Negative follow-up status updated",
        description: "The negative follow-up status has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not update negative follow-up status",
      });
    },
  });
};

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
    onSuccess: async () => {
      // Invalidate all related connection request caches (user/admin variants)
      await invalidateConnectionRequests(queryClient);
      toast({
        title: "Follow-up status updated",
        description: "The follow-up status has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not update follow-up status",
      });
    },
  });
};