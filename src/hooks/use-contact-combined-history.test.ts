import { describe, it, expect } from 'vitest';
import { mapRowToEntry } from './use-contact-combined-history';

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    event_at: '2026-04-01T12:00:00Z',
    created_at: '2026-04-01T12:00:00Z',
    source: 'phoneburner',
    channel: 'call',
    event_type: 'call_completed',
    title: null,
    body_preview: null,
    contact_email: null,
    campaign_name: null,
    direction: null,
    listing_id: null,
    deal_id: null,
    metadata: {},
    ...overrides,
  };
}

describe('mapRowToEntry', () => {
  describe('call channel (PhoneBurner)', () => {
    it('builds an entry id prefixed by source', () => {
      const e = mapRowToEntry(baseRow());
      expect(e.id).toBe('phoneburner-row-1');
      expect(e.channel).toBe('call');
    });

    it('title-cases event_type into a label', () => {
      const e = mapRowToEntry(baseRow({ event_type: 'call_completed' }));
      expect(e.label).toBe('Call Completed');
    });

    it('populates call-specific details from metadata', () => {
      const e = mapRowToEntry(
        baseRow({
          metadata: {
            duration_seconds: 180,
            talk_time_seconds: 120,
            disposition_label: 'Interested',
            disposition_code: 'INTERESTED',
            call_connected: true,
            recording_url: 'https://rec/1',
            user_name: 'Alice',
          },
        }),
      );
      expect(e.details.call_duration_seconds).toBe(180);
      expect(e.details.talk_time_seconds).toBe(120);
      expect(e.details.disposition_label).toBe('Interested');
      expect(e.details.call_connected).toBe(true);
      expect(e.details.recording_url).toBe('https://rec/1');
      expect(e.details.user_name).toBe('Alice');
      expect(e.context).toBe('Called by Alice');
    });

    it('prefers campaign_name over caller name for context', () => {
      const e = mapRowToEntry(
        baseRow({ campaign_name: 'Q2 Outreach', metadata: { user_name: 'Alice' } }),
      );
      expect(e.context).toBe('Campaign: Q2 Outreach');
    });
  });

  describe('email channel', () => {
    it('maps SmartLead EMAIL_SENT to a human label', () => {
      const e = mapRowToEntry(
        baseRow({
          source: 'smartlead',
          channel: 'email',
          event_type: 'EMAIL_SENT',
          campaign_name: 'Blitz',
        }),
      );
      expect(e.label).toBe('Email Sent');
      expect(e.channel).toBe('email');
      expect(e.context).toBe('Campaign: Blitz');
    });

    it('annotates Outlook emails with "(Outlook)" suffix', () => {
      const e = mapRowToEntry(
        baseRow({ source: 'outlook', channel: 'email', event_type: 'EMAIL_SENT' }),
      );
      expect(e.label).toBe('Email Sent (Outlook)');
    });

    it('maps REPLIED (reply inbox) to a human label', () => {
      const e = mapRowToEntry(
        baseRow({ source: 'smartlead', channel: 'email', event_type: 'REPLIED' }),
      );
      expect(e.label).toBe('Email Replied');
    });

    it('resolves lead_email from from_address when lead_email is missing', () => {
      const e = mapRowToEntry(
        baseRow({
          source: 'smartlead',
          channel: 'email',
          event_type: 'EMAIL_SENT',
          metadata: { from_address: 'a@b.co' },
        }),
      );
      expect(e.details.lead_email).toBe('a@b.co');
    });
  });

  describe('linkedin channel (HeyReach)', () => {
    it('maps CONNECTION_REQUEST_ACCEPTED to a human label', () => {
      const e = mapRowToEntry(
        baseRow({
          source: 'heyreach',
          channel: 'linkedin',
          event_type: 'CONNECTION_REQUEST_ACCEPTED',
        }),
      );
      expect(e.label).toBe('Connection Accepted');
      expect(e.channel).toBe('linkedin');
    });

    it('falls back to prettified event_type for unknown LinkedIn events', () => {
      const e = mapRowToEntry(
        baseRow({ source: 'heyreach', channel: 'linkedin', event_type: 'SOME_NEW_EVENT' }),
      );
      expect(e.label).toBe('SOME NEW EVENT');
    });

    it('populates linkedin_url from metadata', () => {
      const e = mapRowToEntry(
        baseRow({
          source: 'heyreach',
          channel: 'linkedin',
          event_type: 'MESSAGE_SENT',
          metadata: { linkedin_url: 'https://li/x' },
        }),
      );
      expect(e.details.lead_linkedin_url).toBe('https://li/x');
    });
  });

  describe('meeting channel (Fireflies)', () => {
    it('maps MEETING_RECORDED to "Meeting Recorded (Fireflies)"', () => {
      const e = mapRowToEntry(
        baseRow({ source: 'fireflies', channel: 'meeting', event_type: 'MEETING_RECORDED' }),
      );
      expect(e.label).toBe('Meeting Recorded (Fireflies)');
      expect(e.channel).toBe('meeting');
    });

    it('copies duration_minutes and also surfaces call_duration_seconds for stats compatibility', () => {
      const e = mapRowToEntry(
        baseRow({
          source: 'fireflies',
          channel: 'meeting',
          event_type: 'MEETING_RECORDED',
          metadata: { duration_minutes: 45 },
        }),
      );
      expect(e.details.duration_minutes).toBe(45);
      expect(e.details.call_duration_seconds).toBe(45 * 60);
    });

    it('passes through key_points, action_items, and transcript_url', () => {
      const e = mapRowToEntry(
        baseRow({
          source: 'fireflies',
          channel: 'meeting',
          event_type: 'MEETING_RECORDED',
          metadata: {
            key_points: ['a', 'b'],
            action_items: ['x'],
            transcript_url: 'https://ff/1',
          },
        }),
      );
      expect(e.details.key_points).toEqual(['a', 'b']);
      expect(e.details.action_items).toEqual(['x']);
      expect(e.details.transcript_url).toBe('https://ff/1');
    });

    it('uses body_preview as the meeting summary (call_outcome slot)', () => {
      const e = mapRowToEntry(
        baseRow({
          source: 'fireflies',
          channel: 'meeting',
          event_type: 'MEETING_RECORDED',
          body_preview: 'Discussed pipeline',
        }),
      );
      expect(e.details.call_outcome).toBe('Discussed pipeline');
    });
  });

  describe('fallbacks', () => {
    it('defaults timestamp to created_at when event_at is missing', () => {
      const e = mapRowToEntry(baseRow({ event_at: null, created_at: '2026-01-01T00:00:00Z' }));
      expect(e.timestamp).toBe('2026-01-01T00:00:00Z');
    });

    it('defaults channel to call when unspecified', () => {
      const e = mapRowToEntry(baseRow({ channel: null }));
      expect(e.channel).toBe('call');
    });
  });
});
