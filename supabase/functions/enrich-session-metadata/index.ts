import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    // N04 FIX: Require admin authentication
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller identity
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin-only: this function modifies ALL user sessions
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: user.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batchSize || 500, 1000); // Cap batch size
    const maxBatches = Math.min(body.maxBatches || 100, 200); // Cap max batches

    console.log(`Starting session metadata enrichment with batch size ${batchSize}`);

    let totalProcessed = 0;
    let totalUpdated = 0;
    let batchCount = 0;

    while (batchCount < maxBatches) {
      // Get sessions with user_agent but missing browser data
      const { data: sessions, error: fetchError } = await supabase
        .from('user_sessions')
        .select('id, user_agent')
        .is('browser', null)
        .not('user_agent', 'is', null)
        .limit(batchSize);

      if (fetchError) {
        console.error('Error fetching sessions:', fetchError);
        throw fetchError;
      }

      if (!sessions || sessions.length === 0) {
        console.log('No more sessions to process');
        break;
      }

      console.log(`Processing batch ${batchCount + 1}: ${sessions.length} sessions`);

      // Process each session
      const updates = sessions.map(session => {
        const parsed = parseUserAgent(session.user_agent);
        return {
          id: session.id,
          browser: parsed.browser,
          os: parsed.os,
          device_type: parsed.device,
        };
      });

      // Batch update
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('user_sessions')
          .update({
            browser: update.browser,
            os: update.os,
            device_type: update.device_type,
          })
          .eq('id', update.id);

        if (!updateError) {
          totalUpdated++;
        }
      }

      totalProcessed += sessions.length;
      batchCount++;

      console.log(`Batch ${batchCount} complete. Total processed: ${totalProcessed}, Updated: ${totalUpdated}`);

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Enrichment complete: ${totalUpdated} sessions updated out of ${totalProcessed} processed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Enriched ${totalUpdated} sessions`,
        totalProcessed,
        totalUpdated,
        batchesProcessed: batchCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Enrichment error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  if (!ua) {
    return { browser: 'Unknown', os: 'Unknown', device: 'desktop' };
  }

  // Browser detection (order matters - check more specific first)
  let browser = 'Unknown';
  if (ua.includes('Edg/') || ua.includes('Edge/')) {
    browser = 'Edge';
  } else if (ua.includes('OPR/') || ua.includes('Opera')) {
    browser = 'Opera';
  } else if (ua.includes('Chrome/') && !ua.includes('Chromium')) {
    browser = 'Chrome';
  } else if (ua.includes('Firefox/')) {
    browser = 'Firefox';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari';
  } else if (ua.includes('MSIE') || ua.includes('Trident/')) {
    browser = 'Internet Explorer';
  }

  // OS detection
  let os = 'Unknown';
  if (ua.includes('Windows NT')) {
    os = 'Windows';
  } else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) {
    os = 'macOS';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) {
    os = 'iOS';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  } else if (ua.includes('CrOS')) {
    os = 'ChromeOS';
  }

  // Device type detection
  let device = 'desktop';
  if (/iPad/i.test(ua)) {
    device = 'tablet';
  } else if (/Mobile|Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    device = 'mobile';
  }

  return { browser, os, device };
}
