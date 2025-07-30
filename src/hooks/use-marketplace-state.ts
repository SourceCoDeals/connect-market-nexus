import { useReducer, useMemo, useCallback } from 'react';
import type { Filters } from '@/types/index';

export interface MarketplaceState {
  filters: Filters;
  currentPage: number;
  pageSize: number;
  viewType: 'grid' | 'list';
  isPageSizeChanging: boolean;
}

type MarketplaceAction =
  | { type: 'SET_FILTERS'; payload: Partial<Filters> }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PAGE_SIZE'; payload: number }
  | { type: 'SET_VIEW_TYPE'; payload: 'grid' | 'list' }
  | { type: 'RESET_FILTERS' }
  | { type: 'SET_PAGE_SIZE_CHANGING'; payload: boolean };

const initialState: MarketplaceState = {
  filters: {
    category: '',
    location: '',
    search: '',
    minRevenue: '',
    maxRevenue: '',
    minEbitda: '',
    maxEbitda: '',
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  currentPage: 1,
  pageSize: 10,
  viewType: 'grid',
  isPageSizeChanging: false
};

function marketplaceReducer(state: MarketplaceState, action: MarketplaceAction): MarketplaceState {
  switch (action.type) {
    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
        currentPage: 1 // Reset to first page when filters change
      };
    case 'SET_PAGE':
      return {
        ...state,
        currentPage: action.payload
      };
    case 'SET_PAGE_SIZE':
      return {
        ...state,
        pageSize: action.payload,
        currentPage: 1 // Reset to first page when page size changes
      };
    case 'SET_VIEW_TYPE':
      return {
        ...state,
        viewType: action.payload
      };
    case 'RESET_FILTERS':
      return {
        ...state,
        filters: initialState.filters,
        currentPage: 1
      };
    case 'SET_PAGE_SIZE_CHANGING':
      return {
        ...state,
        isPageSizeChanging: action.payload
      };
    default:
      return state;
  }
}

export function useMarketplaceState() {
  const [state, dispatch] = useReducer(marketplaceReducer, initialState);

  const pagination = useMemo(() => ({
    page: state.currentPage,
    pageSize: state.pageSize,
    offset: (state.currentPage - 1) * state.pageSize,
    limit: state.pageSize
  }), [state.currentPage, state.pageSize]);

  const setFilters = useCallback((filters: Partial<Filters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  const setPage = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  const setPageSize = useCallback(async (size: number) => {
    dispatch({ type: 'SET_PAGE_SIZE_CHANGING', payload: true });
    dispatch({ type: 'SET_PAGE_SIZE', payload: size });
    // Add small delay for smooth UX
    setTimeout(() => {
      dispatch({ type: 'SET_PAGE_SIZE_CHANGING', payload: false });
    }, 300);
  }, []);

  const setViewType = useCallback((viewType: 'grid' | 'list') => {
    dispatch({ type: 'SET_VIEW_TYPE', payload: viewType });
  }, []);

  const resetFilters = useCallback(() => {
    dispatch({ type: 'RESET_FILTERS' });
  }, []);

  return {
    state,
    pagination,
    actions: {
      setFilters,
      setPage,
      setPageSize,
      setViewType,
      resetFilters
    }
  };
}