import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { Phone, ChevronDown, Sparkles, Loader2, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CallActivityListProps {
  valuationLeadId: string;
  leadEmail?: string | null;
}

interface CallRow {
  id: string;
  call_started_at: string | null;
  call_duration_seconds: number | null;
  talk_time_seconds: number | null;
  disposition_label: string | null;
  disposition_code: string | null;
  call_outcome: string | null;
  call_connected: boolean | null;
  user_name: string | null;
  user_email: string | null;
  contact_email: string | null;
  recording_url: string | null;
  recording_url_public: string | null;
  call_transcript: string | null;
  phoneburner_call_id: string | null;
  ai_summary?: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function getInitials(label: string | null | undefined): string {
  if (!label) return '··';
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

function dispositionStyle(label: string | null, connected: boolean | null) {
  const l = (label || '').toLowerCase();
  if (l.includes('connect') || l.includes('interest') || l.includes('appoint') || connected) {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  }
  if (l.includes('voicemail') || l.includes('callback')) {
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  }
  if (l.includes('do not call') || l.includes('not interested') || l.includes('bad number')) {
    return 'bg-red-50 text-red-700 ring-1 ring-red-200';
  }
  return 'bg-muted text-muted-foreground ring-1 ring-border/60';
}

async function fetchCalls(valuationLeadId: string, leadEmail?: string | null): Promise<CallRow[]> {
  // Waterfall: direct attribution first, then email-match fallback. Dedup by phoneburner_call_id.
  const fields =
    'id, call_started_at, call_duration_seconds, talk_time_seconds, disposition_label, disposition_code, call_outcome, call_connected, user_name, user_email, contact_email, recording_url, recording_url_public, call_transcript, phoneburner_call_id, ai_summary';

  const { data: direct } = await supabase
    .from('contact_activities')
    .select(fields)
    .eq('valuation_lead_id', valuationLeadId)
    .eq('source_system', 'phoneburner')
    .order('call_started_at', { ascending: false })
    .limit(50);

  const directList = (direct || []) as unknown as CallRow[];
  const seen = new Set(directList.map((r) => r.phoneburner_call_id).filter(Boolean));

  let emailList: CallRow[] = [];
  if (leadEmail) {
    const { data: byEmail } = await supabase
      .from('contact_activities')
      .select(fields)
      .ilike('contact_email', leadEmail)
      .eq('source_system', 'phoneburner')
      .is('valuation_lead_id', null)
      .order('call_started_at', { ascending: false })
      .limit(50);
    emailList = ((byEmail || []) as unknown as CallRow[]).filter(
      (r) => !r.phoneburner_call_id || !seen.has(r.phoneburner_call_id),
    );
  }

  // Dedup again by phoneburner_call_id across the merged set
  const merged = [...directList, ...emailList];
  const dedup = new Map<string, CallRow>();
  const noKey: CallRow[] = [];
  for (const r of merged) {
    if (r.phoneburner_call_id) {
      if (!dedup.has(r.phoneburner_call_id)) dedup.set(r.phoneburner_call_id, r);
    } else {
      noKey.push(r);
    }
  }
  return [...dedup.values(), ...noKey].sort((a, b) => {
    const ta = a.call_started_at ? new Date(a.call_started_at).getTime() : 0;
    const tb = b.call_started_at ? new Date(b.call_started_at).getTime() : 0;
    return tb - ta;
  });
}

function CallRowItem({ call }: { call: CallRow }) {
  const [expanded, setExpanded] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(call.ai_summary ?? null);

  const recording = call.recording_url_public || call.recording_url || null;
  const repName = call.user_name || call.user_email || 'Unknown rep';
  const startedAt = call.call_started_at ? new Date(call.call_started_at) : null;

  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-call-summary', {
        body: {
          contact_activity_id: call.id,
          disposition: call.disposition_label || call.call_outcome,
        },
      });
      if (error) throw error;
      return (data?.summary as string | undefined) || null;
    },
    onSuccess: (summary) => {
      if (summary) setAiSummary(summary);
      else toast.info('No summary available — transcript may be missing.');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to generate summary');
    },
  });

  const hasTranscript = !!call.call_transcript && call.call_transcript.trim().length > 0;

  return (
    <div className="rounded-lg border border-border/60 bg-card hover:border-border transition-colors">
      <div className="flex items-start gap-3 px-3 py-3">
        {/* Rep avatar */}
        <div className="h-8 w-8 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground flex items-center justify-center shrink-0">
          {getInitials(repName)}
        </div>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-medium text-foreground truncate">{repName}</p>
            {call.disposition_label && (
              <span
                className={cn(
                  'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
                  dispositionStyle(call.disposition_label, call.call_connected),
                )}
              >
                {call.disposition_label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
            {startedAt && (
              <>
                <span title={format(startedAt, 'MMM d, yyyy h:mm a')}>
                  {formatDistanceToNow(startedAt, { addSuffix: true })}
                </span>
                <span className="text-border">·</span>
              </>
            )}
            <span className="tabular-nums">{formatDuration(call.call_duration_seconds)}</span>
            {call.talk_time_seconds ? (
              <>
                <span className="text-border">·</span>
                <span className="tabular-nums">talk {formatDuration(call.talk_time_seconds)}</span>
              </>
            ) : null}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {(recording || hasTranscript || aiSummary) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] gap-1"
              onClick={() => setExpanded((v) => !v)}
            >
              <ChevronDown
                className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')}
              />
              {expanded ? 'Hide' : 'Details'}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/40 px-3 py-3 space-y-3 bg-muted/20">
          {recording && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center justify-between gap-2">
                <span>Recording</span>
                <a
                  href={recording}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground/80 hover:text-foreground normal-case tracking-normal font-medium"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Open
                </a>
              </p>
              <audio controls preload="none" src={recording} className="w-full h-8 rounded-md" />
            </div>
          )}

          {aiSummary && (
            <div className="flex items-start gap-2">
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-semibold"
              >
                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                AI
              </Badge>
              <p className="text-[12px] text-foreground/80 italic leading-relaxed">{aiSummary}</p>
            </div>
          )}

          {!aiSummary && hasTranscript && (
            <div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1.5"
                disabled={summarizeMutation.isPending}
                onClick={() => summarizeMutation.mutate()}
              >
                {summarizeMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Generate summary
              </Button>
            </div>
          )}

          {hasTranscript && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                Transcript
              </p>
              <div className="max-h-64 overflow-y-auto rounded-md bg-background border border-border/40 px-3 py-2.5 text-[12px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
                {call.call_transcript}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CallActivityList({ valuationLeadId, leadEmail }: CallActivityListProps) {
  const { data: calls, isLoading } = useQuery({
    queryKey: ['valuation-lead-calls', valuationLeadId, leadEmail],
    queryFn: () => fetchCalls(valuationLeadId, leadEmail),
    refetchInterval: 5000, // light poll for fresh webhook landings
    staleTime: 4000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-3">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading calls…
      </div>
    );
  }

  if (!calls || calls.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-5 text-center">
        <Phone className="h-4 w-4 mx-auto text-muted-foreground/50 mb-1.5" />
        <p className="text-[12px] text-muted-foreground">No calls yet</p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
          Click the phone number above to start a session.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {calls.map((call) => (
        <CallRowItem key={call.id} call={call} />
      ))}
    </div>
  );
}
