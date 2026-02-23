import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Inbox,
  Search,
  ExternalLink,
  FileSignature,
  Shield,
  CheckCircle,
  MessageSquarePlus,
} from "lucide-react";
import {
  useConnectionMessages,
  useSendMessage,
  useMarkMessagesReadByBuyer,
} from "@/hooks/use-connection-messages";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { AgreementSigningModal } from "@/components/docuseal/AgreementSigningModal";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook to send a document question as a message to the admin team.
 * Creates a connection message on the buyer's first active deal thread,
 * or creates an admin notification if no thread exists.
 */
function useSendDocumentQuestion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ documentType, question, userId }: { documentType: 'nda' | 'fee_agreement'; question: string; userId: string }) => {
      const docLabel = documentType === 'nda' ? 'NDA' : 'Fee Agreement';
      const messageBody = `📄 Question about ${docLabel}:\n\n${question}`;

      // Find an active connection request to attach the message to
      const { data: activeRequest } = await (supabase
        .from('connection_requests') as any)
        .select('id')
        .eq('user_id', userId)
        .in('status', ['approved', 'on_hold', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Oz De La Luna's admin ID — all document questions route to him
      const OZ_ADMIN_ID = 'ea1f0064-52ef-43fb-bec4-22391b720328';

      if (activeRequest) {
        // Send as a connection message (sender_id required by RLS)
        const { error } = await (supabase.from('connection_messages') as any).insert({
          connection_request_id: activeRequest.id,
          sender_id: userId,
          body: messageBody,
          sender_role: 'buyer',
        });
        if (error) throw error;
      } else {
        // No active thread — create a user notification for Oz instead
        // (buyers can't insert into admin_notifications due to RLS)
        console.warn('No active connection request found for document question');
      }

      // Always notify Oz via admin_notifications using an edge function call
      await supabase.functions.invoke('notify-admin-document-question', {
        body: {
          admin_id: OZ_ADMIN_ID,
          user_id: userId,
          document_type: docLabel,
          question,
        },
      });
    },
    onSuccess: () => {
      toast({ title: 'Question Sent', description: 'Our team will review and respond shortly.' });
      queryClient.invalidateQueries({ queryKey: ['buyer-message-threads'] });
      queryClient.invalidateQueries({ queryKey: ['connection-messages'] });
    },
    onError: () => {
      toast({ title: 'Failed to Send', description: 'Please try again or contact support.', variant: 'destructive' });
    },
  });
}

interface BuyerThread {
  connection_request_id: string;
  deal_title: string;
  deal_category?: string;
  request_status: string;
  listing_id: string;
  messages_count: number;
  last_message_body: string;
  last_message_at: string;
  last_sender_role: string;
  unread_count: number;
}

// Fetch buyer's threads — shows ALL approved+ requests, not just ones with messages
function useBuyerThreads() {
  const { user } = useAuth();

  return useQuery<BuyerThread[]>({
    queryKey: ["buyer-message-threads", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Step 1: Fetch all connection requests for this buyer (approved, on_hold, rejected)
      const { data: requests, error: reqError } = await supabase
        .from("connection_requests")
        .select(`
          id, status, listing_id, user_message, created_at,
          last_message_at, last_message_preview, last_message_sender_role,
          listing:listings!connection_requests_listing_id_fkey(title, category)
        `)
        .eq("user_id", user.id)
        .in("status", ["pending", "approved", "on_hold", "rejected"])
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (reqError || !requests) return [];

      // Step 2: Fetch unread counts for this buyer
      const requestIds = requests.map((r: Record<string, unknown>) => r.id as string);
      const { data: unreadMsgs } = await supabase
        .from("connection_messages")
        .select("connection_request_id")
        .in("connection_request_id", requestIds.length > 0 ? requestIds : ["__none__"])
        .eq("is_read_by_buyer", false)
        .eq("sender_role", "admin");

      const unreadMap: Record<string, number> = {};
      (unreadMsgs || []).forEach((msg: Record<string, unknown>) => {
        const reqId = msg.connection_request_id as string;
        unreadMap[reqId] = (unreadMap[reqId] || 0) + 1;
      });

      const threads: BuyerThread[] = requests.map((req: Record<string, unknown>) => ({
        connection_request_id: req.id as string,
        deal_title: (req.listing as Record<string, unknown>)?.title as string || "Untitled Deal",
        deal_category: ((req.listing as Record<string, unknown>)?.category as string) ?? undefined,
        request_status: req.status as string,
        listing_id: (req.listing_id as string) ?? '',
        messages_count: 0,
        last_message_body: (req.last_message_preview as string) || (req.user_message as string) || "",
        last_message_at: (req.last_message_at as string) || (req.created_at as string),
        last_sender_role: (req.last_message_sender_role as string) || "buyer",
        unread_count: unreadMap[req.id as string] || 0,
      }));

      // Sort: unread first, then by most recent activity
      return threads.sort((a, b) => {
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
}

export default function BuyerMessages() {
  const { data: threads = [], isLoading, error } = useBuyerThreads();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    searchParams.get("deal") || null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showGeneralChat, setShowGeneralChat] = useState(false);

  // Set selected from URL param
  useEffect(() => {
    const dealParam = searchParams.get("deal");
    if (dealParam === "general") {
      setShowGeneralChat(true);
      setSelectedThreadId(null);
    } else if (dealParam && threads.find((t) => t.connection_request_id === dealParam)) {
      setSelectedThreadId(dealParam);
      setShowGeneralChat(false);
    }
  }, [searchParams, threads]);

  // Auto-show general chat if no threads exist and nothing is selected
  useEffect(() => {
    if (!isLoading && threads.length === 0 && !selectedThreadId) {
      setShowGeneralChat(true);
    }
  }, [isLoading, threads.length, selectedThreadId]);

  const handleSelectThread = (requestId: string) => {
    setSelectedThreadId(requestId);
    setShowGeneralChat(false);
    setSearchParams({ deal: requestId });
  };

  const handleSelectGeneral = () => {
    setShowGeneralChat(true);
    setSelectedThreadId(null);
    setSearchParams({ deal: "general" });
  };

  const selectedThread = threads.find(
    (t) => t.connection_request_id === selectedThreadId
  );

  const filteredThreads = searchQuery.trim()
    ? threads.filter((t) =>
        t.deal_title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : threads;

  const hasActiveView = selectedThreadId && selectedThread;

  return (
    <div className="w-full bg-background min-h-screen">
      {/* Header */}
      <div className="px-4 sm:px-8 pt-8 pb-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-semibold text-foreground tracking-tight">
          Messages
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conversations with the SourceCo team across your deals
        </p>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-8 pb-8 max-w-7xl mx-auto space-y-4">
        {/* Pending agreement actions — always shown at top when relevant */}
        <PendingAgreementBanner />

        {error ? (
          <div className="border border-border rounded-xl bg-card flex flex-col items-center justify-center py-16">
            <p className="text-sm text-destructive mb-1">Failed to load messages</p>
            <p className="text-xs text-muted-foreground">Please try refreshing the page.</p>
          </div>
        ) : isLoading ? (
          <BuyerMessagesSkeleton />
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card min-h-[500px] grid grid-cols-1 md:grid-cols-3">
            {/* Thread List */}
            <div
              className={`md:col-span-1 border-r border-border overflow-y-auto ${
                (selectedThreadId || showGeneralChat) ? "hidden md:block" : ""
              }`}
            >
              {/* Search */}
              {threads.length > 0 && (
                <div className="p-3 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search deals..."
                      className="w-full text-sm border border-border rounded-lg pl-8 pr-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="divide-y divide-border">
                {/* General Inquiry thread — always first */}
                <button
                  onClick={handleSelectGeneral}
                  className={`w-full text-left p-3.5 hover:bg-muted/50 transition-colors ${
                    showGeneralChat ? "bg-muted/50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <MessageSquarePlus className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold text-foreground">
                          General Inquiry
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                        Message the SourceCo team directly
                      </p>
                    </div>
                  </div>
                </button>

                {filteredThreads.map((thread) => (
                  <button
                    key={thread.connection_request_id}
                    onClick={() =>
                      handleSelectThread(thread.connection_request_id)
                    }
                    className={`w-full text-left p-3.5 hover:bg-muted/50 transition-colors ${
                      selectedThreadId === thread.connection_request_id
                        ? "bg-muted/50"
                        : ""
                    } ${thread.unread_count > 0 ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {thread.deal_title}
                          </span>
                          {thread.unread_count > 0 && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                              {thread.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {thread.deal_category || "Deal"} ·{" "}
                          <span className="capitalize">
                            {thread.request_status === "on_hold"
                              ? "On Hold"
                              : thread.request_status}
                          </span>
                        </p>
                        <p
                          className={`text-xs mt-1 truncate ${
                            thread.unread_count > 0
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {thread.last_sender_role === "buyer" && "You: "}
                          {thread.last_message_body}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(
                            new Date(thread.last_message_at),
                            { addSuffix: true }
                          )}
                        </span>
                        <StatusDot status={thread.request_status} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Thread View */}
            <div
              className={`md:col-span-2 flex flex-col ${
                !hasActiveView && !showGeneralChat ? "hidden md:flex" : ""
              }`}
            >
              {showGeneralChat ? (
                <GeneralChatView
                  onBack={() => {
                    setShowGeneralChat(false);
                    setSearchParams({});
                  }}
                />
              ) : hasActiveView ? (
                <BuyerThreadView
                  thread={selectedThread!}
                  onBack={() => {
                    setSelectedThreadId(null);
                    setSearchParams({});
                  }}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Inbox className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Select a conversation to view messages
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * GeneralChatView — allows buyers to message admin at any time,
 * even without an existing deal thread.
 * Routes through the first active connection request if one exists,
 * otherwise uses an edge function to notify admin.
 */
function GeneralChatView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sentMessages, setSentMessages] = useState<Array<{ id: string; body: string; created_at: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Try to find any active connection request to attach messages to
  const { data: activeRequest } = useQuery({
    queryKey: ["buyer-active-request", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("connection_requests")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["approved", "on_hold", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // If there's an active request, load existing messages
  const { data: existingMessages = [] } = useConnectionMessages(
    activeRequest?.id || ""
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [existingMessages, sentMessages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending || !user?.id) return;
    setSending(true);

    try {
      if (activeRequest?.id) {
        // Send as a connection message on the active thread
        const { error } = await (supabase.from("connection_messages") as any).insert({
          connection_request_id: activeRequest.id,
          sender_id: user.id,
          body: newMessage.trim(),
          sender_role: "buyer",
        });
        if (error) throw error;
      } else {
        // No active thread — notify admin via edge function
        const OZ_ADMIN_ID = "ea1f0064-52ef-43fb-bec4-22391b720328";
        await supabase.functions.invoke("notify-admin-document-question", {
          body: {
            admin_id: OZ_ADMIN_ID,
            user_id: user.id,
            document_type: "General Inquiry",
            question: newMessage.trim(),
          },
        });
      }

      setSentMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), body: newMessage.trim(), created_at: new Date().toISOString() },
      ]);
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["buyer-message-threads"] });
      queryClient.invalidateQueries({ queryKey: ["connection-messages"] });

      if (!activeRequest?.id) {
        toast({ title: "Message Sent", description: "Our team will respond shortly." });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Failed to Send", description: "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Combine existing messages with locally-sent ones (dedup)
  const allMessages = activeRequest?.id
    ? existingMessages
    : sentMessages;

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-card">
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
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              General Inquiry
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">Message the SourceCo team</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-muted/30">
        {allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Send a message to start a conversation with the SourceCo team.
              </p>
            </div>
          </div>
        ) : (
          allMessages.map((msg: any) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender_role === "buyer" || !msg.sender_role
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.sender_role === "buyer" || !msg.sender_role
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-card-foreground border border-border"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-xs opacity-80">
                    {msg.sender_role === "buyer" || !msg.sender_role
                      ? "You"
                      : msg.sender?.first_name || "SourceCo"}
                  </span>
                  <span className="opacity-50 text-[10px]">
                    {formatDistanceToNow(new Date(msg.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-5 py-3 bg-card">
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
            placeholder="Message the SourceCo team..."
            className="flex-1 text-sm border border-border rounded-lg px-4 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="bg-primary hover:bg-primary/90 px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "approved"
      ? "bg-emerald-500"
      : status === "rejected"
        ? "bg-destructive"
        : status === "on_hold"
          ? "bg-amber-500"
          : "bg-muted-foreground/30";
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
}

function BuyerThreadView({
  thread,
  onBack,
}: {
  thread: {
    connection_request_id: string;
    deal_title: string;
    request_status: string;
    unread_count: number;
  };
  onBack: () => void;
}) {
  const { data: messages = [], isLoading } = useConnectionMessages(
    thread.connection_request_id
  );
  const sendMsg = useSendMessage();
  const markRead = useMarkMessagesReadByBuyer();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isRejected = thread.request_status === "rejected";
  
  useEffect(() => {
    if (thread.connection_request_id && thread.unread_count > 0) {
      markRead.mutate(thread.connection_request_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.connection_request_id, thread.unread_count]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim() || isRejected) return;
    sendMsg.mutate({
      connection_request_id: thread.connection_request_id,
      body: newMessage.trim(),
      sender_role: "buyer",
    });
    setNewMessage("");
  };

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-card">
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
            <h2 className="text-sm font-semibold text-foreground truncate">
              {thread.deal_title}
            </h2>
            <StatusDot status={thread.request_status} />
            <span className="text-xs text-muted-foreground capitalize">
              {thread.request_status === "on_hold"
                ? "On Hold"
                : thread.request_status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">SourceCo Team</p>
        </div>
        <Link
          to={`/my-deals?deal=${thread.connection_request_id}`}
          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
        >
          View deal <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-muted/30">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-3/4" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No messages yet</p>
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
                className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.message_type === "decision" ||
                  msg.message_type === "system"
                    ? "bg-muted text-muted-foreground italic text-xs"
                    : msg.sender_role === "buyer"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-card-foreground border border-border"
                }`}
              >
                {msg.message_type !== "system" &&
                  msg.message_type !== "decision" && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-xs opacity-80">
                        {msg.sender_role === "buyer"
                          ? "You"
                          : msg.sender?.first_name || "SourceCo"}
                      </span>
                      <span className="opacity-50 text-[10px]">
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
      <div className="border-t border-border px-5 py-3 bg-card">
        {isRejected ? (
          <p className="text-xs text-muted-foreground text-center py-1">
            This deal is no longer active.
          </p>
        ) : (
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
              className="flex-1 text-sm border border-border rounded-lg px-4 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMsg.isPending}
              className="bg-primary hover:bg-primary/90 px-4"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function BuyerMessagesSkeleton() {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card p-8">
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
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

/**
 * Button that downloads a document PDF. Uses cached URL if available,
 * otherwise calls the get-document-download edge function.
 */
function DownloadDocButton({
  documentUrl,
  draftUrl,
  documentType,
  label,
  variant = 'outline',
}: {
  documentUrl: string | null;
  draftUrl: string | null;
  documentType: 'nda' | 'fee_agreement';
  label: string;
  variant?: 'outline' | 'default';
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    const cachedUrl = documentUrl || draftUrl;
    if (cachedUrl && cachedUrl.startsWith('https://')) {
      window.open(cachedUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        `get-document-download?document_type=${documentType}`,
      );

      if (error) {
        toast({ title: 'Download Failed', description: 'Could not retrieve document.', variant: 'destructive' });
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        toast({ title: 'Not Available', description: 'Document is not yet available for download.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Download Failed', description: 'Something went wrong.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <FileSignature className="h-3.5 w-3.5 mr-1.5" />
      )}
      {label}
    </Button>
  );
}

/**
 * PendingAgreementBanner — shows at top of messages page.
 * Shows pending documents to sign OR already-signed documents with download links.
 * Automatically hides when there's nothing to show.
 */
function PendingAgreementBanner() {
  const { user } = useAuth();
  const [signingOpen, setSigningOpen] = useState(false);
  const [signingDocType, setSigningDocType] = useState<'nda' | 'fee_agreement'>('nda');
  const [docMessageOpen, setDocMessageOpen] = useState(false);
  const [docMessageType, setDocMessageType] = useState<'nda' | 'fee_agreement'>('nda');
  const [docQuestion, setDocQuestion] = useState('');
  const sendDocQuestion = useSendDocumentQuestion();

  // Fetch firm agreement status to know what's signed vs pending
  const { data: firmStatus } = useQuery({
    queryKey: ['buyer-firm-agreement-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: membership } = await supabase.from('firm_members')
        .select('firm_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (!membership) return null;

      const { data: firm } = await supabase.from('firm_agreements')
        .select('nda_signed, nda_signed_at, nda_signed_document_url, nda_document_url, nda_docuseal_status, fee_agreement_signed, fee_agreement_signed_at, fee_signed_document_url, fee_agreement_document_url, fee_docuseal_status')
        .eq('id', membership.firm_id)
        .maybeSingle();
      return firm;
    },
    enabled: !!user?.id,
    staleTime: 15_000,
  });

  // Fetch pending notifications for documents that still need signing
  const { data: pendingNotifications = [] } = useQuery({
    queryKey: ['agreement-pending-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('notification_type', 'agreement_pending')
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Build document items from firm status + notifications
  type DocItem = {
    key: string;
    type: 'nda' | 'fee_agreement';
    label: string;
    signed: boolean;
    signedAt: string | null;
    documentUrl: string | null;
    draftUrl: string | null;
    notificationMessage?: string;
    notificationTime?: string;
  };

  const items: DocItem[] = [];

  // NDA
  if (firmStatus?.nda_signed) {
    items.push({
      key: 'nda-signed',
      type: 'nda',
      label: 'NDA',
      signed: true,
      signedAt: firmStatus.nda_signed_at,
      documentUrl: firmStatus.nda_signed_document_url,
      draftUrl: firmStatus.nda_document_url,
    });
  } else {
    const ndaNotif = pendingNotifications.find((n: Record<string, unknown>) => (n.metadata as Record<string, unknown>)?.document_type === 'nda');
    if (ndaNotif || firmStatus?.nda_docuseal_status) {
      items.push({
        key: 'nda-pending',
        type: 'nda',
        label: 'NDA',
        signed: false,
        signedAt: null,
        documentUrl: null,
        draftUrl: firmStatus?.nda_document_url || null,
        notificationMessage: ndaNotif?.message,
        notificationTime: ndaNotif?.created_at ?? undefined,
      });
    }
  }

  // Fee Agreement
  if (firmStatus?.fee_agreement_signed) {
    items.push({
      key: 'fee-signed',
      type: 'fee_agreement',
      label: 'Fee Agreement',
      signed: true,
      signedAt: firmStatus.fee_agreement_signed_at,
      documentUrl: firmStatus.fee_signed_document_url,
      draftUrl: firmStatus.fee_agreement_document_url,
    });
  } else {
    const feeNotif = pendingNotifications.find((n: Record<string, unknown>) => (n.metadata as Record<string, unknown>)?.document_type === 'fee_agreement');
    if (feeNotif || firmStatus?.fee_docuseal_status) {
      items.push({
        key: 'fee-pending',
        type: 'fee_agreement',
        label: 'Fee Agreement',
        signed: false,
        signedAt: null,
        documentUrl: null,
        draftUrl: firmStatus?.fee_agreement_document_url || null,
        notificationMessage: feeNotif?.message,
        notificationTime: feeNotif?.created_at ?? undefined,
      });
    }
  }

  if (items.length === 0) return null;

  const hasPending = items.some(i => !i.signed);
  const allSigned = items.every(i => i.signed);

  return (
    <>
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            {allSigned ? 'Signed Documents' : hasPending ? 'Action Required' : 'Documents'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allSigned
              ? 'All agreements are signed. Download copies for your records.'
              : 'Sign these documents to continue accessing deal details'}
          </p>
        </div>
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.key} className="flex items-center gap-4 px-5 py-4">
              <div className={`p-2 rounded-full ${item.signed ? 'bg-primary/10' : 'bg-accent'}`}>
                {item.type === 'nda' ? (
                  <Shield className={`h-5 w-5 ${item.signed ? 'text-primary' : 'text-accent-foreground'}`} />
                ) : (
                  <FileSignature className={`h-5 w-5 ${item.signed ? 'text-primary' : 'text-accent-foreground'}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {item.signed ? `${item.label} — Signed` : `${item.label} Ready to Sign`}
                  </p>
                  {item.signed && (
                    <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.signed
                    ? item.signedAt
                      ? `Signed ${formatDistanceToNow(new Date(item.signedAt), { addSuffix: true })}`
                      : 'Signed'
                    : item.notificationMessage || `A ${item.label} has been prepared for your signature. Please sign it to continue accessing deal details.`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.signed ? (
                  <>
                    <DownloadDocButton
                      documentUrl={item.documentUrl}
                      draftUrl={item.draftUrl}
                      documentType={item.type}
                      label="Download PDF"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setDocMessageType(item.type);
                        setDocMessageOpen(true);
                      }}
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5 mr-1.5" />
                      Questions?
                    </Button>
                  </>
                ) : (
                  <>
                    <DownloadDocButton
                      documentUrl={null}
                      draftUrl={item.draftUrl}
                      documentType={item.type}
                      label="Download Draft"
                      variant="outline"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setDocMessageType(item.type);
                        setDocMessageOpen(true);
                      }}
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5 mr-1.5" />
                      Questions?
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSigningDocType(item.type);
                        setSigningOpen(true);
                      }}
                    >
                      Sign Now
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <AgreementSigningModal
        open={signingOpen}
        onOpenChange={setSigningOpen}
        documentType={signingDocType}
      />

      {/* Document Question Dialog */}
      <Dialog open={docMessageOpen} onOpenChange={(open) => { setDocMessageOpen(open); if (!open) setDocQuestion(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquarePlus className="h-4 w-4" />
              Question about {docMessageType === 'nda' ? 'NDA' : 'Fee Agreement'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Have questions or redline requests about this document? Send us a message and our team will respond shortly.
            </p>
            <textarea
              value={docQuestion}
              onChange={(e) => setDocQuestion(e.target.value)}
              placeholder="Describe your questions, concerns, or requested changes..."
              className="w-full min-h-[120px] text-sm border border-border rounded-lg px-3 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setDocMessageOpen(false); setDocQuestion(''); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!docQuestion.trim() || sendDocQuestion.isPending}
                onClick={() => {
                  sendDocQuestion.mutate(
                    { documentType: docMessageType, question: docQuestion.trim(), userId: user?.id || '' },
                    { onSuccess: () => { setDocMessageOpen(false); setDocQuestion(''); } }
                  );
                }}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Send Question
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
