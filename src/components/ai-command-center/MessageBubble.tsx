/**
 * MessageBubble.tsx
 *
 * Renders a single message in the AI Command Center chat, including
 * user/assistant bubbles, tool-call badges, UI-action indicators,
 * confirmation prompts, feedback buttons, and streaming state.
 *
 * Extracted from AICommandCenterPanel.tsx
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Bot,
  User,
  Wrench,
  CheckCircle,
  XCircle,
  MousePointerClick,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { AIMessage, ToolCallInfo } from '@/hooks/useAICommandCenter';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ---------- ToolBadge ----------

export function ToolBadge({ tool }: { tool: ToolCallInfo }) {
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

// ---------- StreamingIndicator ----------

export function StreamingIndicator({
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

// ---------- MessageBubble ----------

interface MessageBubbleProps {
  message: AIMessage;
  onConfirm: () => void;
  onDeny: () => void;
  userQuery?: string;
}

export function MessageBubble({ message, onConfirm, onDeny, userQuery }: MessageBubbleProps) {
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
      toast.success(rating > 0 ? 'Thanks for the feedback!' : "Thanks \u2014 we'll improve this.");
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
                  {feedbackGiven > 0 ? '\uD83D\uDC4D' : '\uD83D\uDC4E'}
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
