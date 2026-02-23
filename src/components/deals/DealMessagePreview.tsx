import { MessageSquare, ArrowRight, Lock } from "lucide-react";
import { useConnectionMessages } from "@/hooks/use-connection-messages";
import { formatDistanceToNow } from "date-fns";

interface DealMessagePreviewProps {
  requestId: string;
  requestStatus: "pending" | "approved" | "rejected" | "on_hold";
  onViewAll: () => void;
}

export function DealMessagePreview({ requestId, requestStatus, onViewAll }: DealMessagePreviewProps) {
  const { data: messages = [] } = useConnectionMessages(requestId);

  const isPending = requestStatus === "pending";

  // Filter to actual messages (not system/decision), take last 3
  const recentMessages = messages
    .filter(m => m.message_type === "message")
    .slice(-3);

  // Pending state
  if (isPending) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/50 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Messages</h3>
        </div>
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="rounded-full bg-muted p-2 shrink-0">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            Messaging will be available once your request is accepted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Messages</h3>
          {messages.filter(m => m.message_type === "message").length > 0 && (
            <span className="text-xs text-muted-foreground">
              {messages.filter(m => m.message_type === "message").length}
            </span>
          )}
        </div>
        {recentMessages.length > 0 && (
          <button
            onClick={onViewAll}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Preview messages */}
      <div className="px-5 py-3 space-y-2.5">
        {recentMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No messages yet. Start a conversation from the Messages tab.
          </p>
        ) : (
          recentMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender_role === "buyer" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs ${
                  msg.sender_role === "buyer"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-foreground border border-border/40"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-medium opacity-80">
                    {msg.sender_role === "buyer"
                      ? "You"
                      : msg.sender?.first_name || "SourceCo"}
                  </span>
                  <span className="opacity-40 text-[9px]">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="leading-relaxed line-clamp-2">{msg.body}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer CTA */}
      {recentMessages.length > 0 && (
        <div className="px-5 py-2.5 border-t border-border/50">
          <button
            onClick={onViewAll}
            className="w-full text-xs text-muted-foreground hover:text-foreground font-medium py-1 transition-colors"
          >
            Open full conversation
          </button>
        </div>
      )}
    </div>
  );
}
