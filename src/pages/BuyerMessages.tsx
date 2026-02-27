import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Circle,
} from 'lucide-react';
import {
  useConnectionMessages,
  useSendMessage,
  useMarkMessagesReadByBuyer,
} from '@/hooks/use-connection-messages';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { AgreementSigningModal } from '@/components/docuseal/AgreementSigningModal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Types ───

interface BuyerThread {
  connection_request_id: string;
  deal_title: string;
  deal_category?: string;
  request_status: string;
  listing_id: string;
  last_message_body: string;
  last_message_at: string;
  last_sender_role: string;
  unread_count: number;
}

// ─── Hooks ───

function useSendDocumentQuestion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      documentType,
      question,
      userId,
    }: {
      documentType: 'nda' | 'fee_agreement';
      question: string;
      userId: string;
    }) => {
      const docLabel = documentType === 'nda' ? 'NDA' : 'Fee Agreement';
      const messageBody = `📄 Question about ${docLabel}:\n\n${question}`;

      const { data: activeRequest } = await (supabase.from('connection_requests') as any)
        .select('id')
        .eq('user_id', userId)
        .in('status', ['approved', 'on_hold', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const OZ_ADMIN_ID = 'ea1f0064-52ef-43fb-bec4-22391b720328';

      if (activeRequest) {
        const { error } = await (supabase.from('connection_messages') as any).insert({
          connection_request_id: activeRequest.id,
          sender_id: userId,
          body: messageBody,
          sender_role: 'buyer',
        });
        if (error) throw error;
      } else {
        console.warn('No active connection request found for document question');
      }

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
      toast({
        title: 'Failed to Send',
        description: 'Please try again or contact support.',
        variant: 'destructive',
      });
    },
  });
}

function useBuyerThreads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Realtime subscription for new messages
  useEffect(() => {
    if (!user?.id) return undefined;
    const channel = supabase
      .channel(`buyer-threads:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'connection_messages' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['buyer-message-threads'] });
          queryClient.invalidateQueries({ queryKey: ['unread-buyer-message-counts'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return useQuery<BuyerThread[]>({
    queryKey: ['buyer-message-threads', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: requests, error: reqError } = await supabase
        .from('connection_requests')
        .select(
          `id, status, listing_id, user_message, created_at,
          last_message_at, last_message_preview, last_message_sender_role,
          listing:listings!connection_requests_listing_id_fkey(title, category)`,
        )
        .eq('user_id', user.id)
        .in('status', ['pending', 'approved', 'on_hold', 'rejected'])
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (reqError || !requests) return [];

      const requestIds = requests.map((r: Record<string, unknown>) => r.id as string);
      const { data: unreadMsgs } = await supabase
        .from('connection_messages')
        .select('connection_request_id')
        .in('connection_request_id', requestIds.length > 0 ? requestIds : ['__none__'])
        .eq('is_read_by_buyer', false)
        .eq('sender_role', 'admin');

      const unreadMap: Record<string, number> = {};
      (unreadMsgs || []).forEach((msg: Record<string, unknown>) => {
        const reqId = msg.connection_request_id as string;
        unreadMap[reqId] = (unreadMap[reqId] || 0) + 1;
      });

      const threads: BuyerThread[] = requests.map((req: Record<string, unknown>) => ({
        connection_request_id: req.id as string,
        deal_title: ((req.listing as Record<string, unknown>)?.title as string) || 'Untitled Deal',
        deal_category: ((req.listing as Record<string, unknown>)?.category as string) ?? undefined,
        request_status: req.status as string,
        listing_id: (req.listing_id as string) ?? '',
        last_message_body:
          (req.last_message_preview as string) || (req.user_message as string) || '',
        last_message_at: (req.last_message_at as string) || (req.created_at as string),
        last_sender_role: (req.last_message_sender_role as string) || 'buyer',
        unread_count: unreadMap[req.id as string] || 0,
      }));

      return threads.sort((a, b) => {
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
    },
    enabled: !!user?.id,
    staleTime: 15000,
  });
}

// ─── Main Component ───

export default function BuyerMessages() {
  const { data: threads = [], isLoading, error } = useBuyerThreads();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    searchParams.get('deal') || null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showGeneralChat, setShowGeneralChat] = useState(false);

  useEffect(() => {
    const dealParam = searchParams.get('deal');
    if (dealParam === 'general') {
      setShowGeneralChat(true);
      setSelectedThreadId(null);
    } else if (dealParam && threads.find((t) => t.connection_request_id === dealParam)) {
      setSelectedThreadId(dealParam);
      setShowGeneralChat(false);
    }
  }, [searchParams, threads]);

  useEffect(() => {
    if (!isLoading && !selectedThreadId && !showGeneralChat) {
      setShowGeneralChat(true);
    }
  }, [isLoading, selectedThreadId, showGeneralChat]);

  const handleSelectThread = (requestId: string) => {
    setSelectedThreadId(requestId);
    setShowGeneralChat(false);
    setSearchParams({ deal: requestId });
  };

  const handleSelectGeneral = () => {
    setShowGeneralChat(true);
    setSelectedThreadId(null);
    setSearchParams({ deal: 'general' });
  };

  const selectedThread = threads.find((t) => t.connection_request_id === selectedThreadId);

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter(
      (t) =>
        t.deal_title.toLowerCase().includes(q) ||
        (t.deal_category || '').toLowerCase().includes(q) ||
        t.last_message_body.toLowerCase().includes(q),
    );
  }, [threads, searchQuery]);

  const totalUnread = useMemo(() => threads.reduce((sum, t) => sum + t.unread_count, 0), [threads]);

  const hasActiveView = selectedThreadId && selectedThread;

  return (
    <div
      className="h-[calc(100vh-80px)] flex flex-col"
      style={{ fontFamily: 'Montserrat, Inter, sans-serif' }}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#0E101A' }}>
              Messages
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#5A5A5A' }}>
              {totalUnread > 0
                ? `${totalUnread} unread message${totalUnread !== 1 ? 's' : ''}`
                : 'Conversations with the SourceCo team'}
            </p>
          </div>
          <Button
            onClick={handleSelectGeneral}
            size="sm"
            className="gap-1.5"
            style={{ backgroundColor: '#0E101A', color: '#FFFFFF' }}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New Message
          </Button>
        </div>
      </div>

      {/* Pending agreement banner */}
      <div className="px-6 flex-shrink-0">
        <PendingAgreementBanner />
      </div>

      {/* Main content */}
      {error ? (
        <div className="flex-1 px-6 pb-6 pt-4">
          <div
            className="border rounded-xl bg-card flex flex-col items-center justify-center py-16"
            style={{ borderColor: '#CBCBCB' }}
          >
            <p className="text-sm text-destructive mb-1">Failed to load messages</p>
            <p className="text-xs" style={{ color: '#5A5A5A' }}>
              Please try refreshing the page.
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex-1 px-6 pb-6 pt-4">
          <BuyerMessagesSkeleton />
        </div>
      ) : (
        <div
          className="flex-1 min-h-0 mx-6 mb-6 mt-4 rounded-xl overflow-hidden flex"
          style={{ border: '2px solid #CBCBCB', backgroundColor: '#FFFFFF' }}
        >
          {/* Thread List (left panel) */}
          <div
            className={cn(
              'w-[360px] flex-shrink-0 flex flex-col min-h-0',
              selectedThreadId || showGeneralChat ? 'hidden md:flex' : 'flex',
            )}
            style={{ borderRight: '1px solid #E5DDD0' }}
          >
            {/* Search */}
            <div className="p-3 flex-shrink-0" style={{ borderBottom: '1px solid #E5DDD0' }}>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                  style={{ color: '#9A9A9A' }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1"
                  style={{
                    border: '1px solid #CBCBCB',
                    backgroundColor: '#FCF9F0',
                    color: '#0E101A',
                  }}
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="divide-y" style={{ borderColor: '#E5DDD0' }}>
                {/* General Inquiry — always first */}
                <button
                  onClick={handleSelectGeneral}
                  className={cn(
                    'w-full text-left px-4 py-3 transition-colors',
                    showGeneralChat ? 'bg-accent' : 'hover:bg-accent/50',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-1.5 flex-shrink-0">
                      <MessageSquarePlus className="w-4 h-4" style={{ color: '#DEC76B' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold" style={{ color: '#0E101A' }}>
                        General Inquiry
                      </span>
                      <p className="text-[11px] mt-0.5" style={{ color: '#5A5A5A' }}>
                        Message the SourceCo team directly
                      </p>
                    </div>
                  </div>
                </button>

                {/* Deal threads */}
                {filteredThreads.map((thread) => (
                  <ThreadListItem
                    key={thread.connection_request_id}
                    thread={thread}
                    isSelected={selectedThreadId === thread.connection_request_id}
                    onClick={() => handleSelectThread(thread.connection_request_id)}
                  />
                ))}

                {filteredThreads.length === 0 && threads.length > 0 && (
                  <div className="p-8 text-center">
                    <Search className="h-8 w-8 mx-auto mb-2" style={{ color: '#CBCBCB' }} />
                    <p className="text-xs" style={{ color: '#5A5A5A' }}>
                      No conversations match your search
                    </p>
                  </div>
                )}

                {threads.length === 0 && (
                  <div className="p-8 text-center">
                    <Inbox className="h-8 w-8 mx-auto mb-2" style={{ color: '#CBCBCB' }} />
                    <p className="text-xs" style={{ color: '#5A5A5A' }}>
                      No deal conversations yet
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: '#9A9A9A' }}>
                      Start a General Inquiry or connect with a deal
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Thread View (right panel) */}
          <div
            className={cn(
              'flex-1 flex flex-col min-h-0',
              !hasActiveView && !showGeneralChat ? 'hidden md:flex' : 'flex',
            )}
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
                  <Inbox className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium" style={{ color: '#5A5A5A' }}>
                    Select a conversation
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#9A9A9A' }}>
                    Choose from the list to view messages
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

// ─── Thread List Item ───

function ThreadListItem({
  thread,
  isSelected,
  onClick,
}: {
  thread: BuyerThread;
  isSelected: boolean;
  onClick: () => void;
}) {
  const timeLabel = formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: false });

  const statusStyle = (() => {
    switch (thread.request_status) {
      case 'approved':
        return { backgroundColor: '#DEC76B', color: '#0E101A' };
      case 'pending':
        return { backgroundColor: '#F7F4DD', color: '#5A5A5A', border: '1px solid #DEC76B' };
      case 'rejected':
        return { backgroundColor: '#8B0000', color: '#FFFFFF' };
      case 'on_hold':
        return { backgroundColor: '#F59E0B20', color: '#92400E' };
      default:
        return { backgroundColor: '#E8E8E8', color: '#5A5A5A' };
    }
  })();

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 transition-colors',
        isSelected ? 'bg-accent' : 'hover:bg-accent/50',
      )}
      style={thread.unread_count > 0 && !isSelected ? { backgroundColor: '#FFFDF5' } : undefined}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-1.5 flex-shrink-0">
          {thread.unread_count > 0 ? (
            <Circle className="w-2.5 h-2.5 fill-[#8B0000] text-[#8B0000]" />
          ) : (
            <Circle className="w-2.5 h-2.5" style={{ color: '#CBCBCB' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {/* Row 1: Deal title + time */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'text-sm truncate',
                thread.unread_count > 0 ? 'font-semibold' : 'font-medium',
              )}
              style={{ color: '#0E101A' }}
            >
              {thread.deal_title}
            </span>
            <span className="text-[10px] flex-shrink-0" style={{ color: '#9A9A9A' }}>
              {timeLabel}
            </span>
          </div>

          {/* Row 2: Category + status */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {thread.deal_category && (
              <span className="text-[11px]" style={{ color: '#5A5A5A' }}>
                {thread.deal_category}
              </span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={statusStyle}>
              {thread.request_status === 'on_hold' ? 'On Hold' : thread.request_status}
            </span>
          </div>

          {/* Row 3: Last message preview */}
          <p
            className={cn(
              'text-[11px] mt-0.5 truncate',
              thread.unread_count > 0 ? 'font-medium' : '',
            )}
            style={{ color: thread.unread_count > 0 ? '#0E101A' : '#5A5A5A' }}
          >
            {thread.last_sender_role === 'buyer' && 'You: '}
            {thread.last_message_body || 'No messages yet'}
          </p>
        </div>

        {/* Unread badge */}
        {thread.unread_count > 0 && (
          <span
            className="mt-1 flex-shrink-0 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
            style={{ backgroundColor: '#8B0000', color: '#FFFFFF' }}
          >
            {thread.unread_count}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Buyer Thread View ───

function BuyerThreadView({ thread, onBack }: { thread: BuyerThread; onBack: () => void }) {
  const { data: messages = [], isLoading } = useConnectionMessages(thread.connection_request_id);
  const sendMsg = useSendMessage();
  const markRead = useMarkMessagesReadByBuyer();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isRejected = thread.request_status === 'rejected';

  useEffect(() => {
    if (thread.connection_request_id && thread.unread_count > 0) {
      markRead.mutate(thread.connection_request_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.connection_request_id, thread.unread_count]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim() || isRejected) return;
    sendMsg.mutate({
      connection_request_id: thread.connection_request_id,
      body: newMessage.trim(),
      sender_role: 'buyer',
    });
    setNewMessage('');
  };

  const statusStyle = (() => {
    switch (thread.request_status) {
      case 'approved':
        return { backgroundColor: '#DEC76B', color: '#0E101A' };
      case 'pending':
        return { backgroundColor: '#F7F4DD', color: '#5A5A5A', border: '1px solid #DEC76B' };
      case 'rejected':
        return { backgroundColor: '#8B0000', color: '#FFFFFF' };
      case 'on_hold':
        return { backgroundColor: '#F59E0B20', color: '#92400E' };
      default:
        return { backgroundColor: '#E8E8E8', color: '#5A5A5A' };
    }
  })();

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #E5DDD0' }}
      >
        <Button variant="ghost" size="sm" onClick={onBack} className="md:hidden h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold truncate" style={{ color: '#0E101A' }}>
              {thread.deal_title}
            </h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={statusStyle}>
              {thread.request_status === 'on_hold' ? 'On Hold' : thread.request_status}
            </span>
          </div>
          <p className="text-xs" style={{ color: '#5A5A5A' }}>
            SourceCo Team
          </p>
        </div>
        <Link
          to={`/my-deals?deal=${thread.connection_request_id}`}
          className="text-xs flex items-center gap-1 shrink-0 hover:opacity-80"
          style={{ color: '#0E101A' }}
        >
          View deal <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" style={{ backgroundColor: '#FCF9F0' }}>
        <div className="px-5 py-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-3/4" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: '#CBCBCB' }} />
                <p className="text-sm" style={{ color: '#5A5A5A' }}>
                  No messages yet
                </p>
                <p className="text-xs mt-1" style={{ color: '#9A9A9A' }}>
                  Send a message to start the conversation
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isSystem = msg.message_type === 'decision' || msg.message_type === 'system';
              const isBuyer = msg.sender_role === 'buyer';

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div
                      className="italic text-xs px-3 py-1.5 rounded-full max-w-[80%]"
                      style={{ backgroundColor: '#F7F4DD', color: '#5A5A5A' }}
                    >
                      <MessageBody body={msg.body} variant="system" />
                      <span className="opacity-50 text-[10px] ml-2">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={cn('flex', isBuyer ? 'justify-end' : 'justify-start')}>
                  <div
                    className="max-w-[80%] rounded-xl px-4 py-3 space-y-1 shadow-sm border"
                    style={
                      isBuyer
                        ? {
                            backgroundColor: '#0E101A',
                            borderColor: '#0E101A',
                            color: '#FFFFFF',
                          }
                        : {
                            backgroundColor: '#FFFFFF',
                            borderColor: '#E5DDD0',
                            color: '#0E101A',
                          }
                    }
                  >
                    <div
                      className="flex items-center gap-2 text-[11px]"
                      style={{
                        color: isBuyer ? 'rgba(255,255,255,0.6)' : '#5A5A5A',
                      }}
                    >
                      <span className="font-medium">
                        {isBuyer ? 'You' : msg.sender?.first_name || 'SourceCo'}
                      </span>
                      <span>·</span>
                      <span>
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-sm leading-relaxed">
                      <MessageBody body={msg.body} variant={isBuyer ? 'buyer' : 'admin'} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Compose bar */}
      {isRejected ? (
        <div className="px-5 py-3 text-center" style={{ borderTop: '1px solid #E5DDD0' }}>
          <p className="text-xs" style={{ color: '#5A5A5A' }}>
            This deal is no longer active.
          </p>
        </div>
      ) : (
        <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid #E5DDD0' }}>
          <div
            className="flex items-end gap-3 rounded-lg border-2 p-2"
            style={{ borderColor: '#E5DDD0', backgroundColor: '#FFFFFF' }}
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message SourceCo about this deal..."
              className="flex-1 text-sm px-2 py-1.5 bg-transparent focus:outline-none"
              style={{ color: '#0E101A' }}
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMsg.isPending}
              className="h-9 px-4"
              style={{ backgroundColor: '#0E101A', color: '#FFFFFF' }}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Send
            </Button>
          </div>
          <p className="text-[10px] mt-1" style={{ color: '#9A9A9A' }}>
            Enter to send
          </p>
        </div>
      )}
    </div>
  );
}

// ─── General Chat View ───

function GeneralChatView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentMessages, setSentMessages] = useState<
    Array<{ id: string; body: string; created_at: string }>
  >([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: activeRequest } = useQuery({
    queryKey: ['buyer-active-request', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('connection_requests')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['approved', 'on_hold', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: existingMessages = [] } = useConnectionMessages(activeRequest?.id || '');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [existingMessages, sentMessages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending || !user?.id) return;
    setSending(true);

    try {
      if (activeRequest?.id) {
        const { error } = await (supabase.from('connection_messages') as any).insert({
          connection_request_id: activeRequest.id,
          sender_id: user.id,
          body: newMessage.trim(),
          sender_role: 'buyer',
        });
        if (error) throw error;
      } else {
        const OZ_ADMIN_ID = 'ea1f0064-52ef-43fb-bec4-22391b720328';
        await supabase.functions.invoke('notify-admin-document-question', {
          body: {
            admin_id: OZ_ADMIN_ID,
            user_id: user.id,
            document_type: 'General Inquiry',
            question: newMessage.trim(),
          },
        });
      }

      setSentMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          body: newMessage.trim(),
          created_at: new Date().toISOString(),
        },
      ]);
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['buyer-message-threads'] });
      queryClient.invalidateQueries({ queryKey: ['connection-messages'] });

      if (!activeRequest?.id) {
        toast({ title: 'Message Sent', description: 'Our team will respond shortly.' });
      }
    } catch (err) {
      console.error('Error sending message:', err);
      toast({
        title: 'Failed to Send',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const allMessages = activeRequest?.id ? existingMessages : sentMessages;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #E5DDD0' }}
      >
        <Button variant="ghost" size="sm" onClick={onBack} className="md:hidden h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" style={{ color: '#DEC76B' }} />
            <h2 className="text-sm font-semibold" style={{ color: '#0E101A' }}>
              General Inquiry
            </h2>
          </div>
          <p className="text-xs" style={{ color: '#5A5A5A' }}>
            Message the SourceCo team
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" style={{ backgroundColor: '#FCF9F0' }}>
        <div className="px-5 py-4 space-y-3">
          {allMessages.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <MessageSquare className="h-10 w-10 mx-auto mb-3" style={{ color: '#CBCBCB' }} />
                <p className="text-sm" style={{ color: '#5A5A5A' }}>
                  Send a message to start a conversation with the SourceCo team.
                </p>
              </div>
            </div>
          ) : (
            allMessages.map((msg: any) => (
              <div
                key={msg.id}
                className={cn(
                  'flex',
                  msg.sender_role === 'buyer' || !msg.sender_role ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className="max-w-[80%] rounded-xl px-4 py-3 space-y-1 shadow-sm border"
                  style={
                    msg.sender_role === 'buyer' || !msg.sender_role
                      ? {
                          backgroundColor: '#0E101A',
                          borderColor: '#0E101A',
                          color: '#FFFFFF',
                        }
                      : {
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E5DDD0',
                          color: '#0E101A',
                        }
                  }
                >
                  <div
                    className="flex items-center gap-2 text-[11px]"
                    style={{
                      color:
                        msg.sender_role === 'buyer' || !msg.sender_role
                          ? 'rgba(255,255,255,0.6)'
                          : '#5A5A5A',
                    }}
                  >
                    <span className="font-medium">
                      {msg.sender_role === 'buyer' || !msg.sender_role
                        ? 'You'
                        : msg.sender?.first_name || 'SourceCo'}
                    </span>
                    <span>·</span>
                    <span>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-sm leading-relaxed">
                    <MessageBody
                      body={msg.body}
                      variant={msg.sender_role === 'buyer' || !msg.sender_role ? 'buyer' : 'admin'}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid #E5DDD0' }}>
        <div
          className="flex items-end gap-3 rounded-lg border-2 p-2"
          style={{ borderColor: '#E5DDD0', backgroundColor: '#FFFFFF' }}
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message the SourceCo team..."
            className="flex-1 text-sm px-2 py-1.5 bg-transparent focus:outline-none"
            style={{ color: '#0E101A' }}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="h-9 px-4"
            style={{ backgroundColor: '#0E101A', color: '#FFFFFF' }}
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Send
          </Button>
        </div>
        <p className="text-[10px] mt-1" style={{ color: '#9A9A9A' }}>
          Enter to send
        </p>
      </div>
    </div>
  );
}

// ─── Helper Components ───

function MessageBody({ body, variant }: { body: string; variant: 'buyer' | 'admin' | 'system' }) {
  const parts = body.split(/(https?:\/\/[^\s]+)/g);

  return (
    <p className="whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>
      {parts.map((part, i) => {
        if (/^https?:\/\//.test(part)) {
          let displayUrl: string;
          try {
            const url = new URL(part);
            const path = url.pathname.length > 30 ? url.pathname.slice(0, 30) + '…' : url.pathname;
            displayUrl = url.hostname + path;
          } catch {
            displayUrl = part.length > 50 ? part.slice(0, 50) + '…' : part;
          }

          const linkColor =
            variant === 'buyer'
              ? 'underline underline-offset-2 opacity-80'
              : 'underline underline-offset-2';

          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkColor} hover:opacity-80 break-all text-xs`}
            >
              {displayUrl}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function BuyerMessagesSkeleton() {
  return (
    <div
      className="rounded-xl overflow-hidden min-h-[500px] flex"
      style={{ border: '2px solid #CBCBCB', backgroundColor: '#FFFFFF' }}
    >
      <div className="w-[360px] p-4 space-y-4" style={{ borderRight: '1px solid #E5DDD0' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-[180px]" />
            <Skeleton className="h-3 w-[120px]" />
            <Skeleton className="h-3 w-[240px]" />
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Inbox className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <Skeleton className="h-4 w-[160px] mx-auto" />
        </div>
      </div>
    </div>
  );
}

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
        toast({
          title: 'Download Failed',
          description: 'Could not retrieve document.',
          variant: 'destructive',
        });
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        toast({
          title: 'Not Available',
          description: 'Document is not yet available for download.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Download Failed',
        description: 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size="sm" onClick={handleDownload} disabled={loading}>
      {loading ? (
        <span className="h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <FileSignature className="h-3.5 w-3.5 mr-1.5" />
      )}
      {label}
    </Button>
  );
}

// ─── Pending Agreement Banner ───

function PendingAgreementBanner() {
  const { user } = useAuth();
  const [signingOpen, setSigningOpen] = useState(false);
  const [signingDocType, setSigningDocType] = useState<'nda' | 'fee_agreement'>('nda');
  const [docMessageOpen, setDocMessageOpen] = useState(false);
  const [docMessageType, setDocMessageType] = useState<'nda' | 'fee_agreement'>('nda');
  const [docQuestion, setDocQuestion] = useState('');
  const sendDocQuestion = useSendDocumentQuestion();

  const { data: firmStatus } = useQuery({
    queryKey: ['buyer-firm-agreement-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: membership } = await supabase
        .from('firm_members')
        .select('firm_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (!membership) return null;

      const { data: firm } = await supabase
        .from('firm_agreements')
        .select(
          'nda_signed, nda_signed_at, nda_signed_document_url, nda_document_url, nda_docuseal_status, fee_agreement_signed, fee_agreement_signed_at, fee_signed_document_url, fee_agreement_document_url, fee_docuseal_status',
        )
        .eq('id', membership.firm_id)
        .maybeSingle();
      return firm;
    },
    enabled: !!user?.id,
    staleTime: 15_000,
  });

  const { data: pendingNotifications = [] } = useQuery({
    queryKey: ['agreement-pending-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('user_notifications')
        .select('id, metadata, message, created_at')
        .eq('user_id', user.id)
        .eq('notification_type', 'agreement_pending')
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user?.id,
  });

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
    const ndaNotif = pendingNotifications.find(
      (n: Record<string, unknown>) =>
        (n.metadata as Record<string, unknown>)?.document_type === 'nda',
    );
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
    const feeNotif = pendingNotifications.find(
      (n: Record<string, unknown>) =>
        (n.metadata as Record<string, unknown>)?.document_type === 'fee_agreement',
    );
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

  const hasPending = items.some((i) => !i.signed);
  const allSigned = items.every((i) => i.signed);

  return (
    <>
      <div
        className="rounded-xl overflow-hidden mb-0"
        style={{ border: '1px solid #CBCBCB', backgroundColor: '#FFFFFF' }}
      >
        <div className="px-5 py-3" style={{ borderBottom: '1px solid #E5DDD0' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#0E101A' }}>
            {allSigned ? 'Signed Documents' : hasPending ? 'Action Required' : 'Documents'}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>
            {allSigned
              ? 'All agreements are signed. Download copies for your records.'
              : 'Sign these documents to continue accessing deal details'}
          </p>
        </div>
        <div className="divide-y" style={{ borderColor: '#E5DDD0' }}>
          {items.map((item) => (
            <div key={item.key} className="flex items-center gap-4 px-5 py-3">
              <div
                className="p-2 rounded-full"
                style={{ backgroundColor: item.signed ? '#F7F4DD' : '#FCF9F0' }}
              >
                {item.type === 'nda' ? (
                  <Shield
                    className="h-5 w-5"
                    style={{ color: item.signed ? '#DEC76B' : '#5A5A5A' }}
                  />
                ) : (
                  <FileSignature
                    className="h-5 w-5"
                    style={{ color: item.signed ? '#DEC76B' : '#5A5A5A' }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium" style={{ color: '#0E101A' }}>
                    {item.signed ? `${item.label} — Signed` : `${item.label} Ready to Sign`}
                  </p>
                  {item.signed && (
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: '#DEC76B' }} />
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>
                  {item.signed
                    ? item.signedAt
                      ? `Signed ${formatDistanceToNow(new Date(item.signedAt), { addSuffix: true })}`
                      : 'Signed'
                    : item.notificationMessage ||
                      `A ${item.label} has been prepared for your review. You can sign, or download and send us a redline.`}
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
                      onClick={() => {
                        setDocMessageType(item.type);
                        setDocMessageOpen(true);
                      }}
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5 mr-1.5" />
                      Redlines / Questions?
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSigningDocType(item.type);
                        setSigningOpen(true);
                      }}
                      style={{ backgroundColor: '#0E101A', color: '#FFFFFF' }}
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

      <Dialog
        open={docMessageOpen}
        onOpenChange={(open) => {
          setDocMessageOpen(open);
          if (!open) setDocQuestion('');
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquarePlus className="h-4 w-4" />
              Question about {docMessageType === 'nda' ? 'NDA' : 'Fee Agreement'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm" style={{ color: '#5A5A5A' }}>
              Have redlines or comments? You can describe your requested changes below, or download
              the document and send us back a redlined version. Our team will respond quickly.
            </p>
            <textarea
              value={docQuestion}
              onChange={(e) => setDocQuestion(e.target.value)}
              placeholder="Describe your redlines, questions, or requested changes..."
              className="w-full min-h-[120px] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 resize-none"
              style={{
                border: '1px solid #CBCBCB',
                backgroundColor: '#FCF9F0',
                color: '#0E101A',
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDocMessageOpen(false);
                  setDocQuestion('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!docQuestion.trim() || sendDocQuestion.isPending}
                onClick={() => {
                  sendDocQuestion.mutate(
                    {
                      documentType: docMessageType,
                      question: docQuestion.trim(),
                      userId: user?.id || '',
                    },
                    {
                      onSuccess: () => {
                        setDocMessageOpen(false);
                        setDocQuestion('');
                      },
                    },
                  );
                }}
                style={{ backgroundColor: '#0E101A', color: '#FFFFFF' }}
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
