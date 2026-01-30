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
        };

        console.log('📤 Sending session data to track-session edge function');

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

        hasTracked.current = true;

      } catch (error) {
        console.error('❌ Unexpected error in session tracking:', error);
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
