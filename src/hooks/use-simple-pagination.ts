import { useState, useCallback } from 'react';
import { flushSync } from 'react-dom';

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
  isTransitioning?: boolean;
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
    console.time('pagination-state-update');
    
    // Use flushSync for immediate state update
    flushSync(() => {
      setState(prev => {
        console.log('📄 [PAGINATION] State update - prev:', prev.page, 'new:', page);
        return { ...prev, page, isTransitioning: true };
      });
    });
    
    console.timeEnd('pagination-state-update');
    
    // Immediate scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Clear transition state
    setTimeout(() => {
      setState(prev => ({ ...prev, isTransitioning: false }));
    }, 50);
  }, [state.page]);

  const setPerPage = useCallback((perPage: number) => {
    console.log('📊 [PAGINATION] Setting perPage:', perPage);
    flushSync(() => {
      setState(prev => ({ ...prev, page: 1, perPage, isTransitioning: true }));
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      setState(prev => ({ ...prev, isTransitioning: false }));
    }, 50);
  }, []);

  const setFilters = useCallback((filters: Partial<PaginationState>) => {
    console.log('🔍 [PAGINATION] Setting filters:', filters);
    flushSync(() => {
      setState(prev => ({ ...prev, page: 1, ...filters, isTransitioning: true }));
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      setState(prev => ({ ...prev, isTransitioning: false }));
    }, 50);
  }, []);

  const resetFilters = useCallback(() => {
    console.log('🧹 [PAGINATION] Resetting filters');
    flushSync(() => {
      setState(prev => ({ 
        ...prev, 
        page: 1, 
        search: '', 
        category: '', 
        location: '', 
        revenueMin: undefined, 
        revenueMax: undefined, 
        ebitdaMin: undefined, 
        ebitdaMax: undefined,
        isTransitioning: true 
      }));
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      setState(prev => ({ ...prev, isTransitioning: false }));
    }, 50);
  }, []);

  return {
    state,
    setPage,
    setPerPage,
    setFilters,
    resetFilters,
  };
}