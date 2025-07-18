
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FilterOptions, Listing } from '@/types';

export function useListings(filters: FilterOptions) {
  return useQuery({
    queryKey: ['marketplace-listings', filters],
    queryFn: async () => {
      let query = supabase
        .from('listings')
        .select('*')
        .is('deleted_at', null)
        .eq('status', 'active');

      // Apply filters
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters.location) {
        query = query.eq('location', filters.location);
      }
      
      if (filters.minRevenue) {
        query = query.gte('revenue', filters.minRevenue);
      }
      
      if (filters.maxRevenue) {
        query = query.lte('revenue', filters.maxRevenue);
      }
      
      if (filters.minEbitda) {
        query = query.gte('ebitda', filters.minEbitda);
      }
      
      if (filters.maxEbitda) {
        query = query.lte('ebitda', filters.maxEbitda);
      }

      // Add pagination
      const page = filters.page || 1;
      const perPage = filters.perPage || 20;
      const start = (page - 1) * perPage;
      const end = start + perPage - 1;

      // Get total count for pagination
      const { count } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('status', 'active');

      // Get paginated results
      const { data, error } = await query
        .range(start, end)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching listings:', error);
        throw error;
      }

      return {
        listings: data?.map(listing => ({
          ...listing,
          ownerNotes: listing.owner_notes || '',
          createdAt: listing.created_at,
          updatedAt: listing.updated_at,
        })) as Listing[] || [],
        totalCount: count || 0
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes  
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export function useListing(id: string) {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) {
        console.error('Error fetching listing:', error);
        throw error;
      }

      return {
        ...data,
        ownerNotes: data.owner_notes || '',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      } as Listing;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: !!id,
  });
}

export function useListingMetadata() {
  return useQuery({
    queryKey: ['listing-metadata'],
    queryFn: async () => {
      // Get unique categories
      const { data: categoriesData } = await supabase
        .from('listings')
        .select('category')
        .is('deleted_at', null)
        .eq('status', 'active');

      // Get unique locations
      const { data: locationsData } = await supabase
        .from('listings')
        .select('location')
        .is('deleted_at', null)
        .eq('status', 'active');

      const categories = [...new Set(categoriesData?.map(item => item.category) || [])];
      const locations = [...new Set(locationsData?.map(item => item.location) || [])];

      return { categories, locations };
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
