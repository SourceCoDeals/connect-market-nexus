/**
 * useOutreachMetrics.ts
 *
 * Data hook for the Outreach & Campaigns tab. Aggregates SmartLead email events,
 * HeyReach LinkedIn events, and PhoneBurner calls in the selected timeframe.
 *
 * Supabase client is typed loosely (as any) because some of these tables aren't
 * in the generated Database type yet — we keep the shape narrow via the local
 * Row types below.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getFromDate, type Timeframe } from '../useDashboardData';

// ─── Row types ─────────────────────────────────────────────────────────────

interface SmartleadRow {
  event_type: string;
  sent_at: string;
  smartlead_campaign_id: number | null;
}

interface HeyreachRow {
  event_type: string;
  sent_at: string;
  heyreach_campaign_id: number | null;
}

interface SmartleadCampaign {
  smartlead_campaign_id: number;
  name: string | null;
  lead_count: number | null;
  status: string | null;
}

interface HeyreachCampaign {
  heyreach_campaign_id: number;
  name: string | null;
  lead_count: number | null;
  status: string | null;
}

interface ReplyInboxRow {
  ai_category: string | null;
  time_replied: string | null;
}

// ─── Output types ──────────────────────────────────────────────────────────

export interface OutreachKPIs {
  emailsSent: number;
  emailsOpened: number;
  emailsReplied: number;
  emailOpenRate: number; // 0-100
  emailReplyRate: number; // 0-100
  callsMade: number;
  callsConnected: number;
  callConnectRate: number; // 0-100
  linkedinSent: number;
  linkedinReplied: number;
  linkedinReplyRate: number; // 0-100
}

export interface CampaignRow {
  campaignId: number;
  name: string;
  leadCount: number;
  sent: number;
  opened: number;
  replied: number;
  replyRate: number; // 0-100
}

export interface WeeklyOutreachPoint {
  week: string; // ISO date for the week start
  emails: number;
  calls: number;
  linkedin: number;
}

export interface ReplyCategory {
  category: string;
  count: number;
}

// Email event_type values (spec says uppercase; DB check constraint is lowercase)
const EMAIL_SENT = 'sent';
const EMAIL_OPENED = 'opened';
const EMAIL_REPLIED = 'replied';

// HeyReach events that count as "outbound" and "reply"
const LINKEDIN_SENT_EVENTS = ['connection_request_sent', 'message_sent', 'inmail_sent'];
const LINKEDIN_REPLY_EVENTS = [
  'message_received',
  'inmail_received',
  'lead_replied',
  'lead_interested',
];

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useOutreachMetrics(timeframe: Timeframe) {
  const fromDate = getFromDate(timeframe);

  // Single query covers all smartlead_messages in the period — sent, opened,
  // and replied events all come through one round-trip. In-memory filtering
  // splits them for the KPI and per-campaign aggregations below.
  const {
    data: smartleadRows,
    isLoading: smartleadLoading,
    error: smartleadError,
    refetch: refetchSmartlead,
  } = useQuery({
    queryKey: ['outreach', 'smartlead', fromDate],
    queryFn: async (): Promise<SmartleadRow[]> => {
      let q = (supabase as any)
        .from('smartlead_messages')
        .select('event_type, sent_at, smartlead_campaign_id');
      if (fromDate) q = q.gte('sent_at', fromDate);
      const { data, error } = await q.limit(50000);
      if (error) throw error;
      return (data || []) as SmartleadRow[];
    },
    staleTime: 60_000,
  });

  const {
    data: heyreachRows,
    isLoading: heyreachLoading,
    error: heyreachError,
    refetch: refetchHeyreach,
  } = useQuery({
    queryKey: ['outreach', 'heyreach', fromDate],
    queryFn: async (): Promise<HeyreachRow[]> => {
      let q = (supabase as any)
        .from('heyreach_messages')
        .select('event_type, sent_at, heyreach_campaign_id');
      if (fromDate) q = q.gte('sent_at', fromDate);
      const { data, error } = await q.limit(50000);
      if (error) throw error;
      return (data || []) as HeyreachRow[];
    },
    staleTime: 60_000,
  });

  const {
    data: callRows,
    isLoading: callsLoading,
    error: callsError,
    refetch: refetchCalls,
  } = useQuery({
    queryKey: ['outreach', 'calls', fromDate],
    queryFn: async () => {
      let q = (supabase as any)
        .from('contact_activities')
        .select('id, call_connected, call_started_at, created_at')
        .not('call_started_at', 'is', null);
      if (fromDate) q = q.gte('created_at', fromDate);
      const { data, error } = await q.limit(50000);
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        call_connected: boolean | null;
        call_started_at: string | null;
        created_at: string;
      }>;
    },
    staleTime: 60_000,
  });

  const { data: slCampaigns } = useQuery({
    queryKey: ['outreach', 'smartlead-campaigns'],
    queryFn: async (): Promise<SmartleadCampaign[]> => {
      const { data, error } = await (supabase as any)
        .from('smartlead_campaigns')
        .select('smartlead_campaign_id, name, lead_count, status');
      if (error) throw error;
      return (data || []) as SmartleadCampaign[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: hrCampaigns } = useQuery({
    queryKey: ['outreach', 'heyreach-campaigns'],
    queryFn: async (): Promise<HeyreachCampaign[]> => {
      const { data, error } = await (supabase as any)
        .from('heyreach_campaigns')
        .select('heyreach_campaign_id, name, lead_count, status');
      if (error) throw error;
      return (data || []) as HeyreachCampaign[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: replyInboxRows } = useQuery({
    queryKey: ['outreach', 'reply-inbox', fromDate],
    queryFn: async (): Promise<ReplyInboxRow[]> => {
      let q = (supabase as any).from('smartlead_reply_inbox').select('ai_category, time_replied');
      if (fromDate) q = q.gte('time_replied', fromDate);
      const { data, error } = await q.limit(10000);
      if (error) throw error;
      return (data || []) as ReplyInboxRow[];
    },
    staleTime: 60_000,
  });

  // ─── Aggregate KPIs ──────────────────────────────────────────────────────
  const emailsSent = (smartleadRows || []).filter((r) => r.event_type === EMAIL_SENT).length;
  const emailsOpened = (smartleadRows || []).filter((r) => r.event_type === EMAIL_OPENED).length;
  const emailsReplied = (smartleadRows || []).filter((r) => r.event_type === EMAIL_REPLIED).length;

  const linkedinSent = (heyreachRows || []).filter((r) =>
    LINKEDIN_SENT_EVENTS.includes(r.event_type),
  ).length;
  const linkedinReplied = (heyreachRows || []).filter((r) =>
    LINKEDIN_REPLY_EVENTS.includes(r.event_type),
  ).length;

  const callsMade = (callRows || []).length;
  const callsConnected = (callRows || []).filter((r) => r.call_connected === true).length;

  // Clamp rates to [0, 100] — data quality issues (e.g. more opens than sends
  // because of webhook replays or backfilled imports) can push raw ratios
  // above 100% which looks broken on a percentage card.
  const pct = (n: number, d: number) =>
    d > 0 ? Math.min(100, Math.round((n / d) * 1000) / 10) : 0;

  const kpis: OutreachKPIs = {
    emailsSent,
    emailsOpened,
    emailsReplied,
    emailOpenRate: pct(emailsOpened, emailsSent),
    emailReplyRate: pct(emailsReplied, emailsSent),
    callsMade,
    callsConnected,
    callConnectRate: pct(callsConnected, callsMade),
    linkedinSent,
    linkedinReplied,
    linkedinReplyRate: pct(linkedinReplied, linkedinSent),
  };

  // ─── Per-campaign tables ─────────────────────────────────────────────────
  const slCampaignRows: CampaignRow[] = (() => {
    if (!slCampaigns) return [];
    const byCampaign = new Map<number, { sent: number; opened: number; replied: number }>();
    for (const row of smartleadRows || []) {
      if (row.smartlead_campaign_id == null) continue;
      const entry = byCampaign.get(row.smartlead_campaign_id) || {
        sent: 0,
        opened: 0,
        replied: 0,
      };
      if (row.event_type === EMAIL_SENT) entry.sent++;
      else if (row.event_type === EMAIL_OPENED) entry.opened++;
      else if (row.event_type === EMAIL_REPLIED) entry.replied++;
      byCampaign.set(row.smartlead_campaign_id, entry);
    }
    return slCampaigns
      .map((c) => {
        const e = byCampaign.get(c.smartlead_campaign_id) || { sent: 0, opened: 0, replied: 0 };
        return {
          campaignId: c.smartlead_campaign_id,
          name: c.name || `Campaign ${c.smartlead_campaign_id}`,
          leadCount: c.lead_count || 0,
          sent: e.sent,
          opened: e.opened,
          replied: e.replied,
          replyRate: pct(e.replied, e.sent),
        };
      })
      .filter((r) => r.sent > 0)
      .sort((a, b) => b.replyRate - a.replyRate);
  })();

  const hrCampaignRows: CampaignRow[] = (() => {
    if (!hrCampaigns) return [];
    const byCampaign = new Map<number, { sent: number; replied: number }>();
    for (const row of heyreachRows || []) {
      if (row.heyreach_campaign_id == null) continue;
      const entry = byCampaign.get(row.heyreach_campaign_id) || { sent: 0, replied: 0 };
      if (LINKEDIN_SENT_EVENTS.includes(row.event_type)) entry.sent++;
      else if (LINKEDIN_REPLY_EVENTS.includes(row.event_type)) entry.replied++;
      byCampaign.set(row.heyreach_campaign_id, entry);
    }
    return hrCampaigns
      .map((c) => {
        const e = byCampaign.get(c.heyreach_campaign_id) || { sent: 0, replied: 0 };
        return {
          campaignId: c.heyreach_campaign_id,
          name: c.name || `Campaign ${c.heyreach_campaign_id}`,
          leadCount: c.lead_count || 0,
          sent: e.sent,
          opened: 0, // LinkedIn has no "opened" event
          replied: e.replied,
          replyRate: pct(e.replied, e.sent),
        };
      })
      .filter((r) => r.sent > 0)
      .sort((a, b) => b.replyRate - a.replyRate);
  })();

  // ─── Weekly volume trend (12 weeks) ──────────────────────────────────────
  // UTC bucketing — local-time bucketing drifts across timezones and caused
  // the same event to land in different weeks for LA vs London users.
  const weeklyTrend: WeeklyOutreachPoint[] = (() => {
    const buckets = new Map<string, { emails: number; calls: number; linkedin: number }>();
    const addToBucket = (dateStr: string, key: 'emails' | 'calls' | 'linkedin') => {
      const d = new Date(dateStr);
      const utcDay = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - utcDay);
      d.setUTCHours(0, 0, 0, 0);
      const weekKey = d.toISOString().slice(0, 10);
      const entry = buckets.get(weekKey) || { emails: 0, calls: 0, linkedin: 0 };
      entry[key]++;
      buckets.set(weekKey, entry);
    };
    for (const r of smartleadRows || []) {
      if (r.event_type === EMAIL_SENT) addToBucket(r.sent_at, 'emails');
    }
    for (const r of heyreachRows || []) {
      if (LINKEDIN_SENT_EVENTS.includes(r.event_type)) addToBucket(r.sent_at, 'linkedin');
    }
    for (const r of callRows || []) {
      if (r.call_started_at) addToBucket(r.call_started_at, 'calls');
    }
    return Array.from(buckets.entries())
      .map(([week, v]) => ({ week, ...v }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12);
  })();

  // ─── Reply inbox categories ──────────────────────────────────────────────
  const replyCategories: ReplyCategory[] = (() => {
    const byCat = new Map<string, number>();
    for (const row of replyInboxRows || []) {
      const cat = row.ai_category || 'Uncategorized';
      byCat.set(cat, (byCat.get(cat) || 0) + 1);
    }
    return Array.from(byCat.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  })();

  const error = (smartleadError || heyreachError || callsError) as Error | null | undefined;
  const retry = () => {
    refetchSmartlead();
    refetchHeyreach();
    refetchCalls();
  };

  return {
    loading: smartleadLoading || heyreachLoading || callsLoading,
    error: error || null,
    retry,
    kpis,
    smartleadCampaigns: slCampaignRows,
    heyreachCampaigns: hrCampaignRows,
    weeklyTrend,
    replyCategories,
  };
}
