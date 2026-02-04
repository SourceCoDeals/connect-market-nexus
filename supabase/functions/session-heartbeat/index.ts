import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HeartbeatData {
  session_id: string;
  user_id?: string;
  page_path?: string;
  scroll_depth?: number;
  is_focused?: boolean;
  ended?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: HeartbeatData = await req.json();
    
    if (!body.session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();

    // Handle session end (from beforeunload)
    if (body.ended) {
      const { error: endError } = await supabase
        .from('user_sessions')
        .update({
          ended_at: now.toISOString(),
          is_active: false,
          updated_at: now.toISOString(),
        })
        .eq('session_id', body.session_id);

      if (endError) {
        console.error('Failed to end session:', endError);
      }

      return new Response(
        JSON.stringify({ success: true, ended: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current session to calculate duration (use limit(1) to handle duplicates gracefully)
    const { data: sessions, error: selectError } = await supabase
      .from('user_sessions')
      .select('started_at, session_duration_seconds')
      .eq('session_id', body.session_id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    const session = sessions?.[0] ?? null;

    if (selectError) {
      console.error('Failed to get session:', selectError);
      throw selectError;
    }

    // If session doesn't exist yet, return gracefully
    // Session creation is handled by track-session edge function to prevent race conditions with journey tracking
    if (!session) {
      console.log('Session not found (will be created by track-session):', body.session_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          pending: true,
          message: 'Session will be created by track-session',
          last_active_at: now.toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate session duration
    const startedAt = new Date(session.started_at);
    const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

    // Update session with heartbeat data
    const { error: updateError } = await supabase
      .from('user_sessions')
      .update({
        last_active_at: now.toISOString(),
        session_duration_seconds: durationSeconds,
        is_active: true,
        user_id: body.user_id || undefined,
        updated_at: now.toISOString(),
      })
      .eq('session_id', body.session_id);

    if (updateError) {
      console.error('Failed to update session heartbeat:', updateError);
      throw updateError;
    }

    console.log(`Heartbeat: session ${body.session_id.substring(0, 20)}..., duration: ${durationSeconds}s`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        duration_seconds: durationSeconds,
        last_active_at: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Heartbeat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
