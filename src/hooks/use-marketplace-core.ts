import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FilterOptions, Listing, PaginationState } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useAnalyticsTracking } from '@/hooks/use-analytics-tracking';
import { withPerformanceMonitoring } from '@/lib/performance-monitor';

interface MarketplaceCoreState {
  page: number;
  perPage: number;
  search: string;
  category: string;
  location: string;
  revenueMin?: number;
  revenueMax?: number;
  ebitdaMin?: number;
  ebitdaMax?: number;
  viewType: 'grid' | 'list';
}

// Initial state
const initialState: MarketplaceCoreState = {
  page: 1,
  perPage: 20,
  search: '',
  category: '',
  location: '',
  viewType: 'grid',
};

// Convert state to stable query key
const createQueryKey = (state: MarketplaceCoreState) => [
  'marketplace-listings',
  state.page,
  state.perPage,
  state.search,
  state.category,
  state.location,
  state.revenueMin,
  state.revenueMax,
  state.ebitdaMin,
  state.ebitdaMax,
];

// Fetch listings function
const fetchListings = async (state: MarketplaceCoreState, user: any) => {
  return withPerformanceMonitoring('marketplace-listings-query', async () => {
    console.log('🔍 Fetching listings with state:', state);
    
    // Auth checks
    if (!user || !user.email_verified) {
      throw new Error('Authentication required');
    }
    
    if (!user.is_admin && user.approval_status !== 'approved') {
      throw new Error('User approval required');
    }
    
    // Build query
    let query = supabase
      .from('listings')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .is('deleted_at', null);
    
    // Apply filters
    if (state.category) {
      query = query.or(`category.eq.${state.category},categories.cs.{${state.category}}`);
    }
    
    if (state.location) {
      query = query.eq('location', state.location);
    }
    
    if (state.search) {
      query = query.ilike('title', `%${state.search}%`);
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
    
    // Add pagination
    const offset = (state.page - 1) * state.perPage;
    query = query.range(offset, offset + state.perPage - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('❌ Query error:', error);
      throw error;
    }
    
    console.log(`✅ Fetched ${data?.length || 0} listings (total: ${count})`);
    
    // Transform data to match Listing interface
    const transformedListings: Listing[] = (data || []).map((item: any) => {
      const listing: Listing = {
        ...item,
        // Ensure categories is always an array
        categories: item.categories || (item.category ? [item.category] : []),
        // Add computed properties for compatibility
        ownerNotes: item.owner_notes || '',
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        // Add formatted revenue and EBITDA
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
        // Add multiples if revenue exists
        multiples: item.revenue > 0 ? {
          revenue: (item.ebitda / item.revenue).toFixed(2),
          value: '0'
        } : undefined,
      };
      
      return listing;
    });
    
    return {
      listings: transformedListings,
      totalCount: count || 0,
    };
  });
};

// Fetch metadata function
const fetchMetadata = async (user: any) => {
  if (!user || !user.email_verified) {
    throw new Error('Authentication required');
  }
  
  if (!user.is_admin && user.approval_status !== 'approved') {
    throw new Error('User approval required');
  }
  
  const { data, error } = await supabase
    .from('listings')
    .select('category, location')
    .eq('status', 'active')
    .is('deleted_at', null);
  
  if (error) throw error;
  
  const categories = Array.from(new Set(data?.map(item => item.category).filter(Boolean))) as string[];
  const locations = Array.from(new Set(data?.map(item => item.location).filter(Boolean))) as string[];
  
  return { categories, locations };
};

export function useMarketplaceCore() {
  const { user, authChecked } = useAuth();
  const { trackSearch } = useAnalyticsTracking();
  
  // Core state management - simple useState
  const [state, setState] = useState<MarketplaceCoreState>(initialState);
  
  // Create stable query key
  const queryKey = useMemo(() => createQueryKey(state), [state]);
  
  // Main listings query with optimized settings
  const listingsQuery = useQuery({
    queryKey,
    queryFn: () => fetchListings(state, user),
    enabled: authChecked && !!user,
    placeholderData: (previousData) => previousData, // Smooth pagination
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
  
  // Metadata query
  const metadataQuery = useQuery({
    queryKey: ['marketplace-metadata'],
    queryFn: () => fetchMetadata(user),
    enabled: authChecked && !!user,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
  });
  
  // Computed values
  const computedData = useMemo(() => {
    const listings = listingsQuery.data?.listings || [];
    const totalItems = listingsQuery.data?.totalCount || 0;
    const totalPages = Math.ceil(totalItems / state.perPage);
    
    const pagination: PaginationState = {
      currentPage: state.page,
      totalPages,
      totalItems,
      perPage: state.perPage,
    };
    
    return {
      listings,
      totalItems,
      pagination,
      categories: metadataQuery.data?.categories || [],
      locations: metadataQuery.data?.locations || [],
      isLoading: listingsQuery.isLoading,
      isFetching: listingsQuery.isFetching,
      isPageTransition: listingsQuery.isFetching && !listingsQuery.isLoading,
      error: listingsQuery.error,
    };
  }, [listingsQuery.data, listingsQuery.isLoading, listingsQuery.isFetching, listingsQuery.error, metadataQuery.data, state.page, state.perPage]);
  
  // Action handlers - direct state updates
  const handlePageChange = useCallback((newPage: number) => {
    const maxPage = Math.ceil((listingsQuery.data?.totalCount || 0) / state.perPage);
    if (newPage < 1 || newPage > maxPage) return;
    
    console.log(`🔄 Page change: ${newPage} (current: ${state.page}, max: ${maxPage})`);
    setState(prev => ({ ...prev, page: newPage }));
  }, [listingsQuery.data?.totalCount, state.perPage, state.page]);
  
  const handlePerPageChange = useCallback((value: string) => {
    const newPerPage = Number(value);
    if (newPerPage === state.perPage) return;
    
    console.log(`📄 Page size change: ${newPerPage}`);
    setState(prev => ({ ...prev, perPage: newPerPage, page: 1 }));
  }, [state.perPage]);
  
  const handleFilterChange = useCallback((filters: FilterOptions) => {
    console.log('🔍 Filter change:', filters);
    
    // Track search analytics
    if (filters.search?.trim()) {
      trackSearch(filters.search, filters, computedData.listings.length, computedData.listings.length === 0);
    }
    
    setState(prev => ({
      ...prev,
      page: 1, // Reset to first page
      search: filters.search || '',
      category: filters.category || '',
      location: filters.location || '',
      revenueMin: filters.revenueMin,
      revenueMax: filters.revenueMax,
      ebitdaMin: filters.ebitdaMin,
      ebitdaMax: filters.ebitdaMax,
    }));
  }, [trackSearch, computedData.listings.length]);
  
  const handleViewTypeChange = useCallback((newViewType: 'grid' | 'list') => {
    setState(prev => ({ ...prev, viewType: newViewType }));
  }, []);
  
  const handleResetFilters = useCallback(() => {
    console.log('🔄 Resetting filters');
    setState(prev => ({
      ...initialState,
      perPage: prev.perPage, // Keep current page size
      viewType: prev.viewType, // Keep current view type
    }));
  }, []);
  
  // Convert state to FilterOptions format for compatibility
  const filters: FilterOptions = useMemo(() => ({
    page: state.page,
    perPage: state.perPage,
    search: state.search,
    category: state.category,
    location: state.location,
    revenueMin: state.revenueMin,
    revenueMax: state.revenueMax,
    ebitdaMin: state.ebitdaMin,
    ebitdaMax: state.ebitdaMax,
  }), [state]);
  
  return {
    // Data
    ...computedData,
    filters,
    viewType: state.viewType,
    isChangingPageSize: false, // Simplified - no special loading state needed
    
    // Actions
    onPageChange: handlePageChange,
    onPerPageChange: handlePerPageChange,
    onFilterChange: handleFilterChange,
    onViewTypeChange: handleViewTypeChange,
    onResetFilters: handleResetFilters,
  };
}