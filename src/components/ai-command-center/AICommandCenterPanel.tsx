/**
 * AI Command Center Panel
 * Floating chat panel with streaming, tool status, UI actions, and confirmations.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Send,
  Loader2,
  X,
  Minimize2,
  Trash2,
  ChevronUp,
  Bot,
  User,
  Wrench,
  CheckCircle,
  XCircle,
  MousePointerClick,
  Square,
  ThumbsUp,
  ThumbsDown,
  History,
  Plus,
  ChevronLeft,
  MessageSquare,
  Archive,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import {
  useAICommandCenter,
  type PageContext,
  type AIMessage,
  type ToolCallInfo,
  type UIActionPayload,
  type Conversation,
} from '@/hooks/useAICommandCenter';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ---------- Props ----------

interface AICommandCenterPanelProps {
  pageContext?: PageContext;
  onUIAction?: (action: UIActionPayload) => void;
  className?: string;
}

// ---------- Smart suggestions per context ----------

function getSuggestions(page?: string): string[] {
  switch (page) {
    case 'deal_detail':
      return [
        'Give me a quick summary of this deal',
        'Who are the top buyers for this deal?',
        'What tasks are overdue?',
        'Prep me for my next meeting',
      ];
    case 'buyers_list':
    case 'remarketing':
      return [
        'Select all buyers in Texas',
        'Filter to PE firms with fee agreements',
        'Who are the most active acquirers?',
        'Show buyers targeting $5M+ revenue',
      ];
    case 'pipeline':
      return [
        'Give me a pipeline summary',
        'Which deals need attention?',
        'Show me CP Target deals',
        'What happened this week?',
      ];
    default:
      return [
        'Give me my daily briefing',
        'Show pipeline health',
        'What tasks do I have today?',
        'Find buyers in the Southeast',
      ];
  }
}

// ---------- Component ----------

export function AICommandCenterPanel({
  pageContext,
  onUIAction,
  className,
}: AICommandCenterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isLoading,
    streamingContent,
    currentPhase,
    routeInfo,
    activeTools,
    error,
    conversationHistory,
    activeConversationDbId,
    isLoadingHistory,
    sendMessage,
    confirmAction,
    denyAction,
    clearMessages,
    stopStreaming,
    onUIAction: registerUIAction,
    switchConversation,
    startNewConversation,
    deleteConversation,
    loadConversationHistory,
  } = useAICommandCenter(pageContext);

  // Register UI action handler
  useEffect(() => {
    if (onUIAction) {
      registerUIAction(onUIAction);
    }
  }, [onUIAction, registerUIAction]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, activeTools]);

  // Focus input when opened and refresh conversation history
  useEffect(() => {
    if (isOpen && !isMinimized) {
      if (inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      // Refresh conversation history whenever the panel is opened
      loadConversationHistory();
    }
  }, [isOpen, isMinimized, loadConversationHistory]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      sendMessage(input);
      setInput('');
      // Reset textarea height after send
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    },
    [input, isLoading, sendMessage],
  );

  // Auto-resize textarea as content changes
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  // Enter to send, Shift+Enter for newline
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        sendMessage(input);
        setInput('');
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
        }
      }
    },
    [input, isLoading, sendMessage],
  );

  const handleSuggestion = useCallback(
    (text: string) => {
      setInput('');
      sendMessage(text);
    },
    [sendMessage],
  );

  const handleSelectConversation = useCallback(
    (conversation: Conversation) => {
      switchConversation(conversation);
      setShowHistory(false);
    },
    [switchConversation],
  );

  const handleNewConversation = useCallback(() => {
    startNewConversation();
    setShowHistory(false);
  }, [startNewConversation]);

  // ---------- Floating bubble (closed) ----------
  if (!isOpen) {
    return (
      <div className={cn('fixed bottom-8 right-8 z-50', className)}>
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="rounded-full h-14 w-14 shadow-lg hover:scale-105 transition-transform bg-[#0E101A] hover:bg-[#000000] text-[#DEC76B]"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  // ---------- Minimized bar ----------
  if (isMinimized) {
    return (
      <div className={cn('fixed bottom-8 right-8 z-50', className)}>
        <Button
          onClick={() => setIsMinimized(false)}
          className="gap-2 shadow-lg rounded-full px-4 bg-[#0E101A] hover:bg-[#000000] text-[#DEC76B]"
        >
          <Sparkles className="h-4 w-4" />
          AI Command Center
          {messages.length > 0 && (
            <Badge variant="secondary" className="ml-1 bg-white/20 text-white">
              {messages.length}
            </Badge>
          )}
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ---------- Full panel ----------
  return (
    <div className={cn('fixed bottom-8 right-8 z-50', className)}>
      <Card
        className="w-[640px] max-w-[calc(100vw-64px)] h-[800px] max-h-[85vh] flex flex-col shadow-2xl border-[#DEC76B]/30"
        style={{ backgroundColor: '#FCF9F0' }}
      >
        {/* Header */}
        <CardHeader className="pb-3 bg-[#0E101A] text-[#FCF9F0] rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <CardTitle className="text-base font-semibold">AI Command Center</CardTitle>
              {routeInfo && (
                <Badge variant="outline" className="text-xs border-white/30 text-white/80">
                  {routeInfo.tier}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
                onClick={handleNewConversation}
                title="New conversation"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-7 w-7 hover:bg-white/10',
                  showHistory ? 'text-[#DEC76B]' : 'text-white/80 hover:text-white',
                )}
                onClick={() => {
                  const opening = !showHistory;
                  setShowHistory(opening);
                  if (opening) {
                    loadConversationHistory();
                  }
                }}
                title="Conversation history"
              >
                <History className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
                onClick={clearMessages}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {pageContext?.page && (
            <p className="text-xs text-white/60 mt-1">
              Context: {pageContext.page}
              {pageContext.entity_id
                ? ` (${pageContext.entity_type} ${pageContext.entity_id.substring(0, 8)}...)`
                : ''}
            </p>
          )}
        </CardHeader>

        {/* History Panel */}
        {showHistory ? (
          <ConversationHistoryPanel
            conversations={conversationHistory}
            activeConversationId={activeConversationDbId}
            isLoading={isLoadingHistory}
            onSelect={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onDelete={deleteConversation}
            onBack={() => setShowHistory(false)}
          />
        ) : (
          <>
            {/* Messages */}
            <ScrollArea
              className="flex-1 p-4"
              ref={scrollRef}
              style={{ backgroundColor: '#FCF9F0' }}
            >
              <div className="space-y-4">
                {/* Empty state */}
                {messages.length === 0 && !isLoading && (
                  <EmptyState
                    suggestions={getSuggestions(pageContext?.page)}
                    onSuggestion={handleSuggestion}
                  />
                )}

                {/* Message list */}
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onConfirm={confirmAction}
                    onDeny={denyAction}
                    userQuery={
                      msg.role === 'assistant' && idx > 0 ? messages[idx - 1]?.content : undefined
                    }
                  />
                ))}

                {/* Streaming content */}
                {isLoading && (
                  <StreamingIndicator
                    content={streamingContent}
                    phase={currentPhase}
                    tools={activeTools}
                  />
                )}

                {/* Follow-up suggestions after last assistant message */}
                {!isLoading &&
                  messages.length > 0 &&
                  messages[messages.length - 1]?.role === 'assistant' && (
                    <FollowUpSuggestions
                      category={messages[messages.length - 1]?.metadata?.category}
                      onSuggestion={handleSuggestion}
                    />
                  )}

                {/* Error */}
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                    {error}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div
              className="p-3 border-t border-[#DEC76B]/20"
              style={{ backgroundColor: '#FCF9F0' }}
            >
              <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about deals, buyers, pipeline..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 min-h-[40px] max-h-[160px] resize-none overflow-y-auto py-2.5"
                />
                {isLoading ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={stopStreaming}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={!input.trim()}
                    size="icon"
                    className="flex-shrink-0 bg-[#0E101A] hover:bg-[#000000] text-[#DEC76B]"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </form>
              <p className="text-[10px] text-muted-foreground mt-1 text-center">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ---------- Sub-components ----------

function EmptyState({
  suggestions,
  onSuggestion,
}: {
  suggestions: string[];
  onSuggestion: (text: string) => void;
}) {
  return (
    <div className="text-center py-8">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F7F4DD] mb-4">
        <Sparkles className="h-6 w-6 text-[#DEC76B]" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">AI Command Center</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Search any deal, buyer, or lead. Take actions. Get insights.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggestion(s)}
            className="text-sm px-3 py-1.5 rounded-full border border-[#DEC76B]/40 text-[#0E101A] hover:bg-[#F7F4DD] transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onConfirm,
  onDeny,
  userQuery,
}: {
  message: AIMessage;
  onConfirm: () => void;
  onDeny: () => void;
  userQuery?: string;
}) {
  const isUser = message.role === 'user';
  const [feedbackGiven, setFeedbackGiven] = React.useState<number | null>(null);

  const submitFeedback = async (rating: number) => {
    setFeedbackGiven(rating);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      await supabase.from('chat_feedback').insert({
        user_id: sessionData.session?.user?.id,
        query: userQuery || '',
        response: message.content?.substring(0, 2000) || '',
        rating,
        category: message.metadata?.category || null,
      } as never);
      toast.success(rating > 0 ? 'Thanks for the feedback!' : "Thanks — we'll improve this.");
    } catch {
      // Non-critical, don't block UX
    }
  };

  return (
    <div className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#F7F4DD] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-[#DEC76B]" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 border',
          isUser
            ? 'bg-[#F7F4DD] border-[#E5DDD0] text-[#0E101A]'
            : 'bg-[#FCF9F0] border-[#E5DDD0] text-[#0E101A]',
        )}
      >
        {/* Tool call indicators */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {message.toolCalls.map((tool) => (
              <ToolBadge key={tool.id} tool={tool} />
            ))}
          </div>
        )}

        {/* UI action indicators */}
        {message.uiActions && message.uiActions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {message.uiActions.map((action, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-xs gap-1 border-[#DEC76B]/50 text-[#0E101A]"
              >
                <MousePointerClick className="h-3 w-3" />
                {action.type === 'select_rows'
                  ? 'Selected rows'
                  : action.type === 'apply_filter'
                    ? 'Applied filter'
                    : action.type === 'sort_column'
                      ? 'Sorted column'
                      : action.type === 'navigate'
                        ? 'Navigated'
                        : action.type}
              </Badge>
            ))}
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <div className="text-base prose prose-base max-w-none [&_*]:text-[#0E101A] [&_a]:text-[#DEC76B]">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}

        {/* Confirmation prompt */}
        {message.pendingConfirmation && (
          <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200">
            <p className="text-xs font-medium text-amber-800 mb-2">
              Confirm action: {message.pendingConfirmation.description}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="default" className="h-7 text-xs" onClick={onConfirm}>
                <CheckCircle className="h-3 w-3 mr-1" /> Confirm
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onDeny}>
                <XCircle className="h-3 w-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Timestamp + Feedback */}
        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] text-muted-foreground">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {message.metadata?.cost != null && (
              <span className="ml-2">${message.metadata.cost.toFixed(4)}</span>
            )}
          </p>
          {/* Feedback buttons for assistant messages */}
          {!isUser && message.content && !message.pendingConfirmation && (
            <div className="flex items-center gap-1">
              {feedbackGiven === null ? (
                <>
                  <button
                    onClick={() => submitFeedback(1)}
                    className="p-0.5 rounded hover:bg-green-100 text-muted-foreground hover:text-green-600 transition-colors"
                    title="Good response"
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => submitFeedback(-1)}
                    className="p-0.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                    title="Poor response"
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  {feedbackGiven > 0 ? '👍' : '👎'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-[#0E101A] flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="h-4 w-4 text-[#DEC76B]" />
        </div>
      )}
    </div>
  );
}

function ToolBadge({ tool }: { tool: ToolCallInfo }) {
  const statusIcon =
    tool.status === 'running' ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : tool.status === 'success' ? (
      <CheckCircle className="h-3 w-3" />
    ) : (
      <XCircle className="h-3 w-3" />
    );

  const statusClass =
    tool.status === 'running'
      ? 'border-[#DEC76B]/50 text-[#0E101A]'
      : tool.status === 'success'
        ? 'border-green-400 text-green-800'
        : 'border-red-400 text-red-800';

  return (
    <Badge variant="outline" className={cn('text-xs gap-1', statusClass)}>
      <Wrench className="h-3 w-3" />
      {tool.name.replace(/_/g, ' ')}
      {statusIcon}
    </Badge>
  );
}

function StreamingIndicator({
  content,
  phase,
  tools,
}: {
  content: string;
  phase: string;
  tools: ToolCallInfo[];
}) {
  const phaseLabel =
    phase === 'routing'
      ? 'Classifying intent...'
      : phase === 'processing'
        ? 'Thinking...'
        : phase === 'executing_confirmed_action'
          ? 'Executing action...'
          : 'Processing...';

  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-full bg-[#F7F4DD] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="h-4 w-4 text-[#DEC76B]" />
      </div>
      <div className="max-w-[85%] rounded-lg px-3 py-2" style={{ backgroundColor: '#F7F4DD' }}>
        {/* Active tools */}
        {tools.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tools.map((tool) => (
              <ToolBadge key={tool.id} tool={tool} />
            ))}
          </div>
        )}

        {/* Streaming text */}
        {content ? (
          <div className="text-base prose prose-base max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {phaseLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationHistoryPanel({
  conversations,
  activeConversationId,
  isLoading,
  onSelect,
  onNewConversation,
  onDelete,
  onBack,
}: {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  onSelect: (conversation: Conversation) => void;
  onNewConversation: () => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: '#FCF9F0' }}>
      {/* History header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#DEC76B]/20">
        <button onClick={onBack} className="p-1 rounded hover:bg-[#F7F4DD] transition-colors">
          <ChevronLeft className="h-4 w-4 text-[#0E101A]" />
        </button>
        <h3 className="text-sm font-semibold text-[#0E101A] flex-1">Message History</h3>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 border-[#DEC76B]/40 hover:bg-[#F7F4DD]"
          onClick={onNewConversation}
        >
          <Plus className="h-3 w-3" />
          New Chat
        </Button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[#DEC76B]" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageSquare className="h-8 w-8 mx-auto mb-3 text-[#DEC76B]/50" />
            <p className="text-sm text-muted-foreground mb-1">No conversations yet</p>
            <p className="text-xs text-muted-foreground">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conversation) => (
              <ConversationHistoryItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeConversationId}
                onSelect={() => onSelect(conversation)}
                onDelete={() => onDelete(conversation.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ConversationHistoryItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = React.useState(false);

  const timeAgo = React.useMemo(() => {
    const date = new Date(conversation.updated_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }, [conversation.updated_at]);

  // Get a preview from the first user message
  const preview = React.useMemo(() => {
    const firstUser = conversation.messages?.find((m) => m.role === 'user');
    if (!firstUser) return 'Empty conversation';
    return firstUser.content.length > 80
      ? firstUser.content.substring(0, 80) + '...'
      : firstUser.content;
  }, [conversation.messages]);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      className={cn(
        'w-full text-left rounded-lg px-3 py-2.5 transition-colors relative group',
        isActive
          ? 'bg-[#F7F4DD] border border-[#DEC76B]/40'
          : 'hover:bg-[#F7F4DD]/50 border border-transparent',
      )}
    >
      <div className="flex items-start gap-2">
        <MessageSquare className="h-4 w-4 text-[#DEC76B] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-[#0E101A] truncate">
              {conversation.title || 'Untitled'}
            </p>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{preview}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">
              {conversation.message_count} message{conversation.message_count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
      {/* Delete button */}
      {showDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-2 right-2 p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
          title="Delete conversation"
        >
          <Archive className="h-3 w-3" />
        </button>
      )}
    </button>
  );
}

function FollowUpSuggestions({
  category,
  onSuggestion,
}: {
  category?: string;
  onSuggestion: (text: string) => void;
}) {
  const suggestions: Record<string, string[]> = {
    PIPELINE_ANALYTICS: [
      'Which deals need attention?',
      'Show deals by industry',
      'What changed this week?',
    ],
    DEAL_STATUS: [
      'Who are the top buyers for this deal?',
      'Show me the deal timeline',
      'Any overdue tasks?',
    ],
    BUYER_SEARCH: [
      'Score these buyers against our top deal',
      'Show engagement history',
      'Draft outreach to top matches',
    ],
    CONTACTS: [
      'Enrich missing contact emails',
      'Push contacts to dialer',
      'Find more contacts at this firm',
    ],
    MEETING_INTEL: [
      'Summarize key takeaways',
      'What action items came up?',
      'Search for pricing discussions',
    ],
    DAILY_BRIEFING: [
      'Show my overdue tasks',
      'Any new buyer engagement?',
      'Which deals went quiet?',
    ],
    ENGAGEMENT: [
      'Who viewed our data room?',
      'Show pass reasons this month',
      'Which buyers are most engaged?',
    ],
    OUTREACH_DRAFT: ['Refine the tone', 'Make it shorter', 'Add deal metrics to the draft'],
    FOLLOW_UP: ['Show stale deals', 'Create follow-up tasks', 'Who needs a call this week?'],
  };

  const items = suggestions[category || ''] || [
    'Show pipeline summary',
    'Find top buyers',
    'Give me my briefing',
  ];

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {items.map((s, i) => (
        <button
          key={i}
          onClick={() => onSuggestion(s)}
          className="text-xs px-2.5 py-1 rounded-full border border-[#DEC76B]/30 text-[#0E101A]/70 hover:bg-[#F7F4DD] hover:text-[#0E101A] transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export default AICommandCenterPanel;
