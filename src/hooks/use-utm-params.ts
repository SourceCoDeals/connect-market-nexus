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
export function useUTMParams() {
  const [utmParams, setUtmParams] = useState<UTMParams>(() => {
    // Check if we have stored UTM params that haven't expired
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    const expiry = sessionStorage.getItem(UTM_EXPIRY_KEY);
    
    if (stored && expiry) {
      const expiryTime = parseInt(expiry, 10);
      if (Date.now() < expiryTime) {
        return JSON.parse(stored);
      } else {
        // Clear expired UTM params
        sessionStorage.removeItem(UTM_STORAGE_KEY);
        sessionStorage.removeItem(UTM_EXPIRY_KEY);
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
    const hasNewUtms = Object.values(newUtmParams).some(value => value !== undefined);
    
    if (hasNewUtms) {
      // Store new UTM params with expiry (last-touch)
      const expiryTime = Date.now() + UTM_SESSION_DURATION;
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(newUtmParams));
      sessionStorage.setItem(UTM_EXPIRY_KEY, expiryTime.toString());
      setUtmParams(newUtmParams);
      
      // First-touch attribution - only set if not already present (localStorage persists)
      const existingFirstTouch = localStorage.getItem(FIRST_TOUCH_KEY);
      if (!existingFirstTouch) {
        const firstTouchData: EnhancedUTMParams = {
          first_touch_source: newUtmParams.utm_source,
          first_touch_medium: newUtmParams.utm_medium,
          first_touch_campaign: newUtmParams.utm_campaign,
          first_touch_timestamp: new Date().toISOString(),
          landing_page: window.location.pathname,
          landing_referrer: document.referrer || undefined,
        };
        localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouchData));
      }
    } else if (Object.keys(utmParams).length > 0) {
      // Update expiry time for existing UTM params (extend session)
      const expiryTime = Date.now() + UTM_SESSION_DURATION;
      sessionStorage.setItem(UTM_EXPIRY_KEY, expiryTime.toString());
    }
    
    // Also store first-touch if this is the first visit (even without UTMs)
    const existingFirstTouch = localStorage.getItem(FIRST_TOUCH_KEY);
    if (!existingFirstTouch) {
      const firstTouchData: EnhancedUTMParams = {
        landing_page: window.location.pathname,
        landing_referrer: document.referrer || undefined,
        first_touch_timestamp: new Date().toISOString(),
      };
      localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouchData));
    }
  }, []);

  return utmParams;
}

/**
 * Get current UTM parameters without using React hooks
 * Useful for non-React contexts or edge functions
 */
export function getCurrentUTMParams(): UTMParams {
  const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
  const expiry = sessionStorage.getItem(UTM_EXPIRY_KEY);
  
  if (stored && expiry) {
    const expiryTime = parseInt(expiry, 10);
    if (Date.now() < expiryTime) {
      return JSON.parse(stored);
    } else {
      // Clear expired UTM params
      sessionStorage.removeItem(UTM_STORAGE_KEY);
      sessionStorage.removeItem(UTM_EXPIRY_KEY);
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
    const stored = localStorage.getItem(FIRST_TOUCH_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading first-touch attribution:', e);
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
