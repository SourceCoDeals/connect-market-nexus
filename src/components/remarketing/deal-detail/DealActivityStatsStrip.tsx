// ============================================================================
// DealActivityStatsStrip
// ============================================================================
// Four-cell strip rendered above the Activity tab's UnifiedDealTimeline.
// Answers the four product questions:
//   1. How many touchpoints in the last 30 days, broken down by channel
//   2. Where did the conversation last leave off
//   3. Which channel actually gets replies
//   4. What's scheduled next (callback or task)
//
// Audit item #2: cells are now interactive where there's a meaningful
// action — clicking the per-channel counts in cell 1, the last-touch
// summary in cell 2, the best channel in cell 3, or the next callback
// in cell 4 will navigate the user to the relevant feed entry or filter.
// ============================================================================

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { useDealActivityStats } from '@/hooks/use-deal-activity-stats';
import { dispatchActivitySetFilter } from '@/lib/activity-events';
import type { FilterCategory } from '@/hooks/use-unified-deal-activity-entries';
import type { StatsChannel, DealActivityStats } from '@/hooks/use-deal-activity-stats';

interface DealActivityStatsStripProps {
  listingId: string | null;
}

/** StatsChannel → FilterCategory mapping for the chip filter. */
function channelToFilter(c: StatsChannel): FilterCategory {
  switch (c) {
    case 'calls':
      return 'calls';
    case 'emails':
      return 'emails';
    case 'linkedin':
      return 'linkedin';
    case 'meetings':
      return 'meetings';
    case 'notes':
      return 'system';
  }
}

/** bestChannel.channel ('email' | 'call' | 'linkedin') → FilterCategory */
function bestChannelToFilter(c: 'email' | 'call' | 'linkedin'): FilterCategory {
  return c === 'email' ? 'emails' : c === 'call' ? 'calls' : 'linkedin';
}

export function DealActivityStatsStrip({ listingId }: DealActivityStatsStripProps) {
  const { stats, isLoading } = useDealActivityStats(listingId);

  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="py-3 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <TouchpointsCell stats={stats} />
      <LastTouchCell stats={stats} />
      <BestChannelCell stats={stats} />
      <NextActionCell stats={stats} />
    </div>
  );
}

// ── Cell 1: Touchpoints (30d) — clickable per-channel counts ──────────────

function TouchpointsCell({ stats }: { stats: DealActivityStats }) {
  if (stats.totalTouchpoints === 0) {
    return <Cell label="Touchpoints (30d)" value="—" detail="no activity in the last 30 days" />;
  }
  const items: Array<{ key: StatsChannel; count: number; label: string }> = [
    { key: 'calls', count: stats.byChannel.calls, label: 'calls' },
    { key: 'emails', count: stats.byChannel.emails, label: 'emails' },
    { key: 'linkedin', count: stats.byChannel.linkedin, label: 'LinkedIn' },
    { key: 'meetings', count: stats.byChannel.meetings, label: 'meetings' },
  ];
  return (
    <Card>
      <CardContent className="py-3 space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Touchpoints (30d)</p>
        <p className="text-2xl font-semibold leading-tight">{stats.totalTouchpoints}</p>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {items.map((it, idx) => {
            const sep = idx > 0 ? <span className="text-muted-foreground/40">·</span> : null;
            if (it.count === 0) {
              return (
                <span key={it.key} className="inline-flex items-center gap-2">
                  {sep}
                  <span className="opacity-50">
                    {it.count} {it.label}
                  </span>
                </span>
              );
            }
            return (
              <span key={it.key} className="inline-flex items-center gap-2">
                {sep}
                <button
                  type="button"
                  onClick={() => dispatchActivitySetFilter({ filter: channelToFilter(it.key) })}
                  className="rounded hover:underline hover:text-foreground transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
                  aria-label={`Filter feed to ${it.label} (${it.count} entries)`}
                >
                  {it.count} {it.label}
                </button>
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Cell 2: Last touch — clickable to jump to entry ───────────────────────

function LastTouchCell({ stats }: { stats: DealActivityStats }) {
  if (!stats.lastTouch) {
    return <Cell label="Last touch" value="—" detail="no recorded touch yet" />;
  }
  const { at, channel, outcome, teamMember } = stats.lastTouch;
  const value = formatDistanceToNow(new Date(at), { addSuffix: true });
  const detail = `${teamMember ? teamMember + ' · ' : ''}${channel} → ${outcome}`;
  // We don't have the entry's id directly on stats.lastTouch — dispatch a
  // jump with no entryId/rawId; UnifiedDealTimeline falls through silently
  // if there's no match. A future improvement: surface the entry id in
  // useDealActivityStats so this becomes a precise jump.
  // For now, click sets the filter to that channel as a useful proxy.
  const filter = channelToFilter(channel);
  return (
    <button
      type="button"
      onClick={() => dispatchActivitySetFilter({ filter })}
      className="text-left rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
      aria-label={`Filter feed to ${channel} (last touch was ${value})`}
    >
      <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
        <CardContent className="py-3 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last touch</p>
          <p className="text-2xl font-semibold leading-tight truncate" title={value}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2" title={detail}>
            {detail}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}

// ── Cell 3: Best channel — clickable to filter ────────────────────────────

function BestChannelCell({ stats }: { stats: DealActivityStats }) {
  if (!stats.bestChannel) {
    return (
      <Cell
        label="Best channel"
        value="—"
        detail="need at least 3 outbound touches on a channel to evaluate"
      />
    );
  }
  const channelLabel =
    stats.bestChannel.channel === 'email'
      ? 'Email'
      : stats.bestChannel.channel === 'call'
        ? 'Call'
        : 'LinkedIn';
  const filter = bestChannelToFilter(stats.bestChannel.channel);
  return (
    <button
      type="button"
      onClick={() => dispatchActivitySetFilter({ filter })}
      className="text-left rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
      aria-label={`Filter feed to ${channelLabel}`}
    >
      <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
        <CardContent className="py-3 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Best channel</p>
          <p className="text-2xl font-semibold leading-tight truncate" title={channelLabel}>
            {channelLabel}
          </p>
          <p
            className="text-xs text-muted-foreground line-clamp-2"
            title={stats.bestChannel.reason}
          >
            {stats.bestChannel.reason}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}

// ── Cell 4: Next action — clickable for callbacks; navigate for tasks ─────

function NextActionCell({ stats }: { stats: DealActivityStats }) {
  if (!stats.nextScheduledAction) {
    return <Cell label="Next action" value="—" detail="nothing scheduled" />;
  }
  const value = formatDistanceToNow(new Date(stats.nextScheduledAction.at), { addSuffix: true });
  const detail = stats.nextScheduledAction.description;
  const isTask = stats.nextScheduledAction.type === 'task';

  function onClick() {
    if (isTask) {
      // Navigate to the Tasks tab on the deal page. The TabsList uses
      // a `value` query-style param via the parent's defaultValue; the
      // simplest way to nav is to click the matching trigger. We dispatch
      // a custom event the deal page subscribes to.
      window.dispatchEvent(new CustomEvent('deal-page-set-tab', { detail: { value: 'tasks' } }));
    } else {
      // Callback — filter the feed to calls so the user can find the
      // call entry that scheduled this callback.
      dispatchActivitySetFilter({ filter: 'calls' });
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
      aria-label={
        isTask ? `Open Tasks tab — next: ${detail}` : `Filter feed to calls — next: ${detail}`
      }
    >
      <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
        <CardContent className="py-3 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Next action</p>
          <p className="text-2xl font-semibold leading-tight truncate" title={value}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2" title={detail}>
            {detail}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}

function Cell({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="py-3 space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold leading-tight truncate" title={value}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2" title={detail}>
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}
