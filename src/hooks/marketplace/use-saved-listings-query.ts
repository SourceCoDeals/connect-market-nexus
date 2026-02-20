
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Listing, FilterOptions } from '@/types';
import { createQueryKey } from '@/lib/query-keys';

export const useSavedListings = (filters: FilterOptions = {}) => {
  return useQuery({
    queryKey: createQueryKey.savedListings(filters),
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
          .eq('status', 'active')
          .is('deleted_at', null)
          .eq('is_internal_deal', false);
        
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
        
        const { data: rawListings, error, count } = await query;
        
        if (error) throw error;
        
        // Transform raw database response to Listing interface with computed properties
        const listings = (rawListings || []).map((rawListing: any) => ({
          ...rawListing,
          // Add computed properties as getters
          get ownerNotes() { return rawListing.owner_notes || ''; },
          get createdAt() { return rawListing.created_at; },
          get updatedAt() { return rawListing.updated_at; },
          get multiples() {
            if (rawListing.revenue && rawListing.ebitda) {
              const revenueMultiple = (rawListing.ebitda / rawListing.revenue).toFixed(2);
              return {
                revenue: `${revenueMultiple}x`,
                value: `${revenueMultiple}x Revenue Multiple`
              };
            }
            return undefined;
          },
          get revenueFormatted() {
            return new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(rawListing.revenue || 0);
          },
          get ebitdaFormatted() {
            return new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(rawListing.ebitda || 0);
          }
        })) as Listing[];
        
        return {
          listings,
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
