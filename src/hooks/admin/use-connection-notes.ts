import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { createQueryKey } from '@/lib/query-keys';

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

// Hook to fetch user notes
export function useUserNotes(userId: string) {
  return useQuery({
    queryKey: createQueryKey.userNotes(userId),
    queryFn: async () => {
      if (!userId) return [];
      
      const { data: notes, error } = await supabase
        .from('user_notes')
        .select(`
          *,
          admin:profiles!user_notes_admin_id_fkey(first_name, last_name, email)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return notes.map(note => ({
        ...note,
        admin_name: note.admin ? `${note.admin.first_name} ${note.admin.last_name}`.trim() : 'Unknown Admin',
        admin_email: note.admin?.email || ''
      }));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5
  });
}

// Hook to create user note
export function useCreateUserNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, noteText }: { userId: string; noteText: string }) => {
      const { data, error } = await supabase
        .from('user_notes')
        .insert([{
          user_id: userId,
          note_text: noteText
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: createQueryKey.userNotes(variables.userId) });
      toast({
        title: "Note added",
        description: "User note has been saved successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save note. Please try again.",
        variant: "destructive"
      });
    }
  });
}

// Hook to update user note
export function useUpdateUserNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ noteId, noteText, userId }: { noteId: string; noteText: string; userId: string }) => {
      const { data, error } = await supabase
        .from('user_notes')
        .update({ note_text: noteText })
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: createQueryKey.userNotes(variables.userId) });
      toast({
        title: "Note updated",
        description: "User note has been updated successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update note. Please try again.",
        variant: "destructive"
      });
    }
  });
}

// Hook to update connection request decision notes
export function useUpdateDecisionNotes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes: string }) => {
      const { data, error } = await supabase
        .from('connection_requests')
        .update({ decision_notes: notes })
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
      toast({
        title: "Error",
        description: "Failed to save decision note. Please try again.",
        variant: "destructive"
      });
    }
  });
}

// Hook to copy notes from previous requests for the same user
export function useCopyUserNotes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      // Get the most recent note for this user
      const { data: existingNotes, error } = await supabase
        .from('user_notes')
        .select('note_text, admin_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (existingNotes.length > 0) {
        const latestNote = existingNotes[0];
        const copyText = `[Copied from previous] ${latestNote.note_text}`;
        
        const { data, error: insertError } = await supabase
          .from('user_notes')
          .insert([{
            user_id: userId,
            note_text: copyText
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        return data;
      }
      
      return null;
    },
    onSuccess: (data, variables) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: createQueryKey.userNotes(variables.userId) });
        toast({
          title: "Note copied",
          description: "Previous note has been copied for this new request."
        });
      }
    },
    onError: (error) => {
      console.error('Error copying note:', error);
    }
  });
}