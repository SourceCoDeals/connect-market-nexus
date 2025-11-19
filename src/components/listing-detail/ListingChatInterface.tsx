import { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, X } from 'lucide-react';
import { useListingConversation, useSendListingMessage } from '@/hooks/use-listing-conversations';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useEffect as useEffectSession, useState as useStateSession } from 'react';

interface ListingChatInterfaceProps {
  connectionRequestId: string;
  onClose: () => void;
}

export function ListingChatInterface({ connectionRequestId, onClose }: ListingChatInterfaceProps) {
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useStateSession<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffectSession(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);
  
  const { data: conversation, isLoading } = useListingConversation(connectionRequestId);
  const sendMessage = useSendListingMessage();

  const messages = conversation?.listing_messages?.filter(m => !m.is_internal_note) || [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !conversation?.id) return;

    await sendMessage.mutateAsync({
      conversationId: conversation.id,
      messageText: message.trim(),
      senderType: 'buyer',
    });

    setMessage('');
  };

  if (isLoading) {
    return (
      <div className="bg-white/50 border border-slate-200/60 rounded-lg p-6 shadow-sm">
        <div className="text-sm text-muted-foreground">Loading conversation...</div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="bg-white/50 border border-slate-200/60 rounded-lg p-6 shadow-sm">
        <div className="text-sm text-muted-foreground">
          No conversation found. This will be created when your connection is approved.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/50 border border-slate-200/60 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/60 bg-white/40 flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wider text-foreground">
          Deal Discussion
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="h-[400px] p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg) => {
              const isOwnMessage = msg.sender_id === currentUserId;
              const senderName = msg.sender
                ? `${msg.sender.first_name} ${msg.sender.last_name}`.trim() || msg.sender.email
                : 'Unknown';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
                >
                  <div className="text-xs text-muted-foreground mb-1">
                    {senderName} • {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                  </div>
                  <div
                    className={`rounded-lg px-3 py-2 max-w-[80%] text-xs ${
                      isOwnMessage
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white/60 border border-slate-200/60 text-foreground'
                    }`}
                  >
                    {msg.message_text}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-slate-200/60 bg-white/40 space-y-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="text-xs min-h-[60px] resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sendMessage.isPending}
          className="w-full text-xs h-8 bg-[#D7B65C] hover:bg-[#D7B65C]/90 text-slate-900"
        >
          <Send className="h-3 w-3 mr-2" />
          Send Message
        </Button>
      </div>
    </div>
  );
}
