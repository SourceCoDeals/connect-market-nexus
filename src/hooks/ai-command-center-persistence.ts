/**
 * Conversation persistence utilities for the AI Command Center
 */

import { supabase } from '@/integrations/supabase/client';
import {
  saveConversation,
  getRecentConversations,
  archiveConversation,
  type ChatMessage as PersistChatMessage,
  type Conversation,
} from '@/integrations/supabase/chat-persistence';
import type { AIMessage, PageContext } from './ai-command-center-types';

export type { Conversation };

export async function loadConversationsFromDatabase(limit = 20) {
  const { success, conversations } = await getRecentConversations(limit);
  if (success && conversations) {
    return conversations;
  }
  return [];
}

export async function persistConversationToDatabase(
  msgs: AIMessage[],
  pageContext: PageContext | undefined,
  activeConversationDbId: string | null,
): Promise<string | null> {
  if (msgs.length < 2) return null; // Need at least 1 exchange

  const persistMessages: PersistChatMessage[] = msgs.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
  }));

  const contextType =
    pageContext?.page === 'deal_detail'
      ? ('deal' as const)
      : pageContext?.page === 'buyers_list' || pageContext?.page === 'remarketing'
        ? ('buyers' as const)
        : ('command_center' as const);

  const { success, conversationId: newId } = await saveConversation({
    context: {
      type: contextType,
      dealId: contextType === 'deal' ? pageContext?.entity_id : undefined,
    },
    messages: persistMessages,
    conversationId: activeConversationDbId || undefined,
  });

  if (success && newId && !activeConversationDbId) {
    return newId;
  }
  return null;
}

export async function archiveConversationById(conversationId: string) {
  return archiveConversation(conversationId);
}

export function saveChatAnalytics(
  conversationId: string,
  messages: AIMessage[],
  lastMsg: AIMessage,
) {
  if (lastMsg.role !== 'assistant' || !lastMsg.metadata) return;

  supabase
    .from('chat_analytics')
    .insert({
      conversation_id: conversationId,
      query_text:
        messages.length >= 2 ? messages[messages.length - 2]?.content?.substring(0, 500) : '',
      response_text: lastMsg.content?.substring(0, 2000) || '',
      query_intent: lastMsg.metadata.category || null,
      tools_called: lastMsg.toolCalls?.map((t) => t.name) || [],
      response_time_ms: lastMsg.metadata.durationMs || null,
      tokens_total: null,
    } as never)
    .then(() => {}); // Fire and forget
}
