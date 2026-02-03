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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify admin access (or service role for cron jobs)
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

    // Parse optional date parameter (default to yesterday for cron jobs)
    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || getYesterdayDate();
    
    console.log(`Aggregating metrics for date: ${targetDate}`);

    const startOfDay = `${targetDate}T00:00:00Z`;
    const endOfDay = `${targetDate}T23:59:59Z`;

    // Get total users count
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Get new signups for the day
    const { count: newSignups } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    // Get session data WITH referrer for filtering dev traffic
    const { data: sessions } = await supabase
      .from('user_sessions')
      .select('session_id, user_id, visitor_id, session_duration_seconds, is_active, referrer')
      .gte('started_at', startOfDay)
      .lte('started_at', endOfDay);

    // CRITICAL: Filter out dev traffic and deduplicate
    const productionSessions = (sessions || []).filter(s => !isDevTraffic(s.referrer));
    
    // Deduplicate by session_id
    const uniqueSessionMap = new Map<string, typeof productionSessions[0]>();
    productionSessions.forEach(s => {
      if (!uniqueSessionMap.has(s.session_id)) {
        uniqueSessionMap.set(s.session_id, s);
      }
    });
    const uniqueSessions = Array.from(uniqueSessionMap.values());
    
    const totalSessions = uniqueSessions.length;
    
    // CRITICAL FIX: Count unique VISITORS (people), not sessions
    // Only count sessions with identifiable visitors (user_id or visitor_id)
    const uniqueVisitorSet = new Set<string>();
    uniqueSessions.forEach(s => {
      // Only count if we have a real user/visitor identifier - NOT session_id fallback
      if (s.user_id) uniqueVisitorSet.add(s.user_id);
      else if (s.visitor_id) uniqueVisitorSet.add(s.visitor_id);
      // Anonymous sessions (no user_id or visitor_id) are NOT counted as unique visitors
    });
    const uniqueVisitors = uniqueVisitorSet.size;
    
    // Active users (logged in users only)
    const activeUsers = new Set(uniqueSessions.filter(s => s.user_id).map(s => s.user_id)).size;
    
    // Calculate average session duration
    const sessionsWithDuration = uniqueSessions.filter(s => s.session_duration_seconds && s.session_duration_seconds > 0);
    const avgSessionDuration = sessionsWithDuration.length > 0
      ? Math.round(sessionsWithDuration.reduce((sum, s) => sum + (s.session_duration_seconds || 0), 0) / sessionsWithDuration.length)
      : 0;

    // Get page views
    const { count: pageViews } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    // Get unique page views (distinct session_ids)
    const { data: uniquePageViewData } = await supabase
      .from('page_views')
      .select('session_id')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);
    
    const uniquePageViews = new Set(uniquePageViewData?.map(p => p.session_id)).size;

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

    // Get successful connections (approved)
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

    // Calculate bounce rate (sessions with only 1 page view)
    const { data: sessionPageCounts } = await supabase
      .from('page_views')
      .select('session_id')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const pageCountsBySession: Record<string, number> = {};
    sessionPageCounts?.forEach(p => {
      pageCountsBySession[p.session_id] = (pageCountsBySession[p.session_id] || 0) + 1;
    });
    
    const totalSessionsWithViews = Object.keys(pageCountsBySession).length;
    const bouncedSessions = Object.values(pageCountsBySession).filter(count => count === 1).length;
    const bounceRate = totalSessionsWithViews > 0 
      ? Math.round((bouncedSessions / totalSessionsWithViews) * 100) 
      : 0;

    // CRITICAL FIX: Calculate conversion rate using unique visitors, not sessions
    const conversionRate = uniqueVisitors > 0 
      ? Math.round(((connectionRequests || 0) / uniqueVisitors) * 10000) / 100
      : 0;

    // Returning users (users who had sessions before this day)
    const { data: todayUserIds } = await supabase
      .from('user_sessions')
      .select('user_id')
      .gte('started_at', startOfDay)
      .lte('started_at', endOfDay)
      .not('user_id', 'is', null);

    const uniqueTodayUsers = [...new Set(todayUserIds?.map(u => u.user_id))];
    
    let returningUsers = 0;
    if (uniqueTodayUsers.length > 0) {
      const { count } = await supabase
        .from('user_sessions')
        .select('user_id', { count: 'exact', head: true })
        .in('user_id', uniqueTodayUsers)
        .lt('started_at', startOfDay);
      returningUsers = count || 0;
    }

    // Upsert the metrics
    const metrics = {
      date: targetDate,
      total_users: totalUsers || 0,
      new_signups: newSignups || 0,
      active_users: activeUsers,
      returning_users: returningUsers,
      total_sessions: totalSessions,
      unique_visitors: uniqueVisitors, // NEW: unique people count
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

    console.log('Computed metrics:', metrics);

    // Upsert (insert or update on conflict)
    const { error: upsertError } = await supabase
      .from('daily_metrics')
      .upsert(metrics, { onConflict: 'date' });

    if (upsertError) {
      console.error('Failed to upsert daily metrics:', upsertError);
      throw upsertError;
    }

    console.log(`Successfully aggregated metrics for ${targetDate}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        date: targetDate,
        metrics 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Aggregate metrics error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}
