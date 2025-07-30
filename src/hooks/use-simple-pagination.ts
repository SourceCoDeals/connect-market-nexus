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
    setState(prev => ({ ...prev, page }));
  }, []);

  const setPerPage = useCallback((perPage: number) => {
    setState(prev => ({ ...prev, page: 1, perPage }));
  }, []);

  const setFilters = useCallback((filters: Partial<PaginationState>) => {
    setState(prev => ({ ...prev, page: 1, ...filters }));
  }, []);

  const resetFilters = useCallback(() => {
    setState(prev => ({ ...prev, page: 1, search: '', category: '', location: '', revenueMin: undefined, revenueMax: undefined, ebitdaMin: undefined, ebitdaMax: undefined }));
  }, []);

  return {
    state,
    setPage,
    setPerPage,
    setFilters,
    resetFilters,
  };
}