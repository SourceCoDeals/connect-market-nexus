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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for options
    const { dryRun = false, limit = 50 } = await req.json().catch(() => ({}));

    // Find all active deals missing address_city or address_state that have a website
    const { data: dealsToEnrich, error: fetchError } = await supabase
      .from('listings')
      .select('id, title, internal_company_name, website, internal_deal_memo_link, address_city, address_state, enriched_at')
      .eq('status', 'active')
      .or('address_city.is.null,address_state.is.null')
      .limit(limit);

    if (fetchError) throw fetchError;

    // Filter to only deals that have a valid website
    const eligibleDeals = (dealsToEnrich || []).filter(deal => {
      const website = deal.website;
      const memoLink = deal.internal_deal_memo_link;
      
      // Has a direct website
      if (website && website.trim() !== '') return true;
      
      // Has a valid URL in memo link (not sharepoint/onedrive)
      if (memoLink && memoLink.trim() !== '') {
        if (!memoLink.includes('sharepoint') && !memoLink.includes('onedrive')) {
          return true;
        }
      }
      
      return false;
    });

    if (dryRun) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          dryRun: true,
          eligibleCount: eligibleDeals.length,
          deals: eligibleDeals.map(d => ({
            id: d.id,
            name: d.internal_company_name || d.title,
            hasCity: !!d.address_city,
            hasState: !!d.address_state,
            wasEnriched: !!d.enriched_at
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (eligibleDeals.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No deals found missing address data with valid websites',
          enriched: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Re-enrich each deal by calling the enrich-deal function
    const results: { id: string; name: string; success: boolean; error?: string }[] = [];
    const BATCH_SIZE = 3;
    const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds

    for (let i = 0; i < eligibleDeals.length; i += BATCH_SIZE) {
      const batch = eligibleDeals.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (deal) => {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/enrich-deal`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ dealId: deal.id }),
          });

          const result = await response.json();
          
          return {
            id: deal.id,
            name: deal.internal_company_name || deal.title || 'Unknown',
            success: response.ok && result.success,
            error: result.error || undefined
          };
        } catch (error: any) {
          return {
            id: deal.id,
            name: deal.internal_company_name || deal.title || 'Unknown',
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay between batches to avoid rate limits
      if (i + BATCH_SIZE < eligibleDeals.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Re-enriched ${successCount} deals (${failedCount} failed)`,
        total: eligibleDeals.length,
        successCount,
        failedCount,
        results
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
