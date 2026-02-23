import { useEffect, useState } from 'react';

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

// Extended UTM params with first-touch attribution
export interface EnhancedUTMParams extends UTMParams {
  // First-touch attribution (never overwritten once set)
  first_touch_source?: string;
  first_touch_medium?: string;
  first_touch_campaign?: string;
  first_touch_timestamp?: string;
  // Landing page info
  landing_page?: string;
  landing_referrer?: string;
}

const UTM_STORAGE_KEY = 'utm_params';
const UTM_EXPIRY_KEY = 'utm_expiry';
const FIRST_TOUCH_KEY = 'first_touch_utm';
const UTM_SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Hook to extract and persist UTM parameters from URL
 * UTM parameters are stored in sessionStorage and expire after 30 minutes of inactivity
 */
/** Safely read from sessionStorage (may throw in sandboxed iframes) */
function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}
function safeSessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* noop */
  }
}
function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

export function useUTMParams() {
  const [utmParams, setUtmParams] = useState<UTMParams>(() => {
    // Check if we have stored UTM params that haven't expired
    const stored = safeSessionGet(UTM_STORAGE_KEY);
    const expiry = safeSessionGet(UTM_EXPIRY_KEY);

    if (stored && expiry) {
      const expiryTime = parseInt(expiry, 10);
      if (Date.now() < expiryTime) {
        try {
          return JSON.parse(stored);
        } catch {
          return {};
        }
      } else {
        // Clear expired UTM params
        safeSessionRemove(UTM_STORAGE_KEY);
        safeSessionRemove(UTM_EXPIRY_KEY);
      }
    }

    return {};
  });

  useEffect(() => {
    // Extract UTM params from current URL
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;

    const newUtmParams: UTMParams = {
      utm_source: searchParams.get('utm_source') || undefined,
      utm_medium: searchParams.get('utm_medium') || undefined,
      utm_campaign: searchParams.get('utm_campaign') || undefined,
      utm_term: searchParams.get('utm_term') || undefined,
      utm_content: searchParams.get('utm_content') || undefined,
    };

    // Only update if we have new UTM params
    const hasNewUtms = Object.values(newUtmParams).some((value) => value !== undefined);

    if (hasNewUtms) {
      // Store new UTM params with expiry (last-touch)
      const expiryTime = Date.now() + UTM_SESSION_DURATION;
      safeSessionSet(UTM_STORAGE_KEY, JSON.stringify(newUtmParams));
      safeSessionSet(UTM_EXPIRY_KEY, expiryTime.toString());
      setUtmParams(newUtmParams);

      // First-touch attribution - only set if not already present (localStorage persists)
      const existingFirstTouch = safeLocalGet(FIRST_TOUCH_KEY);
      if (!existingFirstTouch) {
        const firstTouchData: EnhancedUTMParams = {
          first_touch_source: newUtmParams.utm_source,
          first_touch_medium: newUtmParams.utm_medium,
          first_touch_campaign: newUtmParams.utm_campaign,
          first_touch_timestamp: new Date().toISOString(),
          landing_page: window.location.pathname,
          landing_referrer: document.referrer || undefined,
        };
        safeLocalSet(FIRST_TOUCH_KEY, JSON.stringify(firstTouchData));
      }
    } else if (Object.keys(utmParams).length > 0) {
      // Update expiry time for existing UTM params (extend session)
      const expiryTime = Date.now() + UTM_SESSION_DURATION;
      safeSessionSet(UTM_EXPIRY_KEY, expiryTime.toString());
    }

    // Also store first-touch if this is the first visit (even without UTMs)
    const existingFirstTouch = safeLocalGet(FIRST_TOUCH_KEY);
    if (!existingFirstTouch) {
      const firstTouchData: EnhancedUTMParams = {
        landing_page: window.location.pathname,
        landing_referrer: document.referrer || undefined,
        first_touch_timestamp: new Date().toISOString(),
      };
      safeLocalSet(FIRST_TOUCH_KEY, JSON.stringify(firstTouchData));
    }
  }, []);

  return utmParams;
}

/**
 * Get current UTM parameters without using React hooks
 * Useful for non-React contexts or edge functions
 */
export function getCurrentUTMParams(): UTMParams {
  const stored = safeSessionGet(UTM_STORAGE_KEY);
  const expiry = safeSessionGet(UTM_EXPIRY_KEY);

  if (stored && expiry) {
    const expiryTime = parseInt(expiry, 10);
    if (Date.now() < expiryTime) {
      try {
        return JSON.parse(stored);
      } catch {
        return {};
      }
    } else {
      // Clear expired UTM params
      safeSessionRemove(UTM_STORAGE_KEY);
      safeSessionRemove(UTM_EXPIRY_KEY);
    }
  }

  return {};
}

/**
 * Get first-touch attribution data (persists across sessions in localStorage)
 * Returns the UTM params and landing info from the user's first ever visit
 */
export function getFirstTouchAttribution(): EnhancedUTMParams {
  try {
    const stored = safeLocalGet(FIRST_TOUCH_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Storage or JSON parse error — return empty
  }
  return {};
}

/**
 * Get full attribution data combining first-touch and last-touch
 */
export function getFullAttribution(): {
  firstTouch: EnhancedUTMParams;
  lastTouch: UTMParams;
  landingPage: string | null;
  originalReferrer: string | null;
} {
  const firstTouch = getFirstTouchAttribution();
  const lastTouch = getCurrentUTMParams();

  return {
    firstTouch,
    lastTouch,
    landingPage: firstTouch.landing_page || null,
    originalReferrer: firstTouch.landing_referrer || null,
  };
}
