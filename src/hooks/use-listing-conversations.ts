import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ListingConversation, ListingMessage } from '@/types/chat';
import { useEffect } from 'react';

export function useListingConversation(connectionRequestId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['listing-conversation', connectionRequestId],
    queryFn: async () => {
      if (!connectionRequestId) return null;

      const { data: conversation, error } = await supabase
        .from('listing_conversations')
        .select(`
          *,
          listing_messages (
            *,
            sender:sender_id (
              id,
              email,
              first_name,
              last_name
            )
          )
        `)
        .eq('connection_request_id', connectionRequestId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return conversation as ListingConversation & { listing_messages: ListingMessage[] } | null;
    },
    enabled: !!connectionRequestId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!query.data?.id) return;

    const channel = supabase
      .channel(`conversation:${query.data.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'listing_messages',
          filter: `conversation_id=eq.${query.data.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['listing-conversation', connectionRequestId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [query.data?.id, connectionRequestId, queryClient]);

  return query;
}

export function useSendListingMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      conversationId,
      messageText,
      senderType,
      isInternalNote = false,
    }: {
      conversationId: string;
      messageText: string;
      senderType: 'buyer' | 'admin';
      isInternalNote?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('listing_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          sender_type: senderType,
          message_text: messageText,
          is_internal_note: isInternalNote,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-conversation'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to send message: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}
