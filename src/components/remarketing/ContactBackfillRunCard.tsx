/**
 * Hook + component for the latest contact-backfill run status.
 *
 * Provides a single source of truth for the admin to see whether the most
 * recent "Find Contacts (all)" click is actually progressing server-side,
 * and to resume a paused run with one click.
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  Phone,
  Linkedin,
  Hourglass,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContactBackfillRun {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'paused' | 'needs_resume';
  eligible_count: number;
  processed_count: number;
  pending_count: number;
  found_phone_count: number;
  found_linkedin_count: number;
  queued_clay_count: number | null;
  failed_count: number;
  rate_limited_retried: number;
  rate_limited_dropped: number;
  pause_reason: string | null;
  error: string | null;
  last_heartbeat_at: string;
  started_at: string;
  completed_at: string | null;
}

/**
 * Shared hook so the page header button and the run card both read the same
 * "latest run" state. React Query dedupes the underlying request, so multiple
 * subscribers cost one network round-trip.
 */
export function useLatestContactBackfillRun() {
  const query = useQuery({
    queryKey: ['contact-backfill-runs', 'latest'],
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 5000),
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const r = q.state.data as ContactBackfillRun | null | undefined;
      if (!r) return 5_000;
      return r.status === 'running' ? 3_000 : 30_000;
    },
    queryFn: async (): Promise<ContactBackfillRun | null> => {
      // Fetch a small window so a brief replication lag on the most recent
      // INSERT doesn't hide an obviously-running prior row.
      const { data, error } = await supabase
        .from('contact_backfill_runs')
        .select('*')
        .eq('run_kind', 'valuation_leads')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      const rows = (data ?? []) as unknown as ContactBackfillRun[];
      const running = rows.find((r) => r.status === 'running');
      return running ?? rows[0] ?? null;
    },
  });
  return query;
}

interface QueueActivityRow {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  result: Record<string, unknown> | null;
  valuation_lead_id: string;
  lead?: {
    full_name: string | null;
    business_name: string | null;
    display_name: string | null;
    email: string | null;
    work_email: string | null;
    linkedin_url: string | null;
    phone: string | null;
  };
}

function useBackfillActivity(runId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['contact-backfill-queue', runId],
    enabled: !!runId && enabled,
    refetchInterval: enabled ? 2_000 : false,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<QueueActivityRow[]> => {
      if (!runId) return [];
      const { data: queueRows, error } = await supabase
        .from('contact_backfill_queue')
        .select('id, status, started_at, completed_at, last_error, result, valuation_lead_id')
        .eq('run_id', runId)
        .order('completed_at', { ascending: false, nullsFirst: false })
        .order('started_at', { ascending: false, nullsFirst: false })
        .limit(8);
      if (error) throw error;
      const rows = (queueRows ?? []) as unknown as QueueActivityRow[];
      const leadIds = Array.from(new Set(rows.map((r) => r.valuation_lead_id)));
      if (leadIds.length === 0) return rows;
      const { data: leads } = await supabase
        .from('valuation_leads')
        .select(
          'id, full_name, business_name, display_name, email, work_email, linkedin_url, phone',
        )
        .in('id', leadIds);
      const byId = new Map<string, QueueActivityRow['lead']>();
      for (const l of (leads ?? []) as any[]) {
        byId.set(l.id, l);
      }
      return rows.map((r) => ({ ...r, lead: byId.get(r.valuation_lead_id) }));
    },
  });
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.round(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function describeOutcome(r: QueueActivityRow): {
  label: string;
  tone: 'ok' | 'warn' | 'err' | 'muted';
} {
  if (r.status === 'failed') {
    return { label: r.last_error ? `failed: ${r.last_error.slice(0, 60)}` : 'failed', tone: 'err' };
  }
  if (r.status === 'processing' || r.status === 'pending') {
    return { label: r.status === 'processing' ? 'processing…' : 'pending', tone: 'muted' };
  }
  const res = (r.result ?? {}) as Record<string, unknown>;
  const tags: string[] = [];
  if (res.from_cache) tags.push('cache hit');
  if (res.linkedin_persisted) tags.push('LinkedIn');
  if (res.phone_persisted) tags.push('phone');
  if (res.clay_fallback_sent || res.clay_queued) tags.push('Clay queued');
  if (res.skipped_reason && typeof res.skipped_reason === 'string') {
    tags.push(`skipped: ${res.skipped_reason}`);
  }
  if (tags.length === 0) return { label: 'no new contact', tone: 'muted' };
  return { label: `found ${tags.join(' + ')}`, tone: 'ok' };
}

function leadLabel(lead: QueueActivityRow['lead']): string {
  if (!lead) return '—';
  return (
    lead.business_name ||
    lead.display_name ||
    lead.full_name ||
    lead.work_email ||
    lead.email ||
    'unknown'
  );
}

export function ContactBackfillRunCard() {
  const mountedAtRef = useRef<number>(Date.now());
  const queryClient = useQueryClient();
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1_000);
    return () => clearInterval(t);
  }, []);

  const {
    data: run,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useLatestContactBackfillRun();

  const isRunning = run?.status === 'running';
  const activityQuery = useBackfillActivity(run?.id, isRunning);

  // Realtime: any change to the latest run row or its queue items triggers an
  // immediate refetch. Polling stays as a safety net.
  useEffect(() => {
    const channel = supabase
      .channel('contact-backfill-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contact_backfill_runs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['contact-backfill-runs', 'latest'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contact_backfill_queue' },
        () => {
          if (run?.id) {
            queryClient.invalidateQueries({ queryKey: ['contact-backfill-queue', run.id] });
          }
          queryClient.invalidateQueries({ queryKey: ['contact-backfill-runs', 'latest'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, run?.id]);

  // Activity / progress summary used in both placeholder and main card.
  const total = run ? Math.max(run.eligible_count, run.processed_count + run.pending_count, 1) : 0;
  const pct = run ? Math.min(100, Math.round((run.processed_count / total) * 100)) : 0;

  // Placeholder while the first query is in-flight, OR if there's truly no run
  // and we're still in a brief mount window. Once we've waited >5s and still
  // have no run, we hide the card entirely (no run = nothing to show).
  if (isLoading || (!run && Date.now() - mountedAtRef.current < 5_000)) {
    const waitedMs = Date.now() - mountedAtRef.current;
    const showDiagnostic = waitedMs > 15_000;
    return (
      <Card className="bg-muted/30 border-border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 flex-shrink-0 text-muted-foreground animate-spin" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-muted-foreground">
                {isError
                  ? 'Reconnecting to backfill status…'
                  : 'Checking for active contact backfill…'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isError && error instanceof Error
                  ? error.message
                  : showDiagnostic
                    ? 'No run row visible yet. Click Refresh or try Find Contacts again.'
                    : 'Live progress will appear here within a few seconds of kickoff.'}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!run) return null;

  // Hide stale terminal runs after 30 min.
  const isTerminal = ['completed', 'failed'].includes(run.status);
  const ageMs = Date.now() - new Date(run.last_heartbeat_at).getTime();
  if (isTerminal && ageMs > 30 * 60 * 1000) return null;

  const statusMeta = (() => {
    switch (run.status) {
      case 'running':
        return {
          Icon: Loader2,
          color: 'text-primary',
          bg: 'bg-primary/5 border-primary/30',
          spin: true,
          label: 'Running',
        };
      case 'completed':
        return {
          Icon: CheckCircle2,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50 border-emerald-200',
          spin: false,
          label: 'Completed',
        };
      case 'failed':
        return {
          Icon: AlertTriangle,
          color: 'text-destructive',
          bg: 'bg-destructive/5 border-destructive/30',
          spin: false,
          label: 'Failed',
        };
      case 'paused':
      case 'needs_resume':
        return {
          Icon: PauseCircle,
          color: 'text-amber-600',
          bg: 'bg-amber-50 border-amber-200',
          spin: false,
          label: 'Needs resume',
        };
      default:
        return {
          Icon: Hourglass,
          color: 'text-muted-foreground',
          bg: 'bg-muted/30 border-border',
          spin: false,
          label: run.status,
        };
    }
  })();

  const handleResume = async () => {
    const { data, error: invokeErr } = await supabase.functions.invoke(
      'backfill-valuation-lead-contacts',
      { body: { resume_run_id: run.id } },
    );
    if (invokeErr) {
      toast.error(`Resume failed: ${invokeErr.message}`);
      return;
    }
    const result = data as { run_id?: string; eligible_count?: number } | null;
    if (!result?.run_id) {
      toast.error('Resume did not start — check edge function logs');
      return;
    }
    toast.success(
      `Resumed run ${result.run_id.slice(0, 8)} (${result.eligible_count ?? 0} pending)`,
    );
    refetch();
  };

  const activity = activityQuery.data ?? [];
  const currentlyProcessing = activity.find((a) => a.status === 'processing');
  const recent = activity
    .filter((a) => a.status === 'completed' || a.status === 'failed')
    .slice(0, 5);

  return (
    <Card id="contact-backfill-run-card" className={statusMeta.bg}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          <statusMeta.Icon
            className={`h-5 w-5 flex-shrink-0 mt-0.5 ${statusMeta.color} ${statusMeta.spin ? 'animate-spin' : ''}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-medium text-sm">Contact backfill — {statusMeta.label}</p>
                <span className="text-xs text-muted-foreground font-mono">
                  run {run.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {run.processed_count}/{total} ({pct}%)
                </span>
                {(run.status === 'paused' || run.status === 'needs_resume') && (
                  <Button size="sm" variant="outline" className="h-7" onClick={handleResume}>
                    Resume
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => {
                    refetch();
                    activityQuery.refetch();
                  }}
                  title="Refresh"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <Progress value={pct} className="h-1.5 mb-2" />
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700">
                <Phone className="h-3 w-3" />
                {run.found_phone_count} phone
              </Badge>
              <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700">
                <Linkedin className="h-3 w-3" />
                {run.found_linkedin_count} LinkedIn
              </Badge>
              {(run.queued_clay_count ?? 0) > 0 && (
                <Badge variant="secondary" className="gap-1 bg-violet-100 text-violet-700">
                  {run.queued_clay_count} Clay queued
                </Badge>
              )}
              {run.failed_count > 0 && (
                <Badge variant="secondary" className="gap-1 bg-red-100 text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  {run.failed_count} failed
                </Badge>
              )}
              {run.rate_limited_retried > 0 && (
                <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
                  rl-retried {run.rate_limited_retried}
                </Badge>
              )}
              {run.pending_count > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Hourglass className="h-3 w-3" />
                  {run.pending_count} pending
                </Badge>
              )}
            </div>

            {/* Live activity feed — only while running */}
            {isRunning && (
              <div className="mt-3 border-t border-primary/15 pt-2 space-y-1.5">
                {currentlyProcessing ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span className="font-medium">Processing now:</span>
                    <span className="truncate">{leadLabel(currentlyProcessing.lead)}</span>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Worker is idle between leads…</div>
                )}
                {recent.length > 0 && (
                  <ul className="space-y-1">
                    {recent.map((r) => {
                      const o = describeOutcome(r);
                      const Icon = r.status === 'failed' ? XCircle : CheckCircle2;
                      const toneClass =
                        o.tone === 'ok'
                          ? 'text-emerald-700'
                          : o.tone === 'err'
                            ? 'text-destructive'
                            : o.tone === 'warn'
                              ? 'text-amber-700'
                              : 'text-muted-foreground';
                      return (
                        <li key={r.id} className="flex items-center gap-2 text-xs">
                          <Icon className={`h-3 w-3 flex-shrink-0 ${toneClass}`} />
                          <span className="truncate flex-1 min-w-0">
                            <span className="font-medium">{leadLabel(r.lead)}</span>
                            <span className={`ml-1.5 ${toneClass}`}>— {o.label}</span>
                          </span>
                          <span className="text-muted-foreground tabular-nums flex-shrink-0">
                            {relativeTime(r.completed_at ?? r.started_at)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {run.status === 'completed' &&
              run.found_phone_count === 0 &&
              run.found_linkedin_count === 0 &&
              (run.queued_clay_count ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  No new contacts found synchronously — {run.queued_clay_count} sent to Clay async
                  waterfall. Results land via webhook over the next few minutes.
                </p>
              )}
            {run.status === 'completed' &&
              run.found_phone_count === 0 &&
              run.found_linkedin_count === 0 &&
              (run.queued_clay_count ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  All processed leads were already enriched (cache hit) — nothing new to write.
                </p>
              )}
            {run.pause_reason && (
              <p className="text-xs text-amber-700 mt-1.5">{run.pause_reason}</p>
            )}
            {run.error && <p className="text-xs text-destructive mt-1.5 truncate">{run.error}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
