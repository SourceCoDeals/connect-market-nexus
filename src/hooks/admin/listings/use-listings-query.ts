
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';

/**
 * Hook for fetching admin listings with status filtering
 */
export function useListingsQuery(status?: 'active' | 'inactive') {
  return useQuery({
    queryKey: ['admin-listings', status],
    queryFn: async () => {
      try {
        let query = supabase
          .from('listings')
          .select('*');
        
        // Filter by status if provided
        if (status) {
          query = query.eq('status', status);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });

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
