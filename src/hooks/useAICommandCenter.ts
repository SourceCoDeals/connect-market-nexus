/**
 * AI Command Center Hook
 * Coordinates chat state, SSE streaming, tool execution status,
 * UI action dispatch, and conversation persistence.
 *
 * Implementation split across:
 *   - useAIConversation.ts  -- conversation history management
 *   - useAIToolCalling.ts   -- tool calling and SSE execution logic
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAIConversation } from './useAIConversation';
import { useAIToolCalling } from './useAIToolCalling';
import type { Conversation } from '@/integrations/supabase/chat-persistence';

// ---------- Types ----------

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCallInfo[];
  uiActions?: UIActionPayload[];
  pendingConfirmation?: ConfirmationRequest;
  metadata?: {
    category?: string;
    tier?: string;
    cost?: number;
    durationMs?: number;
    toolCount?: number;
  };
}

export interface ToolCallInfo {
  id: string;
  name: string;
  status: 'running' | 'success' | 'error';
  hasUIAction?: boolean;
}

export interface UIActionPayload {
  type:
    | 'select_rows'
    | 'apply_filter'
    | 'sort_column'
    | 'navigate'
    | 'highlight_rows'
    | 'clear_selection'
    | 'trigger_action';
  target: string;
  payload: Record<string, unknown>;
}

export interface ConfirmationRequest {
  tool_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  description: string;
}

export interface PageContext {
  page?: string;
  entity_id?: string;
  entity_type?: string;
  tab?: string;
}

export interface AICommandCenterState {
  messages: AIMessage[];
  isLoading: boolean;
  streamingContent: string;
  currentPhase: string;
  routeInfo: { category: string; tier: string; confidence: number; bypassed: boolean } | null;
  activeTools: ToolCallInfo[];
  pendingConfirmation: ConfirmationRequest | null;
  error: string | null;
}

export type { Conversation };

// ---------- Hook ----------

export function useAICommandCenter(pageContext?: PageContext) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentPhase, setCurrentPhase] = useState('');
  const [routeInfo, setRouteInfo] = useState<AICommandCenterState['routeInfo']>(null);
  const [activeTools, setActiveTools] = useState<ToolCallInfo[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Shared abort controller ref -- used by both conversation and tool calling
  const abortControllerRef = useRef<AbortController | null>(null);

  // Conversation history management
  const conversation = useAIConversation(
    pageContext,
    setMessages,
    setIsLoading,
    setStreamingContent,
    setCurrentPhase,
    setRouteInfo,
    setActiveTools,
    setPendingConfirmation,
    setError,
    abortControllerRef,
  );

  // Tool calling and execution
  const toolCalling = useAIToolCalling(
    messages,
    isLoading,
    pageContext,
    conversation.conversationIdRef,
    pendingConfirmation,
    setMessages,
    setIsLoading,
    setStreamingContent,
    setCurrentPhase,
    setRouteInfo,
    setActiveTools,
    setPendingConfirmation,
    setError,
  );

  // Keep the shared abort controller in sync with tool calling's ref
  abortControllerRef.current = toolCalling.abortControllerRef.current;

  // Persist messages to sessionStorage + database on change
  useEffect(() => {
    conversation.persistMessagesEffect(messages, isLoading);
  }, [messages, isLoading, conversation.persistMessagesEffect]);

  // Clear conversation (starts a new one)
  const clearMessages = useCallback(() => {
    conversation.startNewConversation();
  }, [conversation.startNewConversation]);

  return {
    // State
    messages,
    isLoading,
    streamingContent,
    currentPhase,
    routeInfo,
    activeTools,
    pendingConfirmation,
    error,
    // Conversation history
    conversationHistory: conversation.conversationHistory,
    activeConversationDbId: conversation.activeConversationDbId,
    isLoadingHistory: conversation.isLoadingHistory,
    // Actions
    sendMessage: toolCalling.sendMessage,
    confirmAction: toolCalling.confirmAction,
    denyAction: toolCalling.denyAction,
    clearMessages,
    stopStreaming: toolCalling.stopStreaming,
    onUIAction: toolCalling.onUIAction,
    // History actions
    switchConversation: conversation.switchConversation,
    startNewConversation: conversation.startNewConversation,
    deleteConversation: conversation.deleteConversation,
    loadConversationHistory: conversation.loadConversationHistory,
  };
}
