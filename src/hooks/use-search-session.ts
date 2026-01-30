import { useRef, useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Hook to manage search sessions for enhanced search analytics
 * Tracks search query timing and result click positions
 */
export function useSearchSession() {
  const [searchSessionId] = useState(() => uuidv4());
  const searchStartTimeRef = useRef<number | null>(null);
  const lastQueryRef = useRef<string>('');
  const resultPositionsRef = useRef<Map<string, number>>(new Map());

  // Start a new search (called when query changes)
  const startSearch = useCallback((query: string) => {
    if (query !== lastQueryRef.current) {
      searchStartTimeRef.current = Date.now();
      lastQueryRef.current = query;
      resultPositionsRef.current.clear();
    }
  }, []);

  // Register result positions (called when results are rendered)
  const registerResults = useCallback((listingIds: string[]) => {
    resultPositionsRef.current.clear();
    listingIds.forEach((id, index) => {
      resultPositionsRef.current.set(id, index + 1); // 1-based position
    });
  }, []);

  // Get click data for a listing (called when user clicks a result)
  const getClickData = useCallback((listingId: string) => {
    const position = resultPositionsRef.current.get(listingId) || null;
    const timeToClick = searchStartTimeRef.current 
      ? Date.now() - searchStartTimeRef.current 
      : null;

    return {
      search_session_id: searchSessionId,
      position_clicked: position,
      time_to_click: timeToClick,
      query: lastQueryRef.current,
    };
  }, [searchSessionId]);

  // Check if there's an active search
  const hasActiveSearch = useCallback(() => {
    return lastQueryRef.current.length > 0 && resultPositionsRef.current.size > 0;
  }, []);

  return {
    searchSessionId,
    startSearch,
    registerResults,
    getClickData,
    hasActiveSearch,
  };
}
