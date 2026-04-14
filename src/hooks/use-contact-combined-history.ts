import { useQuery } from '@tanstack/react-query';
import { untypedFrom } from '@/integrations/supabase/client';

/**
 * Unified activity entry combining SmartLead emails, PhoneBurner calls,
 * HeyReach LinkedIn outreach, Outlook emails, and Fireflies meetings
 * into a single chronological timeline.
 */
export interface UnifiedActivityEntry {
  id: string;
  timestamp: string;
  channel: 'email' | 'call' | 'linkedin' | 'meeting';
  /** e.g. EMAIL_SENT, EMAIL_OPENED, call_completed, CONNECTION_REQUEST_SENT */
  event_type: string;
  /** Human-readable label */
  label: string;
  /** Campaign or session context */
  context: string | null;
  /** Extra details: disposition, recording, etc. */
  details: {
    campaign_name?: string | null;
    lead_email?: string | null;
    lead_linkedin_url?: string | null;
    lead_status?: string | null;
    call_outcome?: string | null;
    disposition_code?: string | null;
    disposition_label?: string | null;
    disposition_notes?: string | null;
    call_duration_seconds?: number | null;
    talk_time_seconds?: number | null;
    recording_url?: string | null;
    recording_url_public?: string | null;
    call_transcript?: string | null;
    call_connected?: boolean | null;
    call_direction?: string | null;
    phoneburner_status?: string | null;
    contact_notes?: string | null;
    callback_scheduled_date?: string | null;
    user_name?: string | null;
    // Meeting fields
    duration_minutes?: number | null;
    participants?: unknown;
    transcript_url?: string | null;
    key_points?: unknown;
    action_items?: unknown;
  };
}

const EMAIL_EVENT_LABELS: Record<string, string> = {
  EMAIL_SENT: 'Email Sent',
  EMAIL_OPENED: 'Email Opened',
  OPENED: 'Email Opened',
  LINK_CLICKED: 'Link Clicked',
  CLICKED: 'Link Clicked',
  EMAIL_REPLIED: 'Email Replied',
  REPLIED: 'Email Replied',
  EMAIL_RECEIVED: 'Email Received',
  EMAIL_BOUNCED: 'Email Bounced',
  BOUNCED: 'Email Bounced',
  UNSUBSCRIBED: 'Unsubscribed',
  INTERESTED: 'Marked Interested',
  NOT_INTERESTED: 'Not Interested',
  MANUAL_STEP_REACHED: 'Manual Step',
  SENT: 'Email Sent',
};

const LINKEDIN_EVENT_LABELS: Record<string, string> = {
  CONNECTION_REQUEST_SENT: 'Connection Request Sent',
  CONNECTION_REQUEST_ACCEPTED: 'Connection Accepted',
  MESSAGE_SENT: 'LinkedIn Message Sent',
  MESSAGE_RECEIVED: 'LinkedIn Message Received',
  INMAIL_SENT: 'InMail Sent',
  INMAIL_RECEIVED: 'InMail Received',
  PROFILE_VIEWED: 'Profile Viewed',
  FOLLOW_SENT: 'Followed',
  LIKE_SENT: 'Liked Post',
  LEAD_REPLIED: 'Lead Replied',
  LEAD_INTERESTED: 'Marked Interested',
  LEAD_NOT_INTERESTED: 'Not Interested',
};

const MEETING_EVENT_LABELS: Record<string, string> = {
  MEETING_RECORDED: 'Meeting Recorded (Fireflies)',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TimelineRow = Record<string, any>;

function mapRowToEntry(row: TimelineRow): UnifiedActivityEntry {
  const channel = (row.channel || 'call') as UnifiedActivityEntry['channel'];
  const eventType = (row.event_type || '').toUpperCase();
  const meta = row.metadata || {};
  const source = row.source || '';

  // Build human-readable label
  let label: string;
  if (channel === 'email') {
    label = EMAIL_EVENT_LABELS[eventType] || eventType.replace(/_/g, ' ');
    if (source === 'outlook' && !label.includes('Outlook')) {
      label += ' (Outlook)';
    }
  } else if (channel === 'linkedin') {
    label = LINKEDIN_EVENT_LABELS[eventType] || eventType.replace(/_/g, ' ');
  } else if (channel === 'meeting') {
    label = MEETING_EVENT_LABELS[eventType] || 'Meeting';
  } else {
    // call
    label = (row.event_type || 'Call')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  // Build context string
  let context: string | null = null;
  if (row.campaign_name) {
    context = `Campaign: ${row.campaign_name}`;
  } else if (channel === 'call' && meta.user_name) {
    context = `Called by ${meta.user_name}`;
  } else if (row.title && channel !== 'call') {
    context = row.title;
  } else if (channel === 'meeting') {
    context = row.title || 'Meeting';
  }

  // Build details from metadata JSONB
  const details: UnifiedActivityEntry['details'] = {
    campaign_name: row.campaign_name || null,
    lead_email: meta.lead_email || meta.from_address || row.contact_email || null,
    lead_linkedin_url: meta.linkedin_url || null,
  };

  if (channel === 'call') {
    details.call_outcome = meta.call_outcome || null;
    details.disposition_code = meta.disposition_code || null;
    details.disposition_label = meta.disposition_label || null;
    details.disposition_notes = meta.disposition_notes || null;
    details.call_duration_seconds = meta.duration_seconds || null;
    details.talk_time_seconds = meta.talk_time_seconds || null;
    details.recording_url = meta.recording_url || null;
    details.recording_url_public = meta.recording_url_public || null;
    details.call_transcript = meta.call_transcript || null;
    details.call_connected = meta.call_connected || null;
    details.call_direction = meta.call_direction || row.direction || null;
    details.phoneburner_status = meta.phoneburner_status || null;
    details.contact_notes = meta.contact_notes || null;
    details.callback_scheduled_date = meta.callback_scheduled_date || null;
    details.user_name = meta.user_name || null;
  } else if (channel === 'meeting') {
    details.duration_minutes = meta.duration_minutes || null;
    details.participants = meta.participants || null;
    details.transcript_url = meta.transcript_url || null;
    details.key_points = meta.key_points || null;
    details.action_items = meta.action_items || null;
    // Map duration for compatibility with call stats
    if (meta.duration_minutes) {
      details.call_duration_seconds = meta.duration_minutes * 60;
    }
    details.call_outcome = row.body_preview || null;
  }

  return {
    id: `${source}-${row.id}`,
    timestamp: row.event_at || row.created_at || new Date().toISOString(),
    channel,
    event_type: row.event_type || '',
    label,
    context,
    details,
  };
}

/**
 * Fetches combined communication history for a buyer or contact email.
 * Uses the unified_contact_timeline Postgres view — single query replaces
 * the previous 6+ parallel queries.
 */
export function useContactCombinedHistory(buyerId: string | null) {
  return useQuery<UnifiedActivityEntry[]>({
    queryKey: ['contact-combined-history', buyerId],
    queryFn: async () => {
      if (!buyerId) return [];

      const { data, error } = await untypedFrom('unified_contact_timeline')
        .select('*')
        .eq('remarketing_buyer_id', buyerId)
        .order('event_at', { ascending: false })
        .limit(500);

      if (error) {
        console.warn('[useContactCombinedHistory] query error:', error.message);
        return [];
      }

      return (data || []).map(mapRowToEntry);
    },
    enabled: !!buyerId,
    staleTime: 60_000,
  });
}

/**
 * Fetches combined history by contact email address.
 * Useful on deal pages where we have buyer email but not necessarily the buyer ID.
 */
export function useContactCombinedHistoryByEmail(email: string | null) {
  return useQuery<UnifiedActivityEntry[]>({
    queryKey: ['contact-combined-history-email', email],
    queryFn: async () => {
      if (!email) return [];

      const { data, error } = await untypedFrom('unified_contact_timeline')
        .select('*')
        .ilike('contact_email', email)
        .order('event_at', { ascending: false })
        .limit(500);

      if (error) {
        console.warn('[useContactCombinedHistoryByEmail] query error:', error.message);
        return [];
      }

      return (data || []).map(mapRowToEntry);
    },
    enabled: !!email,
    staleTime: 60_000,
  });
}
