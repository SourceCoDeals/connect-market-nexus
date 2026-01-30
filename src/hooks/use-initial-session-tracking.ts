import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSessionContext } from '@/contexts/SessionContext';

// Helper functions
function getBrowserName(): string {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Edg')) return 'Edge';
  if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
  return 'Unknown';
}

function getOSName(): string {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux') && !userAgent.includes('Android')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  return 'Unknown';
}

function getDeviceType(): string {
  const userAgent = navigator.userAgent;
  if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
    return /iPad/i.test(userAgent) ? 'tablet' : 'mobile';
  }
  return 'desktop';
}

// Get GA4 Client ID from cookie for data stitching
function getGA4ClientId(): string | null {
  try {
    const match = document.cookie.match(/_ga=GA\d\.\d\.(\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Get first-touch attribution from localStorage
function getFirstTouchAttribution(): {
  first_touch_source: string | null;
  first_touch_medium: string | null;
  first_touch_campaign: string | null;
  first_touch_term: string | null;
  first_touch_content: string | null;
  first_touch_timestamp: string | null;
  first_touch_landing_page: string | null;
  first_touch_referrer: string | null;
} {
  try {
    const stored = localStorage.getItem('first_touch_attribution');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        first_touch_source: parsed.utm_source || null,
        first_touch_medium: parsed.utm_medium || null,
        first_touch_campaign: parsed.utm_campaign || null,
        first_touch_term: parsed.utm_term || null,
        first_touch_content: parsed.utm_content || null,
        first_touch_timestamp: parsed.timestamp || null,
        first_touch_landing_page: parsed.landing_page || null,
        first_touch_referrer: parsed.referrer || null,
      };
    }
  } catch {
    // Ignore localStorage errors
  }
  return {
    first_touch_source: null,
    first_touch_medium: null,
    first_touch_campaign: null,
    first_touch_term: null,
    first_touch_content: null,
    first_touch_timestamp: null,
    first_touch_landing_page: null,
    first_touch_referrer: null,
  };
}

export const useInitialSessionTracking = () => {
  const { sessionId, utmParams, referrer } = useSessionContext();
  const hasTracked = useRef(false);

  useEffect(() => {
    // Only track once per app load
    if (hasTracked.current) return;

    const trackInitialSession = async () => {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        
        console.log('🎯 Starting initial session tracking, sessionId:', sessionId);

        // Get GA4 client ID for data stitching
        const ga4ClientId = getGA4ClientId();
        
        // Get first-touch attribution data from localStorage
        const firstTouchData = getFirstTouchAttribution();

        // Prepare tracking data for edge function with enhanced landing info
        const trackingData = {
          session_id: sessionId,
          user_id: user?.id || null,
          user_agent: navigator.userAgent,
          referrer: referrer || document.referrer || null,
          device_type: getDeviceType(),
          browser: getBrowserName(),
          os: getOSName(),
          utm_source: utmParams.utm_source || null,
          utm_medium: utmParams.utm_medium || null,
          utm_campaign: utmParams.utm_campaign || null,
          utm_term: utmParams.utm_term || null,
          utm_content: utmParams.utm_content || null,
          // Enhanced landing page tracking
          landing_url: window.location.href,
          landing_path: window.location.pathname,
          landing_search: window.location.search,
          // GA4 integration for data stitching
          ga4_client_id: ga4ClientId,
          // First-touch attribution for historical analysis
          ...firstTouchData,
        };

        console.log('📤 Sending session data to track-session edge function');
        console.log('🔗 GA4 Client ID:', ga4ClientId || 'not available yet');
        console.log('📊 First-touch source:', firstTouchData.first_touch_source || 'current session');

        // Call edge function for IP geolocation and session creation
        const { data, error } = await supabase.functions.invoke('track-session', {
          body: trackingData,
        });

        if (error) {
          console.error('❌ Error tracking session via edge function:', error);
          // Fallback: create session directly without geo data
          await createSessionDirectly(trackingData);
          return;
        }

        if (data?.geo) {
          console.log('✅ Session tracked with geo data:', data.geo);
        } else {
          console.log('✅ Session tracked (no geo data available)');
        }

        // Also track initial session for first-touch attribution (for authenticated users)
        if (user?.id) {
          await trackInitialSessionForUser(user.id, trackingData);
        }

        hasTracked.current = true;

      } catch (error) {
        console.error('❌ Unexpected error in session tracking:', error);
      }
    };

    // Track first-touch attribution for authenticated users
    const trackInitialSessionForUser = async (userId: string, data: any) => {
      try {
        console.log('📊 Tracking initial session for user:', userId);
        
        const { error } = await supabase.functions.invoke('track-initial-session', {
          body: {
            user_id: userId,
            session_id: data.session_id,
            referrer: data.referrer,
            landing_page: data.landing_path,
            landing_page_query: data.landing_search,
            utm_source: data.first_touch_source || data.utm_source,
            utm_medium: data.first_touch_medium || data.utm_medium,
            utm_campaign: data.first_touch_campaign || data.utm_campaign,
            utm_term: data.first_touch_term || data.utm_term,
            utm_content: data.first_touch_content || data.utm_content,
            user_agent: data.user_agent,
            ga4_client_id: data.ga4_client_id,
          },
        });

        if (error) {
          console.error('❌ Error tracking initial session:', error);
        } else {
          console.log('✅ Initial session tracked for user');
        }
      } catch (error) {
        console.error('❌ Error in trackInitialSessionForUser:', error);
      }
    };

    // Fallback function to create session directly
    const createSessionDirectly = async (data: any) => {
      try {
        const { error } = await supabase.from('user_sessions').insert({
          session_id: data.session_id,
          user_id: data.user_id,
          started_at: new Date().toISOString(),
          user_agent: data.user_agent,
          referrer: data.referrer,
          device_type: data.device_type,
          browser: data.browser,
          os: data.os,
          utm_source: data.utm_source,
          utm_medium: data.utm_medium,
          utm_campaign: data.utm_campaign,
          utm_term: data.utm_term,
          utm_content: data.utm_content,
          is_active: true,
          last_active_at: new Date().toISOString(),
        });

        if (error) {
          console.error('❌ Fallback session creation failed:', error);
        } else {
          console.log('✅ Session created via fallback (no geo data)');
          hasTracked.current = true;
        }
      } catch (error) {
        console.error('❌ Fallback session creation error:', error);
      }
    };

    // Track after a short delay to ensure everything is loaded
    const timeoutId = setTimeout(trackInitialSession, 500);

    return () => clearTimeout(timeoutId);
  }, [sessionId, utmParams, referrer]);
};
