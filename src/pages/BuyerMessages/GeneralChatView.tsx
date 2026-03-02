import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { useConnectionMessages } from '@/hooks/use-connection-messages';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

import { useBuyerActiveRequest } from './useMessagesData';
import { MessageBody } from './MessageBody';
import { MessageInput } from './MessageInput';

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
  const [sentMessages, setSentMessages] = useState<
    Array<{ id: string; body: string; created_at: string }>
  >([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: activeRequest } = useBuyerActiveRequest();

  const { data: existingMessages = [] } = useConnectionMessages(activeRequest?.id || '');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [existingMessages, sentMessages]);

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
      <MessageInput
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        onSend={handleSend}
        isSending={sending}
        isUploading={uploading}
        attachment={attachment}
        onAttachmentChange={setAttachment}
        placeholder="Message the SourceCo team..."
      />
    </div>
  );
}
