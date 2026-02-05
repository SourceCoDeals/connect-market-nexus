
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FilterOptions, Listing, ListingStatus } from '@/types';
import { withPerformanceMonitoring } from '@/lib/performance-monitor';
import { useAuth } from '@/context/AuthContext';
import { toStandardCategory, toStandardLocation } from '@/lib/standardization';

// Fetch listings with filters and pagination
export const useListings = (filters: FilterOptions = {}) => {
  const { user, authChecked } = useAuth();
  
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: async () => {
      return withPerformanceMonitoring('marketplace-listings-query', async () => {
        try {
          // Fetching marketplace listings with filters

          // Simple auth check - must have user with verified email
          if (!user || !user.email_verified) {
            // User not authenticated or email not verified
            throw new Error('Authentication required');
          }

          // Allow admin users to always see listings, require approval for regular users
          if (!user.is_admin && user.approval_status !== 'approved') {
            // User not approved (and not admin)
            throw new Error('User approval required');
          }
          
          // Start building the query
          let query = supabase
            .from('listings')
            .select('*, hero_description', { count: 'exact' });
          
          // Always filter to only show active, non-deleted listings in the marketplace
          query = query
            .eq('status', 'active')
            .is('deleted_at', null)
            .eq('is_internal_deal', false); // Only show marketplace deals, not internal/research deals
          
          // Base query: SELECT * FROM listings WHERE status = active AND deleted_at IS NULL
          
          // Apply filters if provided - only apply filters that have actual values
          if (filters.category) {
            // Apply standardization before querying - check both standardized and original values
            const standardizedCategory = toStandardCategory(filters.category);
            const categoryQueries = [`category.eq.${filters.category}`, `categories.cs.{${filters.category}}`];
            
            // If standardized version is different, also search for that
            if (standardizedCategory !== filters.category) {
              categoryQueries.push(`category.eq.${standardizedCategory}`, `categories.cs.{${standardizedCategory}}`);
            }
            
            query = query.or(categoryQueries.join(','));
            // Added category filter with standardization
          }
          
          if (filters.location) {
            // Apply standardization before querying - check both standardized and original values
            const standardizedLocation = toStandardLocation(filters.location);
            const locationQueries = [`location.eq.${filters.location}`];
            
            // If standardized version is different, also search for that
            if (standardizedLocation !== filters.location) {
              locationQueries.push(`location.eq.${standardizedLocation}`);
            }
            
            query = query.or(locationQueries.join(','));
            // Added location filter with standardization
          }
          
          if (filters.search) {
            query = query.ilike('title', `%${filters.search}%`);
            // Added search filter
          }
          
          // Apply revenue filters
          if (filters.revenueMin !== undefined) {
            query = query.gte('revenue', filters.revenueMin);
            // Added revenue min filter
          }
          
          if (filters.revenueMax !== undefined) {
            query = query.lte('revenue', filters.revenueMax);
            // Added revenue max filter
          }
          
          // Apply EBITDA filters
          if (filters.ebitdaMin !== undefined) {
            query = query.gte('ebitda', filters.ebitdaMin);
            // Added EBITDA min filter
          }
          
          if (filters.ebitdaMax !== undefined) {
            query = query.lte('ebitda', filters.ebitdaMax);
            // Added EBITDA max filter
          }
          
          // Apply pagination
          const page = filters.page || 1;
          const perPage = filters.perPage || 20;
          const start = (page - 1) * perPage;
          const end = start + perPage - 1;
          
          query = query
            .order('created_at', { ascending: false })
            .range(start, end);
          
          // Added pagination
          
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
          
          // Successfully fetched listings from marketplace
          
          if (!data || data.length === 0) {
            // No data returned from query
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
          
          // Final result ready for marketplace
          
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
          // Fetching single listing

          // Simple auth check for single listings
          if (!user || !user.email_verified) {
            throw new Error('Authentication required for single listing');
          }
          
          const { data, error } = await supabase
            .from('listings')
            .select('*, hero_description')
            .eq('id', id)
            .is('deleted_at', null)
            .maybeSingle();
          
          if (error) {
            console.error('❌ Error fetching single listing:', error);
            throw error;
          }
          
          if (!data) {
            // No non-deleted listing found
            return null;
          }
          
          // Successfully fetched listing
          
          // Transform to Listing type with computed properties
          const listing: Listing = {
            ...data,
            categories: data.categories || (data.category ? [data.category] : []),
            metric_3_type: (data.metric_3_type as 'employees' | 'custom') || 'employees',
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

// Get listing metadata for filters (categories, locations) using standardized constants
export const useListingMetadata = () => {
  const { user, authChecked } = useAuth();
  
  return useQuery({
    queryKey: ['listing-metadata'],
    queryFn: async () => {
      return withPerformanceMonitoring('listing-metadata-query', async () => {
        try {
          // Use standardized constants directly for consistent filtering
          // This ensures all filter options are always available and properly standardized
          const { STANDARDIZED_CATEGORIES, STANDARDIZED_LOCATIONS } = await import('@/lib/financial-parser');
          
          return { 
            categories: STANDARDIZED_CATEGORIES, 
            locations: STANDARDIZED_LOCATIONS 
          };
        } catch (error: any) {
          console.error('💥 Error in useListingMetadata:', error);
          // Fallback to hardcoded arrays if import fails
          return { 
            categories: ['Technology', 'Healthcare', 'Manufacturing', 'Retail', 'Financial Services'], 
            locations: ['United States', 'Canada', 'United Kingdom', 'Germany', 'France'] 
          };
        }
      });
    },
    enabled: !!(user && user.email_verified && (user.approval_status === 'approved' || user.is_admin)),
    staleTime: 1000 * 60 * 60, // 1 hour - these are static constants
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
