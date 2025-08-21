import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UserNote {
  id: string;
  user_id: string;
  admin_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
  admin?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export const useUserNotes = (userId: string) => {
  return useQuery({
    queryKey: ['user-notes', userId],
    queryFn: async () => {
      // First get the notes
      const { data: notes, error: notesError } = await supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (notesError) throw notesError;
      if (!notes || notes.length === 0) return [];

      // Get unique admin IDs
      const adminIds = [...new Set(notes.map(note => note.admin_id))];

      // Get admin details
      const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', adminIds);
      
      if (adminsError) throw adminsError;

      // Combine the data
      const notesWithAdmins: UserNote[] = notes.map(note => ({
        ...note,
        admin: admins?.find(admin => admin.id === note.admin_id)
      }));

      return notesWithAdmins;
    },
    enabled: !!userId
  });
};

export const useCreateUserNote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, noteText }: { userId: string; noteText: string }) => {
      const { data, error } = await supabase
        .from('user_notes')
        .insert({
          user_id: userId,
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          note_text: noteText
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-notes', variables.userId] });
      toast({
        title: "Note added",
        description: "User note has been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add note. Please try again.",
        variant: "destructive",
      });
    }
  });
};

export const useDeleteUserNote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('user_notes')
        .delete()
        .eq('id', noteId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notes'] });
      toast({
        title: "Note deleted",
        description: "User note has been removed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete note. Please try again.",
        variant: "destructive",
      });
    }
  });
};