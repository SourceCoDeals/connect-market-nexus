import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

interface TrackingData {
  user_id: string;
  session_id: string;
  referrer?: string;
  landing_page: string;
  landing_page_query?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  user_agent: string;
  ga4_client_id?: string;
}

interface ParsedUserAgent {
  browser: string;
  browser_type: string;
  device_type: string;
  platform: string;
}

// Parse User-Agent string to extract browser, device, and platform information
function parseUserAgent(userAgent: string): ParsedUserAgent {
  const ua = userAgent.toLowerCase();
  
  // Detect browser
  let browser = 'Unknown';
  let browser_type = 'Unknown';
  
  if (ua.includes('edg/')) {
    const version = userAgent.match(/Edg\/([\d.]+)/)?.[1] || '';
    browser = `Edge ${version}`;
    browser_type = 'Edge';
  } else if (ua.includes('chrome/') && !ua.includes('edg/')) {
    const version = userAgent.match(/Chrome\/([\d.]+)/)?.[1] || '';
    browser = `Chrome ${version}`;
    browser_type = 'Chrome';
  } else if (ua.includes('firefox/')) {
    const version = userAgent.match(/Firefox\/([\d.]+)/)?.[1] || '';
    browser = `Firefox ${version}`;
    browser_type = 'Firefox';
  } else if (ua.includes('safari/') && !ua.includes('chrome')) {
    const version = userAgent.match(/Version\/([\d.]+)/)?.[1] || '';
    browser = `Safari ${version}`;
    browser_type = 'Safari';
  } else if (ua.includes('opera/') || ua.includes('opr/')) {
    const version = userAgent.match(/(?:Opera|OPR)\/([\d.]+)/)?.[1] || '';
    browser = `Opera ${version}`;
    browser_type = 'Opera';
  }
  
  // Detect device type
  let device_type = 'Desktop';
  
  if (ua.includes('mobile')) {
    device_type = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device_type = 'Tablet';
  }
  
  // Detect platform/OS
  let platform = 'Unknown';
  
  if (ua.includes('windows nt 10')) {
    platform = 'Windows 10/11';
  } else if (ua.includes('windows nt 6.3')) {
    platform = 'Windows 8.1';
  } else if (ua.includes('windows nt 6.2')) {
    platform = 'Windows 8';
  } else if (ua.includes('windows nt 6.1')) {
    platform = 'Windows 7';
  } else if (ua.includes('windows')) {
    platform = 'Windows';
  } else if (ua.includes('mac os x')) {
    const version = userAgent.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '';
    platform = version ? `macOS ${version}` : 'macOS';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    platform = 'iOS';
  } else if (ua.includes('android')) {
    const version = userAgent.match(/Android ([\d.]+)/)?.[1] || '';
    platform = version ? `Android ${version}` : 'Android';
  } else if (ua.includes('linux')) {
    platform = 'Linux';
  } else if (ua.includes('cros')) {
    platform = 'Chrome OS';
  }
  
  return {
    browser,
    browser_type,
    device_type,
    platform,
  };
}

// Determine marketing channel from referrer and UTM data
function getMarketingChannel(referrer: string | undefined, utm_source: string | undefined): string {
  if (utm_source) {
    return utm_source;
  }
  
  if (!referrer || referrer === 'Direct') {
    return 'Direct';
  }
  
  const lower = referrer.toLowerCase();
  
  if (lower.includes('google.com') || lower.includes('google.')) {
    return 'Google';
  }
  if (lower.includes('facebook.com') || lower.includes('fb.com')) {
    return 'Facebook';
  }
  if (lower.includes('linkedin.com')) {
    return 'LinkedIn';
  }
  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    return 'Twitter/X';
  }
  if (lower.includes('instagram.com')) {
    return 'Instagram';
  }
  if (lower.includes('youtube.com')) {
    return 'YouTube';
  }
  if (lower.includes('bing.com')) {
    return 'Bing';
  }
  if (lower.includes('yahoo.com')) {
    return 'Yahoo';
  }
  
  return 'Referral';
}

// Extract short referrer hostname
function getShortReferrer(url: string | undefined): string {
  if (!url) return 'Direct';
  
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '');
  } catch {
    return url;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  console.log('📊 Track initial session function invoked');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    // Create Supabase client with service role for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('✅ Supabase client initialized');

    // Parse request body
    const trackingData: TrackingData = await req.json();
    
    // Validate required fields
    if (!trackingData.user_id || !trackingData.session_id) {
      console.error('❌ Missing required fields: user_id or session_id');
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('📥 Tracking data received:', {
      user_id: trackingData.user_id,
      session_id: trackingData.session_id,
      landing_page: trackingData.landing_page,
      referrer: trackingData.referrer,
      utm_source: trackingData.utm_source,
      utm_medium: trackingData.utm_medium,
    });

    // Check if initial session already exists for this user
    const { data: existingSession, error: checkError } = await supabase
      .from('user_initial_session')
      .select('id')
      .eq('user_id', trackingData.user_id)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking existing session:', checkError);
      throw checkError;
    }

    if (existingSession) {
      console.log('ℹ️  Initial session already exists for user, skipping');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Initial session already recorded',
          already_exists: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse User-Agent
    const userAgentData = parseUserAgent(trackingData.user_agent);
    console.log('🔍 Parsed User-Agent:', userAgentData);

    // Determine marketing channel
    const marketingChannel = getMarketingChannel(
      trackingData.referrer,
      trackingData.utm_source
    );
    console.log('📢 Marketing channel:', marketingChannel);

    // Get short referrer
    const shortReferrer = getShortReferrer(trackingData.referrer);

    // Prepare initial session data with GA4 client ID and full UTM params
    const initialSessionData = {
      user_id: trackingData.user_id,
      session_id: trackingData.session_id,
      referrer: shortReferrer,
      full_referrer: trackingData.referrer || null,
      landing_page: trackingData.landing_page,
      landing_page_query: trackingData.landing_page_query || null,
      utm_source: trackingData.utm_source || null,
      utm_medium: trackingData.utm_medium || null,
      utm_campaign: trackingData.utm_campaign || null,
      utm_term: trackingData.utm_term || null,
      utm_content: trackingData.utm_content || null,
      browser: userAgentData.browser,
      browser_type: userAgentData.browser_type,
      device_type: userAgentData.device_type,
      platform: userAgentData.platform,
      marketing_channel: marketingChannel,
      ga4_client_id: trackingData.ga4_client_id || null,
      location: null, // Will be populated later if we add IP geolocation
      first_seen_at: new Date().toISOString(),
    };

    console.log('💾 Inserting initial session data...');

    // Insert initial session data
    const { data: insertedData, error: insertError } = await supabase
      .from('user_initial_session')
      .insert(initialSessionData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error inserting initial session:', insertError);
      throw insertError;
    }

    console.log('✅ Initial session data saved successfully!');
    console.log('📊 Session details:', {
      browser: userAgentData.browser_type,
      device: userAgentData.device_type,
      platform: userAgentData.platform,
      channel: marketingChannel,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Initial session tracked successfully',
        data: insertedData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ Unexpected error in track-initial-session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
