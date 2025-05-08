
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';

/**
 * Hook for fetching admin listings
 */
export function useListingsQuery() {
  return useQuery({
    queryKey: ['admin-listings'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('listings')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data as AdminListing[];
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error fetching listings',
          description: error.message,
        });
        return [];
      }
    },
  });
}
