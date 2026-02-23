/**
 * AI Command Center Panel
 * Floating chat panel with streaming, tool status, UI actions, and confirmations.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles, Send, Loader2, X, Minimize2, Trash2,
  ChevronUp, Bot, User, Wrench,
  CheckCircle, XCircle, MousePointerClick, Square,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import {
  useAICommandCenter,
  type PageContext,
  type AIMessage,
  type ToolCallInfo,
  type UIActionPayload,
} from '@/hooks/useAICommandCenter';

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

export function AICommandCenterPanel({ pageContext, onUIAction, className }: AICommandCenterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages, isLoading, streamingContent, currentPhase,
    routeInfo, activeTools, error,
    sendMessage, confirmAction, denyAction, clearMessages, stopStreaming,
    onUIAction: registerUIAction,
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

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  }, [input, isLoading, sendMessage]);

  const handleSuggestion = useCallback((text: string) => {
    setInput('');
    sendMessage(text);
  }, [sendMessage]);

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
      <Card className="w-[640px] max-w-[calc(100vw-64px)] h-[800px] max-h-[85vh] flex flex-col shadow-2xl border-[#DEC76B]/30">
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
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={clearMessages}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={() => setIsMinimized(true)}>
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {pageContext?.page && (
            <p className="text-xs text-white/60 mt-1">
              Context: {pageContext.page}{pageContext.entity_id ? ` (${pageContext.entity_type} ${pageContext.entity_id.substring(0, 8)}...)` : ''}
            </p>
          )}
        </CardHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {/* Empty state */}
            {messages.length === 0 && !isLoading && (
              <EmptyState suggestions={getSuggestions(pageContext?.page)} onSuggestion={handleSuggestion} />
            )}

            {/* Message list */}
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} onConfirm={confirmAction} onDeny={denyAction} />
            ))}

            {/* Streaming content */}
            {isLoading && (
              <StreamingIndicator
                content={streamingContent}
                phase={currentPhase}
                tools={activeTools}
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
        <div className="p-3 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about deals, buyers, pipeline..."
              disabled={isLoading}
              className="flex-1"
            />
            {isLoading ? (
              <Button type="button" variant="outline" size="icon" onClick={stopStreaming}>
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={!input.trim()} size="icon" className="bg-[#0E101A] hover:bg-[#000000] text-[#DEC76B]">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </form>
        </div>
      </Card>
    </div>
  );
}

// ---------- Sub-components ----------

function EmptyState({ suggestions, onSuggestion }: { suggestions: string[]; onSuggestion: (text: string) => void }) {
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
}: {
  message: AIMessage;
  onConfirm: () => void;
  onDeny: () => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#F7F4DD] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-[#DEC76B]" />
        </div>
      )}

      <div className={cn(
        'max-w-[85%] rounded-lg px-3 py-2',
        isUser
          ? 'bg-[#0E101A] text-[#FCF9F0]'
          : 'bg-[#FCF9F0] text-[#0E101A]',
      )}>
        {/* Tool call indicators */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {message.toolCalls.map(tool => (
              <ToolBadge key={tool.id} tool={tool} />
            ))}
          </div>
        )}

        {/* UI action indicators */}
        {message.uiActions && message.uiActions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {message.uiActions.map((action, i) => (
              <Badge key={i} variant="outline" className="text-xs gap-1 border-blue-300 text-blue-700">
                <MousePointerClick className="h-3 w-3" />
                {action.type === 'select_rows' ? 'Selected rows' :
                 action.type === 'apply_filter' ? 'Applied filter' :
                 action.type === 'navigate' ? 'Navigated' : action.type}
              </Badge>
            ))}
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <div className={cn('text-base prose prose-base max-w-none', isUser ? 'prose-invert' : '[&_*]:text-[#0E101A]')}>
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

        {/* Timestamp */}
        <p className={cn('text-[10px] mt-1', isUser ? 'text-white/60' : 'text-muted-foreground')}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {message.metadata?.cost != null && (
            <span className="ml-2">${message.metadata.cost.toFixed(4)}</span>
          )}
        </p>
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
  const statusIcon = tool.status === 'running'
    ? <Loader2 className="h-3 w-3 animate-spin" />
    : tool.status === 'success'
    ? <CheckCircle className="h-3 w-3" />
    : <XCircle className="h-3 w-3" />;

  const statusClass = tool.status === 'running'
    ? 'border-blue-300 text-blue-700'
    : tool.status === 'success'
    ? 'border-green-300 text-green-700'
    : 'border-red-300 text-red-700';

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
  const phaseLabel = phase === 'routing' ? 'Classifying intent...'
    : phase === 'processing' ? 'Thinking...'
    : phase === 'executing_confirmed_action' ? 'Executing action...'
    : 'Processing...';

  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-full bg-[#F7F4DD] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="h-4 w-4 text-[#DEC76B]" />
      </div>
      <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted">
        {/* Active tools */}
        {tools.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tools.map(tool => (
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

export default AICommandCenterPanel;
