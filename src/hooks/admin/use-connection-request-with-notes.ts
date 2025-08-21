import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useUpdateConnectionRequestWithNotes = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      requestId, 
      status, 
      decisionNotes 
    }: { 
      requestId: string; 
      status: string; 
      decisionNotes?: string;
    }) => {
      const { data, error } = await supabase.rpc(
        'update_connection_request_status_with_notes',
        {
          request_id: requestId,
          new_status: status,
          decision_notes: decisionNotes
        }
      );
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({
        title: "Request updated",
        description: "Connection request status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update request. Please try again.",
        variant: "destructive",
      });
    }
  });
};