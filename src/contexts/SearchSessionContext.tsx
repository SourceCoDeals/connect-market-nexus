import React, { createContext, useContext, ReactNode } from 'react';
import { useSearchSession } from '@/hooks/use-search-session';

interface SearchSessionContextValue {
  searchSessionId: string;
  startSearch: (query: string) => void;
  registerResults: (listingIds: string[]) => void;
  getClickData: (listingId: string) => {
    search_session_id: string;
    position_clicked: number | null;
    time_to_click: number | null;
    query: string;
  };
  hasActiveSearch: () => boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export const SearchSessionContext = createContext<SearchSessionContextValue | undefined>(undefined);

export const SearchSessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const searchSession = useSearchSession();

  return (
    <SearchSessionContext.Provider value={searchSession}>
      {children}
    </SearchSessionContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSearchSessionContext = () => {
  const context = useContext(SearchSessionContext);
  if (!context) {
    throw new Error('useSearchSessionContext must be used within a SearchSessionProvider');
  }
  return context;
};
