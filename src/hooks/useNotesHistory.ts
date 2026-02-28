import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EntityNote {
  id: string;
  entity_type: string;
  entity_id: string;
  note_text: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  author_name?: string;
}

function queryKey(entityType: string, entityId: string) {
  return ['entity-notes', entityType, entityId];
}

export function useNotesHistory(entityType: 'deal' | 'buyer', entityId: string) {
  const qc = useQueryClient();
  const key = queryKey(entityType, entityId);

  const notesQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_notes')
        .select(`*, profiles:created_by (first_name, last_name, email)`)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((note: any) => {
        const p = note.profiles as {
          first_name?: string;
          last_name?: string;
          email?: string;
        } | null;
        return {
          ...note,
          author_name:
            p?.first_name || p?.last_name
              ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
              : p?.email || 'Unknown',
        } as EntityNote;
      });
    },
    enabled: !!entityId,
  });

  const addNote = useMutation({
    mutationFn: async (noteText: string) => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;

      const { data, error } = await supabase
        .from('entity_notes')
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          note_text: noteText,
          created_by: user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success('Note saved');
    },
    onError: () => {
      toast.error('Failed to save note');
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from('entity_notes').delete().eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success('Note deleted');
    },
    onError: () => {
      toast.error('Failed to delete note');
    },
  });

  return {
    notes: notesQuery.data ?? [],
    isLoading: notesQuery.isLoading,
    addNote,
    deleteNote,
  };
}
