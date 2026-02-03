import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * RE-ENRICH MISSING ADDRESSES
 *
 * This function finds all active deals missing structured address data
 * (address_city or address_state) and re-runs enrichment on them.
 *
 * Features:
 * - Finds deals with websites but missing address components
 * - Processes in small batches to avoid rate limits
 * - 3-second delay between enrichments
 * - Reports progress and results
 *
 * Usage:
 *   POST { "batchSize": 5, "dryRun": true }
 *   - batchSize: Number of deals to process (default 10, max 50)
 *   - dryRun: If true, only report which deals would be re-enriched
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batchSize || 10, 50); // Max 50 per run
    const dryRun = body.dryRun === true;

    console.log(`Re-enrich missing addresses: batchSize=${batchSize}, dryRun=${dryRun}`);

    // Find deals missing address data but have a website
    const { data: dealsNeedingAddresses, error: queryError } = await supabase
      .from('listings')
      .select('id, title, internal_company_name, website, address_city, address_state, enriched_at')
      .eq('status', 'active')
      .or('address_city.is.null,address_state.is.null')
      .not('website', 'is', null)
      .neq('website', '')
      .order('created_at', { ascending: false })
      .limit(batchSize);

    if (queryError) {
      console.error('Query error:', queryError);
      throw new Error(`Failed to query deals: ${queryError.message}`);
    }

    if (!dealsNeedingAddresses || dealsNeedingAddresses.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No deals found needing address re-enrichment',
          dealsFound: 0,
          dealsProcessed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${dealsNeedingAddresses.length} deals needing address data`);

    // In dry run mode, just report what would be processed
    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Dry run: would re-enrich ${dealsNeedingAddresses.length} deals`,
          dryRun: true,
          dealsFound: dealsNeedingAddresses.length,
          deals: dealsNeedingAddresses.map(d => ({
            id: d.id,
            name: d.internal_company_name || d.title,
            website: d.website,
            currentCity: d.address_city,
            currentState: d.address_state,
            lastEnriched: d.enriched_at,
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each deal
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const results: Array<{
      dealId: string;
      name: string;
      status: 'success' | 'failed';
      error?: string;
      addressFound?: boolean;
    }> = [];

    for (const deal of dealsNeedingAddresses) {
      const dealName = deal.internal_company_name || deal.title || 'Unknown';
      console.log(`Processing deal ${processed + 1}/${dealsNeedingAddresses.length}: ${dealName}`);

      try {
        // Call the enrich-deal function
        const enrichResponse = await supabase.functions.invoke('enrich-deal', {
          body: { dealId: deal.id },
        });

        if (enrichResponse.error) {
          console.error(`Enrichment error for ${dealName}:`, enrichResponse.error);
          results.push({
            dealId: deal.id,
            name: dealName,
            status: 'failed',
            error: enrichResponse.error.message || 'Unknown error',
          });
          failed++;
        } else {
          // Check if address was found after enrichment
          const { data: updatedDeal } = await supabase
            .from('listings')
            .select('address_city, address_state')
            .eq('id', deal.id)
            .single();

          const addressFound = !!(updatedDeal?.address_city || updatedDeal?.address_state);

          results.push({
            dealId: deal.id,
            name: dealName,
            status: 'success',
            addressFound,
          });
          succeeded++;

          console.log(`Successfully enriched ${dealName}, address found: ${addressFound}`);
        }
      } catch (error) {
        console.error(`Exception for ${dealName}:`, error);
        results.push({
          dealId: deal.id,
          name: dealName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failed++;
      }

      processed++;

      // Rate limit: wait 3 seconds between enrichments
      if (processed < dealsNeedingAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Count how many addresses were found
    const addressesFound = results.filter(r => r.status === 'success' && r.addressFound).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Re-enrichment complete: ${succeeded} succeeded, ${failed} failed, ${addressesFound} addresses found`,
        dealsFound: dealsNeedingAddresses.length,
        dealsProcessed: processed,
        succeeded,
        failed,
        addressesFound,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in re-enrich-missing-addresses:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
