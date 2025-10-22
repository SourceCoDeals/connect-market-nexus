import { useEffect, useState } from 'react';

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

const UTM_STORAGE_KEY = 'utm_params';
const UTM_EXPIRY_KEY = 'utm_expiry';
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
      // Store new UTM params with expiry
      const expiryTime = Date.now() + UTM_SESSION_DURATION;
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(newUtmParams));
      sessionStorage.setItem(UTM_EXPIRY_KEY, expiryTime.toString());
      setUtmParams(newUtmParams);
    } else if (Object.keys(utmParams).length > 0) {
      // Update expiry time for existing UTM params (extend session)
      const expiryTime = Date.now() + UTM_SESSION_DURATION;
      sessionStorage.setItem(UTM_EXPIRY_KEY, expiryTime.toString());
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
