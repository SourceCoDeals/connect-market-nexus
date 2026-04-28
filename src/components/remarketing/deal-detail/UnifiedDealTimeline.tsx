import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Clock, Mic, FileText, FileCheck, Search, Users, X, Info } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  useUnifiedDealActivityEntries,
  getActivityLabel,
  type FilterCategory,
  type UnifiedTimelineEntry,
} from '@/hooks/use-unified-deal-activity-entries';
import { ActivityDetailDrawer } from './ActivityDetailDrawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ACTIVITY_SEARCH_JUMP_EVENT,
  ACTIVITY_SET_FILTER_EVENT,
  type ActivitySearchJumpDetail,
  type ActivitySetFilterDetail,
} from '@/lib/activity-events';

const FILTER_TABS: { label: string; value: FilterCategory }[] = [
  { label: 'All', value: 'all' },
  { label: 'Calls', value: 'calls' },
  { label: 'Emails', value: 'emails' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Tasks', value: 'tasks' },
  { label: 'Meetings', value: 'meetings' },
  { label: 'System', value: 'system' },
];

type GroupingMode = 'timeline' | 'by-contact';

interface UnifiedDealTimelineProps {
  dealId: string;
  listingId: string;
}

export function UnifiedDealTimeline({ dealId, listingId }: UnifiedDealTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [grouping, setGrouping] = useState<GroupingMode>('timeline');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [drawerEntry, setDrawerEntry] = useState<UnifiedTimelineEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 200ms debounce — keeps the input responsive without re-filtering on
  // every keystroke for large feeds.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { entries: allEntries, isLoading } = useUnifiedDealActivityEntries(dealId, listingId);

  // FTS via search-deal-history edge function — fires for queries ≥3 chars.
  // For < 3 chars we fall back to the prior client-side substring filter.
  const ftsEnabled = debouncedSearch.length >= 3;
  const { data: ftsRawIds } = useQuery({
    queryKey: ['unified-timeline-fts', listingId, debouncedSearch],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.functions.invoke('search-deal-history', {
        body: { query: debouncedSearch, listing_id: listingId, limit: 200 },
      });
      if (error) {
        console.warn('FTS search failed; falling back to client-side substring', error);
        return new Set();
      }
      const ids = ((data as { results?: Array<{ id?: string }> } | undefined)?.results ?? [])
        .map((r) => r.id)
        .filter((x): x is string => !!x);
      return new Set(ids);
    },
    enabled: ftsEnabled && !!listingId,
    staleTime: 60_000,
  });

  const filteredEntries = useMemo(() => {
    let list = allEntries;
    if (activeFilter !== 'all') list = list.filter((e) => e.category === activeFilter);
    if (debouncedSearch) {
      const lower = debouncedSearch.toLowerCase();
      const substringFilter = (e: UnifiedTimelineEntry) => {
        const m = (e.metadata ?? {}) as Record<string, unknown>;
        return [e.title, e.description, e.contactEmail, m.body_preview as string | undefined]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(lower));
      };
      if (ftsEnabled && ftsRawIds && ftsRawIds.size > 0) {
        // Intersect FTS hits (matched on server-side full-text) with currently-loaded
        // entries. The entry id has a source-prefix (e.g. `call-<uuid>`); strip it
        // before comparing against the FTS raw uuid.
        list = list.filter((e) => {
          const rawId = e.id.replace(/^[a-z]+-/i, '');
          return ftsRawIds.has(rawId) || substringFilter(e);
        });
      } else {
        list = list.filter(substringFilter);
      }
    }
    return list;
  }, [allEntries, activeFilter, debouncedSearch, ftsEnabled, ftsRawIds]);

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
    for (const e of allEntries) counts[e.category]++;
    return counts;
  }, [allEntries]);

  const grouped = useMemo(() => {
    if (grouping === 'timeline') return null;
    const groups = new Map<string, { label: string; entries: UnifiedTimelineEntry[] }>();
    for (const e of filteredEntries) {
      const key = e.contactId || e.contactEmail || '__unknown__';
      const label = e.contactEmail || e.contactId || 'No contact';
      const g = groups.get(key);
      if (g) g.entries.push(e);
      else groups.set(key, { label, entries: [e] });
    }
    return Array.from(groups.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.entries.length - a.entries.length);
  }, [filteredEntries, grouping]);

  function openDetail(entry: UnifiedTimelineEntry) {
    if (entry.source === 'deal_activity') {
      const m = (entry.metadata as Record<string, unknown> | undefined) ?? {};
      if (m.activity_type === 'follow_up') return;
    }
    setDrawerEntry(entry);
    setDrawerOpen(true);
  }

  // Refs for deep-link scroll-into-view (Fix #5).
  const entryRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const setEntryRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) entryRefs.current.set(id, el);
    else entryRefs.current.delete(id);
  };

  // Subscribe to deep-link events from DealSearchDialog. Match the event's
  // entryId / rawId against currently-loaded entries; if found, scroll +
  // open the drawer. If not (e.g. entry hasn't been loaded into the merged
  // feed yet), no-op silently.
  useEffect(() => {
    function onJump(e: Event) {
      const detail = (e as CustomEvent<ActivitySearchJumpDetail>).detail;
      if (!detail) return;
      const candidates: UnifiedTimelineEntry[] = [];
      if (detail.entryId) {
        const direct = allEntries.find((x) => x.id === detail.entryId);
        if (direct) candidates.push(direct);
      }
      if (candidates.length === 0 && detail.rawId) {
        const matched = allEntries.find((x) => x.id.replace(/^[a-z]+-/i, '') === detail.rawId);
        if (matched) candidates.push(matched);
      }
      const target = candidates[0];
      if (!target) return;
      const el = entryRefs.current.get(target.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      openDetail(target);
    }
    function onSetFilter(e: Event) {
      const detail = (e as CustomEvent<ActivitySetFilterDetail>).detail;
      if (!detail) return;
      setActiveFilter(detail.filter);
      if (detail.clearSearch) {
        setSearchInput('');
      }
    }
    window.addEventListener(ACTIVITY_SEARCH_JUMP_EVENT, onJump);
    window.addEventListener(ACTIVITY_SET_FILTER_EVENT, onSetFilter);
    return () => {
      window.removeEventListener(ACTIVITY_SEARCH_JUMP_EVENT, onJump);
      window.removeEventListener(ACTIVITY_SET_FILTER_EVENT, onSetFilter);
    };
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
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Unified Activity Timeline
            </CardTitle>
            {/* Audit item #5 — segmented control for grouping mode */}
            <div
              role="radiogroup"
              aria-label="Grouping mode"
              className="inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5"
            >
              <button
                type="button"
                role="radio"
                aria-checked={grouping === 'timeline'}
                onClick={() => setGrouping('timeline')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                  grouping === 'timeline'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Timeline
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={grouping === 'by-contact'}
                onClick={() => setGrouping('by-contact')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                  grouping === 'by-contact'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                By contact
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search — full-text via search-deal-history edge function for ≥3 chars,
              client-side substring for shorter queries */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search subject, body, contact email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 pr-9 h-8 text-sm"
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded hover:bg-muted text-muted-foreground inline-flex items-center justify-center"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter chips */}
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
                  {/* Audit item #4 — always show counts on every chip including 0 */}
                  <Badge
                    variant={isActive ? 'secondary' : 'outline'}
                    className={`ml-1.5 text-[10px] h-4 min-w-[16px] px-1 ${
                      count === 0 && !isActive ? 'opacity-50' : ''
                    }`}
                  >
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>

          {/* Body */}
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                {activeFilter === 'all' && !debouncedSearch
                  ? 'No activity recorded yet'
                  : 'No matching activity'}
              </p>
            </div>
          ) : grouped ? (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pr-3">
                {grouped.map((g) => (
                  <div key={g.key} className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {g.label}
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {g.entries.length}
                      </Badge>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            On this deal: shows touches recorded on this listing only. Per-contact
                            history below shows firm-wide activity.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="space-y-3">
                      {g.entries.map((entry) => (
                        <TimelineRow
                          key={entry.id}
                          entry={entry}
                          onClick={openDetail}
                          rowRef={setEntryRef(entry.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3 pr-3">
                {filteredEntries.map((entry) => (
                  <TimelineRow
                    key={entry.id}
                    entry={entry}
                    onClick={openDetail}
                    rowRef={setEntryRef(entry.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <ActivityDetailDrawer entry={drawerEntry} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}

function TimelineRow({
  entry,
  onClick,
  rowRef,
}: {
  entry: UnifiedTimelineEntry;
  onClick: (e: UnifiedTimelineEntry) => void;
  rowRef?: (el: HTMLDivElement | null) => void;
}) {
  const m = (entry.metadata ?? {}) as Record<string, any>;
  const isClickable =
    entry.source !== 'deal_activity' || (m.activity_type as string | undefined) !== 'follow_up';
  return (
    <div
      ref={rowRef}
      data-entry-id={entry.id}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? () => onClick(entry) : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(entry);
              }
            }
          : undefined
      }
      className={`rounded-lg border p-3 space-y-1.5 bg-muted/30 transition-colors ${
        isClickable ? 'hover:bg-muted/50 cursor-pointer' : ''
      }`}
    >
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
                onClick={(e) => e.stopPropagation()}
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
