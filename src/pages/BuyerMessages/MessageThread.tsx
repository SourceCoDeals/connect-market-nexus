import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ExternalLink, Inbox } from 'lucide-react';
import {
  useConnectionMessages,
  useSendMessage,
  useMarkMessagesReadByBuyer,
} from '@/hooks/use-connection-messages';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

import type { BuyerThread } from './helpers';
import { getStatusStyle, getStatusLabel } from './helpers';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

// Re-export components consumed by index.tsx
export { GeneralChatView } from './GeneralChatView';
export { PendingAgreementBanner } from './AgreementSection';

// ─── BuyerThreadView ───
// Displays a message thread for a specific deal.

export function BuyerThreadView({ thread, onBack }: { thread: BuyerThread; onBack: () => void }) {
  const { data: messages = [], isLoading } = useConnectionMessages(thread.connection_request_id);
  const sendMsg = useSendMessage();
  const markRead = useMarkMessagesReadByBuyer();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isRejected = thread.request_status === 'rejected';

  // ─── Typing indicator state ───
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buyerTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to Supabase broadcast channel for typing events
  useEffect(() => {
    const channelName = `typing:${thread.connection_request_id}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.role === 'admin') {
          setIsAdminTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsAdminTyping(false);
          }, 3000);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (buyerTypingTimeoutRef.current) clearTimeout(buyerTypingTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [thread.connection_request_id]);

  // Broadcast buyer typing event (debounced)
  const broadcastTyping = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { role: 'buyer' },
    });
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewMessage(e.target.value);
      if (!buyerTypingTimeoutRef.current) {
        broadcastTyping();
      }
      if (buyerTypingTimeoutRef.current) clearTimeout(buyerTypingTimeoutRef.current);
      buyerTypingTimeoutRef.current = setTimeout(() => {
        buyerTypingTimeoutRef.current = null;
      }, 1000);
    },
    [broadcastTyping],
  );

  // Hide admin typing when new messages arrive
  useEffect(() => {
    setIsAdminTyping(false);
  }, [messages.length]);

  useEffect(() => {
    if (thread.connection_request_id && thread.unread_count > 0) {
      markRead.mutate(thread.connection_request_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.connection_request_id, thread.unread_count]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAdminTyping]);

  const handleSend = async () => {
    if ((!newMessage.trim() && !attachment) || isRejected) return;

    let body = newMessage.trim();

    if (attachment) {
      setUploading(true);
      try {
        const filePath = `${thread.connection_request_id}/${Date.now()}-${attachment.name}`;
        const { error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(filePath, attachment);

        if (uploadError) {
          body = body
            ? `${body}\n[📎 ${attachment.name}](attachment://${attachment.name})`
            : `[📎 ${attachment.name}](attachment://${attachment.name})`;
        } else {
          const { data: urlData } = supabase.storage
            .from('message-attachments')
            .getPublicUrl(filePath);
          const publicUrl = urlData?.publicUrl || `attachment://${attachment.name}`;
          body = body
            ? `${body}\n[📎 ${attachment.name}](${publicUrl})`
            : `[📎 ${attachment.name}](${publicUrl})`;
        }
      } catch {
        body = body
          ? `${body}\n[📎 ${attachment.name}](attachment://${attachment.name})`
          : `[📎 ${attachment.name}](attachment://${attachment.name})`;
      } finally {
        setUploading(false);
      }
    }

    if (!body) return;

    sendMsg.mutate({
      connection_request_id: thread.connection_request_id,
      body,
      sender_role: 'buyer',
    });
    setNewMessage('');
    setAttachment(null);
  };

  const statusStyle = getStatusStyle(thread.request_status);

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
              {getStatusLabel(thread.request_status)}
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
      <MessageList
        messages={messages}
        isLoading={isLoading}
        isAdminTyping={isAdminTyping}
        messagesEndRef={messagesEndRef}
      />

      {/* Compose bar */}
      {isRejected ? (
        <div className="px-5 py-3 text-center" style={{ borderTop: '1px solid #E5DDD0' }}>
          <p className="text-xs" style={{ color: '#5A5A5A' }}>
            This deal is no longer active.
          </p>
        </div>
      ) : (
        <MessageInput
          value={newMessage}
          onChange={handleInputChange}
          onSend={handleSend}
          isSending={sendMsg.isPending}
          isUploading={uploading}
          attachment={attachment}
          onAttachmentChange={setAttachment}
          placeholder="Message SourceCo about this deal..."
        />
      )}
    </div>
  );
}

// ─── BuyerMessagesSkeleton ───
// Loading skeleton shown while threads are being fetched.

export function BuyerMessagesSkeleton() {
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
