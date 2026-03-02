import { forwardRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Check, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

import { MessageBody, TypingIndicator } from './MessageBody';

// ─── MessageList ───
// Renders the scrollable list of messages in a thread, including
// loading skeletons, empty state, system messages, and read receipts.

interface MessageListProps {
  messages: Array<{
    id: string;
    body: string;
    created_at: string;
    sender_role?: string;
    message_type?: string;
    is_read_by_admin?: boolean;
    sender?: { first_name?: string } | null;
  }>;
  isLoading: boolean;
  isAdminTyping?: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  function MessageList({ messages, isLoading, isAdminTyping = false, messagesEndRef }) {
    return (
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
    );
  },
);
