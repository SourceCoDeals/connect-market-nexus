// ============================================================================
// DealActivityStatsStrip
// ============================================================================
// Four-cell strip rendered above the Activity tab's UnifiedDealTimeline.
// Answers the four product questions:
//   1. How many touchpoints in the last 30 days, broken down by channel
//   2. Where did the conversation last leave off
//   3. Which channel actually gets replies
//   4. What's scheduled next (callback or task)
// ============================================================================

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { useDealActivityStats } from '@/hooks/use-deal-activity-stats';

interface DealActivityStatsStripProps {
  listingId: string | null;
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

  const channelLabel =
    stats.bestChannel == null
      ? null
      : stats.bestChannel.channel === 'email'
        ? 'Email'
        : stats.bestChannel.channel === 'call'
          ? 'Call'
          : 'LinkedIn';

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Cell 1 — total touchpoints (30d) */}
      <Cell
        label="Touchpoints (30d)"
        value={stats.totalTouchpoints > 0 ? String(stats.totalTouchpoints) : '—'}
        detail={
          stats.totalTouchpoints > 0
            ? `${stats.byChannel.calls} calls · ${stats.byChannel.emails} emails · ${stats.byChannel.linkedin} LinkedIn · ${stats.byChannel.meetings} meetings`
            : 'no activity in last 30 days'
        }
      />

      {/* Cell 2 — last touch */}
      <Cell
        label="Last touch"
        value={
          stats.lastTouch
            ? formatDistanceToNow(new Date(stats.lastTouch.at), { addSuffix: true })
            : '—'
        }
        detail={
          stats.lastTouch
            ? `${stats.lastTouch.teamMember ? stats.lastTouch.teamMember + ' · ' : ''}${stats.lastTouch.channel} → ${stats.lastTouch.outcome}`
            : 'no recorded touch yet'
        }
      />

      {/* Cell 3 — best channel */}
      <Cell
        label="Best channel"
        value={channelLabel ?? '—'}
        detail={stats.bestChannel?.reason ?? 'need ≥3 outbound on a channel to evaluate'}
      />

      {/* Cell 4 — next scheduled action */}
      <Cell
        label="Next action"
        value={
          stats.nextScheduledAction
            ? formatDistanceToNow(new Date(stats.nextScheduledAction.at), { addSuffix: true })
            : '—'
        }
        detail={stats.nextScheduledAction?.description ?? 'nothing scheduled'}
      />
    </div>
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
