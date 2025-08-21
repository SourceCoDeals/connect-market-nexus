import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { QUERY_KEYS } from '@/lib/query-keys';

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

// Real implementation for user notes
export function useUserNotes(userId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.admin.userNotes(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_notes')
        .select(`
          *,
          admin:profiles!admin_id(first_name, last_name, email)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(note => {
        const admin = note.admin as any;
        
        return {
          ...note,
          admin_name: admin ? 
            `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || admin.email || 'Unknown Admin' : 
            'Unknown Admin',
          admin_email: admin?.email || '',
        };
      });
    },
    enabled: !!userId,
  });
}

export function useCreateUserNote() {
  const queryClient = useQueryClient();
  
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
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.admin.userNotes(variables.userId) 
      });
      toast({
        title: "Note created",
        description: "User note has been created successfully."
      });
    },
    onError: (error) => {
      console.error('Note creation failed:', error);
      toast({
        title: "Error",
        description: "Failed to create note. Please try again.",
        variant: "destructive"
      });
    }
  });
}

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
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.admin.userNotes(variables.userId) 
      });
      toast({
        title: "Note updated",
        description: "User note has been updated successfully."
      });
    },
    onError: (error) => {
      console.error('Note update failed:', error);
      toast({
        title: "Error",
        description: "Failed to update note. Please try again.",
        variant: "destructive"
      });
    }
  });
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