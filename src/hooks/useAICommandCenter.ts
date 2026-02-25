/**
 * AI Command Center Hook
 * Manages chat state, SSE streaming, tool execution status,
 * UI action dispatch, and conversation persistence with thread support.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// Untyped client to bypass generated types for chat_conversations
const db = supabase as unknown as SupabaseClient;

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
    | 'clear_selection';
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

export interface ThreadSummary {
  id: string;
  title: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  preview: string;
}

type UIActionHandler = (action: UIActionPayload) => void;

// ---------- Thread persistence helpers ----------

async function loadThreadList(): Promise<ThreadSummary[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await db
    .from('chat_conversations')
    .select('id, title, message_count, last_message_at, created_at, messages')
    .eq('user_id', user.id)
    .eq('context_type', 'command_center')
    .eq('archived', false)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return (data as any[]).map((row) => {
    const msgs = (row.messages as any[]) || [];
    const lastMsg = msgs[msgs.length - 1];
    return {
      id: row.id,
      title: row.title || 'New Conversation',
      message_count: row.message_count ?? msgs.length,
      last_message_at: row.last_message_at,
      created_at: row.created_at,
      preview: lastMsg?.content?.substring(0, 80) || '',
    };
  });
}

async function loadThreadMessages(threadId: string): Promise<AIMessage[]> {
  const { data, error } = await db
    .from('chat_conversations')
    .select('messages')
    .eq('id', threadId)
    .single();

  if (error || !data) return [];

  return (((data as any).messages as any[]) || []).map((m: any) => ({
    id: m.id || crypto.randomUUID(),
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp),
  }));
}

async function saveThread(
  threadId: string | null,
  messages: AIMessage[],
  title?: string,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const serialized = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
  }));

  const autoTitle = title || generateTitle(messages);

  if (threadId) {
    const { error } = await db
      .from('chat_conversations')
      .update({
        messages: JSON.parse(JSON.stringify(serialized)),
        title: autoTitle,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', threadId);

    if (error) {
      console.error('[ai-cc] Update thread error:', error);
      return null;
    }
    return threadId;
  } else {
    const { data, error } = await db
      .from('chat_conversations')
      .insert({
        user_id: user.id,
        context_type: 'command_center',
        messages: JSON.parse(JSON.stringify(serialized)),
        title: autoTitle,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[ai-cc] Create thread error:', error);
      return null;
    }
    return (data as any).id;
  }
}

function generateTitle(messages: AIMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New Conversation';
  const t = firstUser.content.substring(0, 50).trim();
  return t.length < firstUser.content.length ? t + '...' : t;
}

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

  // Thread state
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [showThreadList, setShowThreadList] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const uiActionHandlerRef = useRef<UIActionHandler | null>(null);
  const conversationIdRef = useRef<string>(crypto.randomUUID());
  const dbThreadIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load threads on mount
  useEffect(() => {
    refreshThreads();
  }, []);

  const refreshThreads = useCallback(async () => {
    setThreadsLoading(true);
    try {
      const list = await loadThreadList();
      setThreads(list);
    } catch {
      // ignore
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  // Auto-save conversation to Supabase (debounced)
  const scheduleSave = useCallback((msgs: AIMessage[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      if (msgs.length === 0) return;
      const id = await saveThread(dbThreadIdRef.current, msgs);
      if (id && !dbThreadIdRef.current) {
        dbThreadIdRef.current = id;
        setActiveThreadId(id);
      }
      // Refresh thread list in background
      const list = await loadThreadList();
      setThreads(list);
    }, 1500);
  }, []);

  // Register a handler for UI actions (select_rows, filter, navigate)
  const onUIAction = useCallback((handler: UIActionHandler) => {
    uiActionHandlerRef.current = handler;
  }, []);

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

      setMessages((prev) => {
        const next = [...prev, userMsg];
        return next;
      });
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
        await processSSEStream(response);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        setMessages((prev) => {
          const next = [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: `Sorry, something went wrong: ${message}`,
              timestamp: new Date(),
            },
          ];
          scheduleSave(next);
          return next;
        });
      } finally {
        setIsLoading(false);
        setStreamingContent('');
        setCurrentPhase('');
        setActiveTools([]);
      }
    },
    [isLoading, messages, pageContext, scheduleSave],
  );

  // Process SSE stream from the orchestrator
  const processSSEStream = useCallback(
    async (response: Response) => {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      const toolCalls: ToolCallInfo[] = [];
      const uiActions: UIActionPayload[] = [];
      let confirmation: ConfirmationRequest | null = null;
      let meta: AIMessage['metadata'] = {};
      let pendingEventType = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.replace(/\r$/, '');

          // SSE event type line
          if (trimmed.startsWith('event: ')) {
            pendingEventType = trimmed.slice(7).trim();
            continue;
          }

          // Skip empty lines and comments
          if (!trimmed || trimmed.startsWith(':')) {
            pendingEventType = '';
            continue;
          }

          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (!jsonStr) continue;

          const eventType = pendingEventType || 'message';
          pendingEventType = '';

          try {
            const data = JSON.parse(jsonStr);

            switch (eventType) {
              case 'status':
                setCurrentPhase(data.phase || '');
                break;

              case 'routed':
                setRouteInfo(data);
                meta = { ...meta, category: data.category, tier: data.tier };
                break;

              case 'text':
                fullText += data.text || '';
                setStreamingContent(fullText);
                break;

              case 'tool_use':
                // Tool call started by Claude
                break;

              case 'tool_start': {
                const tool: ToolCallInfo = { id: data.id, name: data.name, status: 'running' };
                toolCalls.push(tool);
                setActiveTools([...toolCalls]);
                break;
              }

              case 'tool_result': {
                const idx = toolCalls.findIndex((t) => t.id === data.id);
                if (idx >= 0) {
                  toolCalls[idx].status = data.success ? 'success' : 'error';
                  toolCalls[idx].hasUIAction = data.has_ui_action;
                  setActiveTools([...toolCalls]);
                }
                break;
              }

              case 'ui_action': {
                const action = data as UIActionPayload;
                uiActions.push(action);
                // Dispatch to the registered handler
                uiActionHandlerRef.current?.(action);
                break;
              }

              case 'confirmation_required':
                confirmation = data as ConfirmationRequest;
                setPendingConfirmation(confirmation);
                break;

              case 'error':
                setError(data.message || 'Unknown error');
                break;

              case 'done':
                meta = {
                  ...meta,
                  cost: data.cost,
                  toolCount: data.tool_calls,
                  durationMs: data.duration_ms,
                };
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Add the assistant message
      if (fullText || toolCalls.length > 0 || confirmation) {
        const assistantMsg: AIMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fullText,
          timestamp: new Date(),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          uiActions: uiActions.length > 0 ? uiActions : undefined,
          pendingConfirmation: confirmation || undefined,
          metadata: meta,
        };
        setMessages((prev) => {
          const next = [...prev, assistantMsg];
          scheduleSave(next);
          return next;
        });
      }
    },
    [scheduleSave],
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
      await processSSEStream(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setError(message);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      setCurrentPhase('');
    }
  }, [pendingConfirmation, messages, pageContext, processSSEStream]);

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

  // Start a new thread (clears current conversation)
  const newThread = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setStreamingContent('');
    setCurrentPhase('');
    setRouteInfo(null);
    setActiveTools([]);
    setPendingConfirmation(null);
    setError(null);
    conversationIdRef.current = crypto.randomUUID();
    dbThreadIdRef.current = null;
    setActiveThreadId(null);
    setShowThreadList(false);
  }, []);

  // Select a thread to load
  const selectThread = useCallback(async (threadId: string) => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setStreamingContent('');
    setCurrentPhase('');
    setActiveTools([]);
    setPendingConfirmation(null);
    setError(null);

    const msgs = await loadThreadMessages(threadId);
    setMessages(msgs);
    dbThreadIdRef.current = threadId;
    setActiveThreadId(threadId);
    conversationIdRef.current = threadId;
    setShowThreadList(false);
  }, []);

  // Archive a thread
  const archiveThread = useCallback(
    async (threadId: string) => {
      const { error } = await db
        .from('chat_conversations')
        .update({ archived: true })
        .eq('id', threadId);

      if (!error) {
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        if (dbThreadIdRef.current === threadId) {
          newThread();
        }
      }
    },
    [newThread],
  );

  // Clear conversation (same as newThread for backward compat)
  const clearMessages = newThread;

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
    // Thread state
    threads,
    activeThreadId,
    threadsLoading,
    showThreadList,
    setShowThreadList,
    // Actions
    sendMessage,
    confirmAction,
    denyAction,
    clearMessages,
    stopStreaming,
    onUIAction,
    // Thread actions
    newThread,
    selectThread,
    archiveThread,
    refreshThreads,
  };
}
