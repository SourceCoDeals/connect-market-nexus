import React, { createContext, useContext, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthState } from '@/hooks/auth/use-auth-state';

interface AnalyticsContextType {
  trackEvent: (eventType: string, eventData?: any) => void;
  trackPageView: (pagePath: string) => void;
  trackListingView: (listingId: string) => void;
  trackListingSave: (listingId: string) => void;
  trackConnectionRequest: (listingId: string) => void;
  trackSearch: (query: string, filters?: any, results?: number) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

let currentSessionId: string | null = null;
let sessionStartTime: Date | null = null;

// Generate session ID
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useAuthState();

  // Initialize session on mount
  useEffect(() => {
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      sessionStartTime = new Date();
      
      // Create session record
      if (user) {
        supabase.from('user_sessions').insert({
          session_id: currentSessionId,
          user_id: user.id,
          started_at: sessionStartTime.toISOString(),
          user_agent: navigator.userAgent,
          referrer: document.referrer || null,
        }).then(() => {
          console.log('Analytics session started:', currentSessionId);
        });
      }
    }
  }, [user]);

  // Track page views on location change
  useEffect(() => {
    if (currentSessionId) {
      trackPageView(location.pathname);
    }
  }, [location.pathname]);

  const trackEvent = async (eventType: string, eventData?: any) => {
    if (!currentSessionId) return;

    try {
      await supabase.from('user_events').insert({
        session_id: currentSessionId,
        user_id: user?.id || null,
        event_type: eventType,
        event_category: 'user_interaction',
        event_action: eventType,
        page_path: location.pathname,
        metadata: eventData || {},
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  };

  const trackPageView = async (pagePath: string) => {
    if (!currentSessionId) return;

    try {
      await supabase.from('page_views').insert({
        session_id: currentSessionId,
        user_id: user?.id || null,
        page_path: pagePath,
        page_title: document.title,
        referrer: document.referrer || null,
      });
    } catch (error) {
      console.error('Failed to track page view:', error);
    }
  };

  const trackListingView = async (listingId: string) => {
    if (!currentSessionId) return;

    try {
      await supabase.from('listing_analytics').insert({
        session_id: currentSessionId,
        user_id: user?.id || null,
        listing_id: listingId,
        action_type: 'view',
        referrer_page: location.pathname,
      });
    } catch (error) {
      console.error('Failed to track listing view:', error);
    }
  };

  const trackListingSave = async (listingId: string) => {
    if (!currentSessionId) return;

    try {
      await supabase.from('listing_analytics').insert({
        session_id: currentSessionId,
        user_id: user?.id || null,
        listing_id: listingId,
        action_type: 'save',
        referrer_page: location.pathname,
      });
    } catch (error) {
      console.error('Failed to track listing save:', error);
    }
  };

  const trackConnectionRequest = async (listingId: string) => {
    if (!currentSessionId) return;

    try {
      await supabase.from('listing_analytics').insert({
        session_id: currentSessionId,
        user_id: user?.id || null,
        listing_id: listingId,
        action_type: 'request_connection',
        referrer_page: location.pathname,
      });
    } catch (error) {
      console.error('Failed to track connection request:', error);
    }
  };

  const trackSearch = async (query: string, filters?: any, results?: number) => {
    if (!currentSessionId) return;

    try {
      await supabase.from('search_analytics').insert({
        session_id: currentSessionId,
        user_id: user?.id || null,
        search_query: query,
        filters_applied: filters || {},
        results_count: results || 0,
        no_results: (results || 0) === 0,
      });
    } catch (error) {
      console.error('Failed to track search:', error);
    }
  };

  const value: AnalyticsContextType = {
    trackEvent,
    trackPageView,
    trackListingView,
    trackListingSave,
    trackConnectionRequest,
    trackSearch,
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