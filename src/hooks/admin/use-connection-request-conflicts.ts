import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ConnectionRequestConflict {
  request_id: string;
  user_email: string;
  listing_title: string;
  conflict_type: string;
  conflict_details: Record<string, any>;
  needs_review: boolean;
}

export function useConnectionRequestConflicts() {
  return useQuery({
    queryKey: ['connection-request-conflicts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_connection_request_conflicts');
      
      if (error) {
        console.error('Error fetching connection request conflicts:', error);
        throw error;
      }
      
      return data as ConnectionRequestConflict[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}