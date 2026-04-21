import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MatchToolOutboundEmailRecord {
  id: string;
  status: string;
  sender_email: string | null;
  sender_name: string | null;
  accepted_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  failed_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface MatchToolLeadOutreachTracking {
  outboundEmail: MatchToolOutboundEmailRecord | null;
  allSends: MatchToolOutboundEmailRecord[];
  resolvedStatus: string | null;
  highestLifecycle: string | null;
  emailSentAt: string | null;
  emailStatus: string | null;
  senderEmail: string | null;
  sendCount: number;
}

const LIFECYCLE_ORDER = ['sent', 'queued', 'accepted', 'delivered', 'opened'];

function resolveStatusFromEmail(email: MatchToolOutboundEmailRecord): string {
  if (email.opened_at) return 'opened';
  if (email.delivered_at) return 'delivered';
  if (email.accepted_at) return 'accepted';
  if (email.status && email.status !== 'queued') return email.status;
  return 'sent';
}

export function useMatchToolLeadOutreachTracking(matchToolLeadId: string | undefined) {
  return useQuery<MatchToolLeadOutreachTracking>({
    queryKey: ['match-tool-lead-outreach-tracking', matchToolLeadId],
    enabled: !!matchToolLeadId,
    staleTime: 5_000,
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!matchToolLeadId) throw new Error('No lead id');

      const { data: lead, error: leadErr } = await supabase
        .from('match_tool_leads')
        .select(
          'outreach_email_sent_at, outreach_email_status, outreach_sender_email, outreach_send_count',
        )
        .eq('id', matchToolLeadId)
        .single();

      if (leadErr) throw leadErr;

      const { data: rpcRows, error: rpcErr } = await supabase.rpc(
        'get_match_tool_lead_outreach_tracking' as never,
        { lead_id: matchToolLeadId } as never,
      );

      if (rpcErr) {
        console.error('[MatchToolLeadOutreachTracking] RPC error:', rpcErr);
      }

      const allSends: MatchToolOutboundEmailRecord[] =
        (rpcRows as MatchToolOutboundEmailRecord[] | null) || [];

      const outboundEmail = allSends.length > 0 ? allSends[0] : null;
      const resolvedStatus = outboundEmail ? resolveStatusFromEmail(outboundEmail) : null;

      let highestIdx = -1;
      for (const send of allSends) {
        const status = resolveStatusFromEmail(send);
        const idx = LIFECYCLE_ORDER.indexOf(status);
        if (idx > highestIdx) highestIdx = idx;
      }
      const highestLifecycle = highestIdx >= 0 ? LIFECYCLE_ORDER[highestIdx] : null;

      const leadRow = (lead || {}) as Record<string, unknown>;

      return {
        outboundEmail,
        allSends,
        resolvedStatus,
        highestLifecycle,
        emailSentAt: (leadRow.outreach_email_sent_at as string | null) ?? null,
        emailStatus: (leadRow.outreach_email_status as string | null) ?? null,
        senderEmail: (leadRow.outreach_sender_email as string | null) ?? null,
        sendCount: (leadRow.outreach_send_count as number | null) ?? 0,
      };
    },
  });
}
