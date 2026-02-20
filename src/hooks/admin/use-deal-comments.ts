import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DealComment {
  id: string;
  deal_id: string;
  admin_id: string;
  comment_text: string;
  mentioned_admins: string[];
  created_at: string;
  updated_at: string;
  admin_name?: string;
  admin_email?: string;
}

export function useDealComments(dealId: string) {
  return useQuery({
    queryKey: ['deal-comments', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_comments')
        .select(`
          *,
          profiles:admin_id (
            first_name,
            last_name,
            email
          )
        `)
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((comment: any) => ({
        ...comment,
        admin_name: comment.profiles?.first_name || comment.profiles?.last_name
          ? `${comment.profiles?.first_name ?? ''} ${comment.profiles?.last_name ?? ''}`.trim()
          : (comment.profiles?.email || 'Unknown'),
        admin_email: comment.profiles?.email || '',
      })) as DealComment[];
    },
  });
}

export function useCreateDealComment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      dealId, 
      commentText, 
      mentionedAdmins = [] 
    }: { 
      dealId: string; 
      commentText: string;
      mentionedAdmins?: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('deal_comments')
        .insert({
          deal_id: dealId,
          admin_id: user.id,
          comment_text: commentText,
          mentioned_admins: mentionedAdmins,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-comments', variables.dealId] });
      toast({
        title: 'Comment Added',
        description: 'Your comment has been saved successfully.',
      });
    },
    onError: (error) => {
      console.error('Create comment error:', error);
      const msg = (error as any)?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      toast({
        title: 'Error',
        description: `Failed to add comment: ${msg}`,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateDealComment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      commentId, 
      commentText, 
      mentionedAdmins,
      dealId 
    }: { 
      commentId: string; 
      commentText: string; 
      mentionedAdmins: string[];
      dealId: string;
    }) => {
      const { data, error } = await supabase
        .from('deal_comments')
        .update({
          comment_text: commentText,
          mentioned_admins: mentionedAdmins,
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-comments', variables.dealId] });
      toast({
        title: 'Comment Updated',
        description: 'Your comment has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update comment: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteDealComment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ commentId, dealId }: { commentId: string; dealId: string }) => {
      const { error } = await supabase
        .from('deal_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-comments', variables.dealId] });
      toast({
        title: 'Comment Deleted',
        description: 'Your comment has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete comment: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}
