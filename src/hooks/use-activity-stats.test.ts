import { describe, it, expect } from 'vitest';
import { computeActivityStats } from './use-activity-stats';
import type { UnifiedActivityEntry } from './use-contact-combined-history';

function entry(
  channel: UnifiedActivityEntry['channel'],
  event_type: string,
  opts: Partial<UnifiedActivityEntry> & { daysAgo?: number } = {},
): UnifiedActivityEntry {
  const { daysAgo, timestamp, ...rest } = opts;
  const ts =
    daysAgo !== undefined
      ? new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
      : timestamp || new Date().toISOString();
  return {
    id: `${channel}-${Math.random().toString(36).slice(2)}`,
    channel,
    event_type,
    label: event_type,
    context: null,
    details: {},
    ...rest,
    timestamp: ts,
  };
}

describe('computeActivityStats', () => {
  it('returns zeroed stats and default action for empty input', () => {
    const s = computeActivityStats([]);
    expect(s.totalEmails).toBe(0);
    expect(s.totalCalls).toBe(0);
    expect(s.totalLinkedIn).toBe(0);
    expect(s.totalMeetings).toBe(0);
    expect(s.engagementStatus).toBe('none');
    expect(s.nextBestAction.action).toBe('Send Email');
    expect(s.lastContactDate).toBeNull();
  });

  it('categorizes emails and counts opens/replies', () => {
    const s = computeActivityStats([
      entry('email', 'EMAIL_SENT', { daysAgo: 3 }),
      entry('email', 'EMAIL_OPENED', { daysAgo: 2 }),
      entry('email', 'EMAIL_REPLIED', { daysAgo: 1 }),
    ]);
    expect(s.totalEmails).toBe(3);
    expect(s.emailsOpened).toBe(1);
    expect(s.emailsReplied).toBe(1);
    expect(s.emailEntries).toHaveLength(3);
  });

  it('categorizes LinkedIn and counts connections/replies', () => {
    const s = computeActivityStats([
      entry('linkedin', 'CONNECTION_REQUEST_SENT'),
      entry('linkedin', 'CONNECTION_REQUEST_ACCEPTED'),
      entry('linkedin', 'LEAD_REPLIED'),
    ]);
    expect(s.totalLinkedIn).toBe(3);
    expect(s.linkedInConnected).toBe(1);
    expect(s.linkedInReplied).toBe(1);
  });

  it('categorizes calls and counts connected', () => {
    const s = computeActivityStats([
      entry('call', 'call_completed', { details: { call_connected: true } }),
      entry('call', 'call_attempt', { details: { call_connected: false } }),
    ]);
    expect(s.totalCalls).toBe(2);
    expect(s.callsConnected).toBe(1);
  });

  it('categorizes meetings and stores them in meetingEntries', () => {
    const s = computeActivityStats([
      entry('meeting', 'MEETING_RECORDED', { details: { duration_minutes: 45 } }),
    ]);
    expect(s.totalMeetings).toBe(1);
    expect(s.meetingEntries).toHaveLength(1);
  });

  it('picks the first entry as "last contact"', () => {
    const recent = entry('email', 'EMAIL_SENT', { daysAgo: 1 });
    const older = entry('call', 'call_completed', { daysAgo: 10 });
    const s = computeActivityStats([recent, older]);
    expect(s.lastContactDate).toBe(recent.timestamp);
    expect(s.lastContactChannel).toBe('email');
    expect(s.daysSinceLastContact).toBeLessThanOrEqual(1);
  });

  it('flags engagementStatus=active when last contact <= 7 days ago', () => {
    const s = computeActivityStats([entry('email', 'EMAIL_SENT', { daysAgo: 2 })]);
    expect(s.engagementStatus).toBe('active');
  });

  it('flags engagementStatus=warm when last contact 8-30 days ago', () => {
    const s = computeActivityStats([entry('email', 'EMAIL_SENT', { daysAgo: 14 })]);
    expect(s.engagementStatus).toBe('warm');
  });

  it('flags engagementStatus=cold when last contact > 30 days ago', () => {
    const s = computeActivityStats([entry('email', 'EMAIL_SENT', { daysAgo: 45 })]);
    expect(s.engagementStatus).toBe('cold');
  });

  describe('nextBestAction', () => {
    it('recommends follow-up email after a recent attended meeting', () => {
      const s = computeActivityStats([
        entry('meeting', 'MEETING_RECORDED', { daysAgo: 2, details: { duration_minutes: 30 } }),
      ]);
      expect(s.nextBestAction.action).toBe('Send Follow-up Email');
      expect(s.nextBestAction.reason).toMatch(/meeting/i);
    });

    it('recommends scheduling a call after email opens without reply', () => {
      const s = computeActivityStats([
        entry('email', 'EMAIL_SENT', { daysAgo: 3 }),
        entry('email', 'EMAIL_OPENED', { daysAgo: 2 }),
      ]);
      expect(s.nextBestAction.action).toBe('Schedule Call');
    });

    it('recommends LinkedIn after many unopened emails', () => {
      const s = computeActivityStats([
        entry('email', 'EMAIL_SENT', { daysAgo: 5 }),
        entry('email', 'EMAIL_SENT', { daysAgo: 4 }),
        entry('email', 'EMAIL_SENT', { daysAgo: 3 }),
        entry('email', 'EMAIL_SENT', { daysAgo: 2 }),
      ]);
      expect(s.nextBestAction.action).toBe('Try LinkedIn');
    });

    it('recommends re-engage after 14+ days of silence', () => {
      const s = computeActivityStats([
        entry('call', 'call_completed', { daysAgo: 30, details: { call_connected: true } }),
      ]);
      // callsConnected > 0 && emailsReplied === 0 path triggers "Send Follow-up Email"
      // but daysAgo=30 doesn't hit the >14 re-engage branch because the
      // call path fires first. Use a no-engagement scenario instead:
      const s2 = computeActivityStats([entry('email', 'EMAIL_SENT', { daysAgo: 30 })]);
      expect(s2.nextBestAction.action).toBe('Re-engage');
      // keep s reachable for the other branch
      expect(s.nextBestAction.action).toBe('Send Follow-up Email');
    });
  });
});
