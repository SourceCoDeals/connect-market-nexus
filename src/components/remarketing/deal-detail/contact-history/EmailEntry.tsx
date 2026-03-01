/**
 * EmailEntry.tsx
 *
 * Renders a single email activity entry.
 *
 * Extracted from ContactHistoryTracker.tsx
 */
import { Mail, CheckCircle, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { UnifiedActivityEntry } from '@/hooks/use-contact-combined-history';

interface EmailEntryProps {
  entry: UnifiedActivityEntry;
}

export function EmailEntry({ entry }: EmailEntryProps) {
  const isOpened = ['EMAIL_OPENED', 'OPENED'].includes(entry.event_type);
  const isReplied = ['EMAIL_REPLIED', 'REPLIED'].includes(entry.event_type);
  const isSent = entry.event_type === 'EMAIL_SENT';

  return (
    <div className="rounded-md border bg-card p-3 hover:bg-muted/30 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="font-medium text-sm">{entry.label}</h4>
          {entry.context && <p className="text-xs text-muted-foreground mt-0.5">{entry.context}</p>}
          {entry.details.lead_email && (
            <p className="text-xs text-muted-foreground mt-0.5">{entry.details.lead_email}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
          {format(new Date(entry.timestamp), 'MMM d, h:mm a')}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted">
          {isOpened || isReplied ? (
            <>
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span>{isReplied ? 'Replied' : 'Opened'}</span>
            </>
          ) : isSent ? (
            <>
              <Mail className="w-3 h-3 text-blue-500" />
              <span>Sent</span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span>{entry.label}</span>
            </>
          )}
        </div>
        <span className="text-muted-foreground">
          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
        </span>
      </div>
      {isReplied && entry.details.lead_email && (
        <div className="mt-2 p-2 rounded-md bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800">
          <div className="text-xs text-muted-foreground">
            Reply received from {entry.details.lead_email}
          </div>
        </div>
      )}
    </div>
  );
}
