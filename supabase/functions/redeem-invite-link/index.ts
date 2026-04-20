import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse body
    const { token } = await req.json();
    if (!token || typeof token !== 'string' || token.length < 10) {
      return new Response(JSON.stringify({ error: 'Invalid invite token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create admin client for service-role operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify the JWT to get user info
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up the invite link
    const { data: invite, error: lookupError } = await supabaseAdmin
      .from('invite_links')
      .select('*')
      .eq('token', token)
      .single();

    if (lookupError || !invite) {
      return new Response(JSON.stringify({ error: 'Invite link not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already used
    if (invite.used_at) {
      return new Response(JSON.stringify({ error: 'This invite link has already been used' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check expiry
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This invite link has expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check domain restriction
    if (invite.allowed_email_domain) {
      const userDomain = (user.email || '').split('@')[1]?.toLowerCase();
      if (userDomain !== invite.allowed_email_domain.toLowerCase()) {
        return new Response(
          JSON.stringify({
            error: `This invite is restricted to @${invite.allowed_email_domain} email addresses`,
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Atomically mark token as used
    const { error: updateTokenError } = await supabaseAdmin
      .from('invite_links')
      .update({ used_at: new Date().toISOString(), used_by: user.id })
      .eq('id', invite.id)
      .is('used_at', null); // Atomic: only succeeds if still unused

    if (updateTokenError) {
      console.error('Failed to mark invite as used:', updateTokenError);
      return new Response(JSON.stringify({ error: 'This invite link has already been used' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Approve the user's profile
    const { error: approveError } = await supabaseAdmin
      .from('profiles')
      .update({
        approval_status: 'approved',
        email_verified: true,
      })
      .eq('id', user.id);

    if (approveError) {
      console.error('Failed to approve profile:', approveError);
      return new Response(
        JSON.stringify({ error: 'Failed to approve profile. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Log to audit
    try {
      await supabaseAdmin.from('audit_logs').insert({
        operation: 'invite_link_redeemed',
        table_name: 'invite_links',
        user_id: user.id,
        admin_id: invite.created_by,
        metadata: {
          invite_id: invite.id,
          label: invite.label,
          allowed_email_domain: invite.allowed_email_domain,
          approval_status: 'approved',
        },
        new_data: { approval_status: 'approved' },
      });
    } catch {
      // Non-critical
    }

    return new Response(JSON.stringify({ success: true, message: 'Account approved' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('redeem-invite-link error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
