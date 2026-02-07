/**
 * Chat Analytics & Feedback Client Utilities
 */

import { supabase } from './client';

export interface LogAnalyticsOptions {
  conversationId: string;
  queryText: string;
  responseText: string;
  responseTimeMs: number;
  tokensInput?: number;
  tokensOutput?: number;
  contextType: 'deal' | 'deals' | 'buyers' | 'universe';
  dealId?: string;
  universeId?: string;
  toolsCalled?: string[];
}

export interface SubmitFeedbackOptions {
  conversationId: string;
  messageIndex: number;
  rating: 1 | -1; // thumbs up or down
  issueType?: 'incorrect' | 'incomplete' | 'hallucination' | 'poor_formatting' | 'missing_data' | 'slow_response' | 'other';
  feedbackText?: string;
}

/**
 * Log chat analytics
 */
export async function logChatAnalytics(
  options: LogAnalyticsOptions
): Promise<{ success: boolean; analyticsId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('chat_analytics')
      .insert({
        conversation_id: options.conversationId,
        context_type: options.contextType,
        deal_id: options.dealId || null,
        universe_id: options.universeId || null,
        query_text: options.queryText,
        response_text: options.responseText.substring(0, 5000), // Limit response text
        response_time_ms: options.responseTimeMs,
        tokens_input: options.tokensInput || 0,
        tokens_output: options.tokensOutput || 0,
        tokens_total: (options.tokensInput || 0) + (options.tokensOutput || 0),
        tools_called: options.toolsCalled ? JSON.stringify(options.toolsCalled) : null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[chat-analytics] Log error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, analyticsId: data.id };
  } catch (err) {
    console.error('[chat-analytics] Log error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Submit user feedback
 */
export async function submitFeedback(
  options: SubmitFeedbackOptions
): Promise<{ success: boolean; feedbackId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('chat_feedback')
      .insert({
        conversation_id: options.conversationId,
        message_index: options.messageIndex,
        rating: options.rating,
        issue_type: options.issueType || null,
        feedback_text: options.feedbackText || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[chat-feedback] Submit error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, feedbackId: data.id };
  } catch (err) {
    console.error('[chat-feedback] Submit error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get analytics summary
 */
export async function getAnalyticsSummary(
  contextType?: 'deal' | 'deals' | 'buyers' | 'universe',
  days: number = 7
): Promise<{
  success: boolean;
  summary?: {
    total_queries: number;
    avg_response_time_ms: number;
    total_tokens: number;
    unique_conversations: number;
    continuation_rate: number;
    positive_feedback_rate: number;
    most_common_intent: string;
    tools_used_count: number;
  };
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_chat_analytics_summary', {
      p_context_type: contextType || null,
      p_days: days,
    });

    if (error) {
      console.error('[chat-analytics] Summary error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, summary: data[0] };
  } catch (err) {
    console.error('[chat-analytics] Summary error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Mark that user continued conversation (asked follow-up)
 */
export async function markUserContinued(
  conversationId: string,
  messageIndex: number
): Promise<void> {
  try {
    // Find the analytics entry for this message
    const { data } = await supabase
      .from('chat_analytics')
      .select('id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data && data[messageIndex]) {
      await supabase
        .from('chat_analytics')
        .update({ user_continued: true })
        .eq('id', data[messageIndex].id);
    }
  } catch (error) {
    console.error('[chat-analytics] Mark continued error:', error);
  }
}
