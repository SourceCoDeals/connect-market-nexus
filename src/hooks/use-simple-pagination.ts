import { useState, useCallback } from 'react';

export interface PaginationState {
  page: number;
  perPage: number;
  search: string;
  category: string;
  location: string;
  revenueMin?: number;
  revenueMax?: number;
  ebitdaMin?: number;
  ebitdaMax?: number;
}

const initialState: PaginationState = {
  page: 1,
  perPage: 20,
  search: '',
  category: 'all',
  location: 'all',
};

export function useSimplePagination() {
  const [state, setState] = useState<PaginationState>(initialState);

  const setPage = useCallback((page: number) => {
    setState(prev => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.page]);

  const setPerPage = useCallback((perPage: number) => {
    setState(prev => ({ ...prev, page: 1, perPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const setFilters = useCallback((filters: Partial<PaginationState>) => {
    // Only reset page to 1 if filters actually contain filter values (not pagination changes)
    const hasActualFilters = Object.keys(filters).some(key => 
      key !== 'page' && key !== 'perPage' && filters[key as keyof PaginationState] !== undefined
    );
    
    const newState = { 
      ...state, 
      page: hasActualFilters ? 1 : state.page, // Only reset page if actual filters changed
      ...filters 
    };
    
    setState(newState);
    
    if (hasActualFilters) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [state]);

  const resetFilters = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      page: 1, 
      search: '', 
      category: 'all', 
      location: 'all', 
      revenueMin: undefined, 
      revenueMax: undefined, 
      ebitdaMin: undefined, 
      ebitdaMax: undefined
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return {
    state,
    setPage,
    setPerPage,
    setFilters,
    resetFilters,
  };
}