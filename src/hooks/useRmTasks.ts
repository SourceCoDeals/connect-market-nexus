/**
 * useRmTasks — React Query hooks for the rm_tasks system (v3.0)
 *
 * Provides queries and mutations for:
 * - Fetching tasks with relations (inbox views, entity-scoped views)
 * - Creating, editing, completing, snoozing, deleting tasks
 * - Template-based task creation
 * - Task counts for notification badge
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type {
  RmTask,
  RmTaskWithRelations,
  RmTaskStatus,
  RmTaskEntityType,
  RmTaskPriority,
  CreateRmTaskInput,
  DealStageTemplate,
  RmTaskFilters,
} from '@/types/rm-tasks';
import { DEAL_STAGE_TEMPLATES } from '@/types/rm-tasks';

const QUERY_KEY = 'rm-tasks';
const COUNTS_KEY = 'rm-tasks-counts';

// ─── Helpers ───

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

/** Returns YYYY-MM-DD in local timezone (not UTC) */
function localDateStr(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD
}

function todayStr(): string {
  return localDateStr();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Task counts for badge ───

export interface RmTaskCounts {
  open: number;
  overdue: number;
  dueToday: number;
  aiPending: number;
}

export function useRmTaskCounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [COUNTS_KEY, user?.id],
    enabled: !!user?.id,
    refetchInterval: 60_000, // refresh every minute
    queryFn: async (): Promise<RmTaskCounts> => {
      const today = todayStr();

      // Fire all 4 count queries in parallel
      const [openRes, overdueRes, dueTodayRes, aiPendingRes] = await Promise.all([
        (supabase as any)
          .from('rm_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user!.id)
          .in('status', ['open', 'in_progress']),
        (supabase as any)
          .from('rm_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user!.id)
          .in('status', ['open', 'in_progress'])
          .lt('due_date', today),
        (supabase as any)
          .from('rm_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user!.id)
          .in('status', ['open', 'in_progress'])
          .eq('due_date', today),
        (supabase as any)
          .from('rm_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user!.id)
          .eq('source', 'ai')
          .is('confirmed_at', null)
          .is('dismissed_at', null)
          .gt('expires_at', new Date().toISOString()),
      ]);

      return {
        open: openRes.count ?? 0,
        overdue: overdueRes.count ?? 0,
        dueToday: dueTodayRes.count ?? 0,
        aiPending: aiPendingRes.count ?? 0,
      };
    },
  });
}

// ─── Fetch tasks (inbox) ───

export type InboxView =
  | 'my_tasks'
  | 'due_today'
  | 'this_week'
  | 'overdue'
  | 'completed'
  | 'ai_suggested';

interface UseRmTasksOptions {
  view: InboxView;
  filters?: RmTaskFilters;
  entityType?: RmTaskEntityType;
  entityId?: string;
}

export function useRmTasks(options: UseRmTasksOptions) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [QUERY_KEY, options, user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<RmTaskWithRelations[]> => {
      const today = todayStr();
      const weekEnd = addDays(7);

      // Use enriched view which resolves entity_name and secondary_entity_name
      let query = (supabase as any).from('rm_tasks_enriched').select(`
          *,
          owner:profiles!rm_tasks_owner_id_fkey(id, first_name, last_name, email),
          blocking_task:rm_tasks!rm_tasks_depends_on_fkey(id, title, status)
        `);

      // If scoped to a specific entity
      if (options.entityType && options.entityId) {
        if (!UUID_RE.test(options.entityId)) throw new Error('Invalid entity ID');
        // Show tasks where entity matches OR secondary entity matches
        query = query.or(
          `and(entity_type.eq.${options.entityType},entity_id.eq.${options.entityId}),and(secondary_entity_type.eq.${options.entityType},secondary_entity_id.eq.${options.entityId})`,
        );
      }

      // View-specific filters
      switch (options.view) {
        case 'my_tasks':
          query = query.eq('owner_id', user!.id).in('status', ['open', 'in_progress']);
          break;
        case 'due_today':
          query = query
            .eq('owner_id', user!.id)
            .eq('due_date', today)
            .in('status', ['open', 'in_progress']);
          break;
        case 'this_week':
          query = query
            .eq('owner_id', user!.id)
            .gte('due_date', today)
            .lte('due_date', weekEnd)
            .in('status', ['open', 'in_progress']);
          break;
        case 'overdue':
          query = query
            .eq('owner_id', user!.id)
            .lt('due_date', today)
            .in('status', ['open', 'in_progress']);
          break;
        case 'completed':
          query = query.eq('owner_id', user!.id).eq('status', 'completed');
          break;
        case 'ai_suggested':
          query = query
            .eq('owner_id', user!.id)
            .eq('source', 'ai')
            .is('confirmed_at', null)
            .is('dismissed_at', null)
            .gt('expires_at', new Date().toISOString());
          break;
      }

      // Additional filters
      if (options.filters) {
        const f = options.filters;
        if (f.entityType) query = query.eq('entity_type', f.entityType);
        if (f.priority) query = query.eq('priority', f.priority);
        if (f.status) query = query.eq('status', f.status);
        if (f.source) query = query.eq('source', f.source);
        if (f.dateRange && f.dateRange !== 'all') {
          switch (f.dateRange) {
            case 'today':
              query = query.eq('due_date', today);
              break;
            case '7d':
              query = query.lte('due_date', addDays(7));
              break;
            case '14d':
              query = query.lte('due_date', addDays(14));
              break;
            case '30d':
              query = query.lte('due_date', addDays(30));
              break;
            case '90d':
              query = query.lte('due_date', addDays(90));
              break;
            case 'custom':
              if (f.customDateFrom) query = query.gte('due_date', f.customDateFrom);
              if (f.customDateTo) query = query.lte('due_date', f.customDateTo);
              break;
          }
        }
      }

      // Sort: overdue first, then by due_date, then by buyer_deal_score desc
      query = query.order('due_date', { ascending: true, nullsFirst: false });

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RmTaskWithRelations[];
    },
  });
}

// ─── Entity-scoped task fetch (for Deal/Buyer/Contact detail pages) ───

export function useEntityRmTasks(entityType: RmTaskEntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'entity', entityType, entityId],
    enabled: !!entityId,
    queryFn: async (): Promise<RmTaskWithRelations[]> => {
      if (!entityId || !UUID_RE.test(entityId)) throw new Error('Invalid entity ID');

      const { data, error } = await (supabase as any)
        .from('rm_tasks_enriched')
        .select(
          `
          *,
          owner:profiles!rm_tasks_owner_id_fkey(id, first_name, last_name, email),
          blocking_task:rm_tasks!rm_tasks_depends_on_fkey(id, title, status)
        `,
        )
        .or(
          `and(entity_type.eq.${entityType},entity_id.eq.${entityId}),and(secondary_entity_type.eq.${entityType},secondary_entity_id.eq.${entityId})`,
        )
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return (data ?? []) as RmTaskWithRelations[];
    },
  });
}

// ─── Create task ───

export function useCreateRmTask() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRmTaskInput) => {
      const { data, error } = await (supabase as any)
        .from('rm_tasks')
        .insert({
          title: input.title,
          entity_type: input.entity_type,
          entity_id: input.entity_id,
          secondary_entity_type: input.secondary_entity_type ?? null,
          secondary_entity_id: input.secondary_entity_id ?? null,
          due_date: input.due_date,
          priority: input.priority ?? 'medium',
          owner_id: input.owner_id,
          deal_team_visible: input.deal_team_visible ?? true,
          source: input.source ?? 'manual',
          notes: input.notes ?? null,
          depends_on: input.depends_on ?? null,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as RmTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [COUNTS_KEY] });
    },
  });
}

// ─── Update task ───

interface UpdateRmTaskInput {
  id: string;
  title?: string;
  due_date?: string | null;
  priority?: RmTaskPriority;
  owner_id?: string;
  notes?: string;
  status?: RmTaskStatus;
  secondary_entity_type?: RmTaskEntityType | null;
  secondary_entity_id?: string | null;
  depends_on?: string | null;
}

export function useUpdateRmTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateRmTaskInput) => {
      const { id, ...updates } = input;
      const { data, error } = await (supabase as any)
        .from('rm_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as RmTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [COUNTS_KEY] });
    },
  });
}

// ─── Complete task ───

export function useCompleteRmTask() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, completion_notes }: { id: string; completion_notes?: string }) => {
      const { data, error } = await (supabase as any)
        .from('rm_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user!.id,
          completion_notes: completion_notes ?? null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as RmTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [COUNTS_KEY] });
    },
  });
}

// ─── Reopen task ───

export function useReopenRmTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any)
        .from('rm_tasks')
        .update({
          status: 'open',
          completed_at: null,
          completed_by: null,
          completion_notes: null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as RmTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [COUNTS_KEY] });
    },
  });
}

// ─── Snooze task ───

export function useSnoozeRmTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, snoozed_until }: { id: string; snoozed_until: string }) => {
      const { data, error } = await (supabase as any)
        .from('rm_tasks')
        .update({
          status: 'snoozed',
          snoozed_until,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as RmTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [COUNTS_KEY] });
    },
  });
}

// ─── Delete task ───

export function useDeleteRmTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('rm_tasks').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [COUNTS_KEY] });
    },
  });
}

// ─── Confirm AI task ───

export function useConfirmAiTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, due_date }: { id: string; due_date: string }) => {
      const { data, error } = await (supabase as any)
        .from('rm_tasks')
        .update({
          confirmed_at: new Date().toISOString(),
          due_date,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as RmTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [COUNTS_KEY] });
    },
  });
}

// ─── Dismiss AI task ───

export function useDismissAiTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any)
        .from('rm_tasks')
        .update({
          dismissed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as RmTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [COUNTS_KEY] });
    },
  });
}

// ─── Create from template ───

export function useCreateFromTemplate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      template,
      dealId,
      ownerId,
    }: {
      template: DealStageTemplate;
      dealId: string;
      ownerId: string;
    }) => {
      const config = DEAL_STAGE_TEMPLATES[template];
      if (!config) throw new Error(`Unknown template: ${template}`);

      // Build the task array for the RPC function
      const templateTasks = config.tasks.map((t) => ({
        title: t.title,
        due_days: t.due_days,
        priority: t.priority,
        depends_on_index: t.depends_on_index ?? null,
      }));

      // Use the atomic RPC function — all tasks created in a single transaction
      const { data, error } = await (supabase as any).rpc('rm_create_template_tasks', {
        p_template_tasks: templateTasks,
        p_deal_id: dealId,
        p_owner_id: ownerId,
        p_created_by: user!.id,
      });

      if (error) throw error;
      return (data ?? []) as string[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [COUNTS_KEY] });
    },
  });
}

// ─── Team members for assignment ───

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name', { ascending: true });

      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email,
        email: p.email,
      }));
    },
  });
}
