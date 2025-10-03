import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface MarketplaceUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  buyer_type: string | null;
}

export function useMarketplaceUsers() {
  const { user, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['marketplace-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, company, buyer_type')
        .eq('approval_status', 'approved')
        .is('deleted_at', null)
        .order('email');

      if (error) throw error;
      return (data || []) as MarketplaceUser[];
    },
    enabled: !!user && isAdmin,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
