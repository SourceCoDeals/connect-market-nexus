
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FilterOptions, Listing, ListingStatus } from '@/types';

// Fetch listings with filters and pagination
export const useListings = (filters: FilterOptions = {}) => {
  return useQuery({
    queryKey: ['marketplace-listings', filters],
    queryFn: async () => {
      try {
        console.log('🔍 Fetching marketplace listings with filters:', filters);
        
        // Start building the query
        let query = supabase
          .from('listings')
          .select('*', { count: 'exact' });
        
        // Always filter to only show active listings in the marketplace
        query = query.eq('status', 'active');
        
        console.log('🔍 Base query: SELECT * FROM listings WHERE status = active');
        
        // Apply filters if provided
        if (filters.category) {
          // Check both the old category field and new categories array
          query = query.or(`category.eq.${filters.category},categories.cs.{${filters.category}}`);
          console.log('🔍 Added category filter:', filters.category);
        }
        
        if (filters.location) {
          query = query.eq('location', filters.location);
          console.log('🔍 Added location filter:', filters.location);
        }
        
        if (filters.revenueMin !== undefined) {
          query = query.gte('revenue', filters.revenueMin);
          console.log('🔍 Added revenue min filter:', filters.revenueMin);
        }
        
        if (filters.revenueMax !== undefined) {
          query = query.lte('revenue', filters.revenueMax);
          console.log('🔍 Added revenue max filter:', filters.revenueMax);
        }
        
        if (filters.ebitdaMin !== undefined) {
          query = query.gte('ebitda', filters.ebitdaMin);
          console.log('🔍 Added ebitda min filter:', filters.ebitdaMin);
        }
        
        if (filters.ebitdaMax !== undefined) {
          query = query.lte('ebitda', filters.ebitdaMax);
          console.log('🔍 Added ebitda max filter:', filters.ebitdaMax);
        }
        
        if (filters.search) {
          query = query.ilike('title', `%${filters.search}%`);
          console.log('🔍 Added search filter:', filters.search);
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
          throw error;
        }
        
        console.log(`✅ Successfully fetched ${data?.length || 0} listings from marketplace`);
        console.log('📊 Total count from database:', count);
        
        // Log each listing for debugging
        data?.forEach((listing, index) => {
          console.log(`📋 Listing ${index + 1}:`, {
            id: listing.id,
            title: listing.title,
            status: listing.status,
            category: listing.category,
            categories: listing.categories,
            location: listing.location,
            revenue: listing.revenue,
            ebitda: listing.ebitda,
            created_at: listing.created_at
          });
        });
        
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
          
          console.log(`🔄 Transformed listing:`, {
            id: listing.id,
            title: listing.title,
            status: listing.status,
            categories: listing.categories,
            revenueFormatted: listing.revenueFormatted,
            ebitdaFormatted: listing.ebitdaFormatted
          });
          
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
    },
    staleTime: 0, // Always consider data stale to ensure fresh fetches
    gcTime: 1000 * 60 * 2, // Keep in cache for 2 minutes to prevent excessive refetches
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    refetchInterval: false, // Don't auto-refetch on interval
  });
};

// Get a single listing by ID
export const useListing = (id: string | undefined) => {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: async () => {
      if (!id) return null;
      
      try {
        console.log('🔍 Fetching single listing:', id);
        
        const { data, error } = await supabase
          .from('listings')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        
        if (error) {
          console.error('❌ Error fetching single listing:', error);
          throw error;
        }
        
        if (!data) {
          console.log('⚠️ No listing found with id:', id);
          return null;
        }
        
        console.log('✅ Successfully fetched listing:', data.title);
        
        // Transform to Listing type with computed properties
        const listing: Listing = {
          ...data,
          // Ensure categories is always an array, fallback to single category
          categories: data.categories || (data.category ? [data.category] : []),
          // Add computed properties
          ownerNotes: data.owner_notes || '',
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          // Ensure status is properly typed as ListingStatus
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
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Get listing metadata for filters (categories, locations)
export const useListingMetadata = () => {
  return useQuery({
    queryKey: ['listing-metadata'],
    queryFn: async () => {
      try {
        console.log('🔍 Fetching listing metadata');
        
        // Only query active listings for metadata
        const { data, error } = await supabase
          .from('listings')
          .select('category, categories, location')
          .eq('status', 'active');
        
        if (error) {
          console.error('❌ Error fetching listing metadata:', error);
          throw error;
        }
        
        console.log('📊 Metadata raw data:', data);
        
        // Extract unique categories from both old and new fields
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
    },
    staleTime: 1000 * 60 * 5, // 5 minutes for metadata
    refetchOnWindowFocus: false,
  });
};
