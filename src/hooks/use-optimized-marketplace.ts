import { useMemo, useCallback } from 'react';
import { useMarketplace } from '@/hooks/use-marketplace';
import { useMarketplaceState } from '@/hooks/use-marketplace-state';
import { FilterOptions } from '@/types';
import { useAnalyticsTracking } from '@/hooks/use-analytics-tracking';

export function useOptimizedMarketplace() {
  const marketplaceState = useMarketplaceState();
  const { useListings, useListingMetadata } = useMarketplace();
  const { trackSearch } = useAnalyticsTracking();
  
  const { filters, viewType, isChangingPageSize } = marketplaceState;
  
  // Memoized data fetching with error boundaries
  const listingsQuery = useListings(filters);
  const metadataQuery = useListingMetadata();
  
  // Memoized computed values
  const computedData = useMemo(() => {
    const listings = listingsQuery.data?.listings || [];
    const totalItems = listingsQuery.data?.totalCount || 0;
    const pagination = marketplaceState.computePagination(totalItems);
    
    return {
      listings,
      totalItems,
      pagination,
      isLoading: listingsQuery.isLoading || isChangingPageSize,
      isFetching: listingsQuery.isFetching,
      error: listingsQuery.error,
      categories: metadataQuery.data?.categories || [],
      locations: metadataQuery.data?.locations || [],
    };
  }, [
    listingsQuery.data,
    listingsQuery.isLoading,
    listingsQuery.isFetching,
    listingsQuery.error,
    metadataQuery.data,
    isChangingPageSize,
    marketplaceState
  ]);
  
  // Enhanced handlers with analytics and validation
  const enhancedHandlers = useMemo(() => ({
    onPageChange: (newPage: number) => {
      console.log(`📱 UI Page change request: ${newPage} (current: ${computedData.pagination.currentPage})`);
      marketplaceState.handlePageChange(newPage, computedData.pagination.totalPages);
    },
    
    onPerPageChange: (value: string) => {
      const perPage = Number(value);
      if (!computedData.isLoading && !computedData.isFetching && perPage !== filters.perPage) {
        marketplaceState.handlePerPageChange(perPage);
      }
    },
    
    onFilterChange: (newFilters: FilterOptions) => {
      marketplaceState.handleFilterChange(newFilters);
      
      // Track search analytics
      if (newFilters.search?.trim()) {
        trackSearch(newFilters.search, newFilters, computedData.listings.length, computedData.listings.length === 0);
      }
    },
    
    onViewTypeChange: marketplaceState.handleViewTypeChange,
    onResetFilters: marketplaceState.resetFilters,
  }), [
    computedData.isLoading,
    computedData.isFetching,
    computedData.pagination.currentPage,
    computedData.pagination.totalPages,
    computedData.listings.length,
    filters.perPage,
    marketplaceState,
    trackSearch
  ]);
  
  return {
    // Data
    ...computedData,
    filters,
    viewType,
    isChangingPageSize,
    
    // Handlers
    ...enhancedHandlers,
  };
}