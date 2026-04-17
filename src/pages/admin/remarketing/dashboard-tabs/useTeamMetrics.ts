/**
 * useTeamMetrics.ts
 *
 * Data hook for the Team Performance tab. Aggregates per-admin activity across
 * contact_activities (calls), smartlead_messages (emails), daily_standup_tasks
 * (tasks), and deal_pipeline (deal ownership).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getFromDate, type Timeframe } from '../useDashboardData';

interface CallRow {
  user_id: string | null;
  call_connected: boolean | null;
}

interface EmailRow {
  from_address: string | null;
}

interface TaskRow {
  assignee_id: string | null;
  completed_by: string | null;
  status: string;
  due_date: string;
  completed_at: string | null;
}

interface PipelineAssignmentRow {
  assigned_to: string | null;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface TeamRow {
  userId: string;
  name: string;
  calls: number;
  connects: number;
  connectRate: number; // 0-100
  emailsSent: number;
  tasksCompleted: number;
  tasksOverdue: number;
  dealsOwned: number;
}

export interface TeamKPIs {
  tasksCompleted: number;
  tasksOverdue: number;
  dealsAssigned: number;
  unassignedDeals: number;
  /** Emails whose from_address couldn't be attributed to any admin profile. */
  unattributedEmails: number;
}

/**
 * Resolve a SmartLead from_address to a profile id.
 *
 * Strategy:
 *   1. Exact email match (fast path, handles the common case).
 *   2. Fallback: match the local part of from_address against each profile's
 *      first_name or last_name (lowercased). Requires a domain match so we
 *      don't accidentally match an admin whose first_name happens to collide
 *      with some random external sender.
 *
 * Returns the profile id, or null if nothing matches.
 */
function resolveSenderProfile(
  fromAddress: string,
  profiles: ProfileRow[],
  exactMap: Map<string, string>,
): string | null {
  const lower = fromAddress.toLowerCase().trim();

  // 1. Exact email match
  const exact = exactMap.get(lower);
  if (exact) return exact;

  // 2. Parse local + domain
  const at = lower.indexOf('@');
  if (at < 0) return null;
  const localPart = lower.slice(0, at);
  const domain = lower.slice(at + 1);

  // Token-split the local part: john.doe / jane-smith / tomos_mughan → [tokens]
  const tokens = localPart.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length === 0) return null;

  // 3. Candidate profiles must share the same email domain (prevents false
  // positives across tenants).
  const candidates = profiles.filter((p) => {
    if (!p.email) return false;
    const profDomain = p.email.toLowerCase().split('@')[1];
    return profDomain === domain;
  });
  if (candidates.length === 0) return null;

  // 4. Rank candidates by how many of their name tokens appear in the local part.
  // Prefer the highest match count; tie-break by longest first_name (more
  // specific match wins).
  let best: { profile: ProfileRow; score: number } | null = null;
  for (const p of candidates) {
    const first = (p.first_name || '').toLowerCase().trim();
    const last = (p.last_name || '').toLowerCase().trim();
    if (!first && !last) continue;

    let score = 0;
    if (first && tokens.includes(first)) score += 2;
    if (last && tokens.includes(last)) score += 2;
    // Partial token contains (e.g. from_address "tomos.m@..." vs first_name "tomos")
    if (first && tokens.some((t) => t.startsWith(first) || first.startsWith(t))) score += 1;
    if (last && tokens.some((t) => t.startsWith(last) || last.startsWith(t))) score += 1;

    if (score > 0) {
      if (!best) {
        best = { profile: p, score };
      } else if (score > best.score) {
        best = { profile: p, score };
      } else if (score === best.score && first.length > (best.profile.first_name || '').length) {
        // Equal score → prefer the profile whose first_name is longer (more
        // specific match wins). E.g. "thom" vs "thomas" — "thomas" should win.
        best = { profile: p, score };
      }
    }
  }

  return best ? best.profile.id : null;
}

export function useTeamMetrics(timeframe: Timeframe) {
  const fromDate = getFromDate(timeframe);

  const { data: profiles } = useQuery({
    queryKey: ['team', 'admin-profiles'],
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('is_admin', true);
      if (error) throw error;
      return (data || []) as ProfileRow[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: calls, isLoading: callsLoading } = useQuery({
    queryKey: ['team', 'calls', fromDate],
    queryFn: async (): Promise<CallRow[]> => {
      let q = (supabase as any)
        .from('contact_activities')
        .select('user_id, call_connected')
        .not('call_started_at', 'is', null);
      if (fromDate) q = q.gte('created_at', fromDate);
      const { data, error } = await q.limit(20000);
      if (error) throw error;
      return (data || []) as CallRow[];
    },
    staleTime: 60_000,
  });

  const { data: emails } = useQuery({
    queryKey: ['team', 'emails', fromDate],
    queryFn: async (): Promise<EmailRow[]> => {
      let q = (supabase as any)
        .from('smartlead_messages')
        .select('from_address')
        .eq('direction', 'outbound')
        .eq('event_type', 'sent');
      if (fromDate) q = q.gte('sent_at', fromDate);
      const { data, error } = await q.limit(20000);
      if (error) throw error;
      return (data || []) as EmailRow[];
    },
    staleTime: 60_000,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['team', 'tasks', fromDate],
    queryFn: async (): Promise<TaskRow[]> => {
      // Fetch in two slices so we can scope by date at the DB level without
      // missing rows that belong in either count:
      //   1. Tasks completed in period (filter by completed_at)
      //   2. Tasks currently overdue regardless of when they were created
      //      (filter by status != completed AND due_date < today)
      // Union them in-memory. This avoids the unbounded-scan problem where
      // the previous .limit(10000) could silently drop data at scale.
      const nowIso = new Date().toISOString().slice(0, 10);

      const completedQuery = (supabase as any)
        .from('daily_standup_tasks')
        .select('assignee_id, completed_by, status, due_date, completed_at')
        .eq('status', 'completed')
        .not('completed_at', 'is', null);
      const completedScoped = fromDate
        ? completedQuery.gte('completed_at', fromDate)
        : completedQuery.gte('completed_at', new Date(Date.now() - 90 * 86400000).toISOString());

      const overdueQuery = (supabase as any)
        .from('daily_standup_tasks')
        .select('assignee_id, completed_by, status, due_date, completed_at')
        .neq('status', 'completed')
        .lt('due_date', nowIso);

      const [completedResult, overdueResult] = await Promise.all([
        completedScoped.limit(20000),
        overdueQuery.limit(20000),
      ]);
      if (completedResult.error) throw completedResult.error;
      if (overdueResult.error) throw overdueResult.error;

      // De-dup by (assignee_id, due_date, completed_at) just in case a row
      // somehow matches both predicates (shouldn't happen — a completed task
      // can't also be non-completed — but belt and braces).
      const seen = new Set<string>();
      const merged: TaskRow[] = [];
      for (const row of [...(completedResult.data || []), ...(overdueResult.data || [])]) {
        const key = `${row.assignee_id || ''}|${row.due_date}|${row.completed_at || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row as TaskRow);
      }
      return merged;
    },
    staleTime: 60_000,
  });

  const { data: assignments } = useQuery({
    queryKey: ['team', 'deal-assignments'],
    queryFn: async (): Promise<PipelineAssignmentRow[]> => {
      const { data, error } = await (supabase as any)
        .from('deal_pipeline')
        .select('assigned_to')
        .is('deleted_at', null);
      if (error) throw error;
      return (data || []) as PipelineAssignmentRow[];
    },
    staleTime: 60_000,
  });

  // ─── KPIs ───────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);

  const tasksCompletedInPeriod = (tasks || []).filter(
    (t) => t.status === 'completed' && t.completed_at && (!fromDate || t.completed_at >= fromDate),
  );

  const tasksOverdueList = (tasks || []).filter(
    (t) => t.status !== 'completed' && t.due_date < today,
  );

  const dealsAssignedCount = (assignments || []).filter((a) => a.assigned_to).length;
  const unassignedCount = (assignments || []).filter((a) => !a.assigned_to).length;

  // ─── Per-admin rollup ───────────────────────────────────────────────────
  const byUser = new Map<
    string,
    {
      calls: number;
      connects: number;
      emailsSent: number;
      tasksCompleted: number;
      tasksOverdue: number;
      dealsOwned: number;
    }
  >();

  const bump = (userId: string) => {
    let row = byUser.get(userId);
    if (!row) {
      row = {
        calls: 0,
        connects: 0,
        emailsSent: 0,
        tasksCompleted: 0,
        tasksOverdue: 0,
        dealsOwned: 0,
      };
      byUser.set(userId, row);
    }
    return row;
  };

  for (const c of calls || []) {
    if (!c.user_id) continue;
    const row = bump(c.user_id);
    row.calls++;
    if (c.call_connected === true) row.connects++;
  }

  // Email attribution via from_address → profile.
  // Two-stage match: exact email first, then fuzzy first_name/last_name
  // fallback against profiles sharing the same email domain. Results are
  // cached in a local map so each unique from_address is only resolved once.
  const exactEmailMap = new Map<string, string>();
  for (const p of profiles || []) {
    if (p.email) exactEmailMap.set(p.email.toLowerCase(), p.id);
  }
  const addressCache = new Map<string, string | null>();
  let unattributedEmails = 0;
  for (const e of emails || []) {
    if (!e.from_address) continue;
    const key = e.from_address.toLowerCase();
    let userId = addressCache.get(key);
    if (userId === undefined) {
      userId = resolveSenderProfile(e.from_address, profiles || [], exactEmailMap);
      addressCache.set(key, userId);
    }
    if (userId) {
      bump(userId).emailsSent++;
    } else {
      unattributedEmails++;
    }
  }

  const kpis: TeamKPIs = {
    tasksCompleted: tasksCompletedInPeriod.length,
    tasksOverdue: tasksOverdueList.length,
    dealsAssigned: dealsAssignedCount,
    unassignedDeals: unassignedCount,
    unattributedEmails,
  };

  for (const t of tasksCompletedInPeriod) {
    const uid = t.completed_by || t.assignee_id;
    if (uid) bump(uid).tasksCompleted++;
  }
  for (const t of tasksOverdueList) {
    if (t.assignee_id) bump(t.assignee_id).tasksOverdue++;
  }

  for (const a of assignments || []) {
    if (a.assigned_to) bump(a.assigned_to).dealsOwned++;
  }

  const teamRows: TeamRow[] = Array.from(byUser.entries())
    .map(([userId, data]) => {
      const profile = (profiles || []).find((p) => p.id === userId);
      const name = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
          profile.email ||
          userId.slice(0, 8)
        : userId.slice(0, 8);
      return {
        userId,
        name,
        ...data,
        connectRate: data.calls > 0 ? Math.round((data.connects / data.calls) * 1000) / 10 : 0,
      };
    })
    .sort(
      (a, b) =>
        b.calls + b.tasksCompleted + b.emailsSent - (a.calls + a.tasksCompleted + a.emailsSent),
    );

  return {
    loading: callsLoading || tasksLoading,
    kpis,
    teamRows,
  };
}
