import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(origin);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find auth users without a corresponding profile
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });

    if (authError) {
      throw new Error(`Failed to list auth users: ${authError.message}`);
    }

    const authUserIds = (authUsers?.users || []).map(u => u.id);

    if (authUserIds.length === 0) {
      return new Response(JSON.stringify({ profilesCreated: 0, errors: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get existing profile IDs
    const { data: existingProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .in('id', authUserIds);

    if (profileError) {
      throw new Error(`Failed to fetch profiles: ${profileError.message}`);
    }

    const existingIds = new Set((existingProfiles || []).map(p => p.id));
    const missingUsers = (authUsers?.users || []).filter(u => !existingIds.has(u.id));

    let profilesCreated = 0;
    let errors = 0;

    for (const user of missingUsers) {
      const meta = user.user_metadata || {};
      const { error: insertError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          first_name: meta.first_name || meta.full_name?.split(' ')[0] || null,
          last_name: meta.last_name || meta.full_name?.split(' ').slice(1).join(' ') || null,
          email: user.email || null,
          role: meta.role || 'buyer',
        }, { onConflict: 'id' });

      if (insertError) {
        console.error(`Failed to create profile for ${user.id}:`, insertError.message);
        errors++;
      } else {
        profilesCreated++;
        console.log(`Created profile for user ${user.id}`);
      }
    }

    console.log(`Sync complete: ${profilesCreated} profiles created, ${errors} errors, ${missingUsers.length} missing`);

    return new Response(JSON.stringify({
      profilesCreated,
      errors,
      totalAuthUsers: authUserIds.length,
      totalExistingProfiles: existingIds.size,
      missingCount: missingUsers.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('sync-missing-profiles error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
