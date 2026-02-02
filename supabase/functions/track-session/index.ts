import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeoData {
  country: string;
  country_code: string;
  city: string;
  region: string;
  timezone: string;
  isp?: string;
}

interface SessionData {
  session_id: string;
  user_id?: string;
  user_agent: string;
  referrer?: string;
  device_type: string;
  browser: string;
  os: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  ga4_client_id?: string;
  first_touch_source?: string;
  first_touch_medium?: string;
  first_touch_campaign?: string;
  first_touch_landing_page?: string;
  first_touch_referrer?: string;
  visitor_id?: string;
  landing_url?: string;
  landing_path?: string;
  landing_search?: string;
  time_on_page?: number;
  // Cross-domain tracking params (from sourcecodeals.com)
  original_referrer?: string;
  original_referrer_host?: string; // Hardened version - hostname only (privacy-safe)
  blog_landing?: string;
  sco_entry_time?: string;
  // Ad tracking IDs
  gclid?: string;
  fbclid?: string;
  li_fat_id?: string; // LinkedIn ad tracking
}

async function getGeoData(ip: string): Promise<GeoData | null> {
  if (ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '::1') {
    console.log('Skipping geolocation for local/private IP:', ip);
    return null;
  }

  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,timezone,isp`);
    
    if (!response.ok) {
      console.error('Geo API response not OK:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.status === 'fail') {
      console.error('Geo API failed:', data.message);
      return null;
    }

    return {
      country: data.country || 'Unknown',
      country_code: data.countryCode || 'XX',
      city: data.city || 'Unknown',
      region: data.regionName || 'Unknown',
      timezone: data.timezone || 'UTC',
      isp: data.isp || null,
    };
  } catch (error) {
    console.error('Failed to get geo data:', error);
    return null;
  }
}

function getClientIP(req: Request): string {
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIP = req.headers.get('x-real-ip');
  if (xRealIP) return xRealIP;

  return '127.0.0.1';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SessionData = await req.json();
    const clientIP = getClientIP(req);
    
    console.log('Track session request:', {
      session_id: body.session_id,
      client_ip: clientIP,
      user_agent: body.user_agent?.substring(0, 50) + '...',
    });

    // Get geographic data from IP
    const geoData = await getGeoData(clientIP);
    console.log('Geo data result:', geoData);

    // Use UPSERT to prevent race condition duplicates
    // The session_id column has a UNIQUE constraint
    const initialDuration = body.time_on_page || 0;
    
    const { data: upsertResult, error: upsertError } = await supabase
      .from('user_sessions')
      .upsert({
        session_id: body.session_id,
        visitor_id: body.visitor_id || null,
        user_id: body.user_id || null,
        started_at: new Date().toISOString(),
        user_agent: body.user_agent,
        referrer: body.referrer || null,
        device_type: body.device_type,
        browser: body.browser,
        os: body.os,
        ip_address: clientIP,
        country: geoData?.country || null,
        country_code: geoData?.country_code || null,
        city: geoData?.city || null,
        region: geoData?.region || null,
        timezone: geoData?.timezone || null,
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        utm_term: body.utm_term || null,
        utm_content: body.utm_content || null,
        ga4_client_id: body.ga4_client_id || null,
        first_touch_source: body.first_touch_source || null,
        first_touch_medium: body.first_touch_medium || null,
        first_touch_campaign: body.first_touch_campaign || null,
        first_touch_landing_page: body.first_touch_landing_page || null,
        first_touch_referrer: body.first_touch_referrer || null,
        is_active: true,
        last_active_at: new Date().toISOString(),
        session_duration_seconds: initialDuration,
        // Cross-domain tracking: capture original referrer from blog
        original_external_referrer: body.original_referrer || null,
        blog_landing_page: body.blog_landing || null,
      }, {
        onConflict: 'session_id',
        ignoreDuplicates: false,
      })
      .select('id')
      .maybeSingle();

    if (upsertError) {
      console.error('Failed to upsert session:', upsertError);
      throw upsertError;
    }

    // Upsert user_journeys record for cross-session tracking
    if (body.visitor_id) {
      console.log('Upserting user journey for visitor:', body.visitor_id);
      
      const { error: journeyError } = await supabase
        .from('user_journeys')
        .upsert({
          visitor_id: body.visitor_id,
          ga4_client_id: body.ga4_client_id || null,
          user_id: body.user_id || null,
          first_seen_at: new Date().toISOString(),
          first_landing_page: body.landing_path || null,
          first_referrer: body.referrer || null,
          first_utm_source: body.first_touch_source || body.utm_source || null,
          first_utm_medium: body.first_touch_medium || body.utm_medium || null,
          first_utm_campaign: body.first_touch_campaign || body.utm_campaign || null,
          first_utm_term: body.utm_term || null,
          first_utm_content: body.utm_content || null,
          first_device_type: body.device_type,
          first_browser: body.browser,
          first_os: body.os,
          first_country: geoData?.country || null,
          first_city: geoData?.city || null,
          last_seen_at: new Date().toISOString(),
          last_session_id: body.session_id,
          last_page_path: body.landing_path || null,
          journey_stage: body.user_id ? 'registered' : 'anonymous',
        }, {
          onConflict: 'visitor_id',
          ignoreDuplicates: false,
        });

      if (journeyError) {
        console.error('Failed to upsert journey:', journeyError);
      } else {
        // Increment session count
        try {
          await supabase.rpc('increment_journey_sessions', { 
            p_visitor_id: body.visitor_id,
            p_session_id: body.session_id,
            p_page_path: body.landing_path || '/'
          });
        } catch (rpcErr) {
          console.error('RPC increment error:', rpcErr);
        }
        
        console.log('User journey upserted successfully');
      }
    }

    console.log('Session tracked successfully');
    return new Response(
      JSON.stringify({ 
        success: true,
        geo: geoData ? { country: geoData.country, city: geoData.city } : null 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Track session error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
