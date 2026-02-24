import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SmartleadContactActivity {
  id: string;
  campaign_id: string;
  campaign_name: string | null;
  smartlead_lead_id: number | null;
  email: string;
  lead_status: string;
  lead_category: string | null;
  last_activity_at: string | null;
  created_at: string;
}

export interface SmartleadContactEvent {
  id: string;
  event_type: string;
  lead_email: string | null;
  smartlead_campaign_id: number | null;
  campaign_name: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ContactSmartleadHistory {
  campaigns: SmartleadContactActivity[];
  events: SmartleadContactEvent[];
}

/**
 * Fetch Smartlead email history for a buyer (by remarketing_buyer_id).
 * Joins smartlead_campaign_leads + smartlead_campaigns for campaign participation,
 * and smartlead_webhook_events for individual email events.
 */
export function useContactSmartleadHistory(buyerId: string | null) {
  return useQuery<ContactSmartleadHistory>({
    queryKey: ['smartlead', 'contact-history', buyerId],
    queryFn: async () => {
      if (!buyerId) return { campaigns: [], events: [] };

      // 1. Get all campaign leads for this buyer
      const { data: campaignLeads, error: leadsErr } = await supabase
        .from('smartlead_campaign_leads')
        .select(
          `
          id,
          campaign_id,
          smartlead_lead_id,
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
          .from('smartlead_campaigns')
          .select('id, name')
          .in('id', campaignIds);

        if (campaigns) {
          campaignNameMap = new Map(campaigns.map((c) => [c.id, c.name]));
        }
      }

      const campaigns: SmartleadContactActivity[] = (campaignLeads || []).map((l) => ({
        ...l,
        campaign_name: campaignNameMap.get(l.campaign_id) || null,
      }));

      // 3. Get emails for this buyer to look up webhook events
      const emails = [...new Set(campaigns.map((c) => c.email).filter(Boolean))];

      let events: SmartleadContactEvent[] = [];

      if (emails.length > 0) {
        const { data: webhookEvents, error: eventsErr } = await supabase
          .from('smartlead_webhook_events')
          .select('id, event_type, lead_email, smartlead_campaign_id, payload, created_at')
          .in('lead_email', emails)
          .order('created_at', { ascending: false })
          .limit(100);

        if (eventsErr) throw eventsErr;

        // Build a smartlead_campaign_id → name map
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

        events = (webhookEvents || []).map((e) => ({
          ...e,
          campaign_name: e.smartlead_campaign_id
            ? slCampaignNameMap.get(e.smartlead_campaign_id) || null
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
 * Fetch Smartlead email history for a contact by email address.
 * Useful when you have a contact email but not the buyer ID.
 */
export function useContactSmartleadHistoryByEmail(email: string | null) {
  return useQuery<ContactSmartleadHistory>({
    queryKey: ['smartlead', 'contact-history-email', email],
    queryFn: async () => {
      if (!email) return { campaigns: [], events: [] };

      // 1. Get campaign leads by email
      const { data: campaignLeads, error: leadsErr } = await supabase
        .from('smartlead_campaign_leads')
        .select(
          `
          id,
          campaign_id,
          smartlead_lead_id,
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
          .from('smartlead_campaigns')
          .select('id, name')
          .in('id', campaignIds);

        if (campaigns) {
          campaignNameMap = new Map(campaigns.map((c) => [c.id, c.name]));
        }
      }

      const campaigns: SmartleadContactActivity[] = (campaignLeads || []).map((l) => ({
        ...l,
        campaign_name: campaignNameMap.get(l.campaign_id) || null,
      }));

      // 3. Webhook events
      const { data: webhookEvents, error: eventsErr } = await supabase
        .from('smartlead_webhook_events')
        .select('id, event_type, lead_email, smartlead_campaign_id, payload, created_at')
        .eq('lead_email', email)
        .order('created_at', { ascending: false })
        .limit(100);

      if (eventsErr) throw eventsErr;

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

      const events: SmartleadContactEvent[] = (webhookEvents || []).map((e) => ({
        ...e,
        campaign_name: e.smartlead_campaign_id
          ? slCampaignNameMap.get(e.smartlead_campaign_id) || null
          : null,
      }));

      return { campaigns, events };
    },
    enabled: !!email,
    staleTime: 60_000,
  });
}
