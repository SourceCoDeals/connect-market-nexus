import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConnectionRequestStage {
  id: string;
  name: string;
  description: string | null;
  position: number;
  color: string;
  is_active: boolean;
  is_default: boolean;
  automation_rules: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function useConnectionRequestStages() {
  return useQuery({
    queryKey: ['connection-request-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connection_request_stages')
        .select('*')
        .eq('is_active', true)
        .order('position');

      if (error) {
        console.error('Error fetching connection request stages:', error);
        throw error;
      }

      return data as ConnectionRequestStage[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}