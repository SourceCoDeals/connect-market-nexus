import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
// Apify Google Maps Scraper actor - extracts reviews, ratings, and business info
// Using compass~crawler-google-places (the original working actor with tilde separator)
const APIFY_ACTOR = 'compass~crawler-google-places';
interface GooglePlaceData {
  title?: string;
  totalScore?: number;        // Google rating (e.g., 4.5)
  reviewsCount?: number;      // Number of reviews
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  website?: string;
  categoryName?: string;
  placeId?: string;
  url?: string;               // Google Maps URL
  temporarilyClosed?: boolean;
  permanentlyClosed?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify admin access (or service role for internal calls)
    const authHeader = req.headers.get('Authorization');
    const apiKeyHeader = req.headers.get('apikey');
    
    // Require at least one form of auth
    if (!authHeader && !apiKeyHeader) {
      console.error('No authorization header or apikey provided');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Check if this is the service role key (for internal calls from queue processor)
    // IMPORTANT: Check BOTH the Authorization header bearer token AND the apikey header
    const token = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
    const isServiceRole = token === supabaseServiceKey || apiKeyHeader === supabaseServiceKey;
    
    console.log(`Auth check: isServiceRole=${isServiceRole}, hasAuthHeader=${!!authHeader}, hasApiKey=${!!apiKeyHeader}`);

    if (!isServiceRole) {
      // Verify admin access for manual calls
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader || `Bearer ${apiKeyHeader}` } }
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

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');

    if (!APIFY_API_TOKEN) {
      console.error('APIFY_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Apify API token not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      businessName,
      address,
      city,
      state,
      googleMapsUrl,
      dealId,
      scrapeAll  // If true, scrape all deals needing Google data
    } = await req.json();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If scrapeAll is true, fetch all deals that need Google review data
    if (scrapeAll) {
      const { data: deals, error: fetchError } = await supabase
        .from('listings')
        .select('id, title, internal_company_name, location, address, address_city, address_state')
        .is('google_review_count', null)
        .eq('status', 'active')
        .limit(50); // Process in batches of 50

      if (fetchError) {
        throw new Error(`Failed to fetch deals: ${fetchError.message}`);
      }

      if (!deals || deals.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'All deals already have Google review data', scraped: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Scraping Google reviews for ${deals.length} deals...`);

      let scraped = 0;
      let errors = 0;

      for (const deal of deals) {
        try {
          const companyName = deal.internal_company_name || deal.title;
          // Prefer structured city/state over legacy address
          const location = (deal.address_city && deal.address_state)
            ? `${deal.address_city}, ${deal.address_state}`
            : (deal.address || deal.location);

          if (!companyName) {
            console.log(`Skipping deal ${deal.id} - no company name`);
            continue;
          }

          // Build search query - company name + location is best for Google search
          const searchQuery = location
            ? `${companyName} ${location}`
            : companyName;

          const result = await scrapeGooglePlace(APIFY_API_TOKEN, searchQuery, null);

          if (result.success && result.data) {
            const updateData: Record<string, unknown> = {
              google_review_count: result.data.reviewsCount || 0,
              google_rating: result.data.totalScore || null,
              google_maps_url: result.data.url || null,
              google_place_id: result.data.placeId || null,
            };

            // Update address if we don't have one
            if (!deal.address && result.data.address) {
              updateData.address = result.data.address;
            }

            // Update structured address fields if we have them from Google (only if not already set)
            if (result.data.city && !deal.address_city) {
              updateData.address_city = result.data.city;
            }
            if (result.data.state && !deal.address_state) {
              updateData.address_state = result.data.state;
            }
            if (result.data.postalCode) {
              updateData.address_zip = result.data.postalCode;
            }

            const { error: updateError } = await supabase
              .from('listings')
              .update(updateData)
              .eq('id', deal.id);

            if (updateError) {
              console.error(`Error updating deal ${deal.id}:`, updateError);
              errors++;
            } else {
              console.log(`Updated deal ${deal.id}: ${result.data.reviewsCount} reviews, ${result.data.totalScore} rating`);
              scraped++;
            }
          } else {
            // Mark as scraped but with 0 reviews (so we don't retry)
            await supabase
              .from('listings')
              .update({ google_review_count: 0 })
              .eq('id', deal.id);
          }

          // Rate limit - wait 2 seconds between scrapes
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (dealError) {
          console.error(`Error scraping deal ${deal.id}:`, dealError);
          errors++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Scraped ${scraped} deals, ${errors} errors`,
          scraped,
          errors,
          total: deals.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single deal scrape
    if (!businessName && !googleMapsUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Either businessName or googleMapsUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build search query
    let searchQuery = googleMapsUrl;
    if (!searchQuery && businessName) {
      searchQuery = [businessName, city, state].filter(Boolean).join(', ');
      if (address) {
        searchQuery = `${businessName} ${address}`;
      }
    }

    console.log(`Scraping Google reviews for: ${searchQuery}`);

    const result = await scrapeGooglePlace(APIFY_API_TOKEN, searchQuery, googleMapsUrl);

    if (!result.success) {
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const placeData = result.data!;

    const response = {
      success: true,
      scraped: true,
      google_review_count: placeData.reviewsCount || 0,
      google_rating: placeData.totalScore || null,
      google_maps_url: placeData.url || null,
      google_address: placeData.address || null,
      google_city: placeData.city || null,
      google_state: placeData.state || null,
      google_phone: placeData.phone || null,
      google_website: placeData.website || null,
      google_category: placeData.categoryName || null,
      google_place_id: placeData.placeId || null,
      is_closed: placeData.permanentlyClosed || placeData.temporarilyClosed || false,
    };

    // If dealId is provided, update the listing directly
    if (dealId) {
      const updateData: Record<string, unknown> = {
        google_review_count: response.google_review_count,
        google_rating: response.google_rating,
        google_maps_url: response.google_maps_url,
        google_place_id: response.google_place_id,
      };

      // Optionally update address fields if they're empty (phone column doesn't exist)
      if (response.google_address) {
        updateData.address = response.google_address;
      }
      // Update structured address fields from Google
      if (response.google_city) {
        updateData.address_city = response.google_city;
      }
      if (response.google_state) {
        updateData.address_state = response.google_state;
      }

      const { error: updateError } = await supabase
        .from('listings')
        .update(updateData)
        .eq('id', dealId);

      if (updateError) {
        console.error('Error updating listing with Google data:', updateError);
      } else {
        console.log(`Updated deal ${dealId} with Google review data`);
      }
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in apify-google-reviews:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function scrapeGooglePlace(
  apiToken: string,
  searchQuery: string | null,
  directUrl: string | null
): Promise<{ success: boolean; data?: GooglePlaceData; error?: string }> {

  const apifyUrl = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${apiToken}`;

  // Configure the actor input for compass~crawler-google-places
  const actorInput: Record<string, unknown> = {
    maxCrawledPlacesPerSearch: 1,  // We only need the first/best match
    language: 'en',
    deeperCityScrape: false,
    scrapeReviewerName: false,     // Don't need individual reviews
    scrapeReviewerId: false,
    scrapeReviewerUrl: false,
    scrapeReviewId: false,
    scrapeReviewUrl: false,
    scrapeResponseFromOwnerText: false,
    maxImages: 0,
  };

  if (directUrl) {
    // If we have a direct Google Maps URL, use it
    actorInput.startUrls = [{ url: directUrl }];
  } else if (searchQuery) {
    // Search by query - compass actor uses 'searchStringsArray'
    actorInput.searchStringsArray = [searchQuery];
  }

  try {
    const apifyResponse = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actorInput),
      signal: AbortSignal.timeout(90000) // 90 second timeout (Google scraping can be slow)
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('Apify API error:', apifyResponse.status, errorText);
      return {
        success: false,
        error: `Apify API error: ${apifyResponse.status}`
      };
    }

    const items = await apifyResponse.json();

    if (!items || items.length === 0) {
      console.log('No Google Place data found');
      return {
        success: false,
        error: 'No business found on Google Maps'
      };
    }

    const placeData = items[0] as GooglePlaceData;
    console.log('Google Place data:', JSON.stringify({
      title: placeData.title,
      rating: placeData.totalScore,
      reviews: placeData.reviewsCount,
      address: placeData.address
    }));

    return {
      success: true,
      data: placeData
    };

  } catch (fetchError) {
    console.error('Error calling Apify:', fetchError);
    return {
      success: false,
      error: fetchError instanceof Error ? fetchError.message : 'Network error'
    };
  }
}
