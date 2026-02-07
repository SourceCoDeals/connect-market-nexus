/**
 * Chat Conversation Persistence Client Utilities
 *
 * Client-side helpers for saving and loading chat conversations.
 */

import { supabase } from './client';

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
  context: ConversationContext;
  messages: ChatMessage[];
  title?: string;
  conversationId?: string; // If updating existing conversation
}

export interface Conversation {
  id: string;
  context_type: string;
  deal_id?: string;
  universe_id?: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
  last_message_at?: string;
  message_count: number;
  archived: boolean;
}

/**
 * Save or update a conversation
 */
export async function saveConversation(
  options: SaveConversationOptions
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const conversationData = {
      user_id: user.id,
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
        .eq('id', options.conversationId);

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
 * Load conversations by context
 */
export async function loadConversationsByContext(
  context: ConversationContext,
  limit: number = 10
): Promise<{ success: boolean; conversations?: Conversation[]; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    let query = supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('context_type', context.type)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (context.dealId) {
      query = query.eq('deal_id', context.dealId);
    }

    if (context.universeId) {
      query = query.eq('universe_id', context.universeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[chat-persistence] Load error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, conversations: data as Conversation[] || [] };
  } catch (err) {
    console.error('[chat-persistence] Load error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Load a specific conversation by ID
 */
export async function loadConversationById(
  conversationId: string
): Promise<{ success: boolean; conversation?: Conversation; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('[chat-persistence] Load by ID error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, conversation: data as Conversation };
  } catch (err) {
    console.error('[chat-persistence] Load by ID error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Archive (soft delete) a conversation
 */
export async function archiveConversation(
  conversationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('chat_conversations')
      .update({ archived: true })
      .eq('id', conversationId)
      .eq('user_id', user.id);

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
 * Get recent conversations across all contexts
 */
export async function getRecentConversations(
  limit: number = 10
): Promise<{ success: boolean; conversations?: Conversation[]; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[chat-persistence] Get recent error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, conversations: data as Conversation[] || [] };
  } catch (err) {
    console.error('[chat-persistence] Get recent error:', err);
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
 * Get conversation count by context type
 */
export async function getConversationStats(): Promise<{
  success: boolean;
  stats?: {
    total: number;
    byContext: {
      deal: number;
      deals: number;
      buyers: number;
      universe: number;
    };
  };
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('chat_conversations')
      .select('context_type, id')
      .eq('user_id', user.id)
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
