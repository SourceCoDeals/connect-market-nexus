import { useMemo, useEffect, useCallback } from 'react';

const VISITOR_ID_KEY = 'sourceco_visitor_id';
const FIRST_TOUCH_KEY = 'sourceco_first_touch';

interface FirstTouchData {
  landing_page: string;
  landing_search: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  timestamp: string;
  ga4_client_id: string | null;
}

/**
 * Improved GA4 Client ID extraction with multiple fallback strategies
 */
function getGA4ClientId(): string | null {
  try {
    // Strategy 1: Try standard _ga cookie format (GA\d.\d.XXXXXXXXXX.XXXXXXXXXX)
    const gaCookieMatch = document.cookie.match(/_ga=GA\d\.\d\.(\d+\.\d+)/);
    if (gaCookieMatch && gaCookieMatch[1]) {
      return gaCookieMatch[1];
    }
    
    // Strategy 2: Try _ga cookie with different format
    const gaSimpleMatch = document.cookie.match(/_ga=([^;]+)/);
    if (gaSimpleMatch && gaSimpleMatch[1]) {
      const parts = gaSimpleMatch[1].split('.');
      if (parts.length >= 4) {
        return `${parts[2]}.${parts[3]}`;
      }
    }
    
    // Strategy 3: Try _ga_MEASUREMENTID format (newer GA4)
    const ga4CookieMatch = document.cookie.match(/_ga_[A-Z0-9]+=[^;]+/);
    if (ga4CookieMatch) {
      const parts = ga4CookieMatch[0].split('.');
      if (parts.length >= 4) {
        return `${parts[2]}.${parts[3]}`;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Async version that waits for gtag to be ready
 */
export async function getGA4ClientIdAsync(): Promise<string | null> {
  // First try synchronous methods
  const syncResult = getGA4ClientId();
  if (syncResult) return syncResult;
  
  // Then try gtag async method
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 2000);
      
      try {
        window.gtag('get', 'G-N5T31YT52K', 'client_id', (clientId: string) => {
          clearTimeout(timeout);
          resolve(clientId || null);
        });
      } catch {
        clearTimeout(timeout);
        resolve(null);
      }
    });
  }
  
  return null;
}

/**
 * Hook for persistent visitor identity across sessions
 * Creates a unique visitor_id stored in localStorage that persists across sessions
 * Captures first-touch attribution data on the very first visit
 */
export function useVisitorIdentity() {
  // Get or create persistent visitor ID
  const visitorId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    
    try {
      let id = localStorage.getItem(VISITOR_ID_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(VISITOR_ID_KEY, id);
        console.log('🆔 Created new visitor ID:', id);
      }
      return id;
    } catch {
      // Fallback if localStorage is not available
      return crypto.randomUUID();
    }
  }, []);

  // Capture first-touch attribution on FIRST visit only
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const existing = localStorage.getItem(FIRST_TOUCH_KEY);
      if (!existing) {
        const searchParams = new URLSearchParams(window.location.search);
        
        const firstTouch: FirstTouchData = {
          landing_page: window.location.pathname,
          landing_search: window.location.search,
          referrer: document.referrer || null,
          utm_source: searchParams.get('utm_source'),
          utm_medium: searchParams.get('utm_medium'),
          utm_campaign: searchParams.get('utm_campaign'),
          utm_term: searchParams.get('utm_term'),
          utm_content: searchParams.get('utm_content'),
          timestamp: new Date().toISOString(),
          ga4_client_id: getGA4ClientId(),
        };
        
        localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
        console.log('📊 Captured first-touch attribution:', firstTouch);
        
        // If GA4 client ID wasn't available, retry with exponential backoff
        // GA4 cookie may take time to be set after gtag loads
        if (!firstTouch.ga4_client_id) {
          const retryIntervals = [500, 1000, 2000, 3000, 5000]; // Total 11.5s of retries
          
          const attemptGA4Capture = async (attemptIndex: number) => {
            if (attemptIndex >= retryIntervals.length) {
              console.log('📊 GA4 client ID capture exhausted after', retryIntervals.length, 'attempts');
              return;
            }
            
            setTimeout(async () => {
              const ga4Id = await getGA4ClientIdAsync();
              if (ga4Id) {
                try {
                  const stored = localStorage.getItem(FIRST_TOUCH_KEY);
                  if (stored) {
                    const data = JSON.parse(stored);
                    if (!data.ga4_client_id) {
                      data.ga4_client_id = ga4Id;
                      localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(data));
                      console.log('📊 GA4 client ID captured on attempt', attemptIndex + 1, ':', ga4Id);
                    }
                  }
                } catch {
                  // Ignore localStorage errors
                }
              } else {
                // Retry with next interval
                attemptGA4Capture(attemptIndex + 1);
              }
            }, retryIntervals[attemptIndex]);
          };
          
          attemptGA4Capture(0);
        }
      }
    } catch (error) {
      console.error('Error capturing first-touch:', error);
    }
  }, []);

  const getFirstTouch = useCallback((): FirstTouchData | null => {
    try {
      const stored = localStorage.getItem(FIRST_TOUCH_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const getCurrentGA4ClientId = useCallback((): string | null => {
    return getGA4ClientId();
  }, []);

  return { 
    visitorId, 
    getFirstTouch,
    getCurrentGA4ClientId,
    getGA4ClientIdAsync
  };
}
