import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Apify LinkedIn Company Scraper actor
const APIFY_ACTOR = 'logical_scrapers~linkedin-company-scraper';

interface LinkedInCompanyData {
  employeeCount?: number;
  employeeCountRange?: string;
  name?: string;
  industry?: string;
  headquarters?: string;
  website?: string;
  description?: string;
  specialties?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    
    if (!APIFY_API_TOKEN) {
      console.error('APIFY_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Apify API token not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { linkedinUrl, companyName, dealId } = await req.json();

    if (!linkedinUrl && !companyName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Either linkedinUrl or companyName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If we have a company name but no LinkedIn URL, try to construct one
    let targetUrl = linkedinUrl;
    if (!targetUrl && companyName) {
      // Simple approach: use LinkedIn company search URL
      // In practice, you might want to use Apify's search capability
      const sanitizedName = companyName.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
      targetUrl = `https://www.linkedin.com/company/${sanitizedName}`;
    }

    console.log(`Scraping LinkedIn for: ${targetUrl || companyName}`);

    // Call Apify's run-sync-get-dataset-items for immediate results
    const apifyUrl = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`;
    
    const apifyResponse = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: [targetUrl]
      }),
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('Apify API error:', apifyResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Apify API error: ${apifyResponse.status}`,
          details: errorText.substring(0, 200)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const items = await apifyResponse.json();
    
    if (!items || items.length === 0) {
      console.log('No LinkedIn company data found');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No company data found on LinkedIn',
          scraped: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyData = items[0] as LinkedInCompanyData;
    console.log('LinkedIn company data:', JSON.stringify(companyData, null, 2));

    const result = {
      success: true,
      scraped: true,
      linkedin_employee_count: companyData.employeeCount || null,
      linkedin_employee_range: companyData.employeeCountRange || null,
      linkedin_industry: companyData.industry || null,
      linkedin_headquarters: companyData.headquarters || null,
      linkedin_website: companyData.website || null,
      linkedin_description: companyData.description?.substring(0, 1000) || null,
      linkedin_specialties: companyData.specialties || null,
    };

    // If dealId is provided, update the listing directly
    if (dealId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const updateData: Record<string, unknown> = {};
      
      if (result.linkedin_employee_count) {
        updateData.linkedin_employee_count = result.linkedin_employee_count;
      }
      if (result.linkedin_employee_range) {
        updateData.linkedin_employee_range = result.linkedin_employee_range;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('listings')
          .update(updateData)
          .eq('id', dealId);

        if (updateError) {
          console.error('Error updating listing with LinkedIn data:', updateError);
        } else {
          console.log(`Updated deal ${dealId} with LinkedIn employee data`);
        }
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in apify-linkedin-scrape:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
