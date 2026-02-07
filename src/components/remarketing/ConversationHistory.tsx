/**
 * Conversation History Sidebar
 *
 * Displays list of saved conversations for a given context (universe, deal, etc.)
 * Allows users to resume previous conversations or start new ones.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Trash2,
  Clock,
  Plus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadConversationsByContext,
  archiveConversation,
  type Conversation,
  type ConversationContext,
} from "@/integrations/supabase/chat-persistence";
import { formatDistanceToNow } from "date-fns";

interface ConversationHistoryProps {
  context: ConversationContext;
  currentConversationId?: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onNewConversation: () => void;
  className?: string;
}

export function ConversationHistory({
  context,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  className,
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load conversations for this context
  useEffect(() => {
    loadConversations();
  }, [context.type, context.dealId, context.universeId]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const { success, conversations: data } = await loadConversationsByContext(
        context,
        20 // Load up to 20 recent conversations
      );

      if (success && data) {
        setConversations(data);
      }
    } catch (error) {
      console.error('[ConversationHistory] Load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the conversation

    if (!confirm('Delete this conversation? This cannot be undone.')) {
      return;
    }

    setDeletingId(id);
    try {
      const { success } = await archiveConversation(id);
      if (success) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (error) {
      console.error('[ConversationHistory] Delete error:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const getContextLabel = () => {
    switch (context.type) {
      case 'deal':
        return 'Deal Conversations';
      case 'universe':
        return 'Universe Conversations';
      case 'buyers':
        return 'Buyer Conversations';
      case 'deals':
        return 'Deal Pipeline Conversations';
      default:
        return 'Conversations';
    }
  };

  return (
    <div className={cn("flex flex-col h-full border-r bg-muted/10", className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{getContextLabel()}</h3>
          <Badge variant="secondary" className="text-xs">
            {conversations.length}
          </Badge>
        </div>
        <Button
          onClick={onNewConversation}
          size="sm"
          className="w-full"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Conversation
        </Button>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No conversations yet</p>
            <p className="text-xs mt-1">
              Start a new conversation to see it here
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation)}
                className={cn(
                  "w-full text-left p-3 rounded-lg transition-colors",
                  "hover:bg-accent",
                  currentConversationId === conversation.id
                    ? "bg-accent border border-accent-foreground/20"
                    : "border border-transparent"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {conversation.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        <span>{conversation.message_count}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(conversation.updated_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => handleDelete(conversation.id, e)}
                    disabled={deletingId === conversation.id}
                  >
                    {deletingId === conversation.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {conversations.length > 0 && (
        <div className="p-3 border-t text-xs text-muted-foreground text-center">
          Conversations are saved automatically
        </div>
      )}
    </div>
  );
}
