import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HeyReachContactActivity {
  id: string;
  campaign_id: string;
  campaign_name: string | null;
  heyreach_lead_id: string | null;
  linkedin_url: string;
  email: string | null;
  lead_status: string | null;
  lead_category: string | null;
  last_activity_at: string | null;
  created_at: string | null;
}

export interface HeyReachContactEvent {
  id: string;
  event_type: string;
  lead_linkedin_url: string | null;
  lead_email: string | null;
  heyreach_campaign_id: number | null;
  campaign_name: string | null;
  payload: unknown;
  created_at: string | null;
}

export interface ContactHeyReachHistory {
  campaigns: HeyReachContactActivity[];
  events: HeyReachContactEvent[];
}

/**
 * Fetch HeyReach LinkedIn outreach history for a buyer (by remarketing_buyer_id).
 * Joins heyreach_campaign_leads + heyreach_campaigns for campaign participation,
 * and heyreach_webhook_events for individual LinkedIn events.
 */
export function useContactHeyReachHistory(buyerId: string | null) {
  return useQuery<ContactHeyReachHistory>({
    queryKey: ['heyreach', 'contact-history', buyerId],
    queryFn: async () => {
      if (!buyerId) return { campaigns: [], events: [] };

      // 1. Get all campaign leads for this buyer
      const { data: campaignLeads, error: leadsErr } = await supabase
        .from('heyreach_campaign_leads')
        .select(
          `
          id,
          campaign_id,
          heyreach_lead_id,
          linkedin_url,
          email,
          lead_status,
          lead_category,
          last_activity_at,
          created_at
        `,
        )
        .eq('remarketing_buyer_id', buyerId)
        .order('created_at', { ascending: false });

      if (leadsErr) throw leadsErr;

      // 2. Get campaign names for these leads
      const campaignIds = [...new Set((campaignLeads || []).map((l) => l.campaign_id))];
      let campaignNameMap = new Map<string, string>();

      if (campaignIds.length > 0) {
        const { data: campaigns } = await supabase
          .from('heyreach_campaigns')
          .select('id, name')
          .in('id', campaignIds);

        if (campaigns) {
          campaignNameMap = new Map(campaigns.map((c) => [c.id, c.name]));
        }
      }

      const campaigns: HeyReachContactActivity[] = (campaignLeads || []).map((l) => ({
        ...l,
        campaign_name: campaignNameMap.get(l.campaign_id) || null,
      }));

      // 3. Get LinkedIn URLs for this buyer to look up webhook events
      const linkedInUrls = [...new Set(campaigns.map((c) => c.linkedin_url).filter(Boolean))];
      const emails = [...new Set(campaigns.map((c) => c.email).filter(Boolean))] as string[];

      let events: HeyReachContactEvent[] = [];

      if (linkedInUrls.length > 0 || emails.length > 0) {
        // Try to find events by LinkedIn URL first, then by email
        let webhookEvents: Array<Record<string, unknown>> = [];

        if (linkedInUrls.length > 0) {
          const { data: urlEvents, error: urlErr } = await supabase
            .from('heyreach_webhook_events')
            .select('id, event_type, lead_linkedin_url, lead_email, heyreach_campaign_id, payload, created_at')
            .in('lead_linkedin_url', linkedInUrls)
            .order('created_at', { ascending: false })
            .limit(100);

          if (urlErr) throw urlErr;
          webhookEvents = (urlEvents || []) as Array<Record<string, unknown>>;
        }

        // Also look up by email for events that may not have LinkedIn URL
        if (emails.length > 0) {
          const existingIds = new Set(webhookEvents.map((e) => e.id));
          const { data: emailEvents, error: emailErr } = await supabase
            .from('heyreach_webhook_events')
            .select('id, event_type, lead_linkedin_url, lead_email, heyreach_campaign_id, payload, created_at')
            .in('lead_email', emails)
            .order('created_at', { ascending: false })
            .limit(100);

          if (emailErr) throw emailErr;
          for (const e of emailEvents || []) {
            if (!existingIds.has(e.id)) {
              webhookEvents.push(e as Record<string, unknown>);
            }
          }
        }

        // Build campaign ID -> name map
        const hrCampaignIds = [
          ...new Set(webhookEvents.map((e) => e.heyreach_campaign_id).filter(Boolean)),
        ] as number[];

        let hrCampaignNameMap = new Map<number, string>();
        if (hrCampaignIds.length > 0) {
          const { data: hrCampaigns } = await supabase
            .from('heyreach_campaigns')
            .select('id, name, heyreach_campaign_id')
            .in('heyreach_campaign_id', hrCampaignIds);

          if (hrCampaigns) {
            hrCampaignNameMap = new Map(hrCampaigns.map((c) => [c.heyreach_campaign_id, c.name]));
          }
        }

        events = webhookEvents.map((e) => ({
          id: e.id as string,
          event_type: e.event_type as string,
          lead_linkedin_url: e.lead_linkedin_url as string | null,
          lead_email: e.lead_email as string | null,
          heyreach_campaign_id: e.heyreach_campaign_id as number | null,
          payload: e.payload,
          created_at: e.created_at as string | null,
          campaign_name: e.heyreach_campaign_id
            ? hrCampaignNameMap.get(e.heyreach_campaign_id as number) || null
            : null,
        }));
      }

      return { campaigns, events };
    },
    enabled: !!buyerId,
    staleTime: 60_000,
  });
}

/**
 * Fetch HeyReach LinkedIn outreach history for a contact by email address.
 * Useful when you have a contact email but not the buyer ID.
 */
export function useContactHeyReachHistoryByEmail(email: string | null) {
  return useQuery<ContactHeyReachHistory>({
    queryKey: ['heyreach', 'contact-history-email', email],
    queryFn: async () => {
      if (!email) return { campaigns: [], events: [] };

      // 1. Get campaign leads by email
      const { data: campaignLeads, error: leadsErr } = await supabase
        .from('heyreach_campaign_leads')
        .select(
          `
          id,
          campaign_id,
          heyreach_lead_id,
          linkedin_url,
          email,
          lead_status,
          lead_category,
          last_activity_at,
          created_at
        `,
        )
        .eq('email', email)
        .order('created_at', { ascending: false });

      if (leadsErr) throw leadsErr;

      // 2. Get campaign names
      const campaignIds = [...new Set((campaignLeads || []).map((l) => l.campaign_id))];
      let campaignNameMap = new Map<string, string>();

      if (campaignIds.length > 0) {
        const { data: campaigns } = await supabase
          .from('heyreach_campaigns')
          .select('id, name')
          .in('id', campaignIds);

        if (campaigns) {
          campaignNameMap = new Map(campaigns.map((c) => [c.id, c.name]));
        }
      }

      const campaigns: HeyReachContactActivity[] = (campaignLeads || []).map((l) => ({
        ...l,
        campaign_name: campaignNameMap.get(l.campaign_id) || null,
      }));

      // 3. Webhook events by email
      const { data: webhookEvents, error: eventsErr } = await supabase
        .from('heyreach_webhook_events')
        .select('id, event_type, lead_linkedin_url, lead_email, heyreach_campaign_id, payload, created_at')
        .eq('lead_email', email)
        .order('created_at', { ascending: false })
        .limit(100);

      if (eventsErr) throw eventsErr;

      // Also look up by LinkedIn URLs from campaign leads
      const linkedInUrls = [...new Set(campaigns.map((c) => c.linkedin_url).filter(Boolean))];
      const existingIds = new Set((webhookEvents || []).map((e) => e.id));

      if (linkedInUrls.length > 0) {
        const { data: urlEvents } = await supabase
          .from('heyreach_webhook_events')
          .select('id, event_type, lead_linkedin_url, lead_email, heyreach_campaign_id, payload, created_at')
          .in('lead_linkedin_url', linkedInUrls)
          .order('created_at', { ascending: false })
          .limit(100);

        for (const e of urlEvents || []) {
          if (!existingIds.has(e.id)) {
            (webhookEvents || []).push(e);
          }
        }
      }

      const hrCampaignIds = [
        ...new Set((webhookEvents || []).map((e) => e.heyreach_campaign_id).filter(Boolean)),
      ] as number[];

      let hrCampaignNameMap = new Map<number, string>();
      if (hrCampaignIds.length > 0) {
        const { data: hrCampaigns } = await supabase
          .from('heyreach_campaigns')
          .select('id, name, heyreach_campaign_id')
          .in('heyreach_campaign_id', hrCampaignIds);

        if (hrCampaigns) {
          hrCampaignNameMap = new Map(hrCampaigns.map((c) => [c.heyreach_campaign_id, c.name]));
        }
      }

      const events: HeyReachContactEvent[] = (webhookEvents || []).map((e) => ({
        ...e,
        campaign_name: e.heyreach_campaign_id
          ? hrCampaignNameMap.get(e.heyreach_campaign_id) || null
          : null,
      }));

      return { campaigns, events };
    },
    enabled: !!email,
    staleTime: 60_000,
  });
}
