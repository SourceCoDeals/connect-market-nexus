/**
 * Tests for the pure compute layer of useDealActivityStats. We test
 * computeDealActivityStats directly — it's exported from the hook module
 * specifically so we can run it without spinning up a QueryClient.
 *
 * What's covered:
 *   - empty inputs return EMPTY_DEAL_ACTIVITY_STATS
 *   - touchpoint counts respect the 30-day cutoff and per-channel split
 *   - reverse-chronological iteration: lastTouch is the most recent
 *     non-note entry across all channels
 *   - bestChannel only fires when a channel has ≥3 outbound and at least
 *     one inbound reply; reason string carries the "{N} of {M}" format
 *   - nextScheduledAction prefers the earliest future callback over the
 *     earliest future task and skips past-dated rows
 *   - per-channel mappers handle direction signals from metadata
 */
import { describe, it, expect } from 'vitest';
import {
  computeDealActivityStats,
  EMPTY_DEAL_ACTIVITY_STATS,
  entryChannel,
  entryDirection,
  lastTouchOutcome,
  type ScheduledTaskLike,
} from './use-deal-activity-stats';
import type { UnifiedTimelineEntry } from './use-unified-deal-activity-entries';

const NOW = new Date('2026-04-26T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function entry(over: Partial<UnifiedTimelineEntry>): UnifiedTimelineEntry {
  return {
    id: 'x',
    timestamp: new Date(NOW - 1000).toISOString(),
    source: 'call',
    category: 'calls',
    icon: null as unknown as React.ReactNode,
    iconColor: '',
    title: '',
    description: null,
    metadata: {},
    adminName: null,
    contactId: null,
    contactEmail: null,
    ...over,
  };
}

describe('computeDealActivityStats', () => {
  it('returns the empty stats sentinel for an empty input', () => {
    const stats = computeDealActivityStats([], [], NOW);
    expect(stats).toEqual(EMPTY_DEAL_ACTIVITY_STATS);
  });

  it('returns the empty stats sentinel when only old/non-touchpoint entries are present', () => {
    const stats = computeDealActivityStats(
      [
        // > 30 days old → outside touchpoint window
        entry({
          id: '1',
          timestamp: new Date(NOW - 60 * DAY).toISOString(),
          source: 'call',
          category: 'calls',
          metadata: { direction: 'outbound' },
        }),
      ],
      [],
      NOW,
    );
    expect(stats.totalTouchpoints).toBe(0);
    expect(stats.byChannel.calls).toBe(0);
    // But lastTouch is still set — we want the most recent meaningful touch
    // regardless of the 30-day window.
    expect(stats.lastTouch?.channel).toBe('calls');
  });

  describe('touchpoint counting (last 30 days)', () => {
    it('counts each meaningful touchpoint by channel', () => {
      const stats = computeDealActivityStats(
        [
          entry({
            id: 'c1',
            source: 'call',
            category: 'calls',
            metadata: { direction: 'outbound' },
          }),
          entry({
            id: 'e1',
            source: 'email',
            category: 'emails',
            metadata: { direction: 'outbound' },
          }),
          entry({
            id: 'l1',
            source: 'linkedin',
            category: 'linkedin',
            metadata: { direction: 'outbound' },
          }),
          entry({ id: 'm1', source: 'transcript', category: 'meetings', metadata: {} }),
        ],
        [],
        NOW,
      );
      expect(stats.totalTouchpoints).toBe(4);
      expect(stats.byChannel).toEqual({
        calls: 1,
        emails: 1,
        linkedin: 1,
        meetings: 1,
        notes: 0,
      });
    });

    it('counts notes (deal_activity follow_up) as a touchpoint channel', () => {
      const stats = computeDealActivityStats(
        [
          entry({
            id: 'n1',
            source: 'deal_activity',
            category: 'system',
            metadata: { activity_type: 'follow_up' },
          }),
        ],
        [],
        NOW,
      );
      expect(stats.byChannel.notes).toBe(1);
      expect(stats.totalTouchpoints).toBe(1);
    });

    it('does not count system rows that are not follow_up notes', () => {
      const stats = computeDealActivityStats(
        [
          entry({
            id: 'sys1',
            source: 'deal_activity',
            category: 'system',
            metadata: { activity_type: 'stage_change' },
          }),
        ],
        [],
        NOW,
      );
      expect(stats.totalTouchpoints).toBe(0);
    });

    it('splits direction counts via metadata.direction', () => {
      const stats = computeDealActivityStats(
        [
          entry({
            id: 'a',
            source: 'call',
            category: 'calls',
            metadata: { direction: 'outbound' },
          }),
          entry({ id: 'b', source: 'call', category: 'calls', metadata: { direction: 'inbound' } }),
          entry({
            id: 'c',
            source: 'email',
            category: 'emails',
            metadata: { direction: 'outbound' },
          }),
        ],
        [],
        NOW,
      );
      expect(stats.byDirection).toEqual({ outbound: 2, inbound: 1 });
    });
  });

  describe('lastTouch', () => {
    it('picks the most recent non-note entry regardless of channel', () => {
      const older = entry({
        id: 'older',
        timestamp: new Date(NOW - 5 * DAY).toISOString(),
        source: 'email',
        category: 'emails',
        adminName: 'Alex',
      });
      const newer = entry({
        id: 'newer',
        timestamp: new Date(NOW - 1 * DAY).toISOString(),
        source: 'transcript',
        category: 'meetings',
        adminName: 'Sam',
      });
      const stats = computeDealActivityStats([older, newer], [], NOW);
      expect(stats.lastTouch?.channel).toBe('meetings');
      expect(stats.lastTouch?.teamMember).toBe('Sam');
      expect(stats.lastTouch?.outcome).toBe('meeting');
    });

    it('ignores notes when computing lastTouch', () => {
      const note = entry({
        id: 'note',
        timestamp: new Date(NOW - 1).toISOString(),
        source: 'deal_activity',
        category: 'system',
        metadata: { activity_type: 'follow_up' },
      });
      const callOlder = entry({
        id: 'call',
        timestamp: new Date(NOW - 2 * DAY).toISOString(),
        source: 'call',
        category: 'calls',
      });
      const stats = computeDealActivityStats([note, callOlder], [], NOW);
      expect(stats.lastTouch?.channel).toBe('calls');
    });
  });

  describe('bestChannel', () => {
    it('returns null when no channel hits 3 outbound', () => {
      const stats = computeDealActivityStats(
        [
          entry({
            id: 'o1',
            source: 'email',
            category: 'emails',
            metadata: { direction: 'outbound' },
          }),
          entry({
            id: 'o2',
            source: 'email',
            category: 'emails',
            metadata: { direction: 'outbound' },
          }),
          entry({
            id: 'i1',
            source: 'email',
            category: 'emails',
            metadata: { direction: 'inbound' },
          }),
        ],
        [],
        NOW,
      );
      expect(stats.bestChannel).toBeNull();
    });

    it('returns null when threshold is met but no inbound reply', () => {
      const stats = computeDealActivityStats(
        [
          entry({
            id: 'o1',
            source: 'email',
            category: 'emails',
            metadata: { direction: 'outbound' },
          }),
          entry({
            id: 'o2',
            source: 'email',
            category: 'emails',
            metadata: { direction: 'outbound' },
          }),
          entry({
            id: 'o3',
            source: 'email',
            category: 'emails',
            metadata: { direction: 'outbound' },
          }),
        ],
        [],
        NOW,
      );
      expect(stats.bestChannel).toBeNull();
    });

    it('picks the channel with highest reply rate when ≥3 outbound and ≥1 inbound', () => {
      // email: 3 outbound, 2 inbound => 2/3
      // call:  3 outbound, 1 inbound => 1/3
      const ts = (offsetDays: number) => new Date(NOW - offsetDays * DAY).toISOString();
      const stats = computeDealActivityStats(
        [
          entry({
            id: 'e1',
            timestamp: ts(10),
            source: 'email',
            category: 'emails',
            metadata: { direction: 'outbound' },
          }),
          entry({
            id: 'e2',
            timestamp: ts(9),
            source: 'email',
            category: 'emails',
            metadata: { direction: 'inbound' },
          }),
          entry({
            id: 'e3',
            timestamp: ts(8),
            source: 'email',
            category: 'emails',
            metadata: { direction: 'outbound' },
          }),
          entry({
            id: 'e4',
            timestamp: ts(7),
            source: 'email',
            category: 'emails',
            metadata: { direction: 'outbound' },
          }),
          entry({
            id: 'e5',
            timestamp: ts(6),
            source: 'email',
            category: 'emails',
            metadata: { direction: 'inbound' },
          }),
          entry({
            id: 'c1',
            timestamp: ts(10),
            source: 'call',
            category: 'calls',
            metadata: { direction: 'outbound' },
          }),
          entry({
            id: 'c2',
            timestamp: ts(9),
            source: 'call',
            category: 'calls',
            metadata: { direction: 'outbound' },
          }),
          entry({
            id: 'c3',
            timestamp: ts(8),
            source: 'call',
            category: 'calls',
            metadata: { direction: 'outbound' },
          }),
          entry({
            id: 'c4',
            timestamp: ts(7),
            source: 'call',
            category: 'calls',
            metadata: { direction: 'inbound' },
          }),
        ],
        [],
        NOW,
      );
      expect(stats.bestChannel?.channel).toBe('email');
      expect(stats.bestChannel?.reason).toMatch(/2 of 3 emails got a reply within/);
    });
  });

  describe('nextScheduledAction', () => {
    it('returns null when no future callback or task', () => {
      const stats = computeDealActivityStats([], [], NOW);
      expect(stats.nextScheduledAction).toBeNull();
    });

    it('picks the next future callback from a call entry', () => {
      const stats = computeDealActivityStats(
        [
          entry({
            id: 'c1',
            source: 'call',
            category: 'calls',
            title: 'voicemail',
            adminName: 'Alex',
            metadata: {
              direction: 'outbound',
              callback_scheduled_date: new Date(NOW + 2 * DAY).toISOString(),
            },
          }),
        ],
        [],
        NOW,
      );
      expect(stats.nextScheduledAction?.type).toBe('callback');
      expect(stats.nextScheduledAction?.description).toContain('Callback');
      expect(stats.nextScheduledAction?.description).toContain('Alex');
    });

    it('picks task when task is sooner than callback', () => {
      const callbackAt = new Date(NOW + 5 * DAY).toISOString();
      const taskDue = new Date(NOW + 1 * DAY).toISOString();
      const tasks: ScheduledTaskLike[] = [
        { due_date: taskDue, task_type: 'follow_up', description: 'check on owner reply' },
      ];
      const stats = computeDealActivityStats(
        [
          entry({
            id: 'c1',
            source: 'call',
            category: 'calls',
            metadata: { callback_scheduled_date: callbackAt },
          }),
        ],
        tasks,
        NOW,
      );
      expect(stats.nextScheduledAction?.type).toBe('task');
      expect(stats.nextScheduledAction?.description).toContain('follow_up');
    });

    it('skips past-dated callbacks and tasks', () => {
      const stats = computeDealActivityStats(
        [
          entry({
            id: 'c1',
            source: 'call',
            category: 'calls',
            metadata: { callback_scheduled_date: new Date(NOW - 1 * DAY).toISOString() },
          }),
        ],
        [{ due_date: new Date(NOW - 1 * DAY).toISOString() }],
        NOW,
      );
      expect(stats.nextScheduledAction).toBeNull();
    });
  });
});

describe('helpers', () => {
  it('entryChannel maps category to stats channel', () => {
    expect(entryChannel(entry({ source: 'call', category: 'calls' }))).toBe('calls');
    expect(entryChannel(entry({ source: 'email', category: 'emails' }))).toBe('emails');
    expect(entryChannel(entry({ source: 'linkedin', category: 'linkedin' }))).toBe('linkedin');
    expect(entryChannel(entry({ source: 'transcript', category: 'meetings' }))).toBe('meetings');
    expect(
      entryChannel(
        entry({
          source: 'deal_activity',
          category: 'system',
          metadata: { activity_type: 'follow_up' },
        }),
      ),
    ).toBe('notes');
    expect(
      entryChannel(
        entry({
          source: 'deal_activity',
          category: 'system',
          metadata: { activity_type: 'stage_change' },
        }),
      ),
    ).toBeNull();
  });

  it('entryDirection reads direction from metadata', () => {
    expect(entryDirection(entry({ metadata: { direction: 'outbound' } }))).toBe('outbound');
    expect(entryDirection(entry({ metadata: { direction: 'inbound' } }))).toBe('inbound');
    expect(entryDirection(entry({ metadata: {} }))).toBeNull();
    expect(entryDirection(entry({ metadata: { direction: 'lateral' } }))).toBeNull();
  });

  it('lastTouchOutcome describes the touch by source', () => {
    expect(lastTouchOutcome(entry({ source: 'call', metadata: { outcome: 'connected' } }))).toBe(
      'connected',
    );
    expect(lastTouchOutcome(entry({ source: 'email', metadata: { direction: 'outbound' } }))).toBe(
      'sent',
    );
    expect(lastTouchOutcome(entry({ source: 'email', metadata: { direction: 'inbound' } }))).toBe(
      'received',
    );
    expect(lastTouchOutcome(entry({ source: 'transcript', metadata: {} }))).toBe('meeting');
  });
});
