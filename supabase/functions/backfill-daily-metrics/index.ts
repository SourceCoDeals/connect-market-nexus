import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const startDate = body.startDate || '2025-07-21';
    const endDate = body.endDate || new Date().toISOString().split('T')[0];
    const delayMs = body.delayMs || 100; // Reduced delay for faster processing

    console.log(`Starting backfill from ${startDate} to ${endDate}`);

    const results: Array<{ date: string; success: boolean; error?: string }> = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);
    let processedCount = 0;

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      try {
        // Aggregate metrics for this specific date
        const metrics = await aggregateMetricsForDate(supabase, dateStr);
        
        // Upsert to daily_metrics table
        const { error: upsertError } = await supabase
          .from('daily_metrics')
          .upsert(metrics, { onConflict: 'date' });

        if (upsertError) {
          console.error(`Failed to upsert for ${dateStr}:`, upsertError);
          results.push({ date: dateStr, success: false, error: upsertError.message });
        } else {
          results.push({ date: dateStr, success: true });
          processedCount++;
        }

        // Log progress every 10 days
        if (processedCount % 10 === 0) {
          console.log(`Processed ${processedCount} days...`);
        }

      } catch (err) {
        console.error(`Error processing ${dateStr}:`, err);
        results.push({ date: dateStr, success: false, error: String(err) });
      }

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      // Move to next day
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
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function aggregateMetricsForDate(supabase: any, targetDate: string) {
  const startOfDay = `${targetDate}T00:00:00Z`;
  const endOfDay = `${targetDate}T23:59:59Z`;

  // Get total users count (cumulative up to this date)
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

  // Get session data
  const { data: sessions } = await supabase
    .from('user_sessions')
    .select('user_id, session_duration_seconds, is_active')
    .gte('started_at', startOfDay)
    .lte('started_at', endOfDay);

  const totalSessions = sessions?.length || 0;
  const activeUsers = new Set(sessions?.filter((s: any) => s.user_id).map((s: any) => s.user_id)).size;
  
  // Calculate average session duration
  const sessionsWithDuration = sessions?.filter((s: any) => s.session_duration_seconds && s.session_duration_seconds > 0) || [];
  const avgSessionDuration = sessionsWithDuration.length > 0
    ? Math.round(sessionsWithDuration.reduce((sum: number, s: any) => sum + (s.session_duration_seconds || 0), 0) / sessionsWithDuration.length)
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
  
  const uniquePageViews = new Set(uniquePageViewData?.map((p: any) => p.session_id)).size;

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
  sessionPageCounts?.forEach((p: any) => {
    pageCountsBySession[p.session_id] = (pageCountsBySession[p.session_id] || 0) + 1;
  });
  
  const totalSessionsWithViews = Object.keys(pageCountsBySession).length;
  const bouncedSessions = Object.values(pageCountsBySession).filter(count => count === 1).length;
  const bounceRate = totalSessionsWithViews > 0 
    ? Math.round((bouncedSessions / totalSessionsWithViews) * 100) 
    : 0;

  // Calculate conversion rate
  const conversionRate = (pageViews || 0) > 0 
    ? Math.round(((connectionRequests || 0) / (pageViews || 1)) * 10000) / 100
    : 0;

  // Returning users calculation (simplified for backfill)
  const returningUsers = 0; // This would require complex cross-day queries

  return {
    date: targetDate,
    total_users: totalUsers || 0,
    new_signups: newSignups || 0,
    active_users: activeUsers,
    returning_users: returningUsers,
    total_sessions: totalSessions,
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
