import {
  Clock,
  CheckCheck,
  Circle,
  User,
  Building2,
  FileText,
  UserCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { InboxThread } from "./types";
import { CONNECTION_STATUSES } from '@/constants';

// ─── Props ───

export interface ThreadListItemProps {
  thread: InboxThread;
  isSelected: boolean;
  onClick: () => void;
  adminProfiles?: Record<string, unknown> | null;
  nested?: boolean;
}

// ─── Component ───

export function ThreadListItem({
  thread,
  isSelected,
  onClick,
  nested,
}: ThreadListItemProps) {
  const stateIcon = (() => {
    switch (thread.conversation_state) {
      case "waiting_on_admin": return <Circle className="w-2 h-2 fill-destructive text-destructive" />;
      case "waiting_on_buyer": return <Clock className="w-2 h-2 text-amber-500" />;
      case "claimed": return <User className="w-2 h-2 text-primary" />;
      case "closed": return <CheckCheck className="w-2 h-2 text-muted-foreground" />;
      default: return <Circle className="w-2 h-2 fill-blue-500 text-blue-500" />;
    }
  })();

  const timeLabel = thread.last_message_at
    ? formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: false })
    : formatDistanceToNow(new Date(thread.created_at), { addSuffix: false });

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 transition-colors",
        nested && "pl-10",
        isSelected ? "bg-accent" : "hover:bg-accent/50",
        thread.unread_count > 0 && !isSelected && ""
      )}
      style={thread.unread_count > 0 && !isSelected ? { backgroundColor: '#FFFDF5' } : undefined}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-1.5 flex-shrink-0">{stateIcon}</div>
        <div className="flex-1 min-w-0">
          {/* Row 1: Buyer name + time */}
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "text-sm truncate",
              thread.unread_count > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/90"
            )}>
              {thread.buyer_name}
            </span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeLabel}</span>
          </div>

          {/* Row 2: Company + deal */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {thread.buyer_company && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{thread.buyer_company}</span>
              </span>
            )}
            {!nested && thread.deal_title && (
              <>
                {thread.buyer_company && <span className="text-muted-foreground/40">·</span>}
                <span className="text-[11px] text-muted-foreground/70 truncate flex items-center gap-1">
                  <FileText className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{thread.deal_title}</span>
                </span>
              </>
            )}
          </div>

          {/* Row 3: Request status + pipeline badge */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={
                thread.request_status === CONNECTION_STATUSES.APPROVED ? { backgroundColor: '#DEC76B', color: '#0E101A' } :
                thread.request_status === CONNECTION_STATUSES.PENDING ? { backgroundColor: '#F7F4DD', color: '#5A5A5A', border: '1px solid #DEC76B' } :
                thread.request_status === CONNECTION_STATUSES.REJECTED ? { backgroundColor: '#8B0000', color: '#FFFFFF' } :
                { backgroundColor: '#E8E8E8', color: '#5A5A5A' }
              }
            >
              {thread.request_status}
            </span>
            {thread.pipeline_deal_id && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: '#0E101A', color: '#FFFFFF' }}>
                In Pipeline
              </span>
            )}
            {thread.claimed_by && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"
                style={{ backgroundColor: '#E8E8E8', color: '#5A5A5A' }}>
                <UserCheck className="w-2.5 h-2.5" />
                Claimed
              </span>
            )}
          </div>

          {/* Row 4: Last message preview */}
          <p className={cn(
            "text-[11px] mt-0.5 truncate",
            thread.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground"
          )}>
            {thread.last_message_sender_role === "admin" && "You: "}
            {thread.last_message_preview || thread.user_message || "No messages yet"}
          </p>
        </div>

        {/* Unread badge */}
        {thread.unread_count > 0 && (
          <span className="mt-1 flex-shrink-0 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
            style={{ backgroundColor: '#8B0000', color: '#FFFFFF' }}>
            {thread.unread_count}
          </span>
        )}
      </div>
    </button>
  );
}
