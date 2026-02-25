import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Unified activity entry combining SmartLead emails and PhoneBurner calls
 * into a single chronological timeline for a contact.
 */
export interface UnifiedActivityEntry {
  id: string;
  timestamp: string;
  channel: 'email' | 'call';
  /** e.g. EMAIL_SENT, EMAIL_OPENED, call_completed, call_attempt */
  event_type: string;
  /** Human-readable label */
  label: string;
  /** Campaign or session context */
  context: string | null;
  /** Extra details: disposition, recording, etc. */
  details: {
    campaign_name?: string | null;
    lead_email?: string | null;
    lead_status?: string | null;
    call_outcome?: string | null;
    disposition_code?: string | null;
    disposition_label?: string | null;
    disposition_notes?: string | null;
    call_duration_seconds?: number | null;
    recording_url?: string | null;
    user_name?: string | null;
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
  EMAIL_BOUNCED: 'Email Bounced',
  BOUNCED: 'Email Bounced',
  UNSUBSCRIBED: 'Unsubscribed',
  INTERESTED: 'Marked Interested',
  NOT_INTERESTED: 'Not Interested',
  MANUAL_STEP_REACHED: 'Manual Step',
};

/**
 * Fetches combined SmartLead email + PhoneBurner call history for a given
 * buyer (remarketing_buyer_id). Returns a unified, reverse-chronological
 * timeline of all communication activity.
 */
export function useContactCombinedHistory(buyerId: string | null) {
  return useQuery<UnifiedActivityEntry[]>({
    queryKey: ['contact-combined-history', buyerId],
    queryFn: async () => {
      if (!buyerId) return [];

      const entries: UnifiedActivityEntry[] = [];

      // ── 1. PhoneBurner Call Activities ──
      // Get contacts belonging to this buyer first
      const { data: contacts } = await supabase
        .from('buyer_contacts')
        .select('id')
        .eq('buyer_id', buyerId);

      const contactIds = (contacts || []).map((c) => c.id);

      if (contactIds.length > 0) {
        const { data: callActivities } = await supabase
          .from('contact_activities')
          .select('*')
          .in('contact_id', contactIds)
          .order('created_at', { ascending: false })
          .limit(100);

        for (const a of callActivities || []) {
          entries.push({
            id: `call-${a.id}`,
            timestamp: a.call_started_at || a.created_at,
            channel: 'call',
            event_type: a.activity_type,
            label: a.activity_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            context: a.user_name ? `Called by ${a.user_name}` : null,
            details: {
              call_outcome: a.call_outcome,
              disposition_code: a.disposition_code,
              disposition_label: a.disposition_label,
              disposition_notes: a.disposition_notes,
              call_duration_seconds: a.call_duration_seconds,
              recording_url: a.recording_url,
              user_name: a.user_name,
            },
          });
        }
      }

      // Also check contact_activities directly linked by remarketing_buyer_id
      const { data: directCallActivities } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('remarketing_buyer_id', buyerId)
        .order('created_at', { ascending: false })
        .limit(100);

      const existingCallIds = new Set(entries.map((e) => e.id));
      for (const a of directCallActivities || []) {
        const entryId = `call-${a.id}`;
        if (existingCallIds.has(entryId)) continue;
        entries.push({
          id: entryId,
          timestamp: a.call_started_at || a.created_at,
          channel: 'call',
          event_type: a.activity_type,
          label: a.activity_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          context: a.user_name ? `Called by ${a.user_name}` : null,
          details: {
            call_outcome: a.call_outcome,
            disposition_code: a.disposition_code,
            disposition_label: a.disposition_label,
            disposition_notes: a.disposition_notes,
            call_duration_seconds: a.call_duration_seconds,
            recording_url: a.recording_url,
            user_name: a.user_name,
          },
        });
      }

      // ── 2. SmartLead Email Events ──
      const { data: campaignLeads } = await supabase
        .from('smartlead_campaign_leads')
        .select('id, campaign_id, email, lead_status, lead_category, last_activity_at, created_at')
        .eq('remarketing_buyer_id', buyerId)
        .order('created_at', { ascending: false });


      // Get emails for webhook event lookup
      const emails = [...new Set((campaignLeads || []).map((c) => c.email).filter(Boolean))];

      if (emails.length > 0) {
        const { data: webhookEvents } = await supabase
          .from('smartlead_webhook_events')
          .select('id, event_type, lead_email, smartlead_campaign_id, payload, created_at')
          .in('lead_email', emails)
          .order('created_at', { ascending: false })
          .limit(100);

        // Build smartlead_campaign_id -> name map
        const slCampaignIds = [
          ...new Set((webhookEvents || []).map((e) => e.smartlead_campaign_id).filter(Boolean)),
        ] as number[];

        let slCampaignNameMap = new Map<number, string>();
        if (slCampaignIds.length > 0) {
          const { data: slCampaigns } = await supabase
            .from('smartlead_campaigns')
            .select('id, name, smartlead_campaign_id')
            .in('smartlead_campaign_id', slCampaignIds);
          if (slCampaigns) {
            slCampaignNameMap = new Map(slCampaigns.map((c) => [c.smartlead_campaign_id, c.name]));
          }
        }

        for (const e of webhookEvents || []) {
          const campaignName = e.smartlead_campaign_id
            ? slCampaignNameMap.get(e.smartlead_campaign_id) || null
            : null;

          entries.push({
            id: `email-${e.id}`,
            timestamp: e.created_at || new Date().toISOString(),
            channel: 'email',
            event_type: e.event_type,
            label: EMAIL_EVENT_LABELS[e.event_type] || e.event_type.replace(/_/g, ' '),
            context: campaignName ? `Campaign: ${campaignName}` : null,
            details: {
              campaign_name: campaignName,
              lead_email: e.lead_email,
            },
          });
        }
      }

      // Sort by timestamp descending (newest first)
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return entries;
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

      const entries: UnifiedActivityEntry[] = [];

      // ── 1. PhoneBurner Calls by email ──
      const { data: callActivities } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('contact_email', email)
        .order('created_at', { ascending: false })
        .limit(100);

      for (const a of callActivities || []) {
        entries.push({
          id: `call-${a.id}`,
          timestamp: a.call_started_at || a.created_at,
          channel: 'call',
          event_type: a.activity_type,
          label: a.activity_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          context: a.user_name ? `Called by ${a.user_name}` : null,
          details: {
            call_outcome: a.call_outcome,
            disposition_code: a.disposition_code,
            disposition_label: a.disposition_label,
            disposition_notes: a.disposition_notes,
            call_duration_seconds: a.call_duration_seconds,
            recording_url: a.recording_url,
            user_name: a.user_name,
          },
        });
      }

      // ── 2. SmartLead Email Events by email ──
      const { data: webhookEvents } = await supabase
        .from('smartlead_webhook_events')
        .select('id, event_type, lead_email, smartlead_campaign_id, payload, created_at')
        .eq('lead_email', email)
        .order('created_at', { ascending: false })
        .limit(100);

      const slCampaignIds = [
        ...new Set((webhookEvents || []).map((e) => e.smartlead_campaign_id).filter(Boolean)),
      ] as number[];

      let slCampaignNameMap = new Map<number, string>();
      if (slCampaignIds.length > 0) {
        const { data: slCampaigns } = await supabase
          .from('smartlead_campaigns')
          .select('id, name, smartlead_campaign_id')
          .in('smartlead_campaign_id', slCampaignIds);
        if (slCampaigns) {
          slCampaignNameMap = new Map(slCampaigns.map((c) => [c.smartlead_campaign_id, c.name]));
        }
      }

      for (const e of webhookEvents || []) {
        const campaignName = e.smartlead_campaign_id
          ? slCampaignNameMap.get(e.smartlead_campaign_id) || null
          : null;

        entries.push({
          id: `email-${e.id}`,
          timestamp: e.created_at || new Date().toISOString(),
          channel: 'email',
          event_type: e.event_type,
          label: EMAIL_EVENT_LABELS[e.event_type] || e.event_type.replace(/_/g, ' '),
          context: campaignName ? `Campaign: ${campaignName}` : null,
          details: {
            campaign_name: campaignName,
            lead_email: e.lead_email,
          },
        });
      }

      // Sort newest first
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return entries;
    },
    enabled: !!email,
    staleTime: 60_000,
  });
}
