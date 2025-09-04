import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DealEmail {
  id: string;
  email: string;
  email_type: string;
  status: string;
  sent_at: string;
  correlation_id: string;
  error_message?: string;
}

export function useDealEmails(dealId: string) {
  return useQuery({
    queryKey: ['deal-emails', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      
      const { data, error } = await supabase
        .from('email_delivery_logs')
        .select('*')
        .ilike('correlation_id', `%deal-${dealId}%`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data as DealEmail[];
    },
    enabled: !!dealId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}