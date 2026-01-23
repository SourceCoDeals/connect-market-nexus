import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
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

    const { dealId } = await req.json();

    if (!dealId) {
      return new Response(
        JSON.stringify({ error: 'Missing dealId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the deal/listing
    const { data: deal, error: dealError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      return new Response(
        JSON.stringify({ error: 'Deal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let websiteUrl = deal.website;
    if (!websiteUrl) {
      return new Response(
        JSON.stringify({ error: 'No website URL configured for this deal' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure proper URL format
    if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
      websiteUrl = `https://${websiteUrl}`;
    }

    console.log(`Enriching deal ${dealId} from website: ${websiteUrl}`);

    // Check if Firecrawl is configured
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured. Please enable the Firecrawl connector.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Scrape the website using Firecrawl
    console.log('Scraping website with Firecrawl...');
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: websiteUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error('Firecrawl scrape error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to scrape website: ${scrapeResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scrapeData = await scrapeResponse.json();
    const websiteContent = scrapeData.data?.markdown || scrapeData.markdown || '';

    if (!websiteContent || websiteContent.length < 100) {
      console.log('Insufficient website content scraped');
      return new Response(
        JSON.stringify({ success: false, error: 'Could not extract sufficient content from website' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scraped ${websiteContent.length} characters from website`);

    // Check if AI gateway is configured
    if (!lovableApiKey) {
      // Fall back to basic extraction without AI
      console.log('No AI key configured, using basic extraction');
      const updates: Record<string, unknown> = {
        enriched_at: new Date().toISOString(),
      };

      // Basic extraction from website content
      if (!deal.executive_summary && websiteContent.length > 200) {
        updates.executive_summary = websiteContent.substring(0, 500).trim() + '...';
      }

      const { error: updateError } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', dealId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Basic enrichment completed (AI not configured)',
          fieldsUpdated: Object.keys(updates).filter(k => k !== 'enriched_at'),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Use AI to extract structured data
    console.log('Extracting deal intelligence with AI...');

    const systemPrompt = `You are a business analyst. Extract comprehensive company information from website content.

Focus on extracting:
1. Executive summary - A clear 2-3 paragraph description of the business
2. Services offered - List of services/products they provide
3. Business model - How they make money (B2B, B2C, recurring revenue, project-based, etc.)
4. Industry/sector - Primary industry classification
5. Geographic coverage - States/regions they operate in
6. Number of locations - Physical office/branch count
7. Address/headquarters - Company headquarters location
8. Founded year - When the company was established
9. Customer types - Who they serve (commercial, residential, government, etc.)
10. Key differentiators - What makes them unique`;

    const userPrompt = `Analyze this website content from "${deal.title}" and extract business information.

Website Content:
${websiteContent.substring(0, 15000)}

Extract all available business information using the provided tool.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_deal_intelligence',
              description: 'Extract comprehensive business/deal intelligence from website content',
              parameters: {
                type: 'object',
                properties: {
                  executive_summary: {
                    type: 'string',
                    description: 'A 2-3 paragraph executive summary describing the business, its services, market position, and value proposition'
                  },
                  service_mix: {
                    type: 'string',
                    description: 'Comma-separated list of services or products offered'
                  },
                  business_model: {
                    type: 'string',
                    description: 'Description of how the business generates revenue (e.g., B2B services, recurring contracts, project-based)'
                  },
                  industry: {
                    type: 'string',
                    description: 'Primary industry classification (e.g., HVAC, Plumbing, IT Services, Healthcare)'
                  },
                  geographic_states: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Two-letter US state codes where they operate (e.g., ["CA", "TX", "FL"])'
                  },
                  number_of_locations: {
                    type: 'number',
                    description: 'Number of physical locations/offices/branches'
                  },
                  address: {
                    type: 'string',
                    description: 'Headquarters address or primary location'
                  },
                  founded_year: {
                    type: 'number',
                    description: 'Year the company was founded (e.g., 2005)'
                  },
                  customer_types: {
                    type: 'string',
                    description: 'Types of customers served (e.g., Commercial, Residential, Government, Industrial)'
                  },
                  key_differentiators: {
                    type: 'string',
                    description: 'What makes this company unique or competitive advantages'
                  }
                }
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_deal_intelligence' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI extraction error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI extraction failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData, null, 2));

    // Extract tool call results
    let extracted: Record<string, unknown> = {};
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        extracted = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error('Failed to parse tool arguments:', e);
      }
    }

    console.log('Extracted data:', extracted);

    // Build update object - only update fields that have values and aren't already set
    const updates: Record<string, unknown> = {
      enriched_at: new Date().toISOString(),
    };

    if (extracted.executive_summary && !deal.executive_summary) {
      updates.executive_summary = extracted.executive_summary;
    }
    if (extracted.service_mix && !deal.service_mix) {
      updates.service_mix = extracted.service_mix;
    }
    if (extracted.business_model && !deal.business_model) {
      updates.business_model = extracted.business_model;
    }
    if (extracted.industry && !deal.industry) {
      updates.industry = extracted.industry;
    }
    if (extracted.geographic_states && (!deal.geographic_states || deal.geographic_states.length === 0)) {
      updates.geographic_states = extracted.geographic_states;
    }
    if (extracted.number_of_locations && !deal.number_of_locations) {
      updates.number_of_locations = extracted.number_of_locations;
    }
    if (extracted.address && !deal.address) {
      updates.address = extracted.address;
    }
    if (extracted.founded_year && !deal.founded_year) {
      updates.founded_year = extracted.founded_year;
    }
    if (extracted.customer_types && !deal.customer_types) {
      updates.customer_types = extracted.customer_types;
    }

    // Update the listing
    const { error: updateError } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', dealId);

    if (updateError) {
      console.error('Error updating listing:', updateError);
      throw updateError;
    }

    const fieldsUpdated = Object.keys(updates).filter(k => k !== 'enriched_at');
    console.log(`Updated ${fieldsUpdated.length} fields:`, fieldsUpdated);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully enriched deal with ${fieldsUpdated.length} fields`,
        fieldsUpdated,
        extracted,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in enrich-deal:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
