import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export const useInitialSessionTracking = () => {
  const hasTracked = useRef(false);

  useEffect(() => {
    // Only track once per app load
    if (hasTracked.current) return;

    const trackInitialSession = async () => {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.log('👤 No authenticated user, skipping session tracking');
          return;
        }

        console.log('🎯 Starting initial session tracking for user:', user.id);

        // Get or create session ID
        let sessionId = sessionStorage.getItem('session_id');
        if (!sessionId) {
          sessionId = uuidv4();
          sessionStorage.setItem('session_id', sessionId);
          console.log('🆔 New session ID created:', sessionId);
        }

        // Extract URL parameters
        const url = new URL(window.location.href);
        const searchParams = url.searchParams;

        // Get UTM parameters
        const utmSource = searchParams.get('utm_source');
        const utmMedium = searchParams.get('utm_medium');
        const utmCampaign = searchParams.get('utm_campaign');

        // Get referrer
        const referrer = document.referrer || undefined;

        // Get landing page info
        const landingPage = window.location.href;
        const landingPageQuery = window.location.search || undefined;

        // Get User-Agent
        const userAgent = navigator.userAgent;

        // Prepare tracking data
        const trackingData = {
          user_id: user.id,
          session_id: sessionId,
          referrer,
          landing_page: landingPage,
          landing_page_query: landingPageQuery,
          utm_source: utmSource || undefined,
          utm_medium: utmMedium || undefined,
          utm_campaign: utmCampaign || undefined,
          user_agent: userAgent,
        };

        console.log('📤 Sending tracking data to edge function:', {
          user_id: trackingData.user_id,
          session_id: trackingData.session_id,
          landing_page: trackingData.landing_page,
          has_referrer: !!trackingData.referrer,
          has_utm_source: !!trackingData.utm_source,
        });

        // Call edge function to track initial session
        const { data, error } = await supabase.functions.invoke('track-initial-session', {
          body: trackingData,
        });

        if (error) {
          console.error('❌ Error tracking initial session:', error);
          return;
        }

        if (data?.already_exists) {
          console.log('ℹ️  Initial session already tracked for this user');
        } else {
          console.log('✅ Initial session tracked successfully!', data);
        }

        hasTracked.current = true;

      } catch (error) {
        console.error('❌ Unexpected error in session tracking:', error);
      }
    };

    // Track after a short delay to ensure everything is loaded
    const timeoutId = setTimeout(trackInitialSession, 1000);

    return () => clearTimeout(timeoutId);
  }, []);
};
