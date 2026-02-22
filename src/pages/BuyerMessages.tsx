import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Inbox,
  Search,
  ExternalLink,
} from "lucide-react";
import {
  useConnectionMessages,
  useSendMessage,
  useMarkMessagesReadByBuyer,
  useUnreadBuyerMessageCounts,
  type MessageThread,
} from "@/hooks/use-connection-messages";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

// Fetch buyer's threads from connection_requests + messages
function useBuyerThreads() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["buyer-message-threads", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get all connection requests for this buyer that have messages
      const { data: requests, error: reqError } = await supabase
        .from("connection_requests")
        .select(
          `
          id, status, listing_id, created_at,
          listing:listings!connection_requests_listing_id_fkey(id, title, category)
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (reqError || !requests) return [];

      // Get messages for each request
      const threads: Array<{
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
      }> = [];

      for (const req of requests) {
        const { data: msgs } = await supabase
          .from("connection_messages")
          .select("id, body, sender_role, is_read_by_buyer, created_at")
          .eq("connection_request_id", req.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!msgs || msgs.length === 0) continue;

        const { count: unreadCount } = await supabase
          .from("connection_messages")
          .select("id", { count: "exact", head: true })
          .eq("connection_request_id", req.id)
          .eq("sender_role", "admin")
          .eq("is_read_by_buyer", false);

        const { count: totalCount } = await supabase
          .from("connection_messages")
          .select("id", { count: "exact", head: true })
          .eq("connection_request_id", req.id);

        const lastMsg = msgs[0];
        threads.push({
          connection_request_id: req.id,
          deal_title: (req.listing as any)?.title || "Untitled Deal",
          deal_category: (req.listing as any)?.category,
          request_status: req.status,
          listing_id: req.listing_id,
          messages_count: totalCount || 0,
          last_message_body: lastMsg.body,
          last_message_at: lastMsg.created_at,
          last_sender_role: lastMsg.sender_role,
          unread_count: unreadCount || 0,
        });
      }

      // Sort: unread first, then by most recent message
      threads.sort((a, b) => {
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;
        return (
          new Date(b.last_message_at).getTime() -
          new Date(a.last_message_at).getTime()
        );
      });

      return threads;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
}

export default function BuyerMessages() {
  const { data: threads = [], isLoading } = useBuyerThreads();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    searchParams.get("deal") || null
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Set selected from URL param
  useEffect(() => {
    const dealParam = searchParams.get("deal");
    if (dealParam && threads.find((t) => t.connection_request_id === dealParam)) {
      setSelectedThreadId(dealParam);
    }
  }, [searchParams, threads]);

  const handleSelectThread = (requestId: string) => {
    setSelectedThreadId(requestId);
    setSearchParams({ deal: requestId });
  };

  const selectedThread = threads.find(
    (t) => t.connection_request_id === selectedThreadId
  );

  const filteredThreads = searchQuery.trim()
    ? threads.filter((t) =>
        t.deal_title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : threads;

  return (
    <div className="w-full bg-white min-h-screen">
      {/* Header */}
      <div className="px-4 sm:px-8 pt-8 pb-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">
          Messages
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Conversations with the SourceCo team across your deals
        </p>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-8 pb-8 max-w-7xl mx-auto">
        {isLoading ? (
          <BuyerMessagesSkeleton />
        ) : threads.length === 0 ? (
          <BuyerMessagesEmpty />
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white min-h-[500px] grid grid-cols-1 md:grid-cols-3">
            {/* Thread List */}
            <div
              className={`md:col-span-1 border-r border-slate-200 overflow-y-auto ${
                selectedThreadId ? "hidden md:block" : ""
              }`}
            >
              {/* Search */}
              <div className="p-3 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search deals..."
                    className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredThreads.map((thread) => (
                  <button
                    key={thread.connection_request_id}
                    onClick={() =>
                      handleSelectThread(thread.connection_request_id)
                    }
                    className={`w-full text-left p-3.5 hover:bg-slate-50 transition-colors ${
                      selectedThreadId === thread.connection_request_id
                        ? "bg-slate-50"
                        : ""
                    } ${thread.unread_count > 0 ? "bg-blue-50/30" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {thread.deal_title}
                          </span>
                          {thread.unread_count > 0 && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                              {thread.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
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
                              ? "font-medium text-slate-900"
                              : "text-slate-400"
                          }`}
                        >
                          {thread.last_sender_role === "buyer" && "You: "}
                          {thread.last_message_body}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400">
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
                !selectedThreadId ? "hidden md:flex" : ""
              }`}
            >
              {selectedThreadId && selectedThread ? (
                <BuyerThreadView
                  thread={selectedThread}
                  onBack={() => {
                    setSelectedThreadId(null);
                    setSearchParams({});
                  }}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Inbox className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm text-slate-400">
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

function StatusDot({ status }: { status: string }) {
  const color =
    status === "approved"
      ? "bg-emerald-500"
      : status === "rejected"
        ? "bg-red-500"
        : status === "on_hold"
          ? "bg-amber-500"
          : "bg-slate-300";
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
  }, [thread.connection_request_id]);

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
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-white">
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
            <h2 className="text-sm font-semibold text-slate-900 truncate">
              {thread.deal_title}
            </h2>
            <StatusDot status={thread.request_status} />
            <span className="text-xs text-slate-500 capitalize">
              {thread.request_status === "on_hold"
                ? "On Hold"
                : thread.request_status}
            </span>
          </div>
          <p className="text-xs text-slate-400">SourceCo Team</p>
        </div>
        <Link
          to={`/my-deals?deal=${thread.connection_request_id}`}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 shrink-0"
        >
          View deal <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/50">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-3/4" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-400">No messages yet</p>
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
                    ? "bg-slate-100 text-slate-500 italic text-xs"
                    : msg.sender_role === "buyer"
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-900 border border-slate-200"
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
      <div className="border-t border-slate-100 px-5 py-3 bg-white">
        {isRejected ? (
          <p className="text-xs text-slate-400 text-center py-1">
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
              className="flex-1 text-sm border border-slate-200 rounded-lg px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMsg.isPending}
              className="bg-slate-900 hover:bg-slate-800 px-4"
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
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white p-8">
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

function BuyerMessagesEmpty() {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col items-center justify-center py-20">
      <MessageSquare className="h-12 w-12 text-slate-300 mb-4" />
      <h3 className="text-lg font-semibold text-slate-900 mb-1">
        No messages yet
      </h3>
      <p className="text-sm text-slate-500 max-w-sm text-center">
        Messages from the SourceCo team about your deals will appear here.
        You can also start conversations from your{" "}
        <Link to="/my-deals" className="text-blue-600 hover:text-blue-700">
          My Deals
        </Link>{" "}
        page.
      </p>
    </div>
  );
}
