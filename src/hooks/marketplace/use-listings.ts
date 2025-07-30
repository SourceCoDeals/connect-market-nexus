
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FilterOptions, Listing, ListingStatus } from '@/types';
import { withPerformanceMonitoring } from '@/lib/performance-monitor';
import { useAuth } from '@/context/AuthContext';

// Fetch listings with filters and pagination
export const useListings = (filters: FilterOptions = {}) => {
  const { user, authChecked } = useAuth();
  
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: async () => {
      return withPerformanceMonitoring('marketplace-listings-query', async () => {
        try {
          console.log('🔍 Fetching marketplace listings with filters:', filters);
          console.log('🔐 Auth state:', {
            authChecked,
            user: user?.email,
            email_verified: user?.email_verified,
            approval_status: user?.approval_status,
            is_admin: user?.is_admin
          });

          // Simple auth check - must have user with verified email
          if (!user || !user.email_verified) {
            console.log('❌ User not authenticated or email not verified');
            throw new Error('Authentication required');
          }

          // Allow admin users to always see listings, require approval for regular users
          if (!user.is_admin && user.approval_status !== 'approved') {
            console.log('❌ User not approved (and not admin)');
            throw new Error('User approval required');
          }
          
          // Start building the query
          let query = supabase
            .from('listings')
            .select('*', { count: 'exact' });
          
          // Always filter to only show active, non-deleted listings in the marketplace
          query = query
            .eq('status', 'active')
            .is('deleted_at', null);
          
          console.log('🔍 Base query: SELECT * FROM listings WHERE status = active AND deleted_at IS NULL');
          
          // Apply filters if provided - only apply filters that have actual values
          if (filters.category) {
            // Check both the old category field and new categories array
            query = query.or(`category.eq.${filters.category},categories.cs.{${filters.category}}`);
            console.log('🔍 Added category filter:', filters.category);
          }
          
          if (filters.location) {
            query = query.eq('location', filters.location);
            console.log('🔍 Added location filter:', filters.location);
          }
          
          if (filters.search) {
            query = query.ilike('title', `%${filters.search}%`);
            console.log('🔍 Added search filter:', filters.search);
          }
          
          // Apply revenue filters
          if (filters.revenueMin !== undefined) {
            query = query.gte('revenue', filters.revenueMin);
            console.log('🔍 Added revenue min filter:', filters.revenueMin);
          }
          
          if (filters.revenueMax !== undefined) {
            query = query.lte('revenue', filters.revenueMax);
            console.log('🔍 Added revenue max filter:', filters.revenueMax);
          }
          
          // Apply EBITDA filters
          if (filters.ebitdaMin !== undefined) {
            query = query.gte('ebitda', filters.ebitdaMin);
            console.log('🔍 Added EBITDA min filter:', filters.ebitdaMin);
          }
          
          if (filters.ebitdaMax !== undefined) {
            query = query.lte('ebitda', filters.ebitdaMax);
            console.log('🔍 Added EBITDA max filter:', filters.ebitdaMax);
          }
          
          // Apply pagination
          const page = filters.page || 1;
          const perPage = filters.perPage || 20;
          const start = (page - 1) * perPage;
          const end = start + perPage - 1;
          
          query = query
            .order('created_at', { ascending: false })
            .range(start, end);
          
          console.log('🔍 Added pagination:', { page, perPage, start, end });
          
          // Execute the query
          const { data, error, count } = await query;
          
          if (error) {
            console.error('❌ Error fetching marketplace listings:', error);
            console.error('❌ Error details:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
            throw error;
          }
          
          console.log(`✅ Successfully fetched ${data?.length || 0} listings from marketplace`);
          console.log('📊 Total count from database:', count);
          
          if (!data || data.length === 0) {
            console.log('⚠️ No data returned from query');
            return {
              listings: [],
              totalCount: count || 0
            };
          }
          
          // Transform data to include computed properties
          const listings = data?.map((item: any) => {
            const listing: Listing = {
              ...item,
              // Ensure categories is always an array, fallback to single category
              categories: item.categories || (item.category ? [item.category] : []),
              // Add computed properties
              ownerNotes: item.owner_notes || '',
              createdAt: item.created_at,
              updatedAt: item.updated_at,
              // Ensure status is properly typed as ListingStatus
              status: item.status as ListingStatus,
              multiples: item.revenue > 0 ? {
                revenue: (item.ebitda / item.revenue).toFixed(2),
                value: '0'
              } : undefined,
              revenueFormatted: new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(item.revenue),
              ebitdaFormatted: new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(item.ebitda),
            };
            
            return listing;
          });
          
          console.log(`🎯 Final result: ${listings?.length || 0} listings ready for marketplace`);
          
          return {
            listings: listings || [],
            totalCount: count || 0
          };
        } catch (error: any) {
          console.error('💥 Error in useListings:', error);
          throw error;
        }
      });
    },
    enabled: !!(user && user.email_verified && (user.approval_status === 'approved' || user.is_admin)), // Remove authChecked dependency
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
    retryDelay: 1000,
  });
};

// Get a single listing by ID
export const useListing = (id: string | undefined) => {
  const { user, authChecked } = useAuth();
  
  return useQuery({
    queryKey: ['listing', id],
    queryFn: async () => {
      if (!id) return null;
      
      return withPerformanceMonitoring('single-listing-query', async () => {
        try {
          console.log('🔍 Fetching single listing:', id);
          console.log('🔐 Auth state for single listing:', {
            authChecked,
            user: user?.email,
            email_verified: user?.email_verified,
            approval_status: user?.approval_status
          });

          // Simple auth check for single listings
          if (!user || !user.email_verified) {
            throw new Error('Authentication required for single listing');
          }
          
          const { data, error } = await supabase
            .from('listings')
            .select('*')
            .eq('id', id)
            .is('deleted_at', null)
            .maybeSingle();
          
          if (error) {
            console.error('❌ Error fetching single listing:', error);
            throw error;
          }
          
          if (!data) {
            console.log('⚠️ No non-deleted listing found with id:', id);
            return null;
          }
          
          console.log('✅ Successfully fetched listing:', data.title);
          
          // Transform to Listing type with computed properties
          const listing: Listing = {
            ...data,
            categories: data.categories || (data.category ? [data.category] : []),
            ownerNotes: data.owner_notes || '',
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            status: data.status as ListingStatus,
            multiples: data.revenue > 0 ? {
              revenue: (data.ebitda / data.revenue).toFixed(2),
              value: '0'
            } : undefined,
            revenueFormatted: new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(data.revenue),
            ebitdaFormatted: new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(data.ebitda),
          };
          
          return listing;
        } catch (error: any) {
          console.error('💥 Error in useListing:', error);
          throw error;
        }
      });
    },
    enabled: !!(id && user && user.email_verified && (user.approval_status === 'approved' || user.is_admin)), // Remove authChecked dependency
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

// Get listing metadata for filters (categories, locations)
export const useListingMetadata = () => {
  const { user, authChecked } = useAuth();
  
  return useQuery({
    queryKey: ['listing-metadata'],
    queryFn: async () => {
      return withPerformanceMonitoring('listing-metadata-query', async () => {
        try {
          console.log('🔍 Fetching listing metadata');
          console.log('🔐 Auth state for metadata:', {
            authChecked,
            user: user?.email,
            email_verified: user?.email_verified,
            approval_status: user?.approval_status
          });

          // Simple auth check for metadata
          if (!user || !user.email_verified) {
            throw new Error('Authentication required for metadata');
          }
          
          const { data, error } = await supabase
            .from('listings')
            .select('category, categories, location')
            .eq('status', 'active')
            .is('deleted_at', null);
          
          if (error) {
            console.error('❌ Error fetching listing metadata:', error);
            throw error;
          }
          
          console.log('📊 Metadata raw data:', data);
          
          const allCategories = new Set<string>();
          data.forEach(item => {
            if (item.category) allCategories.add(item.category);
            if (item.categories) {
              item.categories.forEach((cat: string) => allCategories.add(cat));
            }
          });
          
          const categories = Array.from(allCategories).filter(Boolean).sort();
          const locations = [...new Set(data.map(item => item.location))].filter(Boolean).sort();
          
          console.log('✅ Fetched metadata - Categories:', categories, 'Locations:', locations);
          
          return { categories, locations };
        } catch (error: any) {
          console.error('💥 Error in useListingMetadata:', error);
          return { categories: [], locations: [] };
        }
      });
    },
    enabled: !!(user && user.email_verified && (user.approval_status === 'approved' || user.is_admin)), // Remove authChecked dependency
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
