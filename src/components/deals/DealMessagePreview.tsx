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
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Messages</h3>
        </div>
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="rounded-full bg-slate-100 p-2 shrink-0">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="text-xs text-slate-500">
            Messaging will be available once your request is accepted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Messages</h3>
          {messages.filter(m => m.message_type === "message").length > 0 && (
            <span className="text-xs text-slate-400">
              {messages.filter(m => m.message_type === "message").length}
            </span>
          )}
        </div>
        {recentMessages.length > 0 && (
          <button
            onClick={onViewAll}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Preview messages */}
      <div className="px-5 py-3 space-y-2.5">
        {recentMessages.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
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
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-900"
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
        <div className="px-5 py-2.5 border-t border-slate-100">
          <button
            onClick={onViewAll}
            className="w-full text-xs text-slate-500 hover:text-slate-700 font-medium py-1 transition-colors"
          >
            Open full conversation
          </button>
        </div>
      )}
    </div>
  );
}
