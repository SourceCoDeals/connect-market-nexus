import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Inbox,
  ExternalLink,
  FileSignature,
  Shield,
  CheckCircle,
  MessageSquarePlus,
  Paperclip,
  X,
  Download,
  Check,
  CheckCheck,
} from 'lucide-react';
import {
  useConnectionMessages,
  useSendMessage,
  useMarkMessagesReadByBuyer,
} from '@/hooks/use-connection-messages';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { AgreementSigningModal } from '@/components/docuseal/AgreementSigningModal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

import type { BuyerThread } from './helpers';
import { getStatusStyle, getStatusLabel } from './helpers';
import {
  useBuyerActiveRequest,
  useFirmAgreementStatus,
  usePendingNotifications,
} from './useMessagesData';
import { useSendDocumentQuestion, useDownloadDocument } from './useMessagesActions';

// ─── MessageBody ───
// Renders message text, auto-linking URLs.

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg';

function AttachmentChip({
  fileName,
  url,
  variant,
}: {
  fileName: string;
  url: string;
  variant: 'buyer' | 'admin' | 'system';
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-80"
      style={{
        backgroundColor: variant === 'buyer' ? 'rgba(255,255,255,0.15)' : '#FCF9F0',
        color: variant === 'buyer' ? '#FFFFFF' : '#0E101A',
        border: variant === 'buyer' ? '1px solid rgba(255,255,255,0.2)' : '1px solid #E5DDD0',
      }}
    >
      <Download className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[200px]">{fileName}</span>
    </a>
  );
}

function MessageBody({ body, variant }: { body: string; variant: 'buyer' | 'admin' | 'system' }) {
  // Split on attachment link pattern: [📎 filename](url)
  const attachmentRegex = /\[📎\s+([^\]]+)\]\(([^)]+)\)/g;
  const segments: Array<
    { type: 'text'; value: string } | { type: 'attachment'; fileName: string; url: string }
  > = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = attachmentRegex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: body.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'attachment', fileName: match[1], url: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) {
    segments.push({ type: 'text', value: body.slice(lastIndex) });
  }

  return (
    <div
      className="whitespace-pre-wrap break-words space-y-1.5"
      style={{ overflowWrap: 'anywhere' }}
    >
      {segments.map((seg, segIdx) => {
        if (seg.type === 'attachment') {
          return (
            <AttachmentChip key={segIdx} fileName={seg.fileName} url={seg.url} variant={variant} />
          );
        }
        // Render text segment with URL auto-linking
        const parts = seg.value.split(/(https?:\/\/[^\s]+)/g);
        const trimmed = seg.value.trim();
        if (!trimmed) return null;
        return (
          <p
            key={segIdx}
            className="whitespace-pre-wrap break-words"
            style={{ overflowWrap: 'anywhere' }}
          >
            {parts.map((part, i) => {
              if (/^https?:\/\//.test(part)) {
                let displayUrl: string;
                try {
                  const url = new URL(part);
                  const path =
                    url.pathname.length > 30 ? url.pathname.slice(0, 30) + '\u2026' : url.pathname;
                  displayUrl = url.hostname + path;
                } catch {
                  displayUrl = part.length > 50 ? part.slice(0, 50) + '\u2026' : part;
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
                    className={`${linkColor} hover:opacity-80 break-all text-sm`}
                  >
                    {displayUrl}
                  </a>
                );
              }
              return <span key={i}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

// ─── TypingIndicator ───
// Animated dots shown when the other party is typing.

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="rounded-xl px-4 py-3 shadow-sm border"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#E5DDD0',
          color: '#0E101A',
        }}
      >
        <div className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ backgroundColor: '#9A9A9A', animationDelay: '0ms', animationDuration: '1s' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ backgroundColor: '#9A9A9A', animationDelay: '150ms', animationDuration: '1s' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ backgroundColor: '#9A9A9A', animationDelay: '300ms', animationDuration: '1s' }}
          />
        </div>
      </div>
    </div>
  );
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
          // Clear any existing timeout
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          // Auto-hide after 3 seconds of no typing events
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
      // Debounce: only send typing event if we haven't sent one recently
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast({
        title: 'File Too Large',
        description: 'Maximum file size is 10MB.',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }
    setAttachment(file);
    e.target.value = '';
  };

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
          // Bucket may not exist -- fall back to inline filename
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
                      className="italic text-sm px-3 py-1.5 rounded-full max-w-[80%]"
                      style={{ backgroundColor: '#F7F4DD', color: '#3a3a3a' }}
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
                <div
                  key={msg.id}
                  className={cn('flex flex-col', isBuyer ? 'items-end' : 'items-start')}
                >
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
                      <span>&middot;</span>
                      <span>
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-base leading-relaxed">
                      <MessageBody body={msg.body} variant={isBuyer ? 'buyer' : 'admin'} />
                    </div>
                  </div>
                  {/* Read receipt for buyer-sent messages */}
                  {isBuyer && (
                    <div
                      className="flex items-center gap-1 mt-0.5 mr-1"
                      style={{ color: '#9A9A9A' }}
                    >
                      {msg.is_read_by_admin ? (
                        <>
                          <CheckCheck className="h-3 w-3" />
                          <span className="text-[10px]">Read</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3 w-3" />
                          <span className="text-[10px]">Delivered</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {/* Typing indicator when admin is typing */}
          {isAdminTyping && <TypingIndicator />}
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
          {attachment && (
            <div
              className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg text-sm"
              style={{ backgroundColor: '#FCF9F0', border: '1px solid #E5DDD0', color: '#0E101A' }}
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0" style={{ color: '#5A5A5A' }} />
              <span className="truncate flex-1">{attachment.name}</span>
              <span className="text-[10px] shrink-0" style={{ color: '#9A9A9A' }}>
                {(attachment.size / 1024).toFixed(0)}KB
              </span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="shrink-0 p-0.5 rounded hover:bg-black/5"
              >
                <X className="h-3.5 w-3.5" style={{ color: '#5A5A5A' }} />
              </button>
            </div>
          )}
          <div
            className="flex items-end gap-3 rounded-lg border-2 p-2"
            style={{ borderColor: '#E5DDD0', backgroundColor: '#FFFFFF' }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 p-1.5 rounded hover:bg-black/5 transition-colors"
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" style={{ color: '#5A5A5A' }} />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
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
              disabled={(!newMessage.trim() && !attachment) || sendMsg.isPending || uploading}
              className="h-9 px-4"
              style={{ backgroundColor: '#0E101A', color: '#FFFFFF' }}
            >
              {uploading ? (
                <span className="h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Send className="w-3.5 h-3.5 mr-1.5" />
              )}
              {uploading ? 'Uploading...' : 'Send'}
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

// ─── GeneralChatView ───
// A general inquiry chat not tied to any specific deal.

export function GeneralChatView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sentMessages, setSentMessages] = useState<
    Array<{ id: string; body: string; created_at: string }>
  >([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: activeRequest } = useBuyerActiveRequest();

  const { data: existingMessages = [] } = useConnectionMessages(activeRequest?.id || '');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [existingMessages, sentMessages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast({
        title: 'File Too Large',
        description: 'Maximum file size is 10MB.',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }
    setAttachment(file);
    e.target.value = '';
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !attachment) || sending || !user?.id) return;
    setSending(true);

    let body = newMessage.trim();

    // Handle file attachment upload
    if (attachment) {
      setUploading(true);
      try {
        const bucketPath = `general/${user.id}/${Date.now()}-${attachment.name}`;
        const { error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(bucketPath, attachment);

        if (uploadError) {
          body = body
            ? `${body}\n[📎 ${attachment.name}](attachment://${attachment.name})`
            : `[📎 ${attachment.name}](attachment://${attachment.name})`;
        } else {
          const { data: urlData } = supabase.storage
            .from('message-attachments')
            .getPublicUrl(bucketPath);
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

    if (!body) {
      setSending(false);
      return;
    }

    try {
      if (activeRequest?.id) {
        const { error } = await (supabase.from('connection_messages') as any).insert({
          connection_request_id: activeRequest.id,
          sender_id: user.id,
          body,
          sender_role: 'buyer',
        });
        if (error) throw error;
      } else {
        const { OZ_ADMIN_ID } = await import('@/constants');
        await supabase.functions.invoke('notify-admin-document-question', {
          body: {
            admin_id: OZ_ADMIN_ID,
            user_id: user.id,
            document_type: 'General Inquiry',
            question: body,
          },
        });
      }

      setSentMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          body,
          created_at: new Date().toISOString(),
        },
      ]);
      setNewMessage('');
      setAttachment(null);
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
                    <span>&middot;</span>
                    <span>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-base leading-relaxed">
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
        {attachment && (
          <div
            className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg text-sm"
            style={{ backgroundColor: '#FCF9F0', border: '1px solid #E5DDD0', color: '#0E101A' }}
          >
            <Paperclip className="h-3.5 w-3.5 shrink-0" style={{ color: '#5A5A5A' }} />
            <span className="truncate flex-1">{attachment.name}</span>
            <span className="text-[10px] shrink-0" style={{ color: '#9A9A9A' }}>
              {(attachment.size / 1024).toFixed(0)}KB
            </span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="shrink-0 p-0.5 rounded hover:bg-black/5"
            >
              <X className="h-3.5 w-3.5" style={{ color: '#5A5A5A' }} />
            </button>
          </div>
        )}
        <div
          className="flex items-end gap-3 rounded-lg border-2 p-2"
          style={{ borderColor: '#E5DDD0', backgroundColor: '#FFFFFF' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 p-1.5 rounded hover:bg-black/5 transition-colors"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" style={{ color: '#5A5A5A' }} />
          </button>
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
            disabled={(!newMessage.trim() && !attachment) || sending || uploading}
            className="h-9 px-4"
            style={{ backgroundColor: '#0E101A', color: '#FFFFFF' }}
          >
            {uploading ? (
              <span className="h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Send className="w-3.5 h-3.5 mr-1.5" />
            )}
            {uploading ? 'Uploading...' : 'Send'}
          </Button>
        </div>
        <p className="text-[10px] mt-1" style={{ color: '#9A9A9A' }}>
          Enter to send
        </p>
      </div>
    </div>
  );
}

// ─── DownloadDocButton ───

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
  const download = useDownloadDocument();

  const handleDownload = async () => {
    setLoading(true);
    try {
      await download({ documentUrl, draftUrl, documentType });
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

// ─── PendingAgreementBanner ───
// Shows signed/pending document statuses and allows signing or asking questions.

export function PendingAgreementBanner() {
  const { user } = useAuth();
  const [signingOpen, setSigningOpen] = useState(false);
  const [signingDocType, setSigningDocType] = useState<'nda' | 'fee_agreement'>('nda');
  const [docMessageOpen, setDocMessageOpen] = useState(false);
  const [docMessageType, setDocMessageType] = useState<'nda' | 'fee_agreement'>('nda');
  const [docQuestion, setDocQuestion] = useState('');
  const sendDocQuestion = useSendDocumentQuestion();

  const { data: firmStatus } = useFirmAgreementStatus();
  const { data: pendingNotifications = [] } = usePendingNotifications();

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
                    {item.signed ? `${item.label} \u2014 Signed` : `${item.label} Ready to Sign`}
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
