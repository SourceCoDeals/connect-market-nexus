import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SourceCoAdmin {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  displayName: string;
}

export function useSourceCoAdmins() {
  return useQuery({
    queryKey: ['source-co-admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .or('email.like.%@sourcecodeals.com,email.like.%@captarget.com')
        .eq('is_admin', true)
        .order('first_name', { ascending: true });

      if (error) throw error;

      return (data || []).map(admin => ({
        ...admin,
        displayName: `${admin.first_name} ${admin.last_name}`.trim() || admin.email.split('@')[0],
      })) as SourceCoAdmin[];
    },
  });
}
