import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquarePlus,
  Search,
  Inbox,
  Circle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { BuyerThread } from './helpers';
import { getStatusStyle, getStatusLabel } from './helpers';

// ─── ConversationList ───

interface ConversationListProps {
  threads: BuyerThread[];
  filteredThreads: BuyerThread[];
  selectedThreadId: string | null;
  showGeneralChat: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectThread: (requestId: string) => void;
  onSelectGeneral: () => void;
}

export function ConversationList({
  threads,
  filteredThreads,
  selectedThreadId,
  showGeneralChat,
  searchQuery,
  onSearchChange,
  onSelectThread,
  onSelectGeneral,
}: ConversationListProps) {
  return (
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
            onChange={(e) => onSearchChange(e.target.value)}
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
          {/* General Inquiry -- always first */}
          <button
            onClick={onSelectGeneral}
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
              onClick={() => onSelectThread(thread.connection_request_id)}
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
  );
}

// ─── ThreadListItem ───

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
  const statusStyle = getStatusStyle(thread.request_status);

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
              {getStatusLabel(thread.request_status)}
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
