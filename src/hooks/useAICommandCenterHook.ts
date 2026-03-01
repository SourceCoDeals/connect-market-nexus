/**
 * AI Command Center Hook
 * Manages chat state, SSE streaming, tool execution status,
 * UI action dispatch, and conversation persistence.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';

import type {
  AIMessage,
  ToolCallInfo,
  ConfirmationRequest,
  PageContext,
  AICommandCenterState,
  UIActionHandler,
} from './ai-command-center-types';

import { processSSEStream } from './ai-command-center-stream';

import {
  loadConversationsFromDatabase,
  persistConversationToDatabase,
  archiveConversationById,
  saveChatAnalytics,
  type Conversation,
} from './ai-command-center-persistence';

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

  // Conversation history state
  const [conversationHistory, setConversationHistory] = useState<Conversation[]>([]);
  const [activeConversationDbId, setActiveConversationDbId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const uiActionHandlerRef = useRef<UIActionHandler | null>(null);
  const conversationIdRef = useRef<string>(crypto.randomUUID());
  const persistedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted conversation from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('ai-cc-messages');
    const savedId = sessionStorage.getItem('ai-cc-conversation-id');
    if (saved && savedId) {
      try {
        const parsed = JSON.parse(saved) as AIMessage[];
        setMessages(parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })));
        conversationIdRef.current = savedId;
        persistedRef.current = true;
      } catch {
        /* ignore corrupt data */
      }
    }
  }, []);

  // Load conversation history from database on mount
  useEffect(() => {
    loadConversationHistory();
  }, []);

  const loadConversationHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const conversations = await loadConversationsFromDatabase(20);
      setConversationHistory(conversations);
    } catch (err) {
      console.error('[useAICommandCenter] Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Save current conversation to database (debounced)
  const persistToDatabase = useCallback(
    async (msgs: AIMessage[]) => {
      try {
        const newId = await persistConversationToDatabase(
          msgs,
          pageContext,
          activeConversationDbId,
        );

        if (newId) {
          setActiveConversationDbId(newId);
        }

        // Refresh history list
        await loadConversationHistory();
      } catch (err) {
        console.error('[useAICommandCenter] Save error:', err);
      }
    },
    [activeConversationDbId, pageContext, loadConversationHistory],
  );

  // Switch to a past conversation
  const switchConversation = useCallback((conversation: Conversation) => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setStreamingContent('');
    setCurrentPhase('');
    setActiveTools([]);
    setPendingConfirmation(null);
    setError(null);

    const loadedMessages: AIMessage[] = conversation.messages.map((m, idx) => ({
      id: `loaded-${conversation.id}-${idx}`,
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp),
    }));

    setMessages(loadedMessages);
    setActiveConversationDbId(conversation.id);
    conversationIdRef.current = conversation.id;

    // Update sessionStorage
    try {
      sessionStorage.setItem('ai-cc-messages', JSON.stringify(loadedMessages));
      sessionStorage.setItem('ai-cc-conversation-id', conversation.id);
    } catch {
      /* storage full */
    }
  }, []);

  // Start a new conversation
  const startNewConversation = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setStreamingContent('');
    setCurrentPhase('');
    setRouteInfo(null);
    setActiveTools([]);
    setPendingConfirmation(null);
    setError(null);
    setActiveConversationDbId(null);
    conversationIdRef.current = crypto.randomUUID();
    sessionStorage.removeItem('ai-cc-messages');
    sessionStorage.removeItem('ai-cc-conversation-id');
  }, []);

  // Archive a conversation from history
  const deleteConversation = useCallback(
    async (conversationId: string) => {
      const { success } = await archiveConversationById(conversationId);
      if (success) {
        setConversationHistory((prev) => prev.filter((c) => c.id !== conversationId));
        if (conversationId === activeConversationDbId) {
          startNewConversation();
        }
      }
    },
    [activeConversationDbId, startNewConversation],
  );

  // Register a handler for UI actions (select_rows, filter, navigate)
  const onUIAction = useCallback((handler: UIActionHandler) => {
    uiActionHandlerRef.current = handler;
  }, []);

  // Stream callbacks used by processSSEStream
  const getStreamCallbacks = useCallback(() => ({
    setCurrentPhase,
    setRouteInfo,
    setStreamingContent,
    setActiveTools,
    setPendingConfirmation,
    setError,
    setMessages,
    uiActionHandler: () => uiActionHandlerRef.current,
  }), []);

  // Send a message
  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim() || isLoading) return;

      // Cancel any in-flight request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setError(null);
      setPendingConfirmation(null);

      // Add user message
      const userMsg: AIMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: query.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setStreamingContent('');
      setCurrentPhase('routing');
      setActiveTools([]);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          throw new Error('You must be logged in to use the AI Command Center');
        }

        // Build conversation history for context
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const fetchOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData.session.access_token}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            query: query.trim(),
            conversation_id: conversationIdRef.current,
            history,
            page_context: pageContext,
          }),
          signal: abortControllerRef.current.signal,
        };

        // Retry up to 2 times on network errors (Failed to fetch / TypeError)
        let response: Response | undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            response = await fetch(`${SUPABASE_URL}/functions/v1/ai-command-center`, fetchOptions);
            break;
          } catch (fetchErr) {
            if (fetchErr instanceof Error && fetchErr.name === 'AbortError') throw fetchErr;
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            }
          }
        }

        if (!response) {
          throw new Error(
            'Unable to reach the AI service. Please check your internet connection and try again.',
          );
        }

        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('Unauthorized. Please ensure you have admin access.');
        }
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error((err as Record<string, string>).error || 'Failed to get response');
        }

        // Process SSE stream
        await processSSEStream(response, getStreamCallbacks());
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Sorry, something went wrong: ${message}`,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
        setStreamingContent('');
        setCurrentPhase('');
        setActiveTools([]);
      }
    },
    [isLoading, messages, pageContext, getStreamCallbacks],
  );

  // Confirm a pending action
  const confirmAction = useCallback(async () => {
    if (!pendingConfirmation) return;

    const confirmed = { ...pendingConfirmation };
    setPendingConfirmation(null);
    setIsLoading(true);
    setStreamingContent('');
    setCurrentPhase('executing_confirmed_action');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Not authenticated');

      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-command-center`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          query: messages[messages.length - 2]?.content || '',
          conversation_id: conversationIdRef.current,
          history,
          page_context: pageContext,
          confirmed_action: {
            tool_id: confirmed.tool_id,
            tool_name: confirmed.tool_name,
            args: confirmed.args,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to execute confirmed action');
      await processSSEStream(response, getStreamCallbacks());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setError(message);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      setCurrentPhase('');
    }
  }, [pendingConfirmation, messages, pageContext, getStreamCallbacks]);

  // Deny a pending action
  const denyAction = useCallback(() => {
    if (!pendingConfirmation) return;
    setPendingConfirmation(null);
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Action cancelled: ${pendingConfirmation.description}`,
        timestamp: new Date(),
      },
    ]);
  }, [pendingConfirmation]);

  // Clear conversation (starts a new one)
  const clearMessages = useCallback(() => {
    startNewConversation();
  }, [startNewConversation]);

  // Persist messages to sessionStorage + database on change
  useEffect(() => {
    if (messages.length === 0 || isLoading) return;
    // SessionStorage for instant reload
    try {
      sessionStorage.setItem('ai-cc-messages', JSON.stringify(messages.slice(-20)));
      sessionStorage.setItem('ai-cc-conversation-id', conversationIdRef.current);
    } catch {
      /* storage full — ignore */
    }

    // Database persistence (async, non-blocking)
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && !persistedRef.current) {
      persistedRef.current = true;
    }
    // Save the last message to chat_analytics for audit trail
    if (lastMsg) {
      saveChatAnalytics(conversationIdRef.current, messages, lastMsg);
    }

    // Save full conversation to chat_conversations (debounced)
    if (lastMsg?.role === 'assistant') {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        persistToDatabase(messages);
      }, 1500);
    }
  }, [messages, isLoading, persistToDatabase]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setCurrentPhase('');
  }, []);

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
    conversationHistory,
    activeConversationDbId,
    isLoadingHistory,
    // Actions
    sendMessage,
    confirmAction,
    denyAction,
    clearMessages,
    stopStreaming,
    onUIAction,
    // History actions
    switchConversation,
    startNewConversation,
    deleteConversation,
    loadConversationHistory,
  };
}
