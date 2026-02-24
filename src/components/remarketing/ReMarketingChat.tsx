import { useState, useRef, useEffect, useCallback } from 'react';
import type React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  X,
  Minimize2,
  Trash2,
  ChevronUp,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { useChatPersistence } from '@/hooks/use-chat-persistence';
import type { ConversationContext } from '@/integrations/supabase/chat-persistence';
import { ChatFeedbackButtons } from './ChatFeedbackButtons';
import { SmartSuggestions, type Suggestion } from './SmartSuggestions';
import { ProactiveRecommendation, type Recommendation } from './ProactiveRecommendation';
import { generateSmartSuggestions } from '@/utils/smart-suggestions-client';
import { generateProactiveRecommendations } from '@/utils/proactive-recommendations-client';
import { logChatAnalytics, markUserContinued } from '@/integrations/supabase/chat-analytics';
import { processSSEChunk, flushSSEBuffer, type SSEParserState } from '@/utils/sse-stream-parser';

export type ChatContext =
  | { type: 'deal'; dealId: string; dealName?: string }
  | { type: 'deals'; totalDeals?: number }
  | { type: 'buyers'; totalBuyers?: number }
  | { type: 'universe'; universeId: string; universeName?: string };

interface ReMarketingChatProps {
  context: ChatContext;
  onHighlightItems?: (ids: string[]) => void;
  className?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/** Streaming timeout in ms — auto-cancels if no data received within this window */
const STREAM_TIMEOUT_MS = 60_000;

const getExampleQueries = (context: ChatContext): string[] => {
  switch (context.type) {
    case 'deal':
      return [
        'Who are the top 5 buyers for this deal?',
        'Which buyers have presence in this state?',
        'Show me the most active acquirers',
      ];
    case 'deals':
      return [
        'Which deals have the highest quality scores?',
        'Show me deals that need enrichment',
        'What industries have the most deals?',
      ];
    case 'buyers':
      return [
        'Which buyers are most active acquirers?',
        'Show me PE firms focused on the Southeast',
        'Find buyers with fee agreements',
      ];
    case 'universe':
      return [
        'Who are the best matched buyers?',
        'Which deals need more buyer matches?',
        'Show buyers with high alignment scores',
      ];
  }
};

const getChatTitle = (context: ChatContext): string => {
  switch (context.type) {
    case 'deal':
      return 'AI Buyer Assistant';
    case 'deals':
      return 'AI Deals Assistant';
    case 'buyers':
      return 'AI Buyers Assistant';
    case 'universe':
      return 'AI Universe Assistant';
  }
};

const getSubtitle = (context: ChatContext): string | null => {
  switch (context.type) {
    case 'deal':
      return context.dealName || null;
    case 'deals':
      return context.totalDeals ? `${context.totalDeals} deals` : null;
    case 'buyers':
      return context.totalBuyers ? `${context.totalBuyers} buyers` : null;
    case 'universe':
      return context.universeName || null;
  }
};

const getPlaceholder = (context: ChatContext): string => {
  switch (context.type) {
    case 'deal':
      return 'Ask about buyers for this deal...';
    case 'deals':
      return 'Ask about your deals...';
    case 'buyers':
      return 'Ask about your buyers...';
    case 'universe':
      return 'Ask about this universe...';
  }
};

export function ReMarketingChat({ context, onHighlightItems, className }: ReMarketingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Drag state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setPosition(null);
  }, [isOpen]);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      setPosition({
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [smartSuggestions, setSmartSuggestions] = useState<Suggestion[]>([]);
  const [activeRecommendation, setActiveRecommendation] = useState<Recommendation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const exampleQueries = getExampleQueries(context);

  // Convert ChatContext to ConversationContext
  const persistenceContext: ConversationContext = {
    type: context.type,
    dealId: context.type === 'deal' ? context.dealId : undefined,
    universeId: context.type === 'universe' ? context.universeId : undefined,
  };

  // Conversation persistence hook
  const {
    conversationId,
    save: saveConversation,
    startNew: startNewConversation,
    isSaving,
  } = useChatPersistence({
    context: persistenceContext,
    autoLoad: true,
  });

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Extract item IDs from hidden marker
  const extractItemIds = useCallback((content: string): string[] => {
    const match = content.match(/<!-- HIGHLIGHT: \[(.*?)\] -->/);
    if (match) {
      try {
        return JSON.parse(`[${match[1]}]`);
      } catch {
        return [];
      }
    }
    const buyerMatch = content.match(/<!-- BUYER_HIGHLIGHT: \[(.*?)\] -->/);
    if (buyerMatch) {
      try {
        return JSON.parse(`[${buyerMatch[1]}]`);
      } catch {
        return [];
      }
    }
    return [];
  }, []);

  // Clean content of hidden markers
  const cleanContent = useCallback((content: string): string => {
    return content
      .replace(/<!-- HIGHLIGHT:.*?-->/g, '')
      .replace(/<!-- BUYER_HIGHLIGHT:.*?-->/g, '')
      .trim();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    // Track analytics: mark user continued if there are prior messages
    if (conversationId && messages.length > 0) {
      markUserContinued(conversationId, messages.length - 1).catch(() => {});
    }

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    const startTime = Date.now();

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Streaming timeout — abort if no data for STREAM_TIMEOUT_MS
    let streamTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const resetStreamTimeout = () => {
      if (streamTimeoutId) clearTimeout(streamTimeoutId);
      streamTimeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, STREAM_TIMEOUT_MS);
    };

    try {
      const { data: sessionData, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!sessionData.session) {
        throw new Error('You must be logged in to use chat');
      }

      // Build request body based on context
      const requestBody: Record<string, unknown> = {
        query: userMessage.content,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        contextType: context.type,
      };

      // Add context-specific params
      if (context.type === 'deal') {
        requestBody.listingId = context.dealId;
      } else if (context.type === 'universe') {
        requestBody.universeId = context.universeId;
      }

      resetStreamTimeout(); // Start the timeout clock

      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-remarketing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (response.status === 429) {
        throw new Error('Rate limits exceeded. Please wait a moment and try again.');
      }
      if (response.status === 402) {
        throw new Error('AI credits depleted. Please add credits in Settings → Workspace → Usage.');
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let parserState: SSEParserState = { buffer: '', done: false };

      const sseCallbacks = {
        onContent: (content: string) => {
          fullContent += content;
          setStreamingContent(cleanContent(fullContent));
        },
        onDone: () => {},
      };

      while (!parserState.done) {
        const { done, value } = await reader.read();
        if (done) break;

        resetStreamTimeout(); // Reset timeout on each chunk
        const chunk = decoder.decode(value, { stream: true });
        parserState = processSSEChunk(chunk, parserState, sseCallbacks);
      }

      // Release the reader to avoid hanging connections
      reader.cancel().catch(() => {});

      // Final flush — process any remaining buffered content
      flushSSEBuffer(parserState.buffer, sseCallbacks);

      // Extract item IDs and notify parent
      const itemIds = extractItemIds(fullContent);
      if (itemIds.length > 0 && onHighlightItems) {
        onHighlightItems(itemIds);
      }

      const responseTimeMs = Date.now() - startTime;
      const cleanedContent = cleanContent(fullContent);

      // Add assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: cleanedContent,
        timestamp: new Date(),
      };
      setMessages((prev) => {
        const updatedMessages = [...prev, assistantMessage];

        // Save conversation to database
        saveConversation(
          updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
          })),
        )
          .then((result) => {
            // Log analytics after save so we have a conversationId
            const cId = result?.conversationId || conversationId;
            if (cId) {
              logChatAnalytics({
                conversationId: cId,
                queryText: userMessage.content,
                responseText: cleanedContent,
                responseTimeMs,
                contextType: context.type,
                dealId: context.type === 'deal' ? context.dealId : undefined,
                universeId: context.type === 'universe' ? context.universeId : undefined,
              }).catch((err) => console.error('[ReMarketingChat] Analytics error:', err));
            }
          })
          .catch((err) => console.error('[ReMarketingChat] Save error:', err));

        // Generate smart suggestions
        const suggestions = generateSmartSuggestions(
          updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          {
            type: context.type,
            dealId: context.type === 'deal' ? context.dealId : undefined,
            universeId: context.type === 'universe' ? context.universeId : undefined,
          },
        );
        setSmartSuggestions(suggestions);

        // Proactive recommendations every 3 exchanges
        if (updatedMessages.length % 6 === 0) {
          const recs = generateProactiveRecommendations(
            updatedMessages.map((m) => ({ role: m.role, content: m.content })),
            { type: context.type },
          );
          if (recs.length > 0) setActiveRecommendation(recs[0]);
        }

        return updatedMessages;
      });
      setStreamingContent('');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Check if this was a timeout-triggered abort
        if (streamTimeoutId) {
          const timeoutMessage: Message = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content:
              'The response timed out after 60 seconds. Please try a simpler question or try again.',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, timeoutMessage]);
          setStreamingContent('');
        }
        return;
      }
      // Chat error — display message to user below
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setStreamingContent('');
    } finally {
      if (streamTimeoutId) clearTimeout(streamTimeoutId);
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    inputRef.current?.focus();
  };

  const clearConversation = () => {
    setMessages([]);
    setStreamingContent('');
    startNewConversation();
  };

  // Floating chat bubble (closed state)
  if (!isOpen) {
    return (
      <div className={cn('fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2', className)}>
        <div className="bg-foreground text-background rounded-xl px-4 py-2 text-sm font-medium shadow-lg animate-fade-in max-w-[200px] text-center">
          Ask me anything
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="rounded-full h-14 w-14 shadow-2xl hover:scale-110 transition-transform bg-primary hover:bg-primary/90"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div className={cn('fixed bottom-8 right-8 z-50', className)}>
        <Button onClick={() => setIsMinimized(false)} className="gap-2 shadow-lg rounded-full px-4">
          <MessageSquare className="h-4 w-4" />
          {getChatTitle(context)}
          {messages.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {messages.length}
            </Badge>
          )}
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Full chat panel
  const panelStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: position.x,
        top: position.y,
        bottom: 'auto',
        right: 'auto',
        zIndex: 50,
      }
    : {};

  return (
    <div
      ref={panelRef}
      className={cn(
        position
          ? 'w-[624px] max-w-[calc(100vw-64px)]'
          : 'fixed bottom-8 right-8 z-50 w-[624px] max-w-[calc(100vw-64px)]',
        className,
      )}
      style={panelStyle}
    >
      <Card
        className="flex flex-col h-[845px] max-h-[85vh] shadow-2xl border-2 border-primary/30"
        style={{ backgroundColor: 'hsl(48, 70%, 95%)' }}
      >
        <CardHeader className="py-3 px-4 border-b border-primary/20 flex-shrink-0 bg-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <div
                onPointerDown={onDragStart}
                className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-primary/10 touch-none select-none"
                title="Drag to move"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-lg flex items-center gap-2 truncate">
                <Sparkles className="h-4 w-4 text-primary" />
                {getChatTitle(context)}
                {getSubtitle(context) && (
                  <span className="text-sm text-muted-foreground font-normal truncate max-w-[200px]">
                    · {getSubtitle(context)}
                  </span>
                )}
                {isSaving && <span className="text-xs text-muted-foreground">(saving...)</span>}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={clearConversation}
                  title="Clear conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <ScrollArea
          ref={scrollRef}
          className="flex-1 p-4"
          style={{ backgroundColor: 'hsl(48, 70%, 95%)' }}
        >
          {/* Proactive recommendation */}
          {activeRecommendation && (
            <ProactiveRecommendation
              recommendation={activeRecommendation}
              onAccept={(query) => {
                if (query) {
                  setInput(query);
                  setTimeout(() => inputRef.current?.focus(), 100);
                }
                setActiveRecommendation(null);
              }}
              onDismiss={() => setActiveRecommendation(null)}
              className="mb-4"
            />
          )}

          {messages.length === 0 && !streamingContent ? (
            <div className="space-y-4">
              <div className="text-center py-6">
                <Sparkles className="h-10 w-10 mx-auto text-primary/50 mb-3" />
                <p className="text-base font-medium">How can I help?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ask me anything about your {context.type === 'deal' ? 'buyers' : context.type}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground px-1">Try asking:</p>
                {exampleQueries.map((example) => (
                  <Button
                    key={example}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-sm h-auto py-2.5 px-3"
                    onClick={() => handleExampleClick(example)}
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex flex-col',
                    message.role === 'user' ? 'items-end' : 'items-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[90%] rounded-lg px-3 py-2',
                      message.role === 'user'
                        ? 'bg-foreground text-background'
                        : 'bg-background border border-primary/20',
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="text-base prose prose-base dark:prose-invert max-w-none prose-a:text-foreground prose-a:underline prose-strong:text-foreground">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-base">{message.content}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground mt-1 px-1">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {message.role === 'assistant' && conversationId && (
                      <ChatFeedbackButtons
                        conversationId={conversationId}
                        messageIndex={messages.indexOf(message)}
                        messageContent={message.content}
                        className="mt-1"
                      />
                    )}
                  </div>
                </div>
              ))}

              {/* Smart suggestions after last message */}
              {smartSuggestions.length > 0 && !isLoading && !streamingContent && (
                <SmartSuggestions
                  suggestions={smartSuggestions}
                  onSelectSuggestion={(text) => {
                    setInput(text);
                    inputRef.current?.focus();
                    setSmartSuggestions([]);
                  }}
                  className="mt-3"
                />
              )}

              {/* Streaming content */}
              {streamingContent && (
                <div className="flex flex-col items-start">
                  <div className="max-w-[90%] rounded-lg px-3 py-2 bg-background border border-primary/20">
                    <div className="text-base prose prose-base dark:prose-invert max-w-none prose-a:text-foreground prose-a:underline prose-strong:text-foreground">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && !streamingContent && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div
          className="p-3 border-t border-primary/20 flex-shrink-0"
          style={{ backgroundColor: 'hsl(48, 70%, 95%)' }}
        >
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={getPlaceholder(context)}
              className="text-base"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

export default ReMarketingChat;
