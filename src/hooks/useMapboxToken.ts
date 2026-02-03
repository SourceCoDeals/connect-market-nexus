import { useState, useEffect } from 'react';

// Module-level cache for the Mapbox token
let cachedToken: string | null = null;
let tokenPromise: Promise<string | null> | null = null;

async function fetchMapboxToken(): Promise<string | null> {
  try {
    const response = await fetch(
      'https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/get-mapbox-token',
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.token) {
        cachedToken = data.token;
        return data.token;
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch Mapbox token:', error);
    return null;
  }
}

// Preload the token immediately on module load
export function preloadMapboxToken(): void {
  if (!cachedToken && !tokenPromise) {
    tokenPromise = fetchMapboxToken();
  }
}

// Start preloading immediately
preloadMapboxToken();

export function useMapboxToken() {
  const [token, setToken] = useState<string | null>(cachedToken);
  const [isLoading, setIsLoading] = useState(!cachedToken);

  useEffect(() => {
    // If we already have a cached token, use it immediately
    if (cachedToken) {
      setToken(cachedToken);
      setIsLoading(false);
      return;
    }

    // If a fetch is in progress, wait for it
    if (tokenPromise) {
      tokenPromise.then((fetchedToken) => {
        setToken(fetchedToken);
        setIsLoading(false);
      });
      return;
    }

    // Start a new fetch
    tokenPromise = fetchMapboxToken();
    tokenPromise.then((fetchedToken) => {
      setToken(fetchedToken);
      setIsLoading(false);
    });
  }, []);

  return { token, isLoading };
}
