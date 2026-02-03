import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify admin access first
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await authClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for the actual operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First, get all active listings without valid websites
    const { data: listings, error: fetchError } = await supabase
      .from('listings')
      .select('id, title, internal_company_name, website, internal_deal_memo_link')
      .eq('status', 'active');

    if (fetchError) throw fetchError;

    // Filter deals without valid websites
    const dealsToArchive = (listings || []).filter(listing => {
      // Has a proper website
      if (listing.website && listing.website.trim() !== '') return false;
      
      // Has a valid internal_deal_memo_link (not sharepoint/onedrive)
      const memoLink = listing.internal_deal_memo_link;
      if (memoLink && memoLink.trim() !== '') {
        if (!memoLink.includes('sharepoint') && !memoLink.includes('onedrive')) {
          return false; // Has a valid website in memo link
        }
      }
      
      return true; // No valid website
    });

    if (dealsToArchive.length === 0) {
      return new Response(
        JSON.stringify({ success: true, archived: 0, message: 'No deals without websites found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const idsToArchive = dealsToArchive.map(d => d.id);

    // Archive the deals
    const { error: updateError } = await supabase
      .from('listings')
      .update({ status: 'archived' })
      .in('id', idsToArchive);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        archived: dealsToArchive.length,
        deals: dealsToArchive.map(d => ({
          id: d.id,
          name: d.internal_company_name || d.title
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
