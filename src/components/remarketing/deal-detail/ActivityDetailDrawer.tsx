// ============================================================================
// ActivityDetailDrawer
// ============================================================================
// Right-side drawer that opens when an entry in the UnifiedDealTimeline is
// clicked. Shows the full content for the entry — transcript & disposition
// notes for calls, full subject + body for emails, key points / action
// items for meetings, full message body for LinkedIn. Notes don't open
// the drawer (the timeline row inline-expands them instead).
// ============================================================================

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Mic, FileText, FileCheck, ExternalLink, Loader2 } from 'lucide-react';
import type { UnifiedTimelineEntry } from '@/hooks/use-unified-deal-activity-entries';
import { useFullActivityBody } from '@/hooks/use-full-activity-body';

interface ActivityDetailDrawerProps {
  entry: UnifiedTimelineEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Above this length, the body section gets a Show more / Show less toggle. */
const LONG_BODY_THRESHOLD = 2000;

export function ActivityDetailDrawer({ entry, open, onOpenChange }: ActivityDetailDrawerProps) {
  // Only fetch when the drawer is open AND we have an entry — saves the
  // request when the drawer is closed (most of the time).
  const { fullBody, isLoading: bodyLoading, isFetched } = useFullActivityBody(entry, open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[560px] overflow-y-auto">
        {entry ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-xs flex items-center gap-1 ${entry.iconColor}`}
                >
                  {entry.icon}
                  {labelForSource(entry.source)}
                </Badge>
                {entry.adminName && (
                  <span className="text-xs text-muted-foreground">{entry.adminName}</span>
                )}
              </div>
              <SheetTitle>{entry.title}</SheetTitle>
              <SheetDescription>
                {format(new Date(entry.timestamp), 'MMMM d, yyyy h:mm a')}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <DetailBody
                entry={entry}
                fullBody={fullBody}
                bodyLoading={bodyLoading}
                bodyFetched={isFetched}
              />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function labelForSource(source: UnifiedTimelineEntry['source']): string {
  switch (source) {
    case 'call':
      return 'Call';
    case 'email':
      return 'Email';
    case 'linkedin':
      return 'LinkedIn';
    case 'transcript':
      return 'Meeting';
    default:
      return 'Activity';
  }
}

function DetailBody({
  entry,
  fullBody,
  bodyLoading,
  bodyFetched,
}: {
  entry: UnifiedTimelineEntry;
  fullBody: string | null;
  bodyLoading: boolean;
  bodyFetched: boolean;
}) {
  const m = (entry.metadata ?? {}) as Record<string, any>;

  if (entry.source === 'call') {
    return (
      <div className="space-y-3 text-sm">
        {entry.description && (
          <Section label="Disposition notes">
            <p className="whitespace-pre-wrap">{entry.description}</p>
          </Section>
        )}
        {(m.recording_url || m.recording_url_public) && (
          <Section label="Recording">
            <a
              className="inline-flex items-center gap-1 text-primary hover:underline"
              href={m.recording_url_public || m.recording_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Mic className="h-4 w-4" />
              Listen
              <ExternalLink className="h-3 w-3" />
            </a>
          </Section>
        )}
        {/* Full transcript when available; preview as fallback while loading */}
        <ExpandableBodySection
          label="Transcript"
          fullBody={fullBody}
          previewBody={m.transcript_preview}
          isLoading={bodyLoading}
          isFetched={bodyFetched}
        />
        {m.duration != null && m.duration > 0 && (
          <Section label="Duration">
            <p>
              {Math.floor(m.duration / 60)}m {m.duration % 60}s
            </p>
          </Section>
        )}
      </div>
    );
  }

  if (entry.source === 'email') {
    return (
      <div className="space-y-3 text-sm">
        {entry.description && (
          <Section label={m.direction === 'outbound' ? 'To' : 'From'}>
            <p>{entry.description}</p>
          </Section>
        )}
        <ExpandableBodySection
          label="Body"
          fullBody={fullBody}
          previewBody={m.body_preview}
          isLoading={bodyLoading}
          isFetched={bodyFetched}
        />
        {m.has_attachments && (
          <Section label="Attachments">
            <p className="inline-flex items-center gap-1">
              <FileCheck className="h-4 w-4" /> has attachments
            </p>
          </Section>
        )}
      </div>
    );
  }

  if (entry.source === 'linkedin') {
    return (
      <div className="space-y-3 text-sm">
        {m.linkedin_url && (
          <Section label="LinkedIn URL">
            <a
              className="text-primary hover:underline break-all"
              href={m.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {m.linkedin_url}
            </a>
          </Section>
        )}
        {entry.description && (
          <Section label="Lead">
            <p>{entry.description}</p>
          </Section>
        )}
        {m.event_type && (
          <Section label="Event type">
            <p>{String(m.event_type).replace(/_/g, ' ')}</p>
          </Section>
        )}
      </div>
    );
  }

  if (entry.source === 'transcript') {
    return (
      <div className="space-y-3 text-sm">
        {entry.description && (
          <Section label="Summary">
            <p className="whitespace-pre-wrap text-muted-foreground">{entry.description}</p>
          </Section>
        )}
        <ExpandableBodySection
          label="Full transcript"
          fullBody={fullBody}
          previewBody={null}
          isLoading={bodyLoading}
          isFetched={bodyFetched}
        />
        {Array.isArray(m.key_points) && m.key_points.length > 0 && (
          <Section label="Key points">
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              {m.key_points.map((kp: string, i: number) => (
                <li key={i}>{kp}</li>
              ))}
            </ul>
          </Section>
        )}
        {Array.isArray(m.action_items) && m.action_items.length > 0 && (
          <Section label="Action items">
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              {m.action_items.map((ai: string, i: number) => (
                <li key={i}>{ai}</li>
              ))}
            </ul>
          </Section>
        )}
        {m.transcript_url && (
          <Section label="Transcript">
            <a
              className="inline-flex items-center gap-1 text-primary hover:underline"
              href={m.transcript_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText className="h-4 w-4" />
              View transcript
              <ExternalLink className="h-3 w-3" />
            </a>
          </Section>
        )}
      </div>
    );
  }

  // deal_activity / fallback
  return (
    <div className="space-y-3 text-sm">
      {entry.description && (
        <Section label="Description">
          <p className="whitespace-pre-wrap text-muted-foreground">{entry.description}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      {children}
    </div>
  );
}

/**
 * Body content with on-demand full fetch (Fix #8). Renders preview while
 * loading, full body once fetched, with a Show more / Show less toggle if
 * the body exceeds LONG_BODY_THRESHOLD chars.
 */
function ExpandableBodySection({
  label,
  fullBody,
  previewBody,
  isLoading,
  isFetched,
}: {
  label: string;
  fullBody: string | null;
  previewBody: string | null | undefined;
  isLoading: boolean;
  isFetched: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  // Resolve which body to render: prefer full when available, fall back to
  // preview while still loading or if no canonical body was found.
  const resolved = fullBody && fullBody.length > 0 ? fullBody : (previewBody ?? '');
  if (!resolved && !isLoading) return null;

  const isLong = resolved.length > LONG_BODY_THRESHOLD;
  const visible = isLong && !expanded ? resolved.slice(0, LONG_BODY_THRESHOLD) + '…' : resolved;

  return (
    <Section label={label}>
      <p className="whitespace-pre-wrap text-muted-foreground">
        {isLoading && !isFetched ? (
          <span className="inline-flex items-center gap-1 text-xs italic">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading full body…
          </span>
        ) : (
          visible
        )}
      </p>
      {isLong && !isLoading && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-6 px-2 text-xs"
          onClick={() => setExpanded((x) => !x)}
        >
          {expanded
            ? 'Show less'
            : `Show more (${resolved.length - LONG_BODY_THRESHOLD} more chars)`}
        </Button>
      )}
      {!isLoading && !fullBody && previewBody && (
        <p className="mt-1 text-[10px] text-muted-foreground/60 italic">
          Showing preview — full body not stored for this entry
        </p>
      )}
    </Section>
  );
}
