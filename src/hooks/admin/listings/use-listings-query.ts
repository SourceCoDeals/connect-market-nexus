
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';

/**
 * Hook for fetching admin listings with status filtering
 */
export function useListingsQuery(status?: 'active' | 'inactive' | 'all') {
  return useQuery({
    queryKey: ['admin-listings', status],
    queryFn: async () => {
      try {
        let query = supabase
          .from('listings')
          .select('*');
        
        // Filter by status if provided and not 'all'
        if (status && status !== 'all') {
          query = query.eq('status', status);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        
        console.log(`Retrieved ${data?.length} listings with status: ${status || 'all'}`);
        data?.forEach(listing => {
          if (listing.image_url) {
            console.log(`Listing ${listing.id} has image: ${listing.image_url}`);
          }
        });
        
        return data as AdminListing[];
      } catch (error: any) {
        console.error('Error fetching listings:', error);
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
