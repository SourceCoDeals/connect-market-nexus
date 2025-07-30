import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PaginationState } from './use-simple-pagination';
import { Listing, ListingStatus } from '@/types';

async function fetchListings(state: PaginationState) {
  console.log('🔍 Fetching listings for state:', state);
  let query = supabase
    .from('listings')
    .select('*', { count: 'exact' })
    .eq('status', 'active')
    .is('deleted_at', null);

  // Apply filters
  if (state.search) {
    query = query.or(`title.ilike.%${state.search}%,description.ilike.%${state.search}%,category.ilike.%${state.search}%`);
  }
  
  if (state.category) {
    query = query.eq('category', state.category);
  }
  
  if (state.location) {
    query = query.eq('location', state.location);
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
  const { data: listings, error } = await supabase
    .from('listings')
    .select('category, location')
    .eq('status', 'active')
    .is('deleted_at', null);

  if (error) {
    throw error;
  }

  const categories = [...new Set(listings?.map(l => l.category).filter(Boolean))] as string[];
  const locations = [...new Set(listings?.map(l => l.location).filter(Boolean))] as string[];

  return { categories, locations };
}

export function useSimpleListings(state: PaginationState) {
  return useQuery({
    queryKey: ['simple-listings', state],
    queryFn: () => fetchListings(state),
    staleTime: 5000, // Reduce stale time for more responsive pagination
    gcTime: 10000, // Garbage collect after 10 seconds
    refetchOnWindowFocus: false,
  });
}

export function useListingMetadata() {
  return useQuery({
    queryKey: ['listing-metadata'],
    queryFn: fetchMetadata,
    staleTime: 300000, // 5 minutes
  });
}