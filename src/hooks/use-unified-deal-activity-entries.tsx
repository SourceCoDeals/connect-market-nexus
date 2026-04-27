// ============================================================================
// useUnifiedDealActivityEntries
// ============================================================================
// Single source of truth for the merged deal-activity timeline. Hosts the six
// queries that UnifiedDealTimeline previously ran inline:
//
//   1. deal_activities      via useDealActivities(dealId)
//   2. contact_activities   listing_id = listingId
//   3. email_messages       (Outlook) — contacts on this listing
//   4. heyreach_webhook_events — buyer linkedin URLs for this listing
//   5. deal_transcripts     listing_id = listingId
//   6. smartlead_reply_inbox  linked_deal_id = dealId
//
// Returns the same UnifiedTimelineEntry[] shape UnifiedDealTimeline rendered.
// Both UnifiedDealTimeline and useDealActivityStats consume this hook so the
// six queries are deduped by react-query (queryKeys are identical to the keys
// previously used by UnifiedDealTimeline).
// ============================================================================

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Phone,
  Mail,
  Linkedin,
  CheckSquare,
  ArrowRight,
  Video,
  Sparkles,
  StickyNote,
  AlertTriangle,
  Bot,
  Clock,
  FileCheck,
  UserCog,
  Star,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDealActivities } from '@/hooks/admin/use-deal-activities';

// ── Types ──────────────────────────────────────────────────────────────────

export type FilterCategory =
  | 'all'
  | 'calls'
  | 'emails'
  | 'linkedin'
  | 'tasks'
  | 'meetings'
  | 'system';

export interface UnifiedTimelineEntry {
  id: string;
  timestamp: string;
  source: 'deal_activity' | 'call' | 'email' | 'linkedin' | 'transcript';
  category: FilterCategory;
  icon: ReactNode;
  iconColor: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  adminName?: string | null;
  /** Stable identifier for grouping by contact (Phase 5 toggle). */
  contactId?: string | null;
  contactEmail?: string | null;
}

// ── Activity-type config (shared with UnifiedDealTimeline) ─────────────────

interface TypeConfig {
  icon: ReactNode;
  color: string;
  category: FilterCategory;
}

const ACTIVITY_TYPE_CONFIG: Record<string, TypeConfig> = {
  call_completed: {
    icon: <Phone className="h-3.5 w-3.5" />,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    category: 'calls',
  },
  call_made: {
    icon: <Phone className="h-3.5 w-3.5" />,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    category: 'calls',
  },
  email_sent: {
    icon: <Mail className="h-3.5 w-3.5" />,
    color: 'bg-green-50 text-green-700 border-green-200',
    category: 'emails',
  },
  email_received: {
    icon: <Mail className="h-3.5 w-3.5" />,
    color: 'bg-green-50 text-green-700 border-green-200',
    category: 'emails',
  },
  buyer_response: {
    icon: <Mail className="h-3.5 w-3.5" />,
    color: 'bg-green-50 text-green-700 border-green-200',
    category: 'emails',
  },
  linkedin_message: {
    icon: <Linkedin className="h-3.5 w-3.5" />,
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    category: 'linkedin',
  },
  linkedin_connection: {
    icon: <Linkedin className="h-3.5 w-3.5" />,
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    category: 'linkedin',
  },
  task_created: {
    icon: <CheckSquare className="h-3.5 w-3.5" />,
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    category: 'tasks',
  },
  task_completed: {
    icon: <CheckSquare className="h-3.5 w-3.5" />,
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    category: 'tasks',
  },
  task_assigned: {
    icon: <UserCog className="h-3.5 w-3.5" />,
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    category: 'tasks',
  },
  task_overdue: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: 'bg-red-50 text-red-700 border-red-200',
    category: 'tasks',
  },
  task_snoozed: {
    icon: <Clock className="h-3.5 w-3.5" />,
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    category: 'tasks',
  },
  stage_change: {
    icon: <ArrowRight className="h-3.5 w-3.5" />,
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    category: 'system',
  },
  buyer_status_change: {
    icon: <ArrowRight className="h-3.5 w-3.5" />,
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    category: 'system',
  },
  transcript_linked: {
    icon: <Video className="h-3.5 w-3.5" />,
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    category: 'meetings',
  },
  meeting_linked: {
    icon: <Video className="h-3.5 w-3.5" />,
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    category: 'meetings',
  },
  meeting_summary_generated: {
    icon: <Video className="h-3.5 w-3.5" />,
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    category: 'meetings',
  },
  enrichment_completed: {
    icon: <Sparkles className="h-3.5 w-3.5" />,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    category: 'system',
  },
  note_added: {
    icon: <StickyNote className="h-3.5 w-3.5" />,
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    category: 'system',
  },
  follow_up: {
    icon: <StickyNote className="h-3.5 w-3.5" />,
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    category: 'system',
  },
  stale_deal_flagged: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: 'bg-red-50 text-red-700 border-red-200',
    category: 'system',
  },
  auto_followup_created: {
    icon: <Bot className="h-3.5 w-3.5" />,
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    category: 'system',
  },
  deal_created: {
    icon: <Star className="h-3.5 w-3.5" />,
    color: 'bg-muted text-muted-foreground border-border',
    category: 'system',
  },
  deal_updated: {
    icon: <Star className="h-3.5 w-3.5" />,
    color: 'bg-muted text-muted-foreground border-border',
    category: 'system',
  },
  deal_deleted: {
    icon: <Star className="h-3.5 w-3.5" />,
    color: 'bg-muted text-muted-foreground border-border',
    category: 'system',
  },
  deal_restored: {
    icon: <Star className="h-3.5 w-3.5" />,
    color: 'bg-muted text-muted-foreground border-border',
    category: 'system',
  },
  nda_status_changed: {
    icon: <FileCheck className="h-3.5 w-3.5" />,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    category: 'system',
  },
  nda_email_sent: {
    icon: <FileCheck className="h-3.5 w-3.5" />,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    category: 'emails',
  },
  fee_agreement_status_changed: {
    icon: <FileCheck className="h-3.5 w-3.5" />,
    color: 'bg-green-50 text-green-700 border-green-200',
    category: 'system',
  },
  fee_agreement_email_sent: {
    icon: <FileCheck className="h-3.5 w-3.5" />,
    color: 'bg-green-50 text-green-700 border-green-200',
    category: 'emails',
  },
  assignment_changed: {
    icon: <UserCog className="h-3.5 w-3.5" />,
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    category: 'system',
  },
};

const DEFAULT_CONFIG: TypeConfig = {
  icon: <Clock className="h-3.5 w-3.5" />,
  color: 'bg-muted text-muted-foreground border-border',
  category: 'system',
};

export function getActivityTypeConfig(type: string): TypeConfig {
  return ACTIVITY_TYPE_CONFIG[type] ?? DEFAULT_CONFIG;
}

export function getActivityLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Hook ───────────────────────────────────────────────────────────────────

interface UseUnifiedDealActivityEntriesResult {
  entries: UnifiedTimelineEntry[];
  isLoading: boolean;
  /** Per-source counts for telemetry / debugging. */
  rowCounts: {
    dealActivities: number;
    calls: number;
    outlookEmails: number;
    linkedin: number;
    transcripts: number;
    smartleadReplies: number;
  };
}

export function useUnifiedDealActivityEntries(
  dealId: string,
  listingId: string,
): UseUnifiedDealActivityEntriesResult {
  // 1. Deal activities (existing hook — same query key)
  const { data: dealActivities = [], isLoading: loadingDealActivities } = useDealActivities(dealId);

  // 2. PhoneBurner calls linked to the listing
  const { data: callActivities = [], isLoading: loadingCalls } = useQuery({
    queryKey: ['unified-timeline-calls', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!listingId,
    staleTime: 60_000,
  });

  // 3. Outlook email history (via contacts linked to this listing)
  const { data: emailHistory = [], isLoading: loadingEmails } = useQuery({
    queryKey: ['unified-timeline-outlook-emails', listingId],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('listing_id', listingId)
        .eq('archived', false);
      const contactIds = (contacts || []).map((c: { id: string }) => c.id);
      if (contactIds.length === 0) return [];

      const { data, error } = await (supabase as any)
        .from('email_messages')
        .select(
          'id, contact_id, direction, from_address, to_addresses, subject, body_text, sent_at, sourceco_user_id, has_attachments',
        )
        .in('contact_id', contactIds)
        .order('sent_at', { ascending: false })
        .limit(100);
      if (error) {
        console.error('Outlook timeline query failed:', error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!listingId,
    staleTime: 60_000,
  });

  // 4. LinkedIn outreach (via HeyReach for buyers on this listing)
  const { data: linkedinHistory = [], isLoading: loadingLinkedin } = useQuery({
    queryKey: ['unified-timeline-heyreach', listingId],
    queryFn: async () => {
      const { data: deals } = await (supabase as any)
        .from('deal_pipeline')
        .select('remarketing_buyer_id')
        .eq('listing_id', listingId)
        .not('remarketing_buyer_id', 'is', null)
        .is('deleted_at', null);
      const buyerIds = [
        ...new Set((deals || []).map((d: any) => d.remarketing_buyer_id).filter(Boolean)),
      ] as string[];
      if (buyerIds.length === 0) return [];

      const { data: leads } = await (supabase as any)
        .from('heyreach_campaign_leads')
        .select('linkedin_url')
        .in('remarketing_buyer_id', buyerIds);
      const urls = [
        ...new Set((leads || []).map((l: any) => l.linkedin_url).filter(Boolean)),
      ] as string[];
      if (urls.length === 0) return [];

      const { data, error } = await (supabase as any)
        .from('heyreach_webhook_events')
        .select('id, event_type, lead_linkedin_url, lead_email, heyreach_campaign_id, created_at')
        .in('lead_linkedin_url', urls)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        console.error('HeyReach timeline query failed:', error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!listingId,
    staleTime: 60_000,
  });

  // 5. Deal transcripts
  const { data: transcripts = [], isLoading: loadingTranscripts } = useQuery({
    queryKey: ['unified-timeline-transcripts', listingId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('deal_transcripts')
        .select('id, title, created_at, transcript_type, summary')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!listingId,
    staleTime: 60_000,
  });

  // 6. Smartlead reply inbox linked to the deal
  const { data: smartleadReplies = [], isLoading: loadingSmartlead } = useQuery({
    queryKey: ['unified-timeline-smartlead', dealId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('smartlead_reply_inbox')
        .select(
          'id, from_email, to_email, subject, reply_body, sent_message_body, time_replied, event_timestamp, ai_category, ai_sentiment, campaign_name, lead_first_name, lead_last_name, lead_company_name, created_at',
        )
        .eq('linked_deal_id', dealId)
        .order('time_replied', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!dealId,
    staleTime: 60_000,
  });

  const isLoading =
    loadingDealActivities ||
    loadingCalls ||
    loadingEmails ||
    loadingLinkedin ||
    loadingTranscripts ||
    loadingSmartlead;

  const entries = useMemo(() => {
    const out: UnifiedTimelineEntry[] = [];

    // Deal activities (deal_activities table)
    for (const a of dealActivities) {
      const config = getActivityTypeConfig(a.activity_type);
      const adminName = a.admin?.first_name
        ? `${a.admin.first_name}${a.admin.last_name ? ` ${a.admin.last_name}` : ''}`
        : (a.admin?.email ?? null);
      out.push({
        id: `da-${a.id}`,
        timestamp: a.created_at,
        source: 'deal_activity',
        category: config.category,
        icon: config.icon,
        iconColor: config.color,
        title: a.title,
        description: a.description,
        metadata: {
          ...(a.metadata as Record<string, unknown> | undefined),
          activity_type: a.activity_type,
        },
        adminName,
      });
    }

    // PhoneBurner calls
    for (const c of callActivities as any[]) {
      const activityType = c.activity_type ?? 'call_completed';
      const config = getActivityTypeConfig(activityType);
      out.push({
        id: `call-${c.id}`,
        timestamp: c.call_started_at || c.created_at,
        source: 'call',
        category: 'calls',
        icon: config.icon ?? <Phone className="h-3.5 w-3.5" />,
        iconColor: 'bg-blue-50 text-blue-700 border-blue-200',
        title: c.disposition_label || getActivityLabel(activityType),
        description: c.disposition_notes || null,
        metadata: {
          duration: c.call_duration_seconds,
          outcome: c.call_outcome,
          caller: c.user_name,
          direction: c.call_direction,
          callback_scheduled_date: c.callback_scheduled_date,
          recording_url: c.recording_url,
          recording_url_public: c.recording_url_public,
          transcript_preview: c.call_transcript ? c.call_transcript.slice(0, 200) : null,
        },
        adminName: c.user_name || null,
        contactId: c.contact_id ?? null,
        contactEmail: c.contact_email ?? null,
      });
    }

    // Outlook emails
    for (const e of emailHistory as any[]) {
      out.push({
        id: `email-${e.id}`,
        timestamp: e.sent_at,
        source: 'email',
        category: 'emails',
        icon: <Mail className="h-3.5 w-3.5" />,
        iconColor:
          e.direction === 'inbound'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-green-50 text-green-700 border-green-200',
        title: e.subject || '(No subject)',
        description:
          e.direction === 'outbound'
            ? `Sent to ${(e.to_addresses || []).join(', ')}`
            : `Received from ${e.from_address}`,
        metadata: {
          direction: e.direction,
          from: e.from_address,
          to: e.to_addresses,
          has_attachments: e.has_attachments,
          body_preview: e.body_text?.substring(0, 300),
          sourceco_user_id: e.sourceco_user_id,
        },
        adminName: null,
        contactId: e.contact_id ?? null,
        contactEmail: e.direction === 'inbound' ? e.from_address : (e.to_addresses?.[0] ?? null),
      });
    }

    // HeyReach LinkedIn
    const LI_LABELS: Record<string, string> = {
      CONNECTION_REQUEST_SENT: 'Connection Request Sent',
      CONNECTION_REQUEST_ACCEPTED: 'Connection Accepted',
      MESSAGE_SENT: 'LinkedIn Message Sent',
      MESSAGE_RECEIVED: 'Message Received',
      INMAIL_SENT: 'InMail Sent',
      LEAD_REPLIED: 'Lead Replied',
      LEAD_INTERESTED: 'Marked Interested',
      LEAD_NOT_INTERESTED: 'Not Interested',
      PROFILE_VIEWED: 'Profile Viewed',
      FOLLOW_SENT: 'Followed',
      LIKE_SENT: 'Liked Post',
    };
    const LI_INBOUND = new Set([
      'MESSAGE_RECEIVED',
      'LEAD_REPLIED',
      'LEAD_INTERESTED',
      'LEAD_NOT_INTERESTED',
    ]);
    for (const l of linkedinHistory as any[]) {
      out.push({
        id: `li-${l.id}`,
        timestamp: l.created_at,
        source: 'linkedin',
        category: 'linkedin',
        icon: <Linkedin className="h-3.5 w-3.5" />,
        iconColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        title: LI_LABELS[l.event_type] || l.event_type?.replace(/_/g, ' ') || 'LinkedIn Activity',
        description: l.lead_email || l.lead_linkedin_url || null,
        metadata: {
          linkedin_url: l.lead_linkedin_url,
          event_type: l.event_type,
          direction: LI_INBOUND.has(l.event_type) ? 'inbound' : 'outbound',
        },
        contactEmail: l.lead_email ?? null,
      });
    }

    // Deal transcripts (meetings)
    for (const t of transcripts as any[]) {
      out.push({
        id: `transcript-${t.id}`,
        timestamp: t.created_at,
        source: 'transcript',
        category: 'meetings',
        icon: <Video className="h-3.5 w-3.5" />,
        iconColor: 'bg-teal-50 text-teal-700 border-teal-200',
        title: t.title || 'Transcript linked',
        description: t.summary || null,
        metadata: { type: t.transcript_type },
      });
    }

    // Smartlead reply inbox (emails)
    for (const s of smartleadReplies as any[]) {
      const replyText = s.reply_body ? stripHtml(s.reply_body) : '';
      const leadName = [s.lead_first_name, s.lead_last_name].filter(Boolean).join(' ');
      const category = s.ai_category || 'neutral';
      const catLabel = category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      out.push({
        id: `sl-${s.id}`,
        timestamp: s.time_replied || s.event_timestamp || s.created_at,
        source: 'email',
        category: 'emails',
        icon: <Mail className="h-3.5 w-3.5" />,
        iconColor: 'bg-green-50 text-green-700 border-green-200',
        title: `${leadName || s.from_email || 'Lead'} — ${catLabel}`,
        description: replyText ? replyText.slice(0, 200) : s.subject || 'Smartlead reply',
        metadata: {
          ai_category: category,
          ai_sentiment: s.ai_sentiment,
          campaign: s.campaign_name,
          from: s.from_email,
          direction: 'inbound',
          body_preview: replyText.slice(0, 300),
        },
        contactEmail: s.from_email ?? null,
      });
    }

    out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return out;
  }, [
    dealActivities,
    callActivities,
    emailHistory,
    linkedinHistory,
    transcripts,
    smartleadReplies,
  ]);

  const rowCounts = {
    dealActivities: dealActivities.length,
    calls: callActivities.length,
    outlookEmails: emailHistory.length,
    linkedin: linkedinHistory.length,
    transcripts: transcripts.length,
    smartleadReplies: smartleadReplies.length,
  };

  // DEV-only observability: structured log on each load so the timeline
  // composition is trivially diagnoseable when an entry is missing from the
  // feed. Logs once per change in any source — same dependency list as the
  // entries memo.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (isLoading) return;
    // eslint-disable-next-line no-console
    console.debug('[useUnifiedDealActivityEntries]', {
      listingId,
      dealId,
      ...rowCounts,
      mergedRowCount: entries.length,
    });
    // We don't depend on rowCounts directly because it's a fresh object each
    // render; the underlying lengths are already in the dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoading,
    listingId,
    dealId,
    dealActivities.length,
    callActivities.length,
    emailHistory.length,
    linkedinHistory.length,
    transcripts.length,
    smartleadReplies.length,
    entries.length,
  ]);

  return {
    entries,
    isLoading,
    rowCounts,
  };
}
