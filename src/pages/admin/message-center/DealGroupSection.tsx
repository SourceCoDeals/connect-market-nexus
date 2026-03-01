import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ThreadListItem } from "./ThreadListItem";
import type { DealGroup } from "./types";

// ─── Props ───

export interface DealGroupSectionProps {
  group: DealGroup;
  selectedThreadId: string | null;
  onSelectThread: (id: string) => void;
  adminProfiles?: Record<string, unknown> | null;
}

// ─── Component ───

export function DealGroupSection({
  group,
  selectedThreadId,
  onSelectThread,
  adminProfiles,
}: DealGroupSectionProps) {
  const hasSelected = group.threads.some(t => t.connection_request_id === selectedThreadId);
  const [open, setOpen] = useState(hasSelected || group.total_unread > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          "flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors",
        )}
        style={group.total_unread > 0 ? { backgroundColor: '#FFFDF5' } : undefined}
        >
          {open ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#5A5A5A' }} /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#5A5A5A' }} />}
          <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#DEC76B' }} />
          <div className="flex-1 min-w-0 text-left">
            <p className={cn(
              "text-sm truncate",
              group.total_unread > 0 ? "font-semibold" : "font-medium"
            )} style={{ color: '#0E101A' }}>
              {group.deal_title}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: '#9A9A9A' }}>
              {group.threads.length} conversation{group.threads.length !== 1 ? 's' : ''}
              {' · '}
              {formatDistanceToNow(new Date(group.last_activity), { addSuffix: true })}
            </p>
          </div>
          {group.total_unread > 0 && (
            <span className="flex-shrink-0 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
              style={{ backgroundColor: '#8B0000', color: '#FFFFFF' }}>
              {group.total_unread}
            </span>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border/20">
          {group.threads.map(thread => (
            <ThreadListItem
              key={thread.connection_request_id}
              thread={thread}
              isSelected={selectedThreadId === thread.connection_request_id}
              onClick={() => onSelectThread(thread.connection_request_id)}
              adminProfiles={adminProfiles}
              nested
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
