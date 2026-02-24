import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { errorResponse } from '../_shared/error-response.ts';

interface NotifyRequest {
  score_id: string;
  buyer_id: string;
  listing_id: string;
  composite_score: number;
  tier?: string;
}

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

    const body: NotifyRequest = await req.json();
    const { score_id, buyer_id, listing_id, composite_score, tier } = body;

    // Fetch buyer details
    const { data: buyer, error: buyerError } = await supabase
      .from('remarketing_buyers')
      .select('company_name, company_website')
      .eq('id', buyer_id)
      .single();

    if (buyerError) {
      console.error('Failed to fetch buyer:', buyerError);
      throw new Error('Buyer not found');
    }

    // Fetch listing details
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('title, category, location')
      .eq('id', listing_id)
      .single();

    if (listingError) {
      console.error('Failed to fetch listing:', listingError);
      throw new Error('Listing not found');
    }

    // Fetch all admin/owner users from the authoritative user_roles table
    const { data: admins, error: adminsError } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'owner']);

    if (adminsError) {
      console.error('Failed to fetch admins:', adminsError);
      throw new Error('Failed to fetch admins');
    }

    if (!admins || admins.length === 0) {
      console.log('No admins to notify');
      return new Response(JSON.stringify({ success: true, message: 'No admins to notify' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const effectiveTier = (tier || 'A').toUpperCase();
    const notificationType = `remarketing_${effectiveTier.toLowerCase()}_tier_match`;

    // Dedup: skip admins already notified for this score_id + type
    const { data: existingNotifs } = await supabase
      .from('admin_notifications')
      .select('admin_id')
      .eq('notification_type', notificationType)
      .contains('metadata', { score_id });
    const alreadyNotified = new Set(
      (existingNotifs || []).map((n: { admin_id: string }) => n.admin_id),
    );

    const notifications = admins
      .filter((admin) => !alreadyNotified.has(admin.user_id))
      .map((admin) => ({
        admin_id: admin.user_id,
        notification_type: notificationType,
        title: `🎯 ${effectiveTier}-Tier Match: ${buyer.company_name}`,
        message: `${buyer.company_name} scored ${Math.round(composite_score)} for "${listing.title}" - recommended for outreach`,
        action_url: `/admin/remarketing/matching/${listing_id}?highlight=${score_id}`,
        metadata: {
          score_id,
          buyer_id,
          listing_id,
          composite_score,
          tier: effectiveTier,
          buyer_name: buyer.company_name,
          listing_title: listing.title,
        },
        is_read: false,
      }));

    if (notifications.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'All admins already notified' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { error: insertError } = await supabase.from('admin_notifications').insert(notifications);

    if (insertError) {
      console.error('Failed to create notifications:', insertError);
      throw new Error('Failed to create notifications');
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified: notifications.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Notify remarketing match error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500,
      corsHeaders,
      'internal_error',
    );
  }
});
