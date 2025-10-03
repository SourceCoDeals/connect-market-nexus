import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DealNote {
  id: string;
  deal_id: string;
  admin_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
  admin_name?: string;
  admin_email?: string;
}

export function useDealNotes(dealId: string) {
  return useQuery({
    queryKey: ['deal-notes', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_notes')
        .select(`
          *,
          profiles:admin_id (
            full_name,
            email
          )
        `)
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((note: any) => ({
        ...note,
        admin_name: note.profiles?.full_name || 'Unknown',
        admin_email: note.profiles?.email || '',
      })) as DealNote[];
    },
  });
}

export function useCreateDealNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ dealId, noteText }: { dealId: string; noteText: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('deal_notes')
        .insert({
          deal_id: dealId,
          admin_id: user.id,
          note_text: noteText,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-notes', variables.dealId] });
      toast({
        title: 'Note Added',
        description: 'Your note has been saved successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to add note: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateDealNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ noteId, noteText, dealId }: { noteId: string; noteText: string; dealId: string }) => {
      const { data, error } = await supabase
        .from('deal_notes')
        .update({ note_text: noteText })
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-notes', variables.dealId] });
      toast({
        title: 'Note Updated',
        description: 'Your note has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update note: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteDealNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ noteId, dealId }: { noteId: string; dealId: string }) => {
      const { error } = await supabase
        .from('deal_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-notes', variables.dealId] });
      toast({
        title: 'Note Deleted',
        description: 'Your note has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete note: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}
