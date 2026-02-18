
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { withPerformanceMonitoring } from '@/lib/performance-monitor';
import { useAuth } from '@/context/AuthContext';
import { useTabAwareQuery } from '@/hooks/use-tab-aware-query';

/**
 * Hook for fetching admin listings with status filtering and soft delete support
 */
export function useListingsQuery(status?: 'active' | 'inactive' | 'all') {
  const { user, authChecked } = useAuth();

  // Get cached auth state for more stable query enabling
  const cachedAuthState = (() => {
    try {
      const cached = localStorage.getItem('user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  })();

  const isAdminUser = user?.is_admin === true || cachedAuthState?.is_admin === true;
  const shouldEnable = (authChecked || cachedAuthState) && isAdminUser;

  return useTabAwareQuery(
    ['admin-listings', status],
    async () => {
      return withPerformanceMonitoring('admin-listings-query', async () => {
        try {
          // Fetching listings with admin permissions

          // Simple admin check using either current or cached state
          if (!isAdminUser) {
            throw new Error('Admin authentication required');
          }
          
          let query = supabase
            .from('listings')
            .select('*, hero_description')
            .is('deleted_at', null);
          
          if (status && status !== 'all') {
            query = query.eq('status', status);
          }
          
          const { data, error } = await query.order('created_at', { ascending: false });

          if (error) {
            console.error('❌ Supabase error fetching admin listings:', error);
            throw error;
          }
          
          // Retrieved listings with status filter
          
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
    {
      enabled: shouldEnable,
      staleTime: 1000 * 60 * 2,
      // Remove refetchOnWindowFocus - let global settings handle this
      retry: (failureCount, error) => {
        if (error?.message?.includes('Admin authentication')) {
          return false;
        }
        return failureCount < 2;
      },
    }
  );
}
