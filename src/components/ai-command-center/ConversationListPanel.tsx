/**
 * ConversationListPanel.tsx
 *
 * Conversation history sidebar for the AI Command Center.
 * Shows a scrollable list of past conversations with selection,
 * deletion, and "new chat" actions.
 *
 * Extracted from AICommandCenterPanel.tsx
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, ChevronLeft, MessageSquare, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/hooks/useAICommandCenter';

// ---------- Panel ----------

interface ConversationListPanelProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  onSelect: (conversation: Conversation) => void;
  onNewConversation: () => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export function ConversationListPanel({
  conversations,
  activeConversationId,
  isLoading,
  onSelect,
  onNewConversation,
  onDelete,
  onBack,
}: ConversationListPanelProps) {
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

// ---------- Item ----------

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
