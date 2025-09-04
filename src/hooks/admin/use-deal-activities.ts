import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DealActivity {
  id: string;
  deal_id: string;
  admin_id?: string;
  activity_type: string;
  title: string;
  description?: string;
  metadata?: any;
  created_at: string;
  admin?: {
    email: string;
    first_name: string;
    last_name: string;
  };
}

export function useDealActivities(dealId: string) {
  return useQuery({
    queryKey: ['deal-activities', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      
      const { data, error } = await supabase
        .from('deal_activities')
        .select(`
          *,
          admin:admin_id(email, first_name, last_name)
        `)
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data as DealActivity[];
    },
    enabled: !!dealId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}