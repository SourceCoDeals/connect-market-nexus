import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

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
    queryKey: ['user-notes', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data: notes, error } = await supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch admin details for each note
      const notesWithAdmins = await Promise.all(notes.map(async (note) => {
        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', note.admin_id)
          .single();

        return {
          ...note,
          admin_name: adminProfile ? `${adminProfile.first_name} ${adminProfile.last_name}`.trim() : 'Unknown Admin',
          admin_email: adminProfile?.email || ''
        };
      }));

      return notesWithAdmins;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5
  });
}

// Hook to create user note
export function useCreateUserNote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ userId, noteText }: { userId: string; noteText: string }) => {
      if (!user?.id) throw new Error('Admin user not authenticated');
      
      const { data, error } = await supabase
        .from('user_notes')
        .insert({
          user_id: userId,
          admin_id: user.id,
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
      queryClient.invalidateQueries({ queryKey: ['user-notes', variables.userId] });
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