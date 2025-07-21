import React, { createContext, useContext, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

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
  const { user, authChecked } = useAuth();

  // Initialize session immediately on mount
  useEffect(() => {
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      sessionStartTime = new Date();
      console.log('📊 Analytics session initialized:', currentSessionId);
    }
  }, []);

  // Create/update session record when auth state is available
  useEffect(() => {
    if (!authChecked || !currentSessionId) return;

    const createOrUpdateSession = async () => {
      try {
        // Check if session already exists
        const { data: existingSession } = await supabase
          .from('user_sessions')
          .select('id')
          .eq('session_id', currentSessionId)
          .single();

        if (existingSession) {
          // Update existing session with user info
          await supabase
            .from('user_sessions')
            .update({
              user_id: user?.id || null,
              updated_at: new Date().toISOString(),
            })
            .eq('session_id', currentSessionId);
          console.log('✅ Analytics session updated:', currentSessionId, 'for user:', user?.id || 'anonymous');
        } else {
          // Create new session
          await supabase.from('user_sessions').insert({
            session_id: currentSessionId,
            user_id: user?.id || null,
            started_at: sessionStartTime?.toISOString() || new Date().toISOString(),
            user_agent: navigator.userAgent,
            referrer: document.referrer || null,
          });
          console.log('✅ Analytics session created:', currentSessionId, 'for user:', user?.id || 'anonymous');
        }
      } catch (error) {
        console.error('❌ Failed to create/update session:', error);
        // Continue anyway - don't block analytics for session creation failures
      }
    };

    createOrUpdateSession();
  }, [user, authChecked]);

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
    if (!currentSessionId) {
      console.warn('❌ No session ID for page view:', pagePath);
      return;
    }

    console.log('📊 Tracking page view:', pagePath, 'session:', currentSessionId, 'user:', user?.id);

    try {
      await supabase.from('page_views').insert({
        session_id: currentSessionId,
        user_id: user?.id || null,
        page_path: pagePath,
        page_title: document.title,
        referrer: document.referrer || null,
      });
      console.log('✅ Page view tracked successfully');
    } catch (error) {
      console.error('❌ Failed to track page view:', error);
    }
  };

  const trackListingView = async (listingId: string) => {
    if (!currentSessionId) {
      console.warn('❌ No session ID for listing view:', listingId);
      return;
    }

    console.log('👀 Tracking listing view:', listingId, 'session:', currentSessionId, 'user:', user?.id);

    try {
      await supabase.from('listing_analytics').insert({
        session_id: currentSessionId,
        user_id: user?.id || null,
        listing_id: listingId,
        action_type: 'view',
        referrer_page: location.pathname,
      });
      console.log('✅ Listing view tracked successfully');
    } catch (error) {
      console.error('❌ Failed to track listing view:', error);
    }
  };

  const trackListingSave = async (listingId: string) => {
    if (!currentSessionId) {
      console.warn('❌ No session ID for listing save:', listingId);
      return;
    }

    console.log('💾 Tracking listing save:', listingId, 'session:', currentSessionId, 'user:', user?.id);

    try {
      await supabase.from('listing_analytics').insert({
        session_id: currentSessionId,
        user_id: user?.id || null,
        listing_id: listingId,
        action_type: 'save',
        referrer_page: location.pathname,
      });
      console.log('✅ Listing save tracked successfully');
    } catch (error) {
      console.error('❌ Failed to track listing save:', error);
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