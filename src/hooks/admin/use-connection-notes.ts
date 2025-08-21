import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Simplified hook that just updates admin_comment field for decision notes
export function useUpdateDecisionNotes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes: string }) => {
      const { data, error } = await supabase
        .from('connection_requests')
        .update({ admin_comment: notes })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({
        title: "Decision note saved",
        description: "Decision note has been updated successfully."
      });
    },
    onError: (error) => {
      console.log('Decision note update failed:', error);
      toast({
        title: "Error",
        description: "Failed to save decision note. Please try again.",
        variant: "destructive"
      });
    }
  });
}

// Placeholder hooks for user notes that return empty data until database functions are set up
export function useUserNotes(userId: string) {
  return {
    data: [],
    isLoading: false,
    error: null
  };
}

export function useCreateUserNote() {
  return {
    mutateAsync: async () => {
      toast({
        title: "Notes feature coming soon",
        description: "User notes functionality is being set up. Use admin comments for now.",
        variant: "destructive"
      });
    },
    isPending: false
  };
}

export function useUpdateUserNote() {
  return {
    mutateAsync: async () => {
      toast({
        title: "Notes feature coming soon",
        description: "User notes functionality is being set up. Use admin comments for now.",
        variant: "destructive"
      });
    },
    isPending: false
  };
}

export interface UserNote {
  id: string;
  user_id: string;
  admin_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
  admin_name?: string;
  admin_email?: string;
}