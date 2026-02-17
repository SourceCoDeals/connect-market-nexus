import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type FilterType = 
  | 'channel' 
  | 'referrer' 
  | 'country' 
  | 'city' 
  | 'region'
  | 'page' 
  | 'browser' 
  | 'os' 
  | 'device' 
  | 'campaign'
  | 'keyword';

export interface AnalyticsFilter {
  type: FilterType;
  value: string;
  label: string;
  icon?: string;
}

interface AnalyticsFiltersContextType {
  filters: AnalyticsFilter[];
  addFilter: (filter: AnalyticsFilter) => void;
  removeFilter: (type: FilterType, value?: string) => void;
  clearFilters: () => void;
  hasFilter: (type: FilterType, value?: string) => boolean;
  toggleFilter: (filter: AnalyticsFilter) => void;
}

const AnalyticsFiltersContext = createContext<AnalyticsFiltersContextType | undefined>(undefined);

export function AnalyticsFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<AnalyticsFilter[]>([]);

  const addFilter = useCallback((filter: AnalyticsFilter) => {
    setFilters(prev => {
      // Replace existing filter of same type, or add new one
      const existingIndex = prev.findIndex(f => f.type === filter.type && f.value === filter.value);
      if (existingIndex >= 0) {
        return prev; // Already exists
      }
      // Remove any existing filter of the same type (single-select per type)
      const filtered = prev.filter(f => f.type !== filter.type);
      return [...filtered, filter];
    });
  }, []);

  const removeFilter = useCallback((type: FilterType, value?: string) => {
    setFilters(prev => 
      prev.filter(f => {
        if (value) {
          return !(f.type === type && f.value === value);
        }
        return f.type !== type;
      })
    );
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  const hasFilter = useCallback((type: FilterType, value?: string) => {
    return filters.some(f => {
      if (value) {
        return f.type === type && f.value === value;
      }
      return f.type === type;
    });
  }, [filters]);

  const toggleFilter = useCallback((filter: AnalyticsFilter) => {
    setFilters(prev => {
      const existingIndex = prev.findIndex(f => f.type === filter.type && f.value === filter.value);
      if (existingIndex >= 0) {
        // Remove it
        return prev.filter((_, i) => i !== existingIndex);
      }
      // Add it (replace same type)
      const filtered = prev.filter(f => f.type !== filter.type);
      return [...filtered, filter];
    });
  }, []);

  return (
    <AnalyticsFiltersContext.Provider
      value={{
        filters,
        addFilter,
        removeFilter,
        clearFilters,
        hasFilter,
        toggleFilter,
      }}
    >
      {children}
    </AnalyticsFiltersContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAnalyticsFilters() {
  const context = useContext(AnalyticsFiltersContext);
  if (!context) {
    throw new Error("useAnalyticsFilters must be used within an AnalyticsFiltersProvider");
  }
  return context;
}
