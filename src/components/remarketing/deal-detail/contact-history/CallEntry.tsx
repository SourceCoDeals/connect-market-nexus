/**
 * CallEntry.tsx
 *
 * Renders a single call activity entry.
 *
 * Extracted from ContactHistoryTracker.tsx
 */
import { Mic } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { UnifiedActivityEntry } from '@/hooks/use-contact-combined-history';
import { formatDuration } from './formatDuration';

interface CallEntryProps {
  entry: UnifiedActivityEntry;
}

export function CallEntry({ entry }: CallEntryProps) {
  const isConnected =
    entry.event_type === 'call_completed' && entry.details.call_outcome === 'dispositioned';
  const isVoicemail =
    entry.details.call_outcome === 'no_answer' ||
    entry.details.disposition_code?.toLowerCase().includes('voicemail');

  return (
    <div className="rounded-md border bg-card p-3 hover:bg-muted/30 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{entry.label}</span>
            <Badge
              variant={isConnected ? 'default' : isVoicemail ? 'secondary' : 'outline'}
              className="text-[10px]"
            >
              {isConnected
                ? 'Connected'
                : isVoicemail
                  ? 'Voicemail'
                  : entry.details.call_outcome || ''}
            </Badge>
          </div>
          {entry.context && <p className="text-xs text-muted-foreground mt-0.5">{entry.context}</p>}
        </div>
        <span className="text-xs text-muted-foreground">
          {format(new Date(entry.timestamp), 'MMM d, h:mm a')}
        </span>
      </div>
      {entry.details.call_duration_seconds && entry.details.call_duration_seconds > 0 && (
        <div className="text-xs text-muted-foreground mb-2">
          Duration:{' '}
          <span className="font-semibold">
            {formatDuration(entry.details.call_duration_seconds)}
          </span>
        </div>
      )}
      {entry.details.disposition_label && (
        <Badge variant="secondary" className="text-[10px] mb-2">
          {entry.details.disposition_label}
        </Badge>
      )}
      {entry.details.disposition_notes && (
        <div className="p-2 rounded-md bg-muted text-sm">
          <div className="text-xs text-muted-foreground mb-0.5">Notes:</div>
          {entry.details.disposition_notes}
        </div>
      )}
      {entry.details.recording_url && (
        <a
          href={entry.details.recording_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
        >
          <Mic className="w-3 h-3" />
          Listen to Recording
        </a>
      )}
    </div>
  );
}
