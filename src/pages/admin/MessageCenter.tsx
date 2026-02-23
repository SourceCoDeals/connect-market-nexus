import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Inbox,
  Search,
  User,
  Users,
} from "lucide-react";
import {
  useMessageCenterThreads,
  useConnectionMessages,
  useSendMessage,
  useMarkMessagesReadByAdmin,
  type MessageThread,
} from "@/hooks/use-connection-messages";
import { useAuth } from "@/context/AuthContext";
import { formatDistanceToNow } from "date-fns";

type ThreadFilter = "my_deals" | "all";

export default function MessageCenter() {
  const { data: threads = [], isLoading } = useMessageCenterThreads();
  const { user } = useAuth();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>("my_deals");

  const selectedThread = threads.find(
    (t) => t.connection_request_id === selectedThreadId
  );

  // Determine if the current admin owns any deals
  const myDealThreads = useMemo(
    () => threads.filter((t) => t.deal_owner_id === user?.id),
    [threads, user?.id]
  );

  // Auto-switch to "all" if admin doesn't own any deals
  useEffect(() => {
    if (!isLoading && myDealThreads.length === 0 && threads.length > 0) {
      setThreadFilter("all");
    }
  }, [isLoading, myDealThreads.length, threads.length]);

  // Apply filter and search
  const filteredThreads = useMemo(() => {
    let result = threads;

    // Apply tab filter
    if (threadFilter === "my_deals") {
      result = result.filter((t) => t.deal_owner_id === user?.id);
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.buyer_name.toLowerCase().includes(q) ||
          (t.deal_title || "").toLowerCase().includes(q) ||
          (t.buyer_company || "").toLowerCase().includes(q)
      );
    }

    // Sort: unread first, then by last message time
    return result.sort((a, b) => {
      if (a.unread_count > 0 && b.unread_count === 0) return -1;
      if (a.unread_count === 0 && b.unread_count > 0) return 1;
      return (
        new Date(b.last_message_at).getTime() -
        new Date(a.last_message_at).getTime()
      );
    });
  }, [threads, threadFilter, searchQuery, user?.id]);

  // Count unread for each tab
  const myDealsUnread = useMemo(
    () => myDealThreads.reduce((sum, t) => sum + t.unread_count, 0),
    [myDealThreads]
  );
  const allUnread = useMemo(
    () => threads.reduce((sum, t) => sum + t.unread_count, 0),
    [threads]
  );

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Message Center</h1>
          <p className="text-muted-foreground mt-1">
            Manage conversations with marketplace buyers
          </p>
        </div>
      </div>

      {isLoading ? (
        <MessageCenterSkeleton />
      ) : threads.length === 0 ? (
        <MessageCenterEmpty />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden bg-card min-h-[600px]">
          {/* Thread List (left panel) */}
          <div
            className={`md:col-span-1 border-r border-border overflow-y-auto ${
              selectedThreadId ? "hidden md:block" : ""
            }`}
          >
            {/* Tab Filter */}
            <div className="flex border-b border-border">
              <TabButton
                active={threadFilter === "my_deals"}
                onClick={() => setThreadFilter("my_deals")}
                icon={<User className="h-3.5 w-3.5" />}
                label="My Deals"
                count={myDealsUnread}
              />
              <TabButton
                active={threadFilter === "all"}
                onClick={() => setThreadFilter("all")}
                icon={<Users className="h-3.5 w-3.5" />}
                label="All"
                count={allUnread}
              />
            </div>

            {/* Search */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full text-xs border border-border/50 rounded-md pl-8 pr-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Thread items */}
            <div className="divide-y divide-border">
              {filteredThreads.map((thread) => (
                <ThreadListItem
                  key={thread.connection_request_id}
                  thread={thread}
                  isSelected={
                    selectedThreadId === thread.connection_request_id
                  }
                  isOwnDeal={thread.deal_owner_id === user?.id}
                  onClick={() =>
                    setSelectedThreadId(thread.connection_request_id)
                  }
                />
              ))}
              {filteredThreads.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  {searchQuery
                    ? "No conversations match your search."
                    : threadFilter === "my_deals"
                      ? "No conversations on your deals yet."
                      : "No conversations yet."}
                </div>
              )}
            </div>
          </div>

          {/* Thread View (right panel) */}
          <div
            className={`md:col-span-2 flex flex-col ${
              !selectedThreadId ? "hidden md:flex" : ""
            }`}
          >
            {selectedThreadId && selectedThread ? (
              <ThreadView
                thread={selectedThread}
                onBack={() => setSelectedThreadId(null)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    Select a conversation to view messages
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Button ───

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
        active
          ? "border-b-2 border-primary text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
      }`}
    >
      {icon}
      {label}
      {count > 0 && (
        <Badge
          variant="default"
          className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] flex items-center justify-center"
        >
          {count}
        </Badge>
      )}
    </button>
  );
}

// ─── Thread List Item ───

function ThreadListItem({
  thread,
  isSelected,
  isOwnDeal,
  onClick,
}: {
  thread: MessageThread;
  isSelected: boolean;
  isOwnDeal: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 hover:bg-accent/50 transition-colors ${
        isSelected ? "bg-accent" : ""
      } ${thread.unread_count > 0 ? "bg-primary/5" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {thread.buyer_name}
            </span>
            {thread.unread_count > 0 && (
              <Badge
                variant="default"
                className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] flex items-center justify-center"
              >
                {thread.unread_count}
              </Badge>
            )}
          </div>
          {thread.buyer_company && (
            <p className="text-xs text-muted-foreground truncate">
              {thread.buyer_company}
            </p>
          )}
          {thread.deal_title && (
            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
              {thread.deal_title}
              {isOwnDeal && (
                <span className="ml-1 text-primary/60">(yours)</span>
              )}
            </p>
          )}
          <p
            className={`text-xs mt-1 truncate ${
              thread.unread_count > 0
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {thread.last_sender_role === "admin" && "You: "}
            {thread.last_message_body}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(thread.last_message_at), {
              addSuffix: true,
            })}
          </span>
          <StatusDot status={thread.request_status} />
        </div>
      </div>
    </button>
  );
}

// ─── Status Dot ───

function StatusDot({ status }: { status: string }) {
  const color =
    status === "approved"
      ? "bg-emerald-500"
      : status === "rejected"
        ? "bg-destructive"
        : status === "on_hold"
          ? "bg-amber-500"
          : "bg-muted-foreground/40";

  return <div className={`w-2 h-2 rounded-full ${color}`} title={status} />;
}

// ─── Thread View ───

function ThreadView({
  thread,
  onBack,
}: {
  thread: MessageThread;
  onBack: () => void;
}) {
  const { data: messages = [], isLoading } = useConnectionMessages(
    thread.connection_request_id
  );
  const sendMsg = useSendMessage();
  const markRead = useMarkMessagesReadByAdmin();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mark messages as read when viewing
  useEffect(() => {
    if (thread.connection_request_id && thread.unread_count > 0) {
      markRead.mutate(thread.connection_request_id);
    }
  }, [thread.connection_request_id, thread.unread_count, markRead]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMsg.mutate({
      connection_request_id: thread.connection_request_id,
      body: newMessage.trim(),
      sender_role: "admin",
    });
    setNewMessage("");
  };

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-background/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="md:hidden h-8 w-8 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold truncate">
              {thread.buyer_name}
            </h2>
            <StatusDot status={thread.request_status} />
            <span className="text-xs text-muted-foreground capitalize">
              {thread.request_status === "on_hold"
                ? "On Hold"
                : thread.request_status}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {thread.buyer_company && <span>{thread.buyer_company}</span>}
            {thread.buyer_company && thread.deal_title && <span>·</span>}
            {thread.deal_title && <span>{thread.deal_title}</span>}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-3/4" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.message_type === "decision" || msg.message_type === "system"
                  ? "justify-center"
                  : msg.sender_role === "admin"
                    ? "justify-end"
                    : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2.5 text-sm ${
                  msg.message_type === "decision" ||
                  msg.message_type === "system"
                    ? "bg-muted/50 text-muted-foreground italic text-xs"
                    : msg.sender_role === "admin"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-foreground"
                }`}
              >
                {msg.message_type !== "system" &&
                  msg.message_type !== "decision" && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-xs">
                        {msg.sender_role === "admin"
                          ? "You"
                          : msg.sender?.first_name || "Buyer"}
                      </span>
                      <span className="opacity-60 text-[10px]">
                        {formatDistanceToNow(new Date(msg.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  )}
                <p className="leading-relaxed whitespace-pre-wrap">
                  {msg.body}
                </p>
                {(msg.message_type === "system" ||
                  msg.message_type === "decision") && (
                  <span className="opacity-50 text-[10px] block mt-0.5">
                    {formatDistanceToNow(new Date(msg.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 bg-background/50">
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
            placeholder="Type a message..."
            className="flex-1 text-sm border border-border/50 rounded-md px-4 py-2.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMsg.isPending}
            className="px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading / Empty States ───

function MessageCenterSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-3 w-[300px]" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MessageCenterEmpty() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-muted-foreground mb-2">
          No conversations yet
        </h3>
        <p className="text-sm text-muted-foreground">
          Messages will appear here when buyers start conversations on
          connection requests.
        </p>
      </CardContent>
    </Card>
  );
}
