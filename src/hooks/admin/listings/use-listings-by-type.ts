import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminListing } from '@/types/admin';
import { toast } from '@/hooks/use-toast';
import { withPerformanceMonitoring } from '@/lib/performance-monitor';
import { useAuth } from '@/context/AuthContext';
import { useTabAwareQuery } from '@/hooks/use-tab-aware-query';

export type ListingType = 'marketplace' | 'drafts';

/**
 * Hook for fetching admin listings filtered by type:
 * - marketplace: Public-facing listings (is_internal_deal = false, has image)
 * - drafts: Internal/draft listings (is_internal_deal = true, has image)
 */
export function useListingsByType(type: ListingType, status?: 'active' | 'inactive' | 'archived' | 'all') {
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
    ['admin-listings', type, status],
    async () => {
      return withPerformanceMonitoring(`admin-listings-${type}-query`, async () => {
        try {
          if (!isAdminUser) {
            throw new Error('Admin authentication required');
          }
          
          let query = supabase
            .from('listings')
            .select('*, hero_description')
            .is('deleted_at', null)
            .not('image_url', 'is', null)
            .neq('image_url', '');
          
          // Filter by listing type
          if (type === 'marketplace') {
            query = query.eq('is_internal_deal', false);
          } else {
            query = query.eq('is_internal_deal', true);
          }
          
          // Apply status filter if provided
          if (status && status !== 'all') {
            query = query.eq('status', status);
          }
          
          const { data, error } = await query.order('created_at', { ascending: false });

          if (error) {
            console.error('❌ Supabase error fetching listings by type:', error);
            throw error;
          }
          
          const mappedData = data?.map(listing => ({
            ...listing,
            categories: listing.categories || (listing.category ? [listing.category] : [])
          }));
          
          return mappedData as AdminListing[];
        } catch (error: any) {
          console.error('💥 Error fetching listings by type:', error);
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
      retry: (failureCount, error) => {
        if (error?.message?.includes('Admin authentication')) {
          return false;
        }
        return failureCount < 2;
      },
    }
  );
}

/**
 * Hook to get counts for both listing types
 */
export function useListingTypeCounts() {
  const { user, authChecked } = useAuth();

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
    ['admin-listings-counts'],
    async () => {
      if (!isAdminUser) {
        return { marketplace: 0, drafts: 0 };
      }

      const [marketplaceResult, draftsResult] = await Promise.all([
        supabase
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null)
          .not('image_url', 'is', null)
          .neq('image_url', '')
          .eq('is_internal_deal', false),
        supabase
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null)
          .not('image_url', 'is', null)
          .neq('image_url', '')
          .eq('is_internal_deal', true)
      ]);

      return {
        marketplace: marketplaceResult.count || 0,
        drafts: draftsResult.count || 0
      };
    },
    {
      enabled: shouldEnable,
      staleTime: 1000 * 60 * 2,
    }
  );
}
