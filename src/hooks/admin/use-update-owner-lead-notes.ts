import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useUpdateOwnerLeadNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("inbound_leads")
        .update({ admin_notes: notes, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-leads"] });
      toast({
        title: "Notes saved",
        description: "Lead notes have been updated.",
      });
    },
    onError: (error) => {
      console.error("Error updating lead notes:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update lead notes.",
      });
    },
  });
}
