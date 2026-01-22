import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentResult {
  thesis_summary?: string;
  target_geographies?: string[];
  target_services?: string[];
  target_industries?: string[];
  target_revenue_min?: number;
  target_revenue_max?: number;
  target_ebitda_min?: number;
  target_ebitda_max?: number;
  geographic_footprint?: string[];
  recent_acquisitions?: any[];
  portfolio_companies?: any[];
  data_completeness?: 'high' | 'medium' | 'low';
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
    
    const systemPrompt = `You are an M&A intelligence analyst. Extract investment thesis and acquisition criteria from PE firm/platform company websites.

Focus on extracting:
1. Investment thesis - what types of companies they acquire and why
2. Target size criteria - revenue and EBITDA ranges
3. Target geographies - states, regions, or countries they focus on
4. Target services/industries - specific sectors they invest in
5. Recent acquisitions - companies they've acquired
6. Portfolio companies - current holdings
7. Geographic footprint - where they operate`;

    const userPrompt = `Analyze this website content from "${buyer.company_name}" and extract their investment/acquisition criteria.

Website Content:
${websiteContent.substring(0, 15000)}

Extract the buyer intelligence using the provided tool.`;

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
              description: 'Extract structured buyer/investor intelligence from website content',
              parameters: {
                type: 'object',
                properties: {
                  thesis_summary: {
                    type: 'string',
                    description: 'A 2-3 sentence summary of their investment thesis and acquisition strategy'
                  },
                  target_geographies: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'US states or regions they target (e.g., "Texas", "Southeast", "Midwest")'
                  },
                  target_services: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Service types or sectors they invest in (e.g., "HVAC", "Plumbing", "Electrical")'
                  },
                  target_industries: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Industry categories (e.g., "Home Services", "Healthcare", "Manufacturing")'
                  },
                  target_revenue_min: {
                    type: 'number',
                    description: 'Minimum target company revenue in USD (if mentioned)'
                  },
                  target_revenue_max: {
                    type: 'number',
                    description: 'Maximum target company revenue in USD (if mentioned)'
                  },
                  target_ebitda_min: {
                    type: 'number',
                    description: 'Minimum target company EBITDA in USD (if mentioned)'
                  },
                  target_ebitda_max: {
                    type: 'number',
                    description: 'Maximum target company EBITDA in USD (if mentioned)'
                  },
                  geographic_footprint: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Where the firm/portfolio currently operates'
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

    // Only update fields that were extracted
    if (extractedData.thesis_summary) updateData.thesis_summary = extractedData.thesis_summary;
    if (extractedData.target_geographies?.length) updateData.target_geographies = extractedData.target_geographies;
    if (extractedData.target_services?.length) updateData.target_services = extractedData.target_services;
    if (extractedData.target_industries?.length) updateData.target_industries = extractedData.target_industries;
    if (extractedData.target_revenue_min) updateData.target_revenue_min = extractedData.target_revenue_min;
    if (extractedData.target_revenue_max) updateData.target_revenue_max = extractedData.target_revenue_max;
    if (extractedData.target_ebitda_min) updateData.target_ebitda_min = extractedData.target_ebitda_min;
    if (extractedData.target_ebitda_max) updateData.target_ebitda_max = extractedData.target_ebitda_max;
    if (extractedData.geographic_footprint?.length) updateData.geographic_footprint = extractedData.geographic_footprint;
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
