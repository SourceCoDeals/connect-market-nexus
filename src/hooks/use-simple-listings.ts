import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PaginationState } from './use-simple-pagination';
import { Listing, ListingStatus } from '@/types';
import { expandLocations } from '@/lib/location-hierarchy';

async function fetchListings(state: PaginationState) {
  console.log('🔍 Fetching listings for state:', state);

  let query = supabase
    .from('listings')
    .select('*', { count: 'exact' })
    .eq('status', 'active')
    .is('deleted_at', null)
    .eq('is_internal_deal', false); // Only show marketplace deals, not internal/research deals

  // Apply filters
  if (state.search) {
    query = query.or(`title.ilike.%${state.search}%,description.ilike.%${state.search}%,category.ilike.%${state.search}%`);
  }
  
  if (state.category && state.category !== 'all') {
    // Support both single category field and categories array
    query = query.or(`category.eq.${state.category},categories.cs.{${state.category}}`);
  }
  
  if (state.location && state.location !== 'all') {
    // Use location hierarchy expansion for better filtering
    const expandedLocations = expandLocations([state.location]);
    query = query.in('location', expandedLocations);
  }
  
  if (state.revenueMin !== undefined) {
    query = query.gte('revenue', state.revenueMin);
  }
  
  if (state.revenueMax !== undefined) {
    query = query.lte('revenue', state.revenueMax);
  }
  
  if (state.ebitdaMin !== undefined) {
    query = query.gte('ebitda', state.ebitdaMin);
  }
  
  if (state.ebitdaMax !== undefined) {
    query = query.lte('ebitda', state.ebitdaMax);
  }

  // Apply pagination
  const offset = (state.page - 1) * state.perPage;
  console.log('📊 Pagination:', { page: state.page, perPage: state.perPage, offset });
  query = query.range(offset, offset + state.perPage - 1);

  // Order by creation date
  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const listings: Listing[] = (data || []).map(listing => ({
    ...listing,
    status: listing.status as ListingStatus,
    metric_3_type: (listing.metric_3_type as 'employees' | 'custom') || 'employees',
    ownerNotes: listing.owner_notes || '',
    createdAt: listing.created_at,
    updatedAt: listing.updated_at,
    revenueFormatted: `$${(listing.revenue / 1000000).toFixed(1)}M`,
    ebitdaFormatted: `$${(listing.ebitda / 1000000).toFixed(1)}M`,
    multiples: {
      revenue: listing.ebitda > 0 ? (listing.revenue / listing.ebitda).toFixed(1) : 'N/A',
      value: listing.ebitda > 0 ? (listing.revenue / listing.ebitda).toFixed(1) : 'N/A',
    },
  }));

  console.log('✅ Fetched listings:', { count: listings.length, totalItems: count });

  return {
    listings,
    totalItems: count || 0,
  };
}

async function fetchMetadata() {
  let query = supabase
    .from('listings')
    .select('category, location')
    .eq('status', 'active')
    .is('deleted_at', null)
    .eq('is_internal_deal', false); // Only show marketplace deals

  const { data: listings, error } = await query;

  if (error) {
    throw error;
  }

  const categories = [...new Set(listings?.map(l => l.category).filter(Boolean))] as string[];
  const locations = [...new Set(listings?.map(l => l.location).filter(Boolean))] as string[];

  return { categories, locations };
}

export function useSimpleListings(state: PaginationState) {
  console.log('🎯 [LISTINGS] Hook called with state:', state);
  
  return useQuery({
    queryKey: ['simple-listings', state.page, state.perPage, state.search, state.category, state.location, state.revenueMin, state.revenueMax, state.ebitdaMin, state.ebitdaMax],
    queryFn: () => {
      console.log('📡 [LISTINGS] Fetching data for state:', state);
      console.time('listings-fetch');
      return fetchListings(state).finally(() => {
        console.timeEnd('listings-fetch');
      });
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useListingMetadata() {
  return useQuery({
    queryKey: ['listing-metadata'],
    queryFn: fetchMetadata,
    staleTime: 300000, // 5 minutes
  });
}