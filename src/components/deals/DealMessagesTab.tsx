/**
 * DealMessagesTab — Human-only message thread for a single deal.
 *
 * This tab displays the buyer <-> SourceCo deal team conversation,
 * deliberately excluding system/decision messages (those live in the
 * Activity Log tab).  This separation ensures buyers can always find
 * real human replies without wading through automated notifications.
 *
 * Visual treatment:
 *   - **Inbound messages** (from SourceCo team) — white card with a subtle
 *     border, left-aligned.  Sender shown as "FirstName — SourceCo Deal Team".
 *   - **Outbound messages** (from the buyer) — navy background matching the
 *     detail panel header, right-aligned with a gold "You" label.  This
 *     creates a clear visual distinction without relying solely on alignment.
 *
 * The message area uses a light cream background (`#faf8f4`) to differentiate
 * it from the surrounding white UI.
 *
 * Compose bar: A multi-line textarea with a "Send Message" button.  The
 * textarea supports Enter-to-send (Shift+Enter for newlines).
 *
 * Realtime: `useConnectionMessages` subscribes to Supabase realtime
 * INSERT events, so new messages appear immediately without polling.
 *
 * Auto-read: Unread admin messages are marked as read when this tab renders,
 * preventing stale unread badges on the tab trigger.
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Send } from 'lucide-react';
import {
  useConnectionMessages,
  useSendMessage,
  useMarkMessagesReadByBuyer,
} from '@/hooks/use-connection-messages';
import { formatDistanceToNow } from 'date-fns';
import { CONNECTION_STATUSES } from '@/constants';

/* ─── Props ────────────────────────────────────────────────────────────── */

interface DealMessagesTabProps {
  requestId: string;
  requestStatus: 'pending' | 'approved' | 'rejected' | 'on_hold';
}

/* ─── Component ────────────────────────────────────────────────────────── */

export function DealMessagesTab({ requestId, requestStatus }: DealMessagesTabProps) {
  const { data: allMessages = [], isLoading: messagesLoading } = useConnectionMessages(requestId);

  // Filter out system/decision messages — those live in the Activity Log tab
  const messages = allMessages.filter(
    (m) => m.message_type !== 'system' && m.message_type !== 'decision',
  );
  const sendMsg = useSendMessage();
  const markRead = useMarkMessagesReadByBuyer();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canSend = requestStatus !== CONNECTION_STATUSES.REJECTED;
  const isRejected = requestStatus === CONNECTION_STATUSES.REJECTED;

  // Mark unread admin messages as read when the buyer views this tab
  useEffect(() => {
    if (requestId && messages.some((m) => !m.is_read_by_buyer && m.sender_role === 'admin')) {
      markRead.mutate(requestId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, messages.length]);

  // Auto-scroll to the most recent message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /** Send a new message and clear the input field */
  const handleSend = () => {
    if (!newMessage.trim() || !canSend) return;
    sendMsg.mutate(
      {
        connection_request_id: requestId,
        body: newMessage.trim(),
        sender_role: 'buyer',
      },
      {
        onError: () => {
          // Restore the message if send failed so user can retry
          setNewMessage(newMessage.trim());
        },
      },
    );
    setNewMessage('');
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-[#0f1f3d]">Messages</h3>
        {messages.length > 0 && <span className="text-xs text-slate-400">{messages.length}</span>}
      </div>

      {/* Rejected deal banner */}
      {isRejected && (
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100">
          <p className="text-xs text-slate-500">
            This deal is no longer active. Message history is available below.
          </p>
        </div>
      )}

      {/* Message thread — cream background to set apart from white panels */}
      <div className="min-h-[300px] max-h-[500px] overflow-y-auto px-5 py-4 space-y-3 flex-1 bg-[#faf8f4]/50">
        {messagesLoading ? (
          <div className="space-y-3 py-4">
            <div className="flex justify-start">
              <Skeleton className="h-16 w-52 rounded-xl" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-12 w-44 rounded-xl" />
            </div>
            <div className="flex justify-start">
              <Skeleton className="h-16 w-60 rounded-xl" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <p className="text-sm text-slate-400 text-center">
              {canSend
                ? 'No messages yet. Send a message to the SourceCo team below.'
                : 'No messages in this conversation.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isBuyer = msg.sender_role === 'buyer';
            return (
              <div key={msg.id} className={`flex ${isBuyer ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                    isBuyer ? 'bg-[#0f1f3d]' : 'bg-white border border-slate-200'
                  }`}
                >
                  {/* Sender name + timestamp */}
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`font-semibold text-xs ${
                        isBuyer ? 'text-[#c9a84c]' : 'text-[#0f1f3d]'
                      }`}
                    >
                      {isBuyer
                        ? 'You'
                        : `${msg.sender?.first_name || 'SourceCo'} — SourceCo Deal Team`}
                    </span>
                    <span className={`text-[10px] ${isBuyer ? 'text-white/40' : 'text-slate-400'}`}>
                      {formatDistanceToNow(new Date(msg.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  {/* Message body */}
                  <p
                    className={`text-[13px] leading-relaxed whitespace-pre-wrap ${
                      isBuyer ? 'text-white/85' : 'text-slate-700'
                    }`}
                  >
                    {msg.body}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose bar — textarea + send button */}
      <div className="border-t border-slate-100 bg-white">
        {canSend ? (
          <div>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Send a message to the deal team..."
              className="w-full px-4 py-3 text-[13px] text-slate-800 placeholder:text-slate-400 resize-none h-[72px] bg-white focus:outline-none font-[inherit]"
            />
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button
                onClick={handleSend}
                disabled={!newMessage.trim() || sendMsg.isPending}
                size="sm"
                className="bg-[#0f1f3d] text-white hover:bg-[#1a3260] text-xs font-semibold px-4 gap-1.5"
              >
                Send Message
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-3">This deal is no longer active.</p>
        )}
      </div>
    </div>
  );
}
