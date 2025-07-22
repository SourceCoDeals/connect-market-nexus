
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { withPerformanceMonitoring } from '@/lib/performance-monitor';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook for fetching admin listings with status filtering and soft delete support
 */
export function useListingsQuery(status?: 'active' | 'inactive' | 'all') {
  const { user, authChecked } = useAuth();

  return useQuery({
    queryKey: ['admin-listings', status],
    queryFn: async () => {
      return withPerformanceMonitoring('admin-listings-query', async () => {
        try {
          console.log(`🔍 Admin fetching listings with status filter: ${status || 'all'}`);
          console.log('🔐 Admin auth state:', {
            authChecked,
            user: user?.email,
            is_admin: user?.is_admin
          });

          // Simple admin check
          if (!user || !user.is_admin) {
            throw new Error('Admin authentication required');
          }
          
          let query = supabase
            .from('listings')
            .select('*')
            .is('deleted_at', null); // Respect soft deletes
          
          // Filter by status if provided and not 'all'
          if (status && status !== 'all') {
            query = query.eq('status', status);
          }
          
          const { data, error } = await query.order('created_at', { ascending: false });

          if (error) {
            console.error('❌ Supabase error fetching admin listings:', error);
            throw error;
          }
          
          console.log(`✅ Retrieved ${data?.length} non-deleted listings with status: ${status || 'all'}`);
          
          // Add detailed logging for image URLs
          data?.forEach(listing => {
            if (listing.image_url) {
              console.log(`Listing ${listing.id} has image URL: ${listing.image_url}`);
            } else {
              console.log(`Listing ${listing.id} has no image URL`);
            }
          });
          
          // Map old category field to categories array for backward compatibility
          const mappedData = data?.map(listing => ({
            ...listing,
            categories: listing.categories || (listing.category ? [listing.category] : [])
          }));
          
          return mappedData as AdminListing[];
        } catch (error: any) {
          console.error('💥 Error fetching admin listings:', error);
          toast({
            variant: 'destructive',
            title: 'Error fetching listings',
            description: error.message,
          });
          return [];
        }
      });
    },
    enabled: !!(authChecked && user && user.is_admin),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (error?.message?.includes('Admin authentication')) {
        return false; // Don't retry auth errors
      }
      return failureCount < 2;
    },
  });
}
