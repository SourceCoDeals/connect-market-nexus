import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PublishRequest {
  listingId: string;
  action: 'publish' | 'unpublish';
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Minimum quality requirements for marketplace publishing
function validateListingQuality(listing: any): ValidationResult {
  const errors: string[] = [];

  if (!listing.title || listing.title.trim().length < 5) {
    errors.push('Title must be at least 5 characters');
  }

  if (!listing.description || listing.description.trim().length < 50) {
    errors.push('Description must be at least 50 characters');
  }

  if (!listing.category && (!listing.categories || listing.categories.length === 0)) {
    errors.push('At least one category is required');
  }

  if (!listing.location) {
    errors.push('Location is required');
  }

  if (typeof listing.revenue !== 'number' || listing.revenue <= 0) {
    errors.push('Revenue must be a positive number');
  }

  if (typeof listing.ebitda !== 'number') {
    errors.push('EBITDA is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user client to verify auth
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin status
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      console.error('Admin check failed:', profileError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: PublishRequest = await req.json();
    const { listingId, action } = body;

    if (!listingId) {
      return new Response(
        JSON.stringify({ error: 'listingId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the listing
    const { data: listing, error: fetchError } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (fetchError || !listing) {
      console.error('Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Listing not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'publish') {
      // Check if already published
      if (listing.is_internal_deal === false && listing.published_at) {
        return new Response(
          JSON.stringify({ error: 'Listing is already published', listing }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if listing is in remarketing systems
      const { data: remarketingLinks } = await supabaseAdmin
        .from('remarketing_universe_deals')
        .select('id')
        .eq('listing_id', listingId)
        .eq('status', 'active')
        .limit(1);

      const { data: remarketingScores } = await supabaseAdmin
        .from('remarketing_scores')
        .select('id')
        .eq('listing_id', listingId)
        .limit(1);

      if ((remarketingLinks && remarketingLinks.length > 0) || (remarketingScores && remarketingScores.length > 0)) {
        return new Response(
          JSON.stringify({ 
            error: 'Cannot publish: listing is linked to remarketing systems. Remove from universes first or create a separate marketplace listing.',
            remarketingLinked: true 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate quality requirements
      const validation = validateListingQuality(listing);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ 
            error: 'Listing does not meet quality requirements',
            validationErrors: validation.errors 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Publish the listing
      const { data: updatedListing, error: updateError } = await supabaseAdmin
        .from('listings')
        .update({
          is_internal_deal: false,
          published_at: new Date().toISOString(),
          published_by_admin_id: user.id,
          status: 'active',
        })
        .eq('id', listingId)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to publish listing', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Listing ${listingId} published by admin ${user.id}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Listing published to marketplace',
          listing: updatedListing 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'unpublish') {
      // Unpublish - revert to internal
      const { data: updatedListing, error: updateError } = await supabaseAdmin
        .from('listings')
        .update({
          is_internal_deal: true,
          // Keep published_at and published_by for audit trail
        })
        .eq('id', listingId)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to unpublish listing', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Listing ${listingId} unpublished by admin ${user.id}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Listing removed from marketplace',
          listing: updatedListing 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use "publish" or "unpublish"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
