/**
 * Custom hook for chat conversation persistence
 */

import { useState, useEffect, useCallback } from 'react';
import {
  saveConversation,
  loadConversationsByContext,
  archiveConversation,
  type ChatMessage,
  type ConversationContext,
  type Conversation,
} from '@/integrations/supabase/chat-persistence';

interface UseChatPersistenceOptions {
  context: ConversationContext;
  autoLoad?: boolean; // Automatically load latest conversation for this context
}

export function useChatPersistence(options: UseChatPersistenceOptions) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load conversations for this context
  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const { success, conversations: data } = await loadConversationsByContext(
        options.context,
        10
      );

      if (success && data) {
        setConversations(data);

        // Auto-load the most recent conversation if enabled
        if (options.autoLoad && data.length > 0 && !conversationId) {
          setConversationId(data[0].id);
          return data[0].messages;
        }
      }
    } catch (error) {
      console.error('[use-chat-persistence] Load error:', error);
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [options.context, options.autoLoad, conversationId]);

  // Save current conversation
  const save = useCallback(
    async (messages: ChatMessage[], title?: string) => {
      setIsSaving(true);
      try {
        const { success, conversationId: newId } = await saveConversation({
          context: options.context,
          messages,
          title,
          conversationId: conversationId || undefined,
        });

        if (success && newId) {
          // Set conversation ID if this is a new conversation
          if (!conversationId) {
            setConversationId(newId);
          }

          // Reload conversations to update the list
          await loadConversations();

          return { success: true, conversationId: newId };
        }

        return { success: false };
      } catch (error) {
        console.error('[use-chat-persistence] Save error:', error);
        return { success: false, error: String(error) };
      } finally {
        setIsSaving(false);
      }
    },
    [conversationId, options.context, loadConversations]
  );

  // Start a new conversation
  const startNew = useCallback(() => {
    setConversationId(null);
  }, []);

  // Load a specific conversation
  const loadConversation = useCallback(
    (conversation: Conversation) => {
      setConversationId(conversation.id);
      return conversation.messages;
    },
    []
  );

  // Archive a conversation
  const archive = useCallback(
    async (id: string) => {
      const { success } = await archiveConversation(id);
      if (success) {
        // Remove from local list
        setConversations((prev) => prev.filter((c) => c.id !== id));

        // If this was the active conversation, start new
        if (id === conversationId) {
          setConversationId(null);
        }
      }
      return { success };
    },
    [conversationId]
  );

  // Load conversations on mount if context changes
  useEffect(() => {
    loadConversations();
  }, [options.context.type, options.context.dealId, options.context.universeId]);

  return {
    conversationId,
    conversations,
    isLoading,
    isSaving,
    save,
    startNew,
    loadConversation,
    archive,
    reload: loadConversations,
  };
}
