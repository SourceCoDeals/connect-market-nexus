/**
 * Hook to fetch all distinct tags used across tasks.
 * Used for autocomplete suggestions and filter dropdowns.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useExistingTags() {
  return useQuery({
    queryKey: ['task-tags-distinct'],
    queryFn: async () => {
      // Fetch all non-empty tag arrays from active tasks
      const { data, error } = await supabase
        .from('daily_standup_tasks')
        .select('tags')
        .not('tags', 'eq', '{}')
        .in('status', ['pending', 'pending_approval', 'in_progress', 'overdue']);

      if (error) throw error;

      const tagSet = new Set<string>();
      for (const row of data || []) {
        const tags = row.tags;
        if (Array.isArray(tags)) {
          for (const tag of tags) {
            tagSet.add(tag.toLowerCase());
          }
        }
      }

      return Array.from(tagSet).sort();
    },
    staleTime: 60_000,
  });
}
