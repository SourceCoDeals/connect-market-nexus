import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OutboundEmailRecord {
  id: string;
  status: string;
  sender_email: string;
  sender_name: string;
  accepted_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  failed_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface LeadAgreementTracking {
  outboundEmail: OutboundEmailRecord | null;
  allSends: OutboundEmailRecord[];
  events: Array<{
    id: string;
    event_type: string;
    event_data: Record<string, unknown>;
    created_at: string;
  }>;
  resolvedStatus: string | null;
  highestLifecycle: string | null;
  emailSentAt: string | null;
  emailStatus: string | null;
  senderEmail: string | null;
}

const LIFECYCLE_ORDER = ['sent', 'queued', 'accepted', 'delivered', 'opened'];

function resolveStatusFromEmail(email: OutboundEmailRecord): string {
  if (email.opened_at) return 'opened';
  if (email.delivered_at) return 'delivered';
  if (email.accepted_at) return 'accepted';
  if (email.status && email.status !== 'queued') return email.status;
  return 'sent';
}

export function useLeadAgreementTracking(connectionRequestId: string | undefined) {
  return useQuery<LeadAgreementTracking>({
    queryKey: ['lead-agreement-tracking', connectionRequestId],
    enabled: !!connectionRequestId,
    staleTime: 5_000,
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!connectionRequestId) throw new Error('No CR id');

      // Get CR tracking fields
      const { data: cr, error: crErr } = await supabase
        .from('connection_requests')
        .select(
          'lead_agreement_email_sent_at, lead_agreement_email_status, lead_agreement_sender_email, lead_agreement_outbound_id',
        )
        .eq('id', connectionRequestId)
        .single();

      if (crErr) throw crErr;

      // Use SECURITY DEFINER RPC to bypass RLS on outbound_emails
      const { data: rpcRows, error: rpcErr } = await supabase.rpc(
        'get_lead_agreement_tracking' as any,
        { cr_id: connectionRequestId },
      );

      if (rpcErr) {
        console.error('[LeadAgreementTracking] RPC error:', rpcErr);
      }

      const allSends: OutboundEmailRecord[] = (rpcRows as OutboundEmailRecord[] | null) || [];

      console.log('[LeadAgreementTracking]', connectionRequestId, {
        allSendsCount: allSends.length,
        statuses: allSends.map((s) => resolveStatusFromEmail(s)),
      });

      const outboundEmail = allSends.length > 0 ? allSends[0] : null;

      // Fetch events for the latest send
      let events: LeadAgreementTracking['events'] = [];
      if (outboundEmail) {
        const { data: evts } = await supabase
          .from('email_events')
          .select('id, event_type, event_data, created_at')
          .eq('outbound_email_id', outboundEmail.id)
          .order('created_at', { ascending: true });
        events = (evts || []) as LeadAgreementTracking['events'];
      }

      const resolvedStatus = outboundEmail ? resolveStatusFromEmail(outboundEmail) : null;

      // Highest lifecycle across ALL sends
      let highestIdx = -1;
      for (const send of allSends) {
        const status = resolveStatusFromEmail(send);
        const idx = LIFECYCLE_ORDER.indexOf(status);
        if (idx > highestIdx) highestIdx = idx;
      }
      const highestLifecycle = highestIdx >= 0 ? LIFECYCLE_ORDER[highestIdx] : null;

      return {
        outboundEmail,
        allSends,
        events,
        resolvedStatus,
        highestLifecycle,
        emailSentAt: (cr as Record<string, unknown>)?.lead_agreement_email_sent_at as string | null,
        emailStatus: (cr as Record<string, unknown>)?.lead_agreement_email_status as string | null,
        senderEmail: (cr as Record<string, unknown>)?.lead_agreement_sender_email as string | null,
      };
    },
  });
}
