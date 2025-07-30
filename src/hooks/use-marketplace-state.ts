import { useReducer, useCallback, useEffect } from 'react';
import { FilterOptions, PaginationState } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/query-keys';

interface MarketplaceState {
  filters: FilterOptions;
  viewType: 'grid' | 'list';
  isChangingPageSize: boolean;
}

type MarketplaceAction =
  | { type: 'SET_FILTERS'; payload: FilterOptions }
  | { type: 'UPDATE_FILTERS'; payload: Partial<FilterOptions> }
  | { type: 'SET_VIEW_TYPE'; payload: 'grid' | 'list' }
  | { type: 'SET_CHANGING_PAGE_SIZE'; payload: boolean }
  | { type: 'RESET_FILTERS'; payload?: { perPage?: number } };

const initialState: MarketplaceState = {
  filters: { page: 1, perPage: 20 },
  viewType: 'grid',
  isChangingPageSize: false,
};

function marketplaceReducer(state: MarketplaceState, action: MarketplaceAction): MarketplaceState {
  switch (action.type) {
    case 'SET_FILTERS':
      return {
        ...state,
        filters: action.payload,
      };
    case 'UPDATE_FILTERS':
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.payload,
        },
      };
    case 'SET_VIEW_TYPE':
      return {
        ...state,
        viewType: action.payload,
      };
    case 'SET_CHANGING_PAGE_SIZE':
      return {
        ...state,
        isChangingPageSize: action.payload,
      };
    case 'RESET_FILTERS':
      return {
        ...state,
        filters: {
          page: 1,
          perPage: action.payload?.perPage || state.filters.perPage || 20,
        },
      };
    default:
      return state;
  }
}

export function useMarketplaceState() {
  const [state, dispatch] = useReducer(marketplaceReducer, initialState);
  const queryClient = useQueryClient();

  // Debounced filter updates to prevent rapid API calls
  const updateFiltersDebounced = useCallback((newFilters: Partial<FilterOptions>) => {
    dispatch({ type: 'UPDATE_FILTERS', payload: newFilters });
  }, []);

  // Handle filter changes (resets to page 1)
  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    const updatedFilters = {
      ...newFilters,
      page: 1, // Always reset to page 1 when filters change
      perPage: state.filters.perPage || 20, // Preserve current page size
    };
    
    dispatch({ type: 'SET_FILTERS', payload: updatedFilters });
    
    // Invalidate cache when filters change significantly
    queryClient.invalidateQueries({ queryKey: ['listings'] });
  }, [state.filters.perPage, queryClient]);

  // Handle page changes - let React Query handle refetch automatically
  const handlePageChange = useCallback((newPage: number, maxPage: number) => {
    if (newPage < 1 || newPage > maxPage) return;
    
    console.log(`🔄 Page change request: ${newPage} (current: ${state.filters.page}, max: ${maxPage})`);
    
    // Simple state update - React Query will automatically refetch when the queryKey changes
    dispatch({ type: 'UPDATE_FILTERS', payload: { page: newPage } });
  }, [state.filters.page]);

  // Handle page size changes
  const handlePerPageChange = useCallback((newPerPage: number) => {
    if (newPerPage === state.filters.perPage) return;
    
    console.log(`📄 Page size change: ${newPerPage} (current: ${state.filters.perPage})`);
    
    dispatch({ type: 'SET_CHANGING_PAGE_SIZE', payload: true });
    
    // Reset to page 1 when changing page size
    dispatch({ 
      type: 'UPDATE_FILTERS', 
      payload: { perPage: newPerPage, page: 1 } 
    });
    
    // Reset loading state after a brief delay
    setTimeout(() => {
      dispatch({ type: 'SET_CHANGING_PAGE_SIZE', payload: false });
    }, 300);
  }, [state.filters.perPage]);

  // Handle view type changes
  const handleViewTypeChange = useCallback((newViewType: 'grid' | 'list') => {
    dispatch({ type: 'SET_VIEW_TYPE', payload: newViewType });
  }, []);

  // Reset all filters
  const resetFilters = useCallback(() => {
    console.log('🔄 Resetting all filters');
    dispatch({ type: 'RESET_FILTERS', payload: { perPage: state.filters.perPage } });
    // Broad invalidation for reset
    queryClient.invalidateQueries({ queryKey: ['listings'], exact: false });
  }, [state.filters.perPage, queryClient]);

  // Compute pagination state
  const computePagination = useCallback((totalItems: number): PaginationState => {
    const perPage = state.filters.perPage || 20;
    const currentPage = state.filters.page || 1;
    const totalPages = Math.ceil(totalItems / perPage);
    
    return {
      currentPage,
      totalPages,
      totalItems,
      perPage,
    };
  }, [state.filters.page, state.filters.perPage]);

  return {
    // State
    filters: state.filters,
    viewType: state.viewType,
    isChangingPageSize: state.isChangingPageSize,
    
    // Actions
    handleFilterChange,
    handlePageChange,
    handlePerPageChange,
    handleViewTypeChange,
    resetFilters,
    updateFiltersDebounced,
    computePagination,
  };
}