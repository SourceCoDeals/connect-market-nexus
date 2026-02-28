/**
 * useEntityTasks
 *
 * Provides queries for fetching tasks linked to a specific entity
 * (listing, deal, buyer, or contact). Used by the Tasks tab on
 * entity detail pages.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DailyStandupTaskWithRelations, TaskEntityType } from '@/types/daily-tasks';

const ENTITY_TASKS_KEY = 'entity-tasks';

interface UseEntityTasksOptions {
  entityType: TaskEntityType;
  entityId: string;
  includeCompleted?: boolean;
}

export function useEntityTasks({
  entityType,
  entityId,
  includeCompleted = false,
}: UseEntityTasksOptions) {
  return useQuery({
    queryKey: [ENTITY_TASKS_KEY, entityType, entityId, includeCompleted],
    enabled: !!entityId,
    queryFn: async () => {
      let query = supabase
        .from('daily_standup_tasks' as any)
        .select(
          `
          *,
          assignee:profiles!daily_standup_tasks_assignee_id_fkey(id, first_name, last_name, email),
          deal:deals!daily_standup_tasks_deal_id_fkey(id, listing_id, listings(title, internal_company_name, ebitda), deal_stages(name)),
          source_meeting:standup_meetings(id, meeting_title, meeting_date, transcript_url)
        `,
        )
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('priority_rank', { ascending: true, nullsFirst: false })
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: true });

      if (!includeCompleted) {
        query = query.in('status', [
          'pending_approval',
          'pending',
          'in_progress',
          'overdue',
          'snoozed',
        ]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as DailyStandupTaskWithRelations[];
    },
    staleTime: 30_000,
  });
}

/**
 * Fetch tasks where the entity is the secondary entity (e.g. tasks for a
 * buyer that are linked to deals but have the buyer as secondary_entity).
 */
export function useSecondaryEntityTasks({
  entityType,
  entityId,
  includeCompleted = false,
}: UseEntityTasksOptions) {
  return useQuery({
    queryKey: [ENTITY_TASKS_KEY, 'secondary', entityType, entityId, includeCompleted],
    enabled: !!entityId,
    queryFn: async () => {
      let query = supabase
        .from('daily_standup_tasks' as any)
        .select(
          `
          *,
          assignee:profiles!daily_standup_tasks_assignee_id_fkey(id, first_name, last_name, email),
          deal:deals!daily_standup_tasks_deal_id_fkey(id, listing_id, listings(title, internal_company_name, ebitda), deal_stages(name)),
          source_meeting:standup_meetings(id, meeting_title, meeting_date, transcript_url)
        `,
        )
        .eq('secondary_entity_type', entityType)
        .eq('secondary_entity_id', entityId)
        .order('created_at', { ascending: false });

      if (!includeCompleted) {
        query = query.in('status', [
          'pending_approval',
          'pending',
          'in_progress',
          'overdue',
          'snoozed',
        ]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as DailyStandupTaskWithRelations[];
    },
    staleTime: 30_000,
  });
}
