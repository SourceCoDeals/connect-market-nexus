import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentResult {
  thesis_summary?: string;
  thesis_confidence?: 'high' | 'medium' | 'low';
  target_geographies?: string[];
  target_services?: string[];
  target_industries?: string[];
  target_revenue_min?: number;
  target_revenue_max?: number;
  revenue_sweet_spot?: number;
  target_ebitda_min?: number;
  target_ebitda_max?: number;
  ebitda_sweet_spot?: number;
  geographic_footprint?: string[];
  recent_acquisitions?: any[];
  portfolio_companies?: any[];
  data_completeness?: 'high' | 'medium' | 'low';
  // New fields for Whispers parity
  pe_firm_name?: string;
  hq_city?: string;
  hq_state?: string;
  industry_vertical?: string;
  business_summary?: string;
  specialized_focus?: string;
  strategic_priorities?: string[];
  deal_breakers?: string[];
  deal_preferences?: string;
  acquisition_appetite?: string;
  acquisition_timeline?: string;
  acquisition_frequency?: string;
  total_acquisitions?: number;
  primary_customer_size?: string;
  customer_geographic_reach?: string;
  customer_industries?: string[];
  target_customer_profile?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { buyerId } = await req.json();

    if (!buyerId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Buyer ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Lovable API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Fetch buyer
    const { data: buyer, error: buyerError } = await supabase
      .from('remarketing_buyers')
      .select('*')
      .eq('id', buyerId)
      .single();

    if (buyerError || !buyer) {
      console.error('Buyer not found:', buyerError);
      return new Response(
        JSON.stringify({ success: false, error: 'Buyer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!buyer.company_website) {
      return new Response(
        JSON.stringify({ success: false, error: 'Buyer has no website URL to scrape' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Enriching buyer: ${buyer.company_name} (${buyer.company_website})`);

    // Format URL
    let websiteUrl = buyer.company_website.trim();
    if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
      websiteUrl = `https://${websiteUrl}`;
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

    // Step 2: Use AI to extract structured buyer intelligence
    console.log('Extracting buyer intelligence with AI...');
    
    const systemPrompt = `You are an M&A intelligence analyst. Extract comprehensive investment thesis and acquisition criteria from PE firm/platform company websites.

Focus on extracting ALL available information including:
1. Investment thesis - what types of companies they acquire and why (with confidence level)
2. Target size criteria - revenue and EBITDA ranges, including sweet spots
3. Target geographies - states, regions, or countries they focus on
4. Target services/industries - specific sectors they invest in
5. Business description - company summary, industry vertical, specialized focus
6. Strategic priorities - key growth initiatives
7. Deal breakers - what they avoid or won't consider
8. Deal preferences - preferred deal structures or terms
9. Acquisition appetite - current interest level and timeline
10. Customer profile - target customer types, sizes, industries
11. Acquisition history - recent deals, frequency, total count
12. Portfolio companies - current holdings
13. HQ location and PE firm parent name`;

    const userPrompt = `Analyze this website content from "${buyer.company_name}" and extract their comprehensive investment/acquisition criteria.

Website Content:
${websiteContent.substring(0, 15000)}

Extract ALL buyer intelligence using the provided tool. Be thorough - extract every piece of relevant information.`;

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
              name: 'extract_buyer_intelligence',
              description: 'Extract comprehensive buyer/investor intelligence from website content',
              parameters: {
                type: 'object',
                properties: {
                  thesis_summary: {
                    type: 'string',
                    description: 'A 2-3 sentence summary of their investment thesis and acquisition strategy'
                  },
                  thesis_confidence: {
                    type: 'string',
                    enum: ['high', 'medium', 'low'],
                    description: 'How confident we are in the extracted thesis based on website clarity'
                  },
                  pe_firm_name: {
                    type: 'string',
                    description: 'Name of the parent PE firm (if this is a platform company)'
                  },
                  hq_city: {
                    type: 'string',
                    description: 'Headquarters city'
                  },
                  hq_state: {
                    type: 'string',
                    description: 'Headquarters state (2-letter code preferred)'
                  },
                  industry_vertical: {
                    type: 'string',
                    description: 'Primary industry vertical (e.g., "Collision Repair / Auto Body")'
                  },
                  business_summary: {
                    type: 'string',
                    description: 'Brief company description and business model'
                  },
                  specialized_focus: {
                    type: 'string',
                    description: 'Any specialized focus areas or unique capabilities'
                  },
                  strategic_priorities: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Key strategic priorities or growth initiatives'
                  },
                  deal_breakers: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Things they explicitly avoid (e.g., "No shops under $1M revenue")'
                  },
                  deal_preferences: {
                    type: 'string',
                    description: 'Preferred deal structures, terms, or transaction types'
                  },
                  acquisition_appetite: {
                    type: 'string',
                    description: 'Current acquisition appetite description (e.g., "Very active - looking to acquire add-ons")'
                  },
                  acquisition_timeline: {
                    type: 'string',
                    description: 'Timeline for acquisitions (e.g., "Looking to push forward immediately")'
                  },
                  acquisition_frequency: {
                    type: 'string',
                    description: 'How often they acquire (e.g., "1-2 per year", "As needed")'
                  },
                  total_acquisitions: {
                    type: 'number',
                    description: 'Total number of acquisitions/add-ons to date'
                  },
                  target_geographies: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'US states or regions they target (e.g., "TX", "CA", "Southeast")'
                  },
                  target_services: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Service types or sectors they invest in'
                  },
                  target_industries: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Industry categories'
                  },
                  target_revenue_min: {
                    type: 'number',
                    description: 'Minimum target company revenue in USD'
                  },
                  target_revenue_max: {
                    type: 'number',
                    description: 'Maximum target company revenue in USD'
                  },
                  revenue_sweet_spot: {
                    type: 'number',
                    description: 'Ideal/preferred target revenue in USD'
                  },
                  target_ebitda_min: {
                    type: 'number',
                    description: 'Minimum target company EBITDA in USD'
                  },
                  target_ebitda_max: {
                    type: 'number',
                    description: 'Maximum target company EBITDA in USD'
                  },
                  ebitda_sweet_spot: {
                    type: 'number',
                    description: 'Ideal/preferred target EBITDA in USD'
                  },
                  geographic_footprint: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Where the firm/portfolio currently operates'
                  },
                  primary_customer_size: {
                    type: 'string',
                    description: 'Target customer size segment (e.g., "SMB", "Enterprise", "Consumer")'
                  },
                  customer_geographic_reach: {
                    type: 'string',
                    description: 'Customer geographic reach (e.g., "Local", "Regional", "National")'
                  },
                  customer_industries: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Industries their customers are in'
                  },
                  target_customer_profile: {
                    type: 'string',
                    description: 'Description of ideal end customer'
                  },
                  recent_acquisitions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        company_name: { type: 'string' },
                        date: { type: 'string' },
                        location: { type: 'string' },
                        services: { type: 'array', items: { type: 'string' } }
                      }
                    },
                    description: 'Recent acquisitions mentioned on the website'
                  },
                  portfolio_companies: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        website: { type: 'string' },
                        services: { type: 'array', items: { type: 'string' } },
                        locations: { type: 'array', items: { type: 'string' } }
                      }
                    },
                    description: 'Current portfolio companies'
                  },
                  data_quality: {
                    type: 'string',
                    enum: ['high', 'medium', 'low'],
                    description: 'Assessment of how much useful data was extractable'
                  }
                },
                required: ['thesis_summary', 'data_quality']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_buyer_intelligence' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI extraction error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to extract buyer intelligence' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.error('No tool call in AI response');
      return new Response(
        JSON.stringify({ success: false, error: 'AI did not return structured data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractedData = JSON.parse(toolCall.function.arguments) as EnrichmentResult & { data_quality?: string };
    console.log('Extracted buyer intelligence:', JSON.stringify(extractedData, null, 2));

    // Step 3: Update buyer record with extracted data
    const updateData: any = {
      data_last_updated: new Date().toISOString(),
      data_completeness: extractedData.data_quality || 'medium',
      extraction_sources: [
        ...(buyer.extraction_sources || []),
        {
          type: 'website',
          url: websiteUrl,
          extracted_at: new Date().toISOString(),
          fields_extracted: Object.keys(extractedData).filter(k => extractedData[k as keyof typeof extractedData])
        }
      ]
    };

    // Update all extracted fields
    if (extractedData.thesis_summary) updateData.thesis_summary = extractedData.thesis_summary;
    if (extractedData.thesis_confidence) updateData.thesis_confidence = extractedData.thesis_confidence;
    if (extractedData.pe_firm_name) updateData.pe_firm_name = extractedData.pe_firm_name;
    if (extractedData.hq_city) updateData.hq_city = extractedData.hq_city;
    if (extractedData.hq_state) updateData.hq_state = extractedData.hq_state;
    if (extractedData.industry_vertical) updateData.industry_vertical = extractedData.industry_vertical;
    if (extractedData.business_summary) updateData.business_summary = extractedData.business_summary;
    if (extractedData.specialized_focus) updateData.specialized_focus = extractedData.specialized_focus;
    if (extractedData.strategic_priorities?.length) updateData.strategic_priorities = extractedData.strategic_priorities;
    if (extractedData.deal_breakers?.length) updateData.deal_breakers = extractedData.deal_breakers;
    if (extractedData.deal_preferences) updateData.deal_preferences = extractedData.deal_preferences;
    if (extractedData.acquisition_appetite) updateData.acquisition_appetite = extractedData.acquisition_appetite;
    if (extractedData.acquisition_timeline) updateData.acquisition_timeline = extractedData.acquisition_timeline;
    if (extractedData.acquisition_frequency) updateData.acquisition_frequency = extractedData.acquisition_frequency;
    if (extractedData.total_acquisitions) updateData.total_acquisitions = extractedData.total_acquisitions;
    if (extractedData.target_geographies?.length) updateData.target_geographies = extractedData.target_geographies;
    if (extractedData.target_services?.length) updateData.target_services = extractedData.target_services;
    if (extractedData.target_industries?.length) updateData.target_industries = extractedData.target_industries;
    if (extractedData.target_revenue_min) updateData.target_revenue_min = extractedData.target_revenue_min;
    if (extractedData.target_revenue_max) updateData.target_revenue_max = extractedData.target_revenue_max;
    if (extractedData.revenue_sweet_spot) updateData.revenue_sweet_spot = extractedData.revenue_sweet_spot;
    if (extractedData.target_ebitda_min) updateData.target_ebitda_min = extractedData.target_ebitda_min;
    if (extractedData.target_ebitda_max) updateData.target_ebitda_max = extractedData.target_ebitda_max;
    if (extractedData.ebitda_sweet_spot) updateData.ebitda_sweet_spot = extractedData.ebitda_sweet_spot;
    if (extractedData.geographic_footprint?.length) updateData.geographic_footprint = extractedData.geographic_footprint;
    if (extractedData.primary_customer_size) updateData.primary_customer_size = extractedData.primary_customer_size;
    if (extractedData.customer_geographic_reach) updateData.customer_geographic_reach = extractedData.customer_geographic_reach;
    if (extractedData.customer_industries?.length) updateData.customer_industries = extractedData.customer_industries;
    if (extractedData.target_customer_profile) updateData.target_customer_profile = extractedData.target_customer_profile;
    if (extractedData.recent_acquisitions?.length) updateData.recent_acquisitions = extractedData.recent_acquisitions;
    if (extractedData.portfolio_companies?.length) updateData.portfolio_companies = extractedData.portfolio_companies;

    const { error: updateError } = await supabase
      .from('remarketing_buyers')
      .update(updateData)
      .eq('id', buyerId);

    if (updateError) {
      console.error('Failed to update buyer:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save enrichment data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully enriched buyer ${buyer.company_name}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          buyerId,
          fieldsUpdated: Object.keys(updateData).length,
          dataCompleteness: updateData.data_completeness,
          extractedData
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Enrichment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
