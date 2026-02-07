/**
 * Chat Conversation Persistence Utilities
 *
 * Helper functions for saving and loading chat conversations to/from the database.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ConversationContext {
  type: 'deal' | 'deals' | 'buyers' | 'universe';
  dealId?: string;
  universeId?: string;
}

export interface SaveConversationOptions {
  userId: string;
  context: ConversationContext;
  messages: ChatMessage[];
  title?: string;
  conversationId?: string; // If updating existing conversation
}

export interface LoadConversationOptions {
  userId: string;
  conversationId?: string;
  context?: ConversationContext;
  limit?: number;
}

/**
 * Save or update a conversation
 */
export async function saveConversation(
  supabase: SupabaseClient,
  options: SaveConversationOptions
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  try {
    const conversationData = {
      user_id: options.userId,
      context_type: options.context.type,
      deal_id: options.context.dealId || null,
      universe_id: options.context.universeId || null,
      messages: options.messages,
      title: options.title || generateTitle(options.messages),
      last_message_at: new Date().toISOString(),
    };

    if (options.conversationId) {
      // Update existing conversation
      const { error } = await supabase
        .from('chat_conversations')
        .update(conversationData)
        .eq('id', options.conversationId)
        .eq('user_id', options.userId); // Security: ensure user owns this conversation

      if (error) {
        console.error('[chat-persistence] Update error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, conversationId: options.conversationId };
    } else {
      // Create new conversation
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert(conversationData)
        .select('id')
        .single();

      if (error) {
        console.error('[chat-persistence] Insert error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, conversationId: data.id };
    }
  } catch (err) {
    console.error('[chat-persistence] Save error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Load conversation(s)
 */
export async function loadConversation(
  supabase: SupabaseClient,
  options: LoadConversationOptions
): Promise<{ success: boolean; conversations?: any[]; error?: string }> {
  try {
    let query = supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', options.userId)
      .eq('archived', false)
      .order('updated_at', { ascending: false });

    if (options.conversationId) {
      query = query.eq('id', options.conversationId).limit(1);
    } else {
      // Filter by context if provided
      if (options.context) {
        query = query.eq('context_type', options.context.type);

        if (options.context.dealId) {
          query = query.eq('deal_id', options.context.dealId);
        }

        if (options.context.universeId) {
          query = query.eq('universe_id', options.context.universeId);
        }
      }

      query = query.limit(options.limit || 10);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[chat-persistence] Load error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, conversations: data || [] };
  } catch (err) {
    console.error('[chat-persistence] Load error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Archive (soft delete) a conversation
 */
export async function archiveConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('chat_conversations')
      .update({ archived: true })
      .eq('id', conversationId)
      .eq('user_id', userId); // Security: ensure user owns this conversation

    if (error) {
      console.error('[chat-persistence] Archive error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[chat-persistence] Archive error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Generate a title from the first user message
 */
function generateTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find(m => m.role === 'user');

  if (!firstUserMessage) {
    return 'New Conversation';
  }

  // Truncate to first 50 characters
  const title = firstUserMessage.content.substring(0, 50).trim();
  return title.length < firstUserMessage.content.length ? title + '...' : title;
}

/**
 * Helper: Get recent conversations for a user
 */
export async function getRecentConversations(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 10
): Promise<{ success: boolean; conversations?: any[]; error?: string }> {
  return loadConversation(supabase, { userId, limit });
}

/**
 * Helper: Get conversation count by context
 */
export async function getConversationStats(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean; stats?: any; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('context_type, id')
      .eq('user_id', userId)
      .eq('archived', false);

    if (error) {
      return { success: false, error: error.message };
    }

    const stats = {
      total: data.length,
      byContext: {
        deal: data.filter(c => c.context_type === 'deal').length,
        deals: data.filter(c => c.context_type === 'deals').length,
        buyers: data.filter(c => c.context_type === 'buyers').length,
        universe: data.filter(c => c.context_type === 'universe').length,
      }
    };

    return { success: true, stats };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
