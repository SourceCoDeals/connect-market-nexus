import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Send } from "lucide-react";
import {
  useConnectionMessages,
  useSendMessage,
  useMarkMessagesReadByBuyer,
} from "@/hooks/use-connection-messages";
import { formatDistanceToNow } from "date-fns";

interface DealMessagesTabProps {
  requestId: string;
  requestStatus: "pending" | "approved" | "rejected" | "on_hold";
}

export function DealMessagesTab({ requestId, requestStatus }: DealMessagesTabProps) {
  const { data: messages = [], isLoading: messagesLoading } = useConnectionMessages(requestId);
  const sendMsg = useSendMessage();
  const markRead = useMarkMessagesReadByBuyer();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canSend = requestStatus !== "rejected";
  const isRejected = requestStatus === "rejected";

  // Mark messages as read when viewing
  useEffect(() => {
    if (requestId && messages.some(m => !m.is_read_by_buyer && m.sender_role === "admin")) {
      markRead.mutate(requestId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim() || !canSend) return;
    sendMsg.mutate(
      {
        connection_request_id: requestId,
        body: newMessage.trim(),
        sender_role: "buyer",
      },
      {
        onError: () => {
          // Restore the message if send failed so user can retry
          setNewMessage(newMessage.trim());
        },
      }
    );
    setNewMessage("");
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border/50 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Messages</h3>
        {messages.filter(m => m.message_type === "message").length > 0 && (
          <span className="text-xs text-muted-foreground">
            {messages.filter(m => m.message_type === "message").length}
          </span>
        )}
      </div>

      {/* Rejected banner */}
      {isRejected && (
        <div className="px-5 py-2.5 bg-muted/50 border-b border-border/50">
          <p className="text-xs text-muted-foreground">
            This deal is no longer active. Message history is available below.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="min-h-[300px] max-h-[500px] overflow-y-auto px-5 py-4 space-y-3 flex-1">
        {messagesLoading ? (
          <div className="space-y-3 py-4">
            <div className="flex justify-start"><Skeleton className="h-10 w-48 rounded-xl" /></div>
            <div className="flex justify-end"><Skeleton className="h-10 w-40 rounded-xl" /></div>
            <div className="flex justify-start"><Skeleton className="h-10 w-56 rounded-xl" /></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <p className="text-sm text-muted-foreground text-center">
              {canSend
                ? "No messages yet. Send a message to the SourceCo team below."
                : "No messages in this conversation."}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.message_type === "decision" || msg.message_type === "system"
                  ? "justify-center"
                  : msg.sender_role === "buyer"
                    ? "justify-end"
                    : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-3.5 py-2 ${
                  msg.message_type === "decision" || msg.message_type === "system"
                    ? "bg-muted italic text-sm"
                    : msg.sender_role === "buyer"
                      ? "bg-primary text-primary-foreground text-base"
                      : "border border-border/40 text-base"
                }`}
                style={
                  msg.message_type === "decision" || msg.message_type === "system"
                    ? { color: '#3a3a3a' }
                    : msg.sender_role !== "buyer"
                      ? { backgroundColor: 'rgba(0,0,0,0.04)', color: '#0E101A' }
                      : undefined
                }
              >
                {msg.message_type !== "system" && msg.message_type !== "decision" && (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-medium text-xs">
                      {msg.sender_role === "buyer"
                        ? "You"
                        : msg.sender?.first_name || "SourceCo"}
                    </span>
                    <span className="opacity-40 text-[10px]">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </span>
                  </div>
                )}
                <p className="leading-relaxed whitespace-pre-wrap" style={{ color: msg.sender_role === "buyer" ? undefined : '#0E101A' }}>{msg.body}</p>
                {(msg.message_type === "system" || msg.message_type === "decision") && (
                  <span className="opacity-50 text-[10px] block mt-0.5">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-border/50">
        {canSend ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message SourceCo about this deal..."
              className="flex-1 text-sm border border-border rounded-lg px-3.5 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMsg.isPending}
              className="px-3.5"
              size="sm"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-1">
            This deal is no longer active.
          </p>
        )}
      </div>
    </div>
  );
}
