import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { errorResponse } from '../_shared/error-response.ts';

interface TrackSignalRequest {
  listing_id: string;
  buyer_id: string;
  signal_type: SignalType;
  signal_value?: number; // Optional: override default value
  notes?: string;
  source?: 'manual' | 'email_tracking' | 'crm_integration' | 'system_detected';
}

type SignalType =
  | 'site_visit'
  | 'financial_request'
  | 'ceo_involvement'
  | 'nda_signed'
  | 'ioi_submitted'
  | 'loi_submitted'
  | 'call_scheduled'
  | 'management_presentation'
  | 'data_room_access'
  | 'email_engagement';

// Default point values for each signal type (per Whispers spec)
const SIGNAL_VALUES: Record<SignalType, number> = {
  site_visit: 20,
  financial_request: 30,
  ceo_involvement: 40,
  nda_signed: 25,
  ioi_submitted: 60,
  loi_submitted: 100,
  call_scheduled: 15,
  management_presentation: 35,
  data_room_access: 30,
  email_engagement: 10,
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth guard: require valid JWT + admin role
    const authHeader = req.headers.get('Authorization') || '';
    const callerToken = authHeader.replace('Bearer ', '').trim();
    if (!callerToken) {
      return errorResponse('Unauthorized', 401, corsHeaders, 'unauthorized');
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${callerToken}` } },
    });
    const {
      data: { user: callerUser },
      error: callerError,
    } = await anonClient.auth.getUser();
    if (callerError || !callerUser) {
      return errorResponse('Unauthorized', 401, corsHeaders, 'unauthorized');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: callerUser.id });
    if (!isAdmin) {
      return errorResponse('Forbidden: admin access required', 403, corsHeaders, 'forbidden');
    }

    const body: TrackSignalRequest = await req.json();
    const { listing_id, buyer_id, signal_type, signal_value, notes, source = 'manual' } = body;

    // Validate required fields
    if (!listing_id || !buyer_id || !signal_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: listing_id, buyer_id, signal_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate signal type
    if (!Object.prototype.hasOwnProperty.call(SIGNAL_VALUES, signal_type)) {
      return new Response(
        JSON.stringify({
          error: `Invalid signal_type. Must be one of: ${Object.keys(SIGNAL_VALUES).join(', ')}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Use default value if not provided
    const finalValue = signal_value !== undefined ? signal_value : SIGNAL_VALUES[signal_type];

    // Insert engagement signal
    const { data: signal, error: insertError } = await supabase
      .from('engagement_signals')
      .insert({
        listing_id,
        buyer_id,
        signal_type,
        signal_value: finalValue,
        signal_date: new Date().toISOString(),
        source,
        notes: notes || null,
        created_by: callerUser.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert engagement signal:', insertError);
      return new Response(
        JSON.stringify({
          error: 'Failed to record engagement signal',
          details: insertError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Calculate total engagement score for this buyer-listing pair (for response only)
    const { data: totalScore, error: scoreError } = await supabase.rpc(
      'calculate_engagement_score',
      {
        p_listing_id: listing_id,
        p_buyer_id: buyer_id,
      },
    );

    if (scoreError) {
      console.warn('Failed to calculate total engagement score:', scoreError);
    }

    // Update the remarketing_scores table with this signal's points only.
    // We add `finalValue` (not the running `totalScore`) to avoid cumulative inflation
    // where each call would re-add the entire historical total.
    if (!scoreError) {
      const { data: existingScore } = await supabase
        .from('remarketing_scores')
        .select('id, composite_score, fit_reasoning')
        .eq('listing_id', listing_id)
        .eq('buyer_id', buyer_id)
        .maybeSingle();

      if (existingScore) {
        const { error: updateError } = await supabase
          .from('remarketing_scores')
          .update({
            composite_score: Math.min(100, existingScore.composite_score + finalValue),
            fit_reasoning: `${existingScore.fit_reasoning || ''}\n\nEngagement Bonus: +${finalValue} points from ${signal_type}`,
          })
          .eq('id', existingScore.id);

        if (updateError) {
          console.warn('Failed to update remarketing score with engagement bonus:', updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        signal,
        total_engagement_score: totalScore || finalValue,
        message: `Recorded ${signal_type} signal (+${finalValue} points)`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Track engagement signal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
