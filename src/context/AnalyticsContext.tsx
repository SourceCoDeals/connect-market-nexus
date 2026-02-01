import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';

interface AnalyticsContextType {
  trackEvent: (eventType: string, eventData?: any) => Promise<boolean>;
  trackPageView: (pagePath: string) => Promise<boolean>;
  trackListingView: (listingId: string) => Promise<boolean>;
  trackListingSave: (listingId: string) => Promise<boolean>;
  trackConnectionRequest: (listingId: string) => Promise<boolean>;
  trackSearch: (query: string, filters?: any, results?: number) => Promise<boolean>;
  getAnalyticsHealth: () => Promise<{
    totalInsertions: number;
    failedInsertions: number;
    successRate: number;
    isHealthy: boolean;
  }>;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

let currentSessionId: string | null = null;
let sessionStartTime: Date | null = null;

// Analytics health tracking
let analyticsStats = {
  totalInsertions: 0,
  failedInsertions: 0,
  circuitBreakerOpen: false,
  lastFailureTime: 0,
};

// Circuit breaker settings
const CIRCUIT_BREAKER_THRESHOLD = 5; // failures
const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

// Generate session ID
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Retry with exponential backoff
const retryWithBackoff = async (
  fn: () => Promise<any>, 
  maxRetries = MAX_RETRIES,
  delay = 1000
): Promise<{ success: boolean; error?: any }> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await fn();
      return { success: true };
    } catch (error) {
      if (attempt === maxRetries) {
        return { success: false, error };
      }
      
      // Wait with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
    }
  }
  return { success: false };
};

// Circuit breaker check
const shouldSkipAnalytics = (): boolean => {
  if (!analyticsStats.circuitBreakerOpen) {
    return false;
  }
  
  // Check if timeout has passed
  if (Date.now() - analyticsStats.lastFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
    analyticsStats.circuitBreakerOpen = false;
    
    return false;
  }
  
  return true;
};

// Update analytics stats and circuit breaker
const updateAnalyticsStats = (success: boolean, error?: any) => {
  analyticsStats.totalInsertions++;
  
  if (success) {
    // Reset failure count on success
    if (analyticsStats.failedInsertions > 0) {
      
    }
  } else {
    analyticsStats.failedInsertions++;
    analyticsStats.lastFailureTime = Date.now();
    
    // Open circuit breaker if too many failures (silent for users)
    if (analyticsStats.failedInsertions >= CIRCUIT_BREAKER_THRESHOLD && 
        !analyticsStats.circuitBreakerOpen) {
      analyticsStats.circuitBreakerOpen = true;
      console.error('🚨 Analytics circuit breaker OPENED - too many failures');
    }
  }
};

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  // PHASE 1: Remove circular dependency - defer auth usage with local state
  const [authState, setAuthState] = React.useState<{
    user: any | null;
    authChecked: boolean;
  }>({ user: null, authChecked: false });

  // PHASE 1: Initialize auth state listener and session
  useEffect(() => {
    // Initialize session immediately
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      sessionStartTime = new Date();
      
    }

    // Listen to auth changes without circular dependency
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setAuthState({
          user: session?.user || null,
          authChecked: true
        });
      } catch (error) {
        console.error('Analytics: Failed to get session:', error);
        setAuthState({ user: null, authChecked: true });
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthState({
        user: session?.user || null,
        authChecked: true
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Session creation is now handled by track-session edge function via use-initial-session-tracking
  // This prevents race conditions that skip journey upsert logic
  // AnalyticsContext only handles page views, events, and listing tracking - not session creation

  // Track page views on location change
  useEffect(() => {
    if (currentSessionId) {
      trackPageView(location.pathname);
    }
  }, [location.pathname]);

  const trackEvent = async (eventType: string, eventData?: any): Promise<boolean> => {
    if (!currentSessionId) {
      console.warn('❌ No session ID for event:', eventType);
      return false;
    }

    if (shouldSkipAnalytics()) {
      console.warn('⚠️ Analytics disabled (circuit breaker)');
      return false;
    }

    

    const result = await retryWithBackoff(async () => {
      const { error } = await supabase.from('user_events').insert({
        session_id: currentSessionId,
        user_id: authState.user?.id || null,
        event_type: eventType,
        event_category: 'user_interaction',
        event_action: eventType,
        page_path: location.pathname,
        metadata: eventData || {},
      });

      if (error) {
        throw error;
      }
    });

    updateAnalyticsStats(result.success, result.error);

    if (result.success) {
      
    } else {
      console.error('❌ Failed to track event after retries:', result.error);
    }

    return result.success;
  };

  const trackPageView = async (pagePath: string): Promise<boolean> => {
    if (!currentSessionId) {
      console.warn('❌ No session ID for page view:', pagePath);
      return false;
    }

    if (shouldSkipAnalytics()) {
      console.warn('⚠️ Analytics disabled (circuit breaker)');
      return false;
    }

    

    const result = await retryWithBackoff(async () => {
      const { error } = await supabase.from('page_views').insert({
        session_id: currentSessionId,
        user_id: authState.user?.id || null,
        page_path: pagePath,
        page_title: document.title,
        referrer: document.referrer || null,
      });

      if (error) {
        throw error;
      }
    });

    updateAnalyticsStats(result.success, result.error);

    if (result.success) {
      
    } else {
      console.error('❌ Failed to track page view after retries:', result.error);
    }

    return result.success;
  };

  const trackListingView = async (listingId: string): Promise<boolean> => {
    if (!currentSessionId) {
      console.warn('❌ No session ID for listing view:', listingId);
      return false;
    }

    if (shouldSkipAnalytics()) {
      console.warn('⚠️ Analytics disabled (circuit breaker)');
      return false;
    }

    

    const result = await retryWithBackoff(async () => {
      const { error } = await supabase.from('listing_analytics').insert({
        session_id: currentSessionId,
        user_id: authState.user?.id || null,
        listing_id: listingId,
        action_type: 'view',
        referrer_page: location.pathname,
      });

      if (error) {
        throw error;
      }
    });

    updateAnalyticsStats(result.success, result.error);

    if (result.success) {
      
    } else {
      console.error('❌ Failed to track listing view after retries:', result.error);
    }

    return result.success;
  };

  const trackListingSave = async (listingId: string): Promise<boolean> => {
    if (!currentSessionId) {
      console.warn('❌ No session ID for listing save:', listingId);
      return false;
    }

    if (shouldSkipAnalytics()) {
      console.warn('⚠️ Analytics disabled (circuit breaker)');
      return false;
    }

    

    const result = await retryWithBackoff(async () => {
      const { error } = await supabase.from('listing_analytics').insert({
        session_id: currentSessionId,
        user_id: authState.user?.id || null,
        listing_id: listingId,
        action_type: 'save',
        referrer_page: location.pathname,
      });

      if (error) {
        throw error;
      }
    });

    updateAnalyticsStats(result.success, result.error);

    if (result.success) {
      
    } else {
      console.error('❌ Failed to track listing save after retries:', result.error);
    }

    return result.success;
  };

  const trackConnectionRequest = async (listingId: string): Promise<boolean> => {
    if (!currentSessionId) {
      console.warn('❌ No session ID for connection request:', listingId);
      return false;
    }

    if (shouldSkipAnalytics()) {
      console.warn('⚠️ Analytics disabled (circuit breaker)');
      return false;
    }

    

    const result = await retryWithBackoff(async () => {
      const { error } = await supabase.from('listing_analytics').insert({
        session_id: currentSessionId,
        user_id: authState.user?.id || null,
        listing_id: listingId,
        action_type: 'request_connection',
        referrer_page: location.pathname,
      });

      if (error) {
        throw error;
      }
    });

    updateAnalyticsStats(result.success, result.error);

    if (result.success) {
      
    } else {
      console.error('❌ Failed to track connection request after retries:', result.error);
    }

    return result.success;
  };

  const trackSearch = async (query: string, filters?: any, results?: number): Promise<boolean> => {
    if (!currentSessionId) {
      console.warn('❌ No session ID for search:', query);
      return false;
    }

    if (shouldSkipAnalytics()) {
      console.warn('⚠️ Analytics disabled (circuit breaker)');
      return false;
    }

    

    const result = await retryWithBackoff(async () => {
      const { error } = await supabase.from('search_analytics').insert({
        session_id: currentSessionId,
        user_id: authState.user?.id || null,
        search_query: query,
        filters_applied: filters || {},
        results_count: results || 0,
        no_results: (results || 0) === 0,
      });

      if (error) {
        throw error;
      }
    });

    updateAnalyticsStats(result.success, result.error);

    if (result.success) {
      
    } else {
      console.error('❌ Failed to track search after retries:', result.error);
    }

    return result.success;
  };

  const getAnalyticsHealth = async () => {
    const successRate = analyticsStats.totalInsertions > 0 
      ? ((analyticsStats.totalInsertions - analyticsStats.failedInsertions) / analyticsStats.totalInsertions) * 100
      : 100;

    return {
      totalInsertions: analyticsStats.totalInsertions,
      failedInsertions: analyticsStats.failedInsertions,
      successRate,
      isHealthy: successRate > 80 && !analyticsStats.circuitBreakerOpen,
    };
  };

  const value: AnalyticsContextType = {
    trackEvent,
    trackPageView,
    trackListingView,
    trackListingSave,
    trackConnectionRequest,
    trackSearch,
    getAnalyticsHealth,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}