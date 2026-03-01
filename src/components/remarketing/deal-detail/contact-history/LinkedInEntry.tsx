/**
 * LinkedInEntry.tsx
 *
 * Renders a single LinkedIn activity entry.
 *
 * Extracted from ContactHistoryTracker.tsx
 */
import { format } from 'date-fns';
import type { UnifiedActivityEntry } from '@/hooks/use-contact-combined-history';

interface LinkedInEntryProps {
  entry: UnifiedActivityEntry;
}

export function LinkedInEntry({ entry }: LinkedInEntryProps) {
  const isReply = ['MESSAGE_RECEIVED', 'INMAIL_RECEIVED', 'LEAD_REPLIED'].includes(
    entry.event_type,
  );
  const isAccepted = entry.event_type === 'CONNECTION_REQUEST_ACCEPTED';

  const typeLabel =
    {
      CONNECTION_REQUEST_SENT: 'Connection Request Sent',
      CONNECTION_REQUEST_ACCEPTED: 'Connection Accepted',
      MESSAGE_SENT: 'Message Sent',
      MESSAGE_RECEIVED: 'Message Received',
      INMAIL_SENT: 'InMail Sent',
      INMAIL_RECEIVED: 'InMail Received',
      PROFILE_VIEWED: 'Profile Viewed',
      FOLLOW_SENT: 'Followed',
      LIKE_SENT: 'Liked Post',
      LEAD_REPLIED: 'Lead Replied',
      LEAD_INTERESTED: 'Interested',
      LEAD_NOT_INTERESTED: 'Not Interested',
    }[entry.event_type] || entry.label;

  return (
    <div className="rounded-md border bg-card p-3 hover:bg-muted/30 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <span className="font-medium text-sm">{typeLabel}</span>
        <span className="text-xs text-muted-foreground">
          {format(new Date(entry.timestamp), 'MMM d, h:mm a')}
        </span>
      </div>
      {entry.context && <p className="text-xs text-muted-foreground mb-1">{entry.context}</p>}
      {entry.details.lead_linkedin_url && (
        <p className="text-xs text-muted-foreground mb-1 truncate">
          {entry.details.lead_linkedin_url}
        </p>
      )}
      {(isReply || isAccepted) && (
        <div className="p-2 rounded-md bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800">
          <div className="text-xs text-muted-foreground">
            {isAccepted ? 'Connection accepted' : 'Response received'}
          </div>
        </div>
      )}
    </div>
  );
}
