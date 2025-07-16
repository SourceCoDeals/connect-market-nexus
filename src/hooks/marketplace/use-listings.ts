
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FilterOptions, Listing, ListingStatus } from '@/types';

// Fetch listings with filters and pagination
export const useListings = (filters: FilterOptions = {}) => {
  return useQuery({
    queryKey: ['marketplace-listings', filters],
    queryFn: async () => {
      try {
        console.log('Fetching marketplace listings with filters:', filters);
        
        // Start building the query
        let query = supabase
          .from('listings')
          .select('*', { count: 'exact' });
        
        // Always filter to only show active listings in the marketplace
        query = query.eq('status', 'active');
        
        // Apply filters if provided
        if (filters.category) {
          query = query.eq('category', filters.category);
        }
        
        if (filters.location) {
          query = query.eq('location', filters.location);
        }
        
        if (filters.revenueMin !== undefined) {
          query = query.gte('revenue', filters.revenueMin);
        }
        
        if (filters.revenueMax !== undefined) {
          query = query.lte('revenue', filters.revenueMax);
        }
        
        if (filters.ebitdaMin !== undefined) {
          query = query.gte('ebitda', filters.ebitdaMin);
        }
        
        if (filters.ebitdaMax !== undefined) {
          query = query.lte('ebitda', filters.ebitdaMax);
        }
        
        if (filters.search) {
          query = query.ilike('title', `%${filters.search}%`);
        }
        
        // Apply pagination
        const page = filters.page || 1;
        const perPage = filters.perPage || 20;
        const start = (page - 1) * perPage;
        const end = start + perPage - 1;
        
        query = query
          .order('created_at', { ascending: false })
          .range(start, end);
        
        // Execute the query
        const { data, error, count } = await query;
        
        if (error) {
          console.error('Error fetching marketplace listings:', error);
          throw error;
        }
        
        console.log(`Successfully fetched ${data?.length || 0} listings from marketplace`);
        
        // Transform data to include computed properties
        const listings = data?.map((item: any) => {
          const listing: Listing = {
            ...item,
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
        
        return {
          listings: listings || [],
          totalCount: count || 0
        };
      } catch (error: any) {
        console.error('Error in useListings:', error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false, // Prevent excessive refetching
  });
};

// Get a single listing by ID
export const useListing = (id: string | undefined) => {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: async () => {
      if (!id) return null;
      
      try {
        console.log('Fetching single listing:', id);
        
        const { data, error } = await supabase
          .from('listings')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching single listing:', error);
          throw error;
        }
        
        if (!data) {
          console.log('No listing found with id:', id);
          return null;
        }
        
        console.log('Successfully fetched listing:', data.title);
        
        // Transform to Listing type with computed properties
        const listing: Listing = {
          ...data,
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
        console.error('Error in useListing:', error);
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
        console.log('Fetching listing metadata');
        
        // Only query active listings for metadata
        const { data, error } = await supabase
          .from('listings')
          .select('category, location')
          .eq('status', 'active');
        
        if (error) {
          console.error('Error fetching listing metadata:', error);
          throw error;
        }
        
        // Extract unique categories and locations
        const categories = [...new Set(data.map(item => item.category))].filter(Boolean).sort();
        const locations = [...new Set(data.map(item => item.location))].filter(Boolean).sort();
        
        console.log('Fetched metadata - Categories:', categories.length, 'Locations:', locations.length);
        
        return { categories, locations };
      } catch (error: any) {
        console.error('Error in useListingMetadata:', error);
        return { categories: [], locations: [] };
      }
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
    refetchOnWindowFocus: false,
  });
};
