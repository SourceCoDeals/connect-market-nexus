import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Clock, Mic, FileText, FileCheck } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  useUnifiedDealActivityEntries,
  getActivityLabel,
  type FilterCategory,
  type UnifiedTimelineEntry,
} from '@/hooks/use-unified-deal-activity-entries';

const FILTER_TABS: { label: string; value: FilterCategory }[] = [
  { label: 'All', value: 'all' },
  { label: 'Calls', value: 'calls' },
  { label: 'Emails', value: 'emails' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Tasks', value: 'tasks' },
  { label: 'Meetings', value: 'meetings' },
  { label: 'System', value: 'system' },
];

interface UnifiedDealTimelineProps {
  dealId: string;
  listingId: string;
}

export function UnifiedDealTimeline({ dealId, listingId }: UnifiedDealTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const { entries: allEntries, isLoading } = useUnifiedDealActivityEntries(dealId, listingId);

  const filteredEntries = useMemo(() => {
    if (activeFilter === 'all') return allEntries;
    return allEntries.filter((e) => e.category === activeFilter);
  }, [allEntries, activeFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<FilterCategory, number> = {
      all: allEntries.length,
      calls: 0,
      emails: 0,
      linkedin: 0,
      tasks: 0,
      meetings: 0,
      system: 0,
    };
    for (const e of allEntries) {
      counts[e.category]++;
    }
    return counts;
  }, [allEntries]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Unified Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Unified Activity Timeline
            {allEntries.length > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">
                {allEntries.length}
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter bar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_TABS.map((tab) => {
            const count = categoryCounts[tab.value];
            const isActive = activeFilter === tab.value;
            return (
              <Button
                key={tab.value}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7"
                onClick={() => setActiveFilter(tab.value)}
              >
                {tab.label}
                {count > 0 && tab.value !== 'all' && (
                  <Badge
                    variant={isActive ? 'secondary' : 'outline'}
                    className="ml-1.5 text-[10px] h-4 min-w-[16px] px-1"
                  >
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>

        {/* Timeline entries */}
        {filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {activeFilter === 'all'
                ? 'No activity recorded yet'
                : `No ${activeFilter} activity yet`}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-3 pr-3">
              {filteredEntries.map((entry) => (
                <TimelineRow key={entry.id} entry={entry} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineRow({ entry }: { entry: UnifiedTimelineEntry }) {
  const m = (entry.metadata ?? {}) as Record<string, any>;
  return (
    <div className="rounded-lg border p-3 space-y-1.5 bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={`text-xs flex items-center gap-1 ${entry.iconColor}`}>
          {entry.icon}
          {entry.source === 'deal_activity'
            ? getActivityLabel(
                ((entry.metadata as Record<string, unknown> | undefined)
                  ?.activity_type as string) ?? entry.title,
              )
            : entry.source === 'call'
              ? 'Call'
              : entry.source === 'email'
                ? 'Email'
                : entry.source === 'linkedin'
                  ? 'LinkedIn'
                  : 'Meeting'}
        </Badge>
        {entry.adminName && (
          <span className="text-xs text-muted-foreground">{entry.adminName}</span>
        )}
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap flex items-center gap-1.5">
          <span className="font-medium text-foreground/70">
            {format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a')}
          </span>
          <span className="text-muted-foreground/50">&middot;</span>
          <span>{formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}</span>
        </span>
      </div>
      <p className="text-sm font-medium">{entry.title}</p>
      {entry.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
          {entry.description}
        </p>
      )}

      {/* Rich detail for calls */}
      {entry.source === 'call' &&
        (m.duration || m.recording_url || m.recording_url_public || m.transcript_preview) && (
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
            {m.duration != null && m.duration > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {Math.floor(m.duration / 60)}m {m.duration % 60}s
              </span>
            )}
            {(m.recording_url || m.recording_url_public) && (
              <a
                href={m.recording_url_public || m.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Mic className="h-3 w-3" />
                Recording
              </a>
            )}
            {m.transcript_preview && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Transcript available
              </span>
            )}
          </div>
        )}

      {/* Rich detail for emails */}
      {entry.source === 'email' && (m.body_preview || m.has_attachments) && (
        <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
          {m.has_attachments && (
            <span className="flex items-center gap-1">
              <FileCheck className="h-3 w-3" />
              Has attachments
            </span>
          )}
          {m.body_preview && <p className="line-clamp-2 italic">{m.body_preview}</p>}
        </div>
      )}
    </div>
  );
}
