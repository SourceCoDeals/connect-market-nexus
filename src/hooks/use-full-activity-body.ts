// ============================================================================
// useFullActivityBody
// ============================================================================
// Audit finding UC #13: ActivityDetailDrawer rendered metadata.body_preview
// which is capped at 300 chars in the merged-feed hook. For long emails /
// call transcripts that's not enough to actually read.
//
// This hook fetches the full body from the canonical source table on demand
// when the drawer opens, keyed off the entry's source + id-prefix.
//
// Source/id mapping (matches useUnifiedDealActivityEntries entry construction):
//   - source='call',     id = `call-${contact_activities.id}`        → call_transcript
//   - source='email',    id = `email-${email_messages.id}`           → body_text
//   - source='email',    id = `sl-${smartlead_reply_inbox.id}`       → reply_body
//   - source='transcript', id = `transcript-${deal_transcripts.id}`  → transcript_text
//   - source='linkedin'  → no body in the current data source (heyreach_webhook_events
//     doesn't carry one); returns null until that pipeline gets canonical bodies
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { supabase, untypedFrom } from '@/integrations/supabase/client';
import type { UnifiedTimelineEntry } from './use-unified-deal-activity-entries';

interface UseFullActivityBodyResult {
  fullBody: string | null;
  isLoading: boolean;
  isFetched: boolean;
}

/** Strip the source-prefix from an entry id, returning the raw uuid. */
function rawIdOf(entryId: string): string {
  return entryId.replace(/^[a-z]+-/i, '');
}

export function useFullActivityBody(
  entry: UnifiedTimelineEntry | null,
  enabled: boolean = true,
): UseFullActivityBodyResult {
  const { data, isLoading, isFetched } = useQuery({
    queryKey: ['activity-full-body', entry?.id],
    enabled: !!entry && enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      if (!entry) return null;
      const raw = rawIdOf(entry.id);

      if (entry.source === 'call') {
        const { data: row } = await supabase
          .from('contact_activities')
          .select('call_transcript')
          .eq('id', raw)
          .maybeSingle();
        return (row as { call_transcript: string | null } | null)?.call_transcript ?? null;
      }

      if (entry.source === 'email') {
        if (entry.id.startsWith('sl-')) {
          const { data: row } = await untypedFrom('smartlead_reply_inbox')
            .select('reply_body')
            .eq('id', raw)
            .maybeSingle();
          return (row as { reply_body: string | null } | null)?.reply_body ?? null;
        }
        // outlook canonical (email-prefix)
        const { data: row } = await untypedFrom('email_messages')
          .select('body_text')
          .eq('id', raw)
          .maybeSingle();
        return (row as { body_text: string | null } | null)?.body_text ?? null;
      }

      if (entry.source === 'transcript') {
        const { data: row } = await untypedFrom('deal_transcripts')
          .select('transcript_text')
          .eq('id', raw)
          .maybeSingle();
        return (row as { transcript_text: string | null } | null)?.transcript_text ?? null;
      }

      // linkedin / deal_activity — no full-body source surfaced today
      return null;
    },
  });

  return {
    fullBody: data ?? null,
    isLoading,
    isFetched,
  };
}
