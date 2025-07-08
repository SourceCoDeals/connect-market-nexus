
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Listing, FilterOptions } from '@/types';

export const useSavedListings = (filters: FilterOptions = {}) => {
  return useQuery({
    queryKey: ['saved-listings', filters],
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('You must be logged in to view saved listings');
        
        const userId = session.user.id;
        
        // Get saved listing IDs for the user
        const { data: savedListings, error: savedError } = await supabase
          .from('saved_listings')
          .select('listing_id')
          .eq('user_id', userId);
        
        if (savedError) throw savedError;
        
        if (!savedListings || savedListings.length === 0) {
          return { listings: [], totalCount: 0 };
        }
        
        const listingIds = savedListings.map(sl => sl.listing_id);
        
        // Build the query for listings
        let query = supabase
          .from('listings')
          .select('*', { count: 'exact' })
          .in('id', listingIds)
          .eq('status', 'active');
        
        // Apply filters
        if (filters.category) {
          query = query.eq('category', filters.category);
        }
        
        if (filters.location) {
          query = query.eq('location', filters.location);
        }
        
        if (filters.revenueMin) {
          query = query.gte('revenue', filters.revenueMin);
        }
        
        if (filters.revenueMax) {
          query = query.lte('revenue', filters.revenueMax);
        }
        
        if (filters.ebitdaMin) {
          query = query.gte('ebitda', filters.ebitdaMin);
        }
        
        if (filters.ebitdaMax) {
          query = query.lte('ebitda', filters.ebitdaMax);
        }
        
        if (filters.search) {
          query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
        }
        
        // Apply pagination
        const page = filters.page || 1;
        const perPage = filters.perPage || 20;
        const from = (page - 1) * perPage;
        const to = from + perPage - 1;
        
        query = query.range(from, to);
        
        // Order by created_at desc
        query = query.order('created_at', { ascending: false });
        
        const { data: listings, error, count } = await query;
        
        if (error) throw error;
        
        return {
          listings: listings as Listing[],
          totalCount: count || 0
        };
      } catch (error: any) {
        console.error('Error fetching saved listings:', error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
