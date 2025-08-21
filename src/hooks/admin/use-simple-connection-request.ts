import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useUpdateConnectionRequestStatus = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      requestId, 
      status
    }: { 
      requestId: string; 
      status: string; 
    }) => {
      const { data, error } = await supabase.rpc(
        'update_connection_request_status_simple',
        {
          request_id: requestId,
          new_status: status
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

export const useUpdateConnectionRequestNotes = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      requestId, 
      notes
    }: { 
      requestId: string; 
      notes: string; 
    }) => {
      const { data, error } = await supabase.rpc(
        'update_connection_request_notes',
        {
          request_id: requestId,
          notes: notes
        }
      );
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({
        title: "Notes updated",
        description: "Decision notes have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update notes. Please try again.",
        variant: "destructive",
      });
    }
  });
};