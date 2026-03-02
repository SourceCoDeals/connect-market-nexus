import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthState } from './auth/use-auth-state';
import { useSessionContext } from '@/contexts/SessionContext';
import {
  trackGA4PageView,
  trackGA4Event,
  trackGA4Search,
  trackGA4ViewItem,
  trackGA4AddToWishlist,
  trackGA4GenerateLead,
  setGA4UserId,
} from '@/lib/ga4';

interface TrackEventParams {
  eventType: string;
  eventCategory: string;
  eventAction: string;
  eventLabel?: string;
  eventValue?: number;
  metadata?: Record<string, unknown>;
}

interface TrackPageViewParams {
  pagePath: string;
  pageTitle?: string;
  referrer?: string;
}

export function useAnalyticsTracking() {
  const { user } = useAuthState();
  const { sessionId, utmParams, referrer } = useSessionContext();
  const sessionIdRef = useRef<string>(sessionId);
  const pageStartTimeRef = useRef<number>(Date.now());
  const currentPageRef = useRef<string>('');

  // Set GA4 user ID when user logs in
  useEffect(() => {
    if (user?.id) {
      setGA4UserId(user.id);
    }
  }, [user?.id]);

  // Session creation is now handled by track-session edge function via use-initial-session-tracking
  // This hook only tracks page views and events, not session creation
  // Remove duplicate session creation to prevent race conditions with journey tracking

  // Track page views (Supabase + GA4)
  const trackPageView = useCallback(
    async ({ pagePath, pageTitle, referrer: _referrer }: TrackPageViewParams) => {
      try {
        // Track in GA4
        trackGA4PageView(pagePath, pageTitle || document.title);

        // End previous page view if exists
        if (currentPageRef.current) {
          const timeOnPage = Math.floor((Date.now() - pageStartTimeRef.current) / 1000);

          await supabase.from('page_views').insert({
            session_id: sessionIdRef.current,
            user_id: user?.id || null,
            page_path: currentPageRef.current,
            page_title: document.title,
            referrer: referrer || document.referrer || null,
            time_on_page: timeOnPage,
            scroll_depth: getScrollDepth(),
            utm_source: utmParams.utm_source || null,
            utm_medium: utmParams.utm_medium || null,
            utm_campaign: utmParams.utm_campaign || null,
            utm_term: utmParams.utm_term || null,
            utm_content: utmParams.utm_content || null,
          });
        }

        // Start tracking new page
        currentPageRef.current = pagePath;
        pageStartTimeRef.current = Date.now();
      } catch (error) {
        console.error('Failed to track page view:', error);
      }
    },
    [user?.id, utmParams],
  );

  // Track custom events (Supabase + GA4)
  const trackEvent = useCallback(
    async ({
      eventType,
      eventCategory,
      eventAction,
      eventLabel,
      eventValue,
      metadata,
    }: TrackEventParams) => {
      try {
        // Track in GA4
        trackGA4Event(eventType, {
          event_category: eventCategory,
          event_action: eventAction,
          event_label: eventLabel,
          value: eventValue,
          ...metadata,
        });

        // Track in Supabase
        await supabase.from('user_events').insert({
          session_id: sessionIdRef.current,
          user_id: user?.id || null,
          event_type: eventType,
          event_category: eventCategory,
          event_action: eventAction,
          event_label: eventLabel || null,
          event_value: eventValue || null,
          page_path: window.location.pathname,
          metadata: (metadata || null) as import('@/integrations/supabase/types').Json,
          utm_source: utmParams.utm_source || null,
          utm_medium: utmParams.utm_medium || null,
          utm_campaign: utmParams.utm_campaign || null,
          utm_term: utmParams.utm_term || null,
          utm_content: utmParams.utm_content || null,
        });
      } catch (error) {
        console.error('Failed to track event:', error);
      }
    },
    [user?.id, utmParams],
  );

  // Track listing interactions (Supabase + GA4)
  const trackListingInteraction = useCallback(
    async (
      listingId: string,
      actionType: 'view' | 'save' | 'unsave' | 'request_connection' | 'share',
      metadata?: Record<string, unknown>,
    ) => {
      try {
        // Track in GA4 with appropriate event
        if (actionType === 'view') {
          trackGA4ViewItem(
            listingId,
            (metadata?.listingTitle as string) || listingId,
            metadata?.category as string | undefined,
          );
        } else if (actionType === 'save') {
          trackGA4AddToWishlist(
            listingId,
            (metadata?.listingTitle as string) || listingId,
            metadata?.category as string | undefined,
          );
        } else if (actionType === 'request_connection') {
          trackGA4GenerateLead(listingId, (metadata?.listingTitle as string) || listingId);
        }

        // Track in Supabase
        await supabase.from('listing_analytics').insert({
          listing_id: listingId,
          user_id: user?.id || null,
          session_id: sessionIdRef.current,
          action_type: actionType,
          time_spent:
            actionType === 'view'
              ? Math.floor((Date.now() - pageStartTimeRef.current) / 1000)
              : null,
          scroll_depth: actionType === 'view' ? getScrollDepth() : null,
          referrer_page: document.referrer || null,
          clicked_elements: (metadata?.clickedElements ||
            null) as import('@/integrations/supabase/types').Json,
          search_query: (metadata?.searchQuery as string) || null,
          utm_source: utmParams.utm_source || null,
          utm_medium: utmParams.utm_medium || null,
          utm_campaign: utmParams.utm_campaign || null,
          utm_term: utmParams.utm_term || null,
          utm_content: utmParams.utm_content || null,
        });

        // Also track as a general event
        await trackEvent({
          eventType: 'listing_interaction',
          eventCategory: 'engagement',
          eventAction: actionType,
          eventLabel: listingId,
          metadata: metadata,
        });
      } catch (error) {
        console.error('Failed to track listing interaction:', error);
      }
    },
    [user?.id, trackEvent, utmParams],
  );

  // Track search (Supabase + GA4)
  const trackSearch = useCallback(
    async (
      searchQuery: string,
      filters: Record<string, unknown>,
      resultsCount: number,
      noResults = false,
      searchSessionId?: string,
    ) => {
      try {
        // Track in GA4
        trackGA4Search(searchQuery, resultsCount);

        // Track in Supabase
        await supabase.from('search_analytics').insert({
          session_id: sessionIdRef.current,
          user_id: user?.id || null,
          search_query: searchQuery,
          filters_applied: filters as unknown as import('@/integrations/supabase/types').Json,
          results_count: resultsCount,
          no_results: noResults,
          search_session_id: searchSessionId || null,
        });

        await trackEvent({
          eventType: 'search',
          eventCategory: 'engagement',
          eventAction: noResults ? 'no_results' : 'has_results',
          eventLabel: searchQuery,
          eventValue: resultsCount,
          metadata: { filters, noResults, searchSessionId },
        });
      } catch (error) {
        console.error('Failed to track search:', error);
      }
    },
    [user?.id, trackEvent],
  );

  // Track search result click (when user clicks on a search result)
  const trackSearchResultClick = useCallback(
    async (
      _listingId: string,
      searchSessionId: string,
      positionClicked: number,
      timeToClickMs: number,
      searchQuery: string,
    ) => {
      try {
        // Update the search analytics record with click data
        await supabase
          .from('search_analytics')
          .update({
            position_clicked: positionClicked,
            time_to_click: timeToClickMs,
            results_clicked: 1,
          })
          .eq('search_session_id', searchSessionId)
          .eq('search_query', searchQuery)
          .order('created_at', { ascending: false })
          .limit(1);
      } catch (error) {
        console.error('Failed to track search result click:', error);
      }
    },
    [],
  );

  // Track registration funnel
  const trackRegistrationStep = useCallback(
    async (
      stepName: string,
      stepOrder: number,
      timeSpent?: number,
      formData?: Record<string, unknown>,
      droppedOff: boolean = false,
      dropOffReason?: string,
    ) => {
      try {
        await supabase.from('registration_funnel').insert({
          session_id: sessionIdRef.current,
          email: user?.email || null,
          step_name: stepName,
          step_order: stepOrder,
          time_spent: timeSpent || null,
          dropped_off: droppedOff,
          drop_off_reason: dropOffReason || null,
          form_data: (formData || null) as import('@/integrations/supabase/types').Json,
        });

        await trackEvent({
          eventType: 'registration_funnel',
          eventCategory: 'conversion',
          eventAction: droppedOff ? 'dropped_off' : 'completed',
          eventLabel: stepName,
          eventValue: stepOrder,
          metadata: { timeSpent, formData, dropOffReason },
        });
      } catch (error) {
        console.error('Failed to track registration step:', error);
      }
    },
    [user?.id, user?.email, trackEvent],
  );

  // End session on unload
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (sessionIdRef.current) {
        try {
          const timeOnPage = Math.floor((Date.now() - pageStartTimeRef.current) / 1000);

          // Mark current page as exit page
          if (currentPageRef.current) {
            await supabase.from('page_views').insert({
              session_id: sessionIdRef.current,
              user_id: user?.id || null,
              page_path: currentPageRef.current,
              page_title: document.title,
              time_on_page: timeOnPage,
              scroll_depth: getScrollDepth(),
              exit_page: true,
            });
          }

          // End session
          await supabase
            .from('user_sessions')
            .update({
              ended_at: new Date().toISOString(),
              is_active: false,
            })
            .eq('session_id', sessionIdRef.current);
        } catch (error) {
          console.error('Failed to end session:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user?.id]);

  return {
    trackPageView,
    trackEvent,
    trackListingInteraction,
    trackSearch,
    trackSearchResultClick,
    trackRegistrationStep,
    sessionId: sessionIdRef.current,
  };
}

// Helper functions
function getScrollDepth(): number {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  return scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 100;
}
