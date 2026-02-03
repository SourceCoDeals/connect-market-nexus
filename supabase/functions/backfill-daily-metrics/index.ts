import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dev/bot traffic patterns to filter out
const DEV_TRAFFIC_PATTERNS = [
  'lovable.dev',
  'lovableproject.com',
  'preview--',
  'localhost',
  '127.0.0.1',
];

function isDevTraffic(referrer: string | null): boolean {
  if (!referrer) return false;
  const lowerReferrer = referrer.toLowerCase();
  return DEV_TRAFFIC_PATTERNS.some(pattern => lowerReferrer.includes(pattern));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Check if this is the service role key (for cron jobs)
    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === supabaseServiceKey;

    if (!isServiceRole) {
      // Verify admin access for manual calls
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: userError } = await authClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: profile } = await authClient
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const startDate = body.startDate || '2025-07-21';
    const endDate = body.endDate || new Date().toISOString().split('T')[0];
    const delayMs = body.delayMs || 50;

    console.log(`Starting backfill from ${startDate} to ${endDate}`);

    const results: Array<{ date: string; success: boolean; visitors?: number; sessions?: number; error?: string }> = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);
    let processedCount = 0;

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      try {
        const metrics = await aggregateMetricsForDate(supabase, dateStr);
        
        const { error: upsertError } = await supabase
          .from('daily_metrics')
          .upsert(metrics, { onConflict: 'date' });

        if (upsertError) {
          console.error(`Failed to upsert for ${dateStr}:`, upsertError);
          results.push({ date: dateStr, success: false, error: upsertError.message });
        } else {
          results.push({ date: dateStr, success: true, visitors: metrics.unique_visitors, sessions: metrics.total_sessions });
          processedCount++;
        }

        if (processedCount % 10 === 0) {
          console.log(`Processed ${processedCount} days...`);
        }

      } catch (err) {
        console.error(`Error processing ${dateStr}:`, err);
        results.push({ date: dateStr, success: false, error: String(err) });
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Backfill complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfilled ${successCount} days (${failCount} failed)`,
        startDate,
        endDate,
        totalDays: results.length,
        successCount,
        failCount,
        failures: results.filter(r => !r.success),
        lastResults: results.slice(-5),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Backfill error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function aggregateMetricsForDate(supabase: any, targetDate: string) {
  const startOfDay = `${targetDate}T00:00:00Z`;
  const endOfDay = `${targetDate}T23:59:59Z`;

  // Get total users count
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .lte('created_at', endOfDay);

  // Get new signups for the day
  const { count: newSignups } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  // Get session data WITH referrer, visitor_id, user_id for proper filtering and counting
  const { data: sessions } = await supabase
    .from('user_sessions')
    .select('session_id, user_id, visitor_id, session_duration_seconds, referrer')
    .gte('started_at', startOfDay)
    .lte('started_at', endOfDay);

  // CRITICAL: Filter out dev traffic
  const productionSessions = (sessions || []).filter((s: any) => !isDevTraffic(s.referrer));
  
  // Deduplicate by session_id
  const uniqueSessionMap = new Map<string, any>();
  productionSessions.forEach((s: any) => {
    if (!uniqueSessionMap.has(s.session_id)) {
      uniqueSessionMap.set(s.session_id, s);
    }
  });
  const uniqueSessions = Array.from(uniqueSessionMap.values());
  
  const totalSessions = uniqueSessions.length;
  
  // CRITICAL FIX: Count unique VISITORS (people), not sessions
  // Only count sessions with identifiable visitors (user_id or visitor_id)
  const uniqueVisitorSet = new Set<string>();
  uniqueSessions.forEach((s: any) => {
    // Only count if we have a real user/visitor identifier - NOT session_id fallback
    if (s.user_id) uniqueVisitorSet.add(s.user_id);
    else if (s.visitor_id) uniqueVisitorSet.add(s.visitor_id);
    // Anonymous sessions (no user_id or visitor_id) are NOT counted as unique visitors
  });
  const uniqueVisitors = uniqueVisitorSet.size;
  
  // Active logged-in users
  const activeUsers = new Set(uniqueSessions.filter((s: any) => s.user_id).map((s: any) => s.user_id)).size;
  
  // Average session duration
  const sessionsWithDuration = uniqueSessions.filter((s: any) => s.session_duration_seconds && s.session_duration_seconds > 0);
  const avgSessionDuration = sessionsWithDuration.length > 0
    ? Math.round(sessionsWithDuration.reduce((sum: number, s: any) => sum + (s.session_duration_seconds || 0), 0) / sessionsWithDuration.length)
    : 0;

  // Get page views
  const { count: pageViews } = await supabase
    .from('page_views')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  // Get unique page views
  const { data: pageViewData } = await supabase
    .from('page_views')
    .select('session_id')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);
  
  const uniquePageViews = new Set(pageViewData?.map((p: any) => p.session_id)).size;

  // Get listing views
  const { count: listingViews } = await supabase
    .from('listing_analytics')
    .select('*', { count: 'exact', head: true })
    .eq('action_type', 'view')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  // Get new listings
  const { count: newListings } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  // Get connection requests
  const { count: connectionRequests } = await supabase
    .from('connection_requests')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  // Get successful connections
  const { count: successfulConnections } = await supabase
    .from('connection_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .gte('approved_at', startOfDay)
    .lte('approved_at', endOfDay);

  // Get searches performed
  const { count: searchesPerformed } = await supabase
    .from('search_analytics')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  // Calculate bounce rate
  const pageCountsBySession: Record<string, number> = {};
  pageViewData?.forEach((p: any) => {
    pageCountsBySession[p.session_id] = (pageCountsBySession[p.session_id] || 0) + 1;
  });
  
  const totalSessionsWithViews = Object.keys(pageCountsBySession).length;
  const bouncedSessions = Object.values(pageCountsBySession).filter(count => count === 1).length;
  const bounceRate = totalSessionsWithViews > 0 
    ? Math.round((bouncedSessions / totalSessionsWithViews) * 100) 
    : 0;

  // CRITICAL: Conversion rate uses unique visitors, not sessions or page views
  const conversionRate = uniqueVisitors > 0 
    ? Math.round(((connectionRequests || 0) / uniqueVisitors) * 10000) / 100
    : 0;

  return {
    date: targetDate,
    total_users: totalUsers || 0,
    new_signups: newSignups || 0,
    active_users: activeUsers,
    returning_users: 0,
    total_sessions: totalSessions,
    unique_visitors: uniqueVisitors, // NEW: proper unique people count
    avg_session_duration: avgSessionDuration,
    page_views: pageViews || 0,
    unique_page_views: uniquePageViews,
    listing_views: listingViews || 0,
    new_listings: newListings || 0,
    connection_requests: connectionRequests || 0,
    successful_connections: successfulConnections || 0,
    searches_performed: searchesPerformed || 0,
    bounce_rate: bounceRate,
    conversion_rate: conversionRate,
    updated_at: new Date().toISOString(),
  };
}
