/**
 * Tests for the click handlers wired into DealActivityStatsStrip cells
 * (audit item #2). Each interactive cell is supposed to dispatch a
 * specific window event:
 *   - Cell 1's per-channel counts → activity-set-filter with the right
 *     FilterCategory
 *   - Cell 2 (Last touch) → activity-set-filter (channel proxy)
 *   - Cell 3 (Best channel) → activity-set-filter
 *   - Cell 4 (Next action) → activity-set-filter for callback;
 *     deal-page-set-tab for task
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Mock the stats hook to inject deterministic stats data into the strip.
const mockStats = vi.hoisted(() => ({
  current: {
    totalTouchpoints: 0,
    byChannel: { calls: 0, emails: 0, linkedin: 0, meetings: 0, notes: 0 },
    byDirection: { outbound: 0, inbound: 0 },
    lastTouch: null as null | {
      at: string;
      channel: 'calls' | 'emails' | 'linkedin' | 'meetings' | 'notes';
      outcome: string;
      teamMember: string | null;
    },
    bestChannel: null as null | { channel: 'email' | 'call' | 'linkedin'; reason: string },
    nextScheduledAction: null as null | {
      type: 'callback' | 'task';
      at: string;
      description: string;
    },
    byRep: {} as Record<string, number>,
  },
  isLoading: false,
}));

vi.mock('@/hooks/use-deal-activity-stats', () => ({
  useDealActivityStats: () => ({ stats: mockStats.current, isLoading: mockStats.isLoading }),
}));

import { DealActivityStatsStrip } from './DealActivityStatsStrip';

const events: Array<{ name: string; detail: unknown }> = [];

function captureWindowEvent(name: string) {
  const listener = (e: Event) => {
    events.push({ name, detail: (e as CustomEvent).detail });
  };
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}

let removeFilter: () => void;
let removeJump: () => void;
let removeTab: () => void;

beforeEach(() => {
  events.length = 0;
  removeFilter = captureWindowEvent('activity-set-filter');
  removeJump = captureWindowEvent('activity-search-jump');
  removeTab = captureWindowEvent('deal-page-set-tab');
});

afterEach(() => {
  removeFilter();
  removeJump();
  removeTab();
  cleanup();
});

// ── Cell 1: per-channel counts ────────────────────────────────────────────

describe('Cell 1 — touchpoints per-channel counts', () => {
  it('renders inert "—" when totalTouchpoints is 0', () => {
    mockStats.current = {
      ...mockStats.current,
      totalTouchpoints: 0,
      byChannel: { calls: 0, emails: 0, linkedin: 0, meetings: 0, notes: 0 },
    };
    render(<DealActivityStatsStrip listingId="list-1" />);
    // Multiple cells may render "—" when all stats are empty; the
    // touchpoints-specific detail copy is unique.
    expect(screen.getByText('no activity in the last 30 days')).toBeTruthy();
  });

  it('clicking a non-zero count dispatches activity-set-filter for that channel', () => {
    mockStats.current = {
      ...mockStats.current,
      totalTouchpoints: 11,
      byChannel: { calls: 4, emails: 5, linkedin: 2, meetings: 0, notes: 0 },
    };
    render(<DealActivityStatsStrip listingId="list-1" />);

    fireEvent.click(screen.getByLabelText(/Filter feed to calls \(4 entries\)/));
    expect(events.find((e) => e.name === 'activity-set-filter')?.detail).toEqual({
      filter: 'calls',
    });

    events.length = 0;
    fireEvent.click(screen.getByLabelText(/Filter feed to emails \(5 entries\)/));
    expect(events.find((e) => e.name === 'activity-set-filter')?.detail).toEqual({
      filter: 'emails',
    });

    events.length = 0;
    fireEvent.click(screen.getByLabelText(/Filter feed to LinkedIn \(2 entries\)/));
    expect(events.find((e) => e.name === 'activity-set-filter')?.detail).toEqual({
      filter: 'linkedin',
    });
  });

  it('zero-count items render but are not clickable', () => {
    mockStats.current = {
      ...mockStats.current,
      totalTouchpoints: 4,
      byChannel: { calls: 4, emails: 0, linkedin: 0, meetings: 0, notes: 0 },
    };
    render(<DealActivityStatsStrip listingId="list-1" />);
    // 0 emails / 0 LinkedIn / 0 meetings should show but NOT be buttons
    expect(screen.queryByLabelText(/Filter feed to emails \(0 entries\)/)).toBeNull();
    expect(screen.queryByLabelText(/Filter feed to LinkedIn \(0 entries\)/)).toBeNull();
    // Non-button text is still in DOM
    expect(screen.getByText('0 emails')).toBeTruthy();
  });
});

// ── Cell 2: Last touch ────────────────────────────────────────────────────

describe('Cell 2 — last touch', () => {
  it('renders inert "—" when lastTouch is null', () => {
    mockStats.current = { ...mockStats.current, lastTouch: null };
    render(<DealActivityStatsStrip listingId="list-1" />);
    expect(screen.getByText('no recorded touch yet')).toBeTruthy();
  });

  it('clicking the cell dispatches activity-set-filter with the last-touch channel', () => {
    mockStats.current = {
      ...mockStats.current,
      lastTouch: {
        at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        channel: 'emails',
        outcome: 'sent',
        teamMember: 'Alex',
      },
    };
    render(<DealActivityStatsStrip listingId="list-1" />);
    fireEvent.click(screen.getByLabelText(/Filter feed to emails \(last touch was/));
    expect(events.find((e) => e.name === 'activity-set-filter')?.detail).toEqual({
      filter: 'emails',
    });
  });
});

// ── Cell 3: Best channel ──────────────────────────────────────────────────

describe('Cell 3 — best channel', () => {
  it('renders inert "—" when bestChannel is null', () => {
    mockStats.current = { ...mockStats.current, bestChannel: null };
    render(<DealActivityStatsStrip listingId="list-1" />);
    expect(
      screen.getByText('need at least 3 outbound touches on a channel to evaluate'),
    ).toBeTruthy();
  });

  it('clicking sets the filter to that channel (email → emails)', () => {
    mockStats.current = {
      ...mockStats.current,
      bestChannel: { channel: 'email', reason: '4 of 6 emails got a reply within 1d' },
    };
    render(<DealActivityStatsStrip listingId="list-1" />);
    fireEvent.click(screen.getByLabelText(/Filter feed to Email/));
    expect(events.find((e) => e.name === 'activity-set-filter')?.detail).toEqual({
      filter: 'emails',
    });
  });

  it('call → calls and linkedin → linkedin', () => {
    mockStats.current = {
      ...mockStats.current,
      bestChannel: { channel: 'call', reason: '2 of 3 calls got a reply within 4h' },
    };
    const r1 = render(<DealActivityStatsStrip listingId="list-1" />);
    fireEvent.click(screen.getByLabelText(/Filter feed to Call/));
    expect(events.find((e) => e.name === 'activity-set-filter')?.detail).toEqual({
      filter: 'calls',
    });
    r1.unmount();
    events.length = 0;

    mockStats.current = {
      ...mockStats.current,
      bestChannel: { channel: 'linkedin', reason: '1 of 5 linkedin' },
    };
    render(<DealActivityStatsStrip listingId="list-1" />);
    fireEvent.click(screen.getByLabelText(/Filter feed to LinkedIn/));
    expect(events.find((e) => e.name === 'activity-set-filter')?.detail).toEqual({
      filter: 'linkedin',
    });
  });
});

// ── Cell 4: Next action ───────────────────────────────────────────────────

describe('Cell 4 — next action', () => {
  it('renders inert "—" when nextScheduledAction is null', () => {
    mockStats.current = { ...mockStats.current, nextScheduledAction: null };
    render(<DealActivityStatsStrip listingId="list-1" />);
    expect(screen.getByText('nothing scheduled')).toBeTruthy();
  });

  it('callback → activity-set-filter for calls', () => {
    mockStats.current = {
      ...mockStats.current,
      nextScheduledAction: {
        type: 'callback',
        at: new Date(Date.now() + 86400000).toISOString(),
        description: 'Callback: voicemail (Alex)',
      },
    };
    render(<DealActivityStatsStrip listingId="list-1" />);
    fireEvent.click(screen.getByLabelText(/Filter feed to calls — next/));
    expect(events.find((e) => e.name === 'activity-set-filter')?.detail).toEqual({
      filter: 'calls',
    });
    expect(events.find((e) => e.name === 'deal-page-set-tab')).toBeUndefined();
  });

  it('task → deal-page-set-tab event', () => {
    mockStats.current = {
      ...mockStats.current,
      nextScheduledAction: {
        type: 'task',
        at: new Date(Date.now() + 86400000).toISOString(),
        description: 'follow_up: review LOI',
      },
    };
    render(<DealActivityStatsStrip listingId="list-1" />);
    fireEvent.click(screen.getByLabelText(/Open Tasks tab — next/));
    expect(events.find((e) => e.name === 'deal-page-set-tab')?.detail).toEqual({
      value: 'tasks',
    });
    expect(events.find((e) => e.name === 'activity-set-filter')).toBeUndefined();
  });
});
