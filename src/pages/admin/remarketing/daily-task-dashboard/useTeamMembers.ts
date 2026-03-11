import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TeamMember } from './types';

export function useTeamMembers(): TeamMember[] {
  const { data: teamMembersRaw } = useQuery({
    queryKey: ['team-members-for-tasks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, profiles!inner(id, first_name, last_name)')
        .in('role', ['owner', 'admin', 'moderator']);
      return (data || []).map(
        (r: {
          user_id: string;
          profiles: { id: string; first_name: string | null; last_name: string | null };
        }) => ({
          // Use user_id directly from user_roles (matches auth.uid()) to ensure
          // consistent IDs with what useDailyTasks uses for the "My Tasks" filter.
          id: r.user_id,
          name: `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim() || r.user_id,
        }),
      );
    },
    staleTime: 300_000,
  });
  return teamMembersRaw || [];
}
