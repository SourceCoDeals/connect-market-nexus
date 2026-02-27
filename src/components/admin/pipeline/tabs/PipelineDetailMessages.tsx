import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, AlertCircle } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useConnectionMessages, useSendMessage, useMarkMessagesReadByAdmin } from '@/hooks/use-connection-messages';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface PipelineDetailMessagesProps {
  deal: Deal;
}

export function PipelineDetailMessages({ deal }: PipelineDetailMessagesProps) {
  const connectionRequestId = deal.connection_request_id;
  const { data: messages = [], isLoading } = useConnectionMessages(connectionRequestId);
  const sendMessage = useSendMessage();
  const markRead = useMarkMessagesReadByAdmin();
  const [newMessage, setNewMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Mark messages as read when tab opens
  useEffect(() => {
    if (connectionRequestId && messages.length > 0) {
      markRead.mutate(connectionRequestId);
    }
  }, [connectionRequestId, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (!newMessage.trim() || !connectionRequestId) return;
    sendMessage.mutate(
      {
        connection_request_id: connectionRequestId,
        body: newMessage.trim(),
        sender_role: 'admin',
      },
      { onSuccess: () => setNewMessage('') }
    );
  };

  if (!connectionRequestId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3 max-w-xs">
          <AlertCircle className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No messaging available</p>
          <p className="text-xs text-muted-foreground/60">
            This deal was not created from a marketplace connection request, so in-platform messaging is unavailable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Message thread */}
      <ScrollArea className="flex-1 px-6">
        <div className="py-4 space-y-3 rounded-lg p-4" style={{ backgroundColor: '#FCF9F0' }}>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/20 animate-pulse h-16" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground/60">Send a message to start the conversation.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isAdmin = msg.sender_role === 'admin';
              const senderName = msg.sender
                ? `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim() || msg.sender.email
                : isAdmin ? 'Admin' : 'Buyer';

              return (
                <div
                  key={msg.id}
                  className={cn(
                    'max-w-[80%] rounded-xl px-4 py-3 space-y-1 shadow-sm',
                    isAdmin
                      ? 'ml-auto border'
                      : 'mr-auto border'
                  )}
                  style={isAdmin
                    ? { backgroundColor: '#F7F4DD', borderColor: '#E5DDD0', color: '#0E101A' }
                    : { backgroundColor: '#FFFFFF', borderColor: '#E5DDD0', color: '#0E101A' }
                  }
                >
                  <div className="flex items-center gap-2 text-xs" style={{ color: '#5A5A5A' }}>
                    <span className="font-medium">{senderName}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="text-base whitespace-pre-wrap leading-relaxed" style={{ color: '#0E101A' }}>{msg.body}</p>
                  {msg.message_type === 'decision' && (
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: '#DEC76B', color: '#0E101A' }}>
                      Decision
                    </span>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Compose bar */}
      <div className="px-6 py-4" style={{ borderTop: '1px solid #E5DDD0' }}>
        <div className="flex items-end gap-3">
          <Textarea
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="min-h-[60px] max-h-[120px] resize-none text-sm flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSend();
              }
            }}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending}
            className="h-9 px-4"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Send
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">Cmd/Ctrl + Enter to send</p>
      </div>
    </div>
  );
}
