/**
 * DealActivityLog — System notification timeline for a single deal.
 *
 * Displays automated messages (NDA sent, fee agreement ready, approval
 * decisions, status changes) in a vertical dot-timeline layout.  This
 * tab is the counterpart to the Messages tab: Messages shows only
 * human-to-human conversation, while Activity Log shows only automated
 * system events.
 *
 * Why separate?  The original design mixed system notifications with
 * human messages in the same thread, which made it hard for buyers to
 * find real replies.  Splitting them into two tabs eliminates that
 * confusion and makes both easier to scan.
 *
 * Visual treatment:
 *   • Each event has a small colored dot on the left:
 *     - **Navy dot** ("sent") — for outgoing actions (NDA sent, interest
 *       expressed, notifications delivered)
 *     - **Gold dot** ("action") — for events requiring attention (agreements
 *       pending, documents available)
 *     - **Green dot** — for completed/signed/approved events
 *     - **Gray dot** — for neutral or declined events
 *
 *   • The dot is intentionally a simple circle (not an icon) to keep the
 *     timeline lightweight.  The event text provides all the context.
 *
 *   • Events are separated by a subtle bottom border, with the timestamp
 *     right-aligned for easy scanning.
 *
 * Data source: Filters `connection_messages` to `message_type === 'system'`
 * or `message_type === 'decision'`.  Uses the same realtime hook as
 * DealMessagesTab, so new system events appear instantly.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Info } from 'lucide-react';
import { useConnectionMessages } from '@/hooks/use-connection-messages';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

/* ─── Props ────────────────────────────────────────────────────────────── */

interface DealActivityLogProps {
  requestId: string;
  requestStatus: 'pending' | 'approved' | 'rejected' | 'on_hold';
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

/**
 * Determine the dot color for a system message based on its content.
 *
 * The function scans the message body for keywords to classify the event:
 *   - "approved", "signed", "selected" → green (positive outcomes)
 *   - "rejected", "declined" → gray (neutral/negative outcomes)
 *   - "nda", "fee agreement" → gold (actions requiring attention)
 *   - Everything else → navy (informational)
 */
function getDotColor(body: string): string {
  const lower = body.toLowerCase();
  if (
    lower.includes('approved') ||
    lower.includes('selected') ||
    lower.includes('signed') ||
    lower.includes('accepted')
  ) {
    return 'bg-emerald-500';
  }
  if (lower.includes('rejected') || lower.includes('declined') || lower.includes('not selected')) {
    return 'bg-slate-300';
  }
  if (lower.includes('nda') || lower.includes('fee agreement')) {
    return 'bg-[#c9a84c]';
  }
  return 'bg-[#0f1f3d]';
}

/* ─── Component ────────────────────────────────────────────────────────── */

export function DealActivityLog({
  requestId,
  requestStatus: _requestStatus,
}: DealActivityLogProps) {
  const { data: allMessages = [], isLoading } = useConnectionMessages(requestId);

  // Filter to only system/decision messages — human messages live in Messages tab
  const systemMessages = allMessages.filter(
    (msg) => msg.message_type === 'system' || msg.message_type === 'decision',
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <Activity className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-[#0f1f3d]">Activity Log</h3>
        {systemMessages.length > 0 && (
          <span className="text-xs text-slate-400">{systemMessages.length}</span>
        )}
      </div>

      {/* Subtitle explaining what this tab shows */}
      <div className="px-5 pt-3 pb-1">
        <p className="text-xs text-slate-400">
          Automated notifications and system events — kept separate from your conversations.
        </p>
      </div>

      {/* Timeline */}
      <div className="min-h-[200px] max-h-[500px] overflow-y-auto px-5 py-2">
        {isLoading ? (
          <div className="space-y-3 py-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-3/4 rounded-lg" />
          </div>
        ) : systemMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="rounded-full bg-slate-100 p-3 mb-3">
              <Info className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-1">No activity yet</p>
            <p className="text-xs text-slate-500 text-center max-w-xs">
              System notifications like agreement requests, status changes, and deal updates will
              appear here.
            </p>
          </div>
        ) : (
          <div>
            {systemMessages.map((msg, index) => {
              const dotColor = getDotColor(msg.body);
              const isLast = index === systemMessages.length - 1;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex items-start gap-3 py-3',
                    !isLast && 'border-b border-slate-100',
                  )}
                >
                  {/* Colored dot indicator */}
                  <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', dotColor)} />
                  {/* Event text */}
                  <p className="flex-1 text-[13px] text-slate-700 leading-relaxed">{msg.body}</p>
                  {/* Timestamp */}
                  <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
