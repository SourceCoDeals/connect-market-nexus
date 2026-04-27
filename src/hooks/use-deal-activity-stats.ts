// ============================================================================
// useDealActivityStats
// ============================================================================
// Computes the four summary statistics rendered in DealActivityStatsStrip
// directly from the merged entries returned by useUnifiedDealActivityEntries
// (no new query path is invented). Adds one auxiliary query against
// daily_standup_tasks via the existing useEntityTasks hook so the
// nextScheduledAction cell can compare the next callback against the next
// open task.
// ============================================================================

import { useMemo } from 'react';
import { useUnifiedDealActivityEntries } from '@/hooks/use-unified-deal-activity-entries';
import { useEntityTasks } from '@/hooks/useEntityTasks';
import type { UnifiedTimelineEntry } from '@/hooks/use-unified-deal-activity-entries';

export type StatsChannel = 'calls' | 'emails' | 'linkedin' | 'meetings' | 'notes';

export interface DealActivityStats {
  totalTouchpoints: number;
  byChannel: {
    calls: number;
    emails: number;
    linkedin: number;
    meetings: number;
    notes: number;
  };
  byDirection: { outbound: number; inbound: number };
  lastTouch: {
    at: string;
    channel: StatsChannel;
    outcome: string;
    teamMember: string | null;
  } | null;
  bestChannel: {
    channel: 'email' | 'call' | 'linkedin';
    reason: string;
  } | null;
  nextScheduledAction: {
    type: 'callback' | 'task';
    at: string;
    description: string;
  } | null;
  byRep: Record<string, number>;
}

interface UseDealActivityStatsResult {
  stats: DealActivityStats;
  isLoading: boolean;
}

const MS_IN_DAY = 24 * 60 * 60 * 1000;

export const EMPTY_DEAL_ACTIVITY_STATS: DealActivityStats = {
  totalTouchpoints: 0,
  byChannel: { calls: 0, emails: 0, linkedin: 0, meetings: 0, notes: 0 },
  byDirection: { outbound: 0, inbound: 0 },
  lastTouch: null,
  bestChannel: null,
  nextScheduledAction: null,
  byRep: {},
};

export function entryChannel(e: UnifiedTimelineEntry): StatsChannel | null {
  if (e.category === 'calls') return 'calls';
  if (e.category === 'emails') return 'emails';
  if (e.category === 'linkedin') return 'linkedin';
  if (e.category === 'meetings') return 'meetings';
  // Notes / follow-ups land in deal_activities with category=system. Treat
  // follow_up activity_type as "notes" — the rest of category=system (stage
  // changes, task lifecycle, deal CRUD) is not a touchpoint.
  if (e.source === 'deal_activity') {
    const type = (e.metadata as Record<string, unknown> | undefined)?.activity_type as
      | string
      | undefined;
    if (type === 'follow_up') return 'notes';
  }
  return null;
}

export function entryDirection(e: UnifiedTimelineEntry): 'outbound' | 'inbound' | null {
  const m = (e.metadata ?? {}) as Record<string, unknown>;
  const dir = m.direction;
  if (dir === 'outbound' || dir === 'inbound') return dir;
  return null;
}

/**
 * Stable identifier used for pairing outbound→inbound on the same channel.
 * Falls back from contact_id (canonical) → lowercased contact_email
 * (best-effort) → null (entry is unpairable; counted but never contributes
 * to a reply-delay measurement).
 */
export function contactKeyOf(e: UnifiedTimelineEntry): string | null {
  if (e.contactId) return e.contactId;
  if (e.contactEmail) return e.contactEmail.toLowerCase();
  return null;
}

export function lastTouchOutcome(e: UnifiedTimelineEntry): string {
  const m = (e.metadata ?? {}) as Record<string, unknown>;
  if (e.source === 'call') {
    return (m.outcome as string | undefined) ?? e.title ?? 'call';
  }
  if (e.source === 'email') {
    const dir = m.direction as string | undefined;
    return dir === 'outbound' ? 'sent' : 'received';
  }
  if (e.source === 'linkedin') {
    return (m.event_type as string | undefined)?.toLowerCase().replace(/_/g, ' ') ?? 'message';
  }
  if (e.source === 'transcript') return 'meeting';
  return e.title ?? 'touch';
}

export interface ScheduledTaskLike {
  due_date?: string | null;
  task_type?: string | null;
  description?: string | null;
}

/**
 * Pure compute function. Exported so unit tests can hit it without spinning
 * up react-query / a query client.
 */
export function computeDealActivityStats(
  entries: UnifiedTimelineEntry[],
  tasks: ScheduledTaskLike[],
  now: number = Date.now(),
): DealActivityStats {
  const cutoff30d = now - 30 * MS_IN_DAY;
  const cutoff90d = now - 90 * MS_IN_DAY;

  if (entries.length === 0 && tasks.length === 0) {
    return EMPTY_DEAL_ACTIVITY_STATS;
  }

  const byChannel = { calls: 0, emails: 0, linkedin: 0, meetings: 0, notes: 0 };
  const byDirection = { outbound: 0, inbound: 0 };
  const byRep: Record<string, number> = {};
  let totalTouchpoints = 0;
  let lastTouch: DealActivityStats['lastTouch'] = null;

  // Per-channel direction counters over a 90-day window for the
  // bestChannel reply-rate computation.
  const replyCounts = {
    call: { outbound: 0, inbound: 0, replyDelays: [] as number[] },
    email: { outbound: 0, inbound: 0, replyDelays: [] as number[] },
    linkedin: { outbound: 0, inbound: 0, replyDelays: [] as number[] },
  };

  // Sort ascending by timestamp so we can pair outbound→inbound for delay.
  const ascending = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // lastOutbound is keyed by (channel, contactKey) so an inbound from contact
  // A on email cannot be paired with an earlier outbound to contact B on the
  // same channel. Without this, deals with multiple contacts produce
  // misleading "got a reply within" averages — the delay would tend to
  // collapse toward 0 as parallel conversations interleave. The reply
  // *counts* (and therefore the winning channel) are unaffected by this
  // change; only avgDelayMs gets stricter pairing.
  const lastOutboundByContact: Record<'call' | 'email' | 'linkedin', Map<string, number>> = {
    call: new Map(),
    email: new Map(),
    linkedin: new Map(),
  };

  for (const e of ascending) {
    const channel = entryChannel(e);
    if (!channel) continue;
    const ts = new Date(e.timestamp).getTime();
    if (Number.isNaN(ts)) continue;

    // 30-day touchpoint counts
    if (ts >= cutoff30d) {
      totalTouchpoints++;
      byChannel[channel]++;
      const dir = entryDirection(e);
      if (dir) byDirection[dir]++;
      if (e.adminName) {
        byRep[e.adminName] = (byRep[e.adminName] ?? 0) + 1;
      }
    }

    // Last meaningful touch (any channel, any time — answers "where did it end")
    if (channel !== 'notes') {
      if (!lastTouch || ts > new Date(lastTouch.at).getTime()) {
        lastTouch = {
          at: e.timestamp,
          channel,
          outcome: lastTouchOutcome(e),
          teamMember: e.adminName ?? null,
        };
      }
    }

    // 90-day reply rate per channel
    if (ts >= cutoff90d) {
      const rcKey =
        channel === 'calls'
          ? 'call'
          : channel === 'emails'
            ? 'email'
            : channel === 'linkedin'
              ? 'linkedin'
              : null;
      if (rcKey) {
        const dir = entryDirection(e);
        const contactKey = contactKeyOf(e);
        if (dir === 'outbound') {
          replyCounts[rcKey].outbound++;
          // Track the most recent outbound timestamp per contact on this
          // channel. Outbounds without a contactKey can't be paired later
          // (no anchor to match against), so we drop them from the map.
          if (contactKey != null) {
            lastOutboundByContact[rcKey].set(contactKey, ts);
          }
        } else if (dir === 'inbound') {
          replyCounts[rcKey].inbound++;
          // Only record a delay if there's a prior outbound on the same
          // channel AND same contactKey. Inbounds that can't be matched
          // still count toward `inbound`; they just don't contribute to
          // avgDelayMs.
          if (contactKey != null) {
            const last = lastOutboundByContact[rcKey].get(contactKey);
            if (last != null && ts >= last) {
              replyCounts[rcKey].replyDelays.push(ts - last);
            }
          }
        }
      }
    }
  }

  // bestChannel — channel with highest reply rate, requiring ≥3 outbound.
  // Reason format: "{N} of {M} {channel}s got a reply within {avg time}"
  type ReplyKey = 'call' | 'email' | 'linkedin';
  const bestChannelEntry = (Object.entries(replyCounts) as [ReplyKey, typeof replyCounts.call][])
    .filter(([, c]) => c.outbound >= 3)
    .map(([k, c]) => ({
      channel: k,
      rate: c.inbound / c.outbound,
      inbound: c.inbound,
      outbound: c.outbound,
      avgDelayMs:
        c.replyDelays.length > 0
          ? c.replyDelays.reduce((a, b) => a + b, 0) / c.replyDelays.length
          : null,
    }))
    .sort((a, b) => b.rate - a.rate)[0];

  let bestChannel: DealActivityStats['bestChannel'] = null;
  if (bestChannelEntry && bestChannelEntry.inbound > 0) {
    const channelLabel =
      bestChannelEntry.channel === 'call'
        ? 'call'
        : bestChannelEntry.channel === 'email'
          ? 'email'
          : 'LinkedIn message';
    const avg = bestChannelEntry.avgDelayMs;
    const within =
      avg == null
        ? '—'
        : avg < 60 * 60 * 1000
          ? `${Math.round(avg / (60 * 1000))}m`
          : avg < 24 * 60 * 60 * 1000
            ? `${Math.round(avg / (60 * 60 * 1000))}h`
            : `${Math.round(avg / MS_IN_DAY)}d`;
    bestChannel = {
      channel: bestChannelEntry.channel,
      reason: `${bestChannelEntry.inbound} of ${bestChannelEntry.outbound} ${channelLabel}s got a reply within ${within}`,
    };
  }

  // nextScheduledAction — earliest future {callback, task}.
  let nextCallback: { at: number; description: string } | null = null;
  for (const e of entries) {
    if (e.source !== 'call') continue;
    const m = (e.metadata ?? {}) as Record<string, unknown>;
    const cbStr = m.callback_scheduled_date as string | null | undefined;
    if (!cbStr) continue;
    const t = new Date(cbStr).getTime();
    if (Number.isNaN(t) || t <= now) continue;
    if (!nextCallback || t < nextCallback.at) {
      nextCallback = {
        at: t,
        description: `Callback: ${e.title || 'call'}${e.adminName ? ` (${e.adminName})` : ''}`,
      };
    }
  }

  let nextTask: { at: number; description: string } | null = null;
  for (const t of tasks) {
    const dueStr = t.due_date;
    if (!dueStr) continue;
    const dt = new Date(dueStr).getTime();
    if (Number.isNaN(dt) || dt <= now) continue;
    const desc = (t.task_type ? `${t.task_type}: ` : '') + (t.description ?? 'Task due');
    if (!nextTask || dt < nextTask.at) {
      nextTask = { at: dt, description: desc };
    }
  }

  let nextScheduledAction: DealActivityStats['nextScheduledAction'] = null;
  if (nextCallback && (!nextTask || nextCallback.at <= nextTask.at)) {
    nextScheduledAction = {
      type: 'callback',
      at: new Date(nextCallback.at).toISOString(),
      description: nextCallback.description,
    };
  } else if (nextTask) {
    nextScheduledAction = {
      type: 'task',
      at: new Date(nextTask.at).toISOString(),
      description: nextTask.description,
    };
  }

  return {
    totalTouchpoints,
    byChannel,
    byDirection,
    lastTouch,
    bestChannel,
    nextScheduledAction,
    byRep,
  };
}

export function useDealActivityStats(listingId: string | null): UseDealActivityStatsResult {
  // Same listingId-as-dealId convention used elsewhere on the deal page (the
  // URL :dealId param resolves to listings.id). UnifiedDealTimeline does the
  // same — this keeps the two hooks consuming identical query keys so
  // react-query dedupes the underlying fetches.
  const dealId = listingId ?? '';
  const safeListingId = listingId ?? '';

  const { entries, isLoading: entriesLoading } = useUnifiedDealActivityEntries(
    dealId,
    safeListingId,
  );

  const { data: tasks = [], isLoading: tasksLoading } = useEntityTasks({
    entityType: ['deal', 'listing'],
    entityId: safeListingId,
  });

  const stats = useMemo<DealActivityStats>(() => {
    if (!listingId) return EMPTY_DEAL_ACTIVITY_STATS;
    return computeDealActivityStats(entries, tasks as unknown as ScheduledTaskLike[]);
  }, [entries, tasks, listingId]);

  return { stats, isLoading: entriesLoading || tasksLoading };
}
