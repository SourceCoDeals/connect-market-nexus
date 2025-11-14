import React, { createContext, useContext, useState, useEffect } from 'react';

interface Listing {
  id: string;
  title: string;
  category: string;
  location: string;
  revenue: number;
  ebitda: number;
  status: string;
}

interface ComparisonContextType {
  comparedListings: Listing[];
  addToComparison: (listing: Listing) => void;
  removeFromComparison: (listingId: string) => void;
  clearComparison: () => void;
  isInComparison: (listingId: string) => boolean;
  maxReached: boolean;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

const MAX_COMPARISONS = 4;
const STORAGE_KEY = 'marketplace-comparison';

export function ComparisonProvider({ children }: { children: React.ReactNode }) {
  const [comparedListings, setComparedListings] = useState<Listing[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comparedListings));
  }, [comparedListings]);

  const addToComparison = (listing: Listing) => {
    setComparedListings(prev => {
      if (prev.length >= MAX_COMPARISONS) return prev;
      if (prev.some(l => l.id === listing.id)) return prev;
      return [...prev, listing];
    });
  };

  const removeFromComparison = (listingId: string) => {
    setComparedListings(prev => prev.filter(l => l.id !== listingId));
  };

  const clearComparison = () => {
    setComparedListings([]);
  };

  const isInComparison = (listingId: string) => {
    return comparedListings.some(l => l.id === listingId);
  };

  const maxReached = comparedListings.length >= MAX_COMPARISONS;

  return (
    <ComparisonContext.Provider
      value={{
        comparedListings,
        addToComparison,
        removeFromComparison,
        clearComparison,
        isInComparison,
        maxReached,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error('useComparison must be used within ComparisonProvider');
  }
  return context;
}
