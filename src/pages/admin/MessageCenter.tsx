import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Inbox,
  Search,
  Filter,
  Clock,
  CheckCheck,
  Circle,
  User,
  Building2,
  FileText,
  MailWarning,
  Archive,
} from "lucide-react";
import {
  useConnectionMessages,
  useSendMessage,
  useMarkMessagesReadByAdmin,
} from "@/hooks/use-connection-messages";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useAdminProfiles } from "@/hooks/admin/use-admin-profiles";

// ─── Types ───

interface InboxThread {
  connection_request_id: string;
  buyer_name: string;
  buyer_company: string | null;
  buyer_email: string | null;
  buyer_type: string | null;
  deal_title: string | null;
  listing_id: string | null;
  request_status: string;
  conversation_state: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_role: string | null;
  claimed_by: string | null;
  unread_count: number;
  total_messages: number;
  user_message: string | null;
  created_at: string;
}

type InboxFilter = "all" | "unread" | "waiting_on_admin" | "waiting_on_buyer" | "claimed" | "closed";

// ─── Inbox Threads Hook (uses new conversation fields) ───

function useInboxThreads() {
  return useQuery({
    queryKey: ["inbox-threads"],
    queryFn: async () => {
      // Fetch connection requests with conversation state fields
      const { data: requests, error: reqError } = await (supabase
        .from("connection_requests") as any)
        .select(`
          id, status, user_id, listing_id, user_message, created_at,
          conversation_state, last_message_at, last_message_preview, last_message_sender_role,
          claimed_by,
          user:profiles!connection_requests_user_id_fkey(first_name, last_name, email, company, buyer_type),
          listing:listings!connection_requests_listing_id_fkey(title)
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (reqError) throw reqError;

      // Fetch unread counts
      const { data: unreadMessages, error: unreadError } = await (supabase
        .from("connection_messages") as any)
        .select("connection_request_id")
        .eq("is_read_by_admin", false)
        .eq("sender_role", "buyer");

      if (unreadError) throw unreadError;

      // Count unread per request
      const unreadMap: Record<string, number> = {};
      (unreadMessages || []).forEach((msg: any) => {
        unreadMap[msg.connection_request_id] = (unreadMap[msg.connection_request_id] || 0) + 1;
      });

      // Build threads
      const threads: InboxThread[] = (requests || []).map((req: any) => {
        const user = req.user;
        return {
          connection_request_id: req.id,
          buyer_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown' : 'Unknown',
          buyer_company: user?.company || null,
          buyer_email: user?.email || null,
          buyer_type: user?.buyer_type || null,
          deal_title: req.listing?.title || null,
          listing_id: req.listing_id,
          request_status: req.status || 'pending',
          conversation_state: req.conversation_state || 'new',
          last_message_at: req.last_message_at,
          last_message_preview: req.last_message_preview,
          last_message_sender_role: req.last_message_sender_role,
          claimed_by: req.claimed_by,
          unread_count: unreadMap[req.id] || 0,
          total_messages: 0,
          user_message: req.user_message,
          created_at: req.created_at,
        };
      });

      // Sort: unread first, then by last message time, then by created_at
      return threads.sort((a, b) => {
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;
        const aTime = a.last_message_at || a.created_at;
        const bTime = b.last_message_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
    },
    staleTime: 15000,
  });
}

// ─── Update Conversation State Hook ───

function useUpdateConversationState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, state, claimedBy }: { requestId: string; state: string; claimedBy?: string | null }) => {
      const updates: any = { conversation_state: state };
      if (claimedBy !== undefined) {
        updates.claimed_by = claimedBy;
        updates.claimed_at = claimedBy ? new Date().toISOString() : null;
      }
      const { error } = await (supabase
        .from("connection_requests") as any)
        .update(updates)
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-threads"] });
    },
  });
}

// ─── Main Component ───

export default function MessageCenter() {
  const { data: threads = [], isLoading } = useInboxThreads();
  const { data: adminProfiles } = useAdminProfiles();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");

  const selectedThread = threads.find(t => t.connection_request_id === selectedThreadId);

  // Filter threads
  const filteredThreads = useMemo(() => {
    let filtered = threads;

    // Apply status filter
    switch (activeFilter) {
      case "unread":
        filtered = filtered.filter(t => t.unread_count > 0);
        break;
      case "waiting_on_admin":
        filtered = filtered.filter(t => t.conversation_state === "waiting_on_admin" || t.unread_count > 0);
        break;
      case "waiting_on_buyer":
        filtered = filtered.filter(t => t.conversation_state === "waiting_on_buyer");
        break;
      case "claimed":
        filtered = filtered.filter(t => t.conversation_state === "claimed");
        break;
      case "closed":
        filtered = filtered.filter(t => t.conversation_state === "closed");
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.buyer_name.toLowerCase().includes(q) ||
        (t.deal_title || "").toLowerCase().includes(q) ||
        (t.buyer_company || "").toLowerCase().includes(q) ||
        (t.buyer_email || "").toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [threads, activeFilter, searchQuery]);

  // Counts for filter badges
  const counts = useMemo(() => ({
    all: threads.length,
    unread: threads.filter(t => t.unread_count > 0).length,
    waiting_on_admin: threads.filter(t => t.conversation_state === "waiting_on_admin" || t.unread_count > 0).length,
    waiting_on_buyer: threads.filter(t => t.conversation_state === "waiting_on_buyer").length,
    claimed: threads.filter(t => t.conversation_state === "claimed").length,
    closed: threads.filter(t => t.conversation_state === "closed").length,
  }), [threads]);

  const filters: { key: InboxFilter; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All", icon: <Inbox className="w-3.5 h-3.5" /> },
    { key: "unread", label: "Unread", icon: <Circle className="w-3.5 h-3.5" /> },
    { key: "waiting_on_admin", label: "Needs Reply", icon: <MailWarning className="w-3.5 h-3.5" /> },
    { key: "waiting_on_buyer", label: "Waiting", icon: <Clock className="w-3.5 h-3.5" /> },
    { key: "closed", label: "Closed", icon: <Archive className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Inbox</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {counts.unread > 0 ? `${counts.unread} unread conversation${counts.unread !== 1 ? 's' : ''}` : 'All caught up'}
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mt-4 overflow-x-auto">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                activeFilter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {f.icon}
              {f.label}
              {counts[f.key] > 0 && (
                <span className={cn(
                  "ml-0.5 px-1.5 py-0 rounded-full text-[10px] font-bold min-w-[18px] text-center",
                  activeFilter === f.key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : f.key === "unread" || f.key === "waiting_on_admin"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                )}>
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="flex-1 px-6 pb-6">
          <MessageCenterSkeleton />
        </div>
      ) : threads.length === 0 ? (
        <div className="flex-1 px-6 pb-6">
          <MessageCenterEmpty />
        </div>
      ) : (
        <div className="flex-1 min-h-0 mx-6 mb-6 border border-border rounded-xl overflow-hidden bg-card flex">
          {/* Thread List (left panel) */}
          <div className={cn(
            "w-[360px] flex-shrink-0 border-r border-border flex flex-col min-h-0",
            selectedThreadId ? "hidden md:flex" : "flex"
          )}>
            {/* Search */}
            <div className="p-3 border-b border-border/50 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full text-xs border border-border/50 rounded-lg pl-8 pr-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Thread items */}
            <ScrollArea className="flex-1">
              <div className="divide-y divide-border/40">
                {filteredThreads.map(thread => (
                  <ThreadListItem
                    key={thread.connection_request_id}
                    thread={thread}
                    isSelected={selectedThreadId === thread.connection_request_id}
                    onClick={() => setSelectedThreadId(thread.connection_request_id)}
                    adminProfiles={adminProfiles}
                  />
                ))}
                {filteredThreads.length === 0 && (
                  <div className="p-8 text-center">
                    <Filter className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {searchQuery ? "No conversations match your search" : "No conversations in this filter"}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Thread View (right panel) */}
          <div className={cn(
            "flex-1 flex flex-col min-h-0",
            !selectedThreadId ? "hidden md:flex" : "flex"
          )}>
            {selectedThreadId && selectedThread ? (
              <ThreadView
                thread={selectedThread}
                onBack={() => setSelectedThreadId(null)}
                adminProfiles={adminProfiles}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Inbox className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">Select a conversation</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Choose from the list to view messages</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Thread List Item ───

function ThreadListItem({
  thread,
  isSelected,
  onClick,
}: {
  thread: InboxThread;
  isSelected: boolean;
  onClick: () => void;
  adminProfiles?: Record<string, any> | null;
}) {
  const stateIcon = (() => {
    switch (thread.conversation_state) {
      case "waiting_on_admin": return <Circle className="w-2 h-2 fill-destructive text-destructive" />;
      case "waiting_on_buyer": return <Clock className="w-2 h-2 text-amber-500" />;
      case "claimed": return <User className="w-2 h-2 text-primary" />;
      case "closed": return <CheckCheck className="w-2 h-2 text-muted-foreground" />;
      default: return <Circle className="w-2 h-2 fill-blue-500 text-blue-500" />;
    }
  })();

  const timeLabel = thread.last_message_at
    ? formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: false })
    : formatDistanceToNow(new Date(thread.created_at), { addSuffix: false });

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 transition-colors",
        isSelected ? "bg-accent" : "hover:bg-accent/50",
        thread.unread_count > 0 && !isSelected && "bg-primary/[0.03]"
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* State indicator */}
        <div className="mt-1.5 flex-shrink-0">{stateIcon}</div>

        <div className="flex-1 min-w-0">
          {/* Row 1: Buyer name + time */}
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "text-sm truncate",
              thread.unread_count > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/90"
            )}>
              {thread.buyer_name}
            </span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeLabel}</span>
          </div>

          {/* Row 2: Company + deal */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {thread.buyer_company && (
              <span className="text-[11px] text-muted-foreground truncate">{thread.buyer_company}</span>
            )}
            {thread.buyer_company && thread.deal_title && (
              <span className="text-muted-foreground/40">·</span>
            )}
            {thread.deal_title && (
              <span className="text-[11px] text-muted-foreground/70 truncate">{thread.deal_title}</span>
            )}
          </div>

          {/* Row 3: Last message preview */}
          <p className={cn(
            "text-[11px] mt-0.5 truncate",
            thread.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground"
          )}>
            {thread.last_message_sender_role === "admin" && "You: "}
            {thread.last_message_preview || thread.user_message || "No messages yet"}
          </p>
        </div>

        {/* Unread badge */}
        {thread.unread_count > 0 && (
          <span className="mt-1 flex-shrink-0 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
            {thread.unread_count}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Thread View ───

function ThreadView({
  thread,
  onBack,
}: {
  thread: InboxThread;
  onBack: () => void;
  adminProfiles?: Record<string, any> | null;
}) {
  const { data: messages = [], isLoading } = useConnectionMessages(thread.connection_request_id);
  const sendMsg = useSendMessage();
  const markRead = useMarkMessagesReadByAdmin();
  const updateState = useUpdateConversationState();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mark as read
  useEffect(() => {
    if (thread.connection_request_id && thread.unread_count > 0) {
      markRead.mutate(thread.connection_request_id);
    }
  }, [thread.connection_request_id, thread.unread_count]);

  // Auto-scroll
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

  // Build combined messages: inquiry first, then connection_messages
  const allMessages = useMemo(() => {
    const combined: Array<{
      id: string;
      body: string;
      sender_role: string;
      senderName: string;
      created_at: string;
      message_type?: string;
      isInquiry?: boolean;
    }> = [];

    if (thread.user_message) {
      combined.push({
        id: "inquiry",
        body: thread.user_message,
        sender_role: "buyer",
        senderName: thread.buyer_name,
        created_at: thread.created_at,
        isInquiry: true,
      });
    }

    messages.forEach(msg => {
      const isAdmin = msg.sender_role === "admin";
      const senderName = msg.sender
        ? `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim() || msg.sender.email || 'Unknown'
        : isAdmin ? "Admin" : thread.buyer_name;
      combined.push({
        id: msg.id,
        body: msg.body,
        sender_role: msg.sender_role,
        senderName,
        created_at: msg.created_at,
        message_type: msg.message_type,
      });
    });

    return combined;
  }, [thread, messages]);

  const conversationStateLabel = (() => {
    switch (thread.conversation_state) {
      case "waiting_on_admin": return { label: "Needs Reply", color: "text-destructive bg-destructive/10" };
      case "waiting_on_buyer": return { label: "Waiting on Buyer", color: "text-amber-600 bg-amber-50" };
      case "claimed": return { label: "Claimed", color: "text-primary bg-primary/10" };
      case "closed": return { label: "Closed", color: "text-muted-foreground bg-muted" };
      default: return { label: "New", color: "text-blue-600 bg-blue-50" };
    }
  })();

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="md:hidden h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground truncate">{thread.buyer_name}</h2>
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", conversationStateLabel.color)}>
              {conversationStateLabel.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {thread.buyer_company && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {thread.buyer_company}
              </span>
            )}
            {thread.deal_title && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {thread.deal_title}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {thread.conversation_state !== "closed" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => updateState.mutate({
                      requestId: thread.connection_request_id,
                      state: "closed",
                    })}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Close conversation</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {thread.conversation_state === "closed" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => updateState.mutate({
                requestId: thread.connection_request_id,
                state: "new",
              })}
            >
              Reopen
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="px-5 py-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-3/4" />
              ))}
            </div>
          ) : allMessages.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Send a message to start the conversation</p>
              </div>
            </div>
          ) : (
            allMessages.map(msg => {
              const isAdmin = msg.sender_role === "admin";
              const isSystem = msg.message_type === "decision" || msg.message_type === "system";

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="bg-muted/40 text-muted-foreground italic text-xs px-3 py-1.5 rounded-full max-w-[80%]">
                      {msg.body}
                      <span className="opacity-50 text-[10px] ml-2">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[80%] rounded-xl px-4 py-3 space-y-1",
                    isAdmin
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto bg-muted/40 border border-border/40"
                  )}
                >
                  <div className={cn(
                    "flex items-center gap-2 text-[11px]",
                    isAdmin ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    <span className="font-medium">{isAdmin ? "You" : msg.senderName}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                    {msg.isInquiry && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-medium",
                        isAdmin ? "bg-primary-foreground/20" : "bg-accent/40 text-accent-foreground"
                      )}>
                        Initial Inquiry
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    "text-sm whitespace-pre-wrap leading-relaxed",
                    isAdmin ? "text-primary-foreground" : "text-foreground"
                  )}>
                    {msg.body}
                  </p>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Compose bar */}
      {thread.conversation_state !== "closed" ? (
        <div className="border-t border-border px-5 py-3 flex-shrink-0">
          <div className="flex items-end gap-3">
            <Textarea
              placeholder="Type a message..."
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              className="min-h-[50px] max-h-[120px] resize-none text-sm flex-1"
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
              }}
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMsg.isPending}
              className="h-9 px-4"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Send
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Cmd/Ctrl + Enter to send</p>
        </div>
      ) : (
        <div className="border-t border-border px-5 py-3 text-center">
          <p className="text-xs text-muted-foreground">This conversation is closed</p>
        </div>
      )}
    </div>
  );
}

// ─── Skeletons & Empty States ───

function MessageCenterSkeleton() {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card h-full">
      <div className="p-6 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-3 w-[300px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageCenterEmpty() {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card h-full flex items-center justify-center">
      <div className="text-center py-16">
        <Inbox className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-1">No conversations yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Messages will appear here when buyers start conversations through connection requests.
        </p>
      </div>
    </div>
  );
}
