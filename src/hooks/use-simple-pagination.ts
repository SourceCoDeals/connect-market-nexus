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
  category: '',
  location: '',
};

export function useSimplePagination() {
  const [state, setState] = useState<PaginationState>(initialState);

  const setPage = useCallback((page: number) => {
    console.log('🔄 [PAGINATION] Setting page:', page, 'from:', state.page);
    setState(prev => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.page]);

  const setPerPage = useCallback((perPage: number) => {
    console.log('📊 [PAGINATION] Setting perPage:', perPage);
    setState(prev => ({ ...prev, page: 1, perPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const setFilters = useCallback((filters: Partial<PaginationState>) => {
    console.log('🔍 [PAGINATION] Setting filters:', filters);
    setState(prev => ({ ...prev, page: 1, ...filters }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const resetFilters = useCallback(() => {
    console.log('🧹 [PAGINATION] Resetting filters');
    setState(prev => ({ 
      ...prev, 
      page: 1, 
      search: '', 
      category: '', 
      location: '', 
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