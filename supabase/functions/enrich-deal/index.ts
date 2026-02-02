import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStates, mergeStates } from "../_shared/geography.ts";
import { buildPriorityUpdates, updateExtractionSources } from "../_shared/source-priority.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";
import { checkRateLimit, validateUrl, rateLimitResponse, ssrfErrorResponse } from "../_shared/security.ts";

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
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
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

    // SECURITY: Check rate limit before making expensive AI calls
    const rateLimitResult = await checkRateLimit(supabase, user.id, 'ai_enrichment', true);
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for admin ${user.id} on ai_enrichment`);
      return rateLimitResponse(rateLimitResult);
    }

    const { dealId } = await req.json();

    if (!dealId) {
      return new Response(
        JSON.stringify({ error: 'Missing dealId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the deal/listing with extraction_sources
    const { data: deal, error: dealError } = await supabase
      .from('listings')
      .select('*, extraction_sources')
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      return new Response(
        JSON.stringify({ error: 'Deal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get website URL - prefer website field, fallback to extracting from internal_deal_memo_link
    let websiteUrl = deal.website;
    
    if (!websiteUrl && deal.internal_deal_memo_link) {
      const memoLink = deal.internal_deal_memo_link;
      
      // Skip SharePoint/OneDrive links
      if (!memoLink.includes('sharepoint.com') && !memoLink.includes('onedrive')) {
        // Handle "Website: https://..." format
        const websiteMatch = memoLink.match(/Website:\s*(https?:\/\/[^\s]+)/i);
        if (websiteMatch) {
          websiteUrl = websiteMatch[1];
        } else if (memoLink.match(/^https?:\/\/[a-zA-Z0-9]/)) {
          // Direct URL
          websiteUrl = memoLink;
        } else if (memoLink.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/)) {
          // Domain-only format
          websiteUrl = `https://${memoLink}`;
        }
      }
    }
    
    if (!websiteUrl) {
      return new Response(
        JSON.stringify({ error: 'No website URL found for this deal. Add a website in the company overview or deal memo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure proper URL format
    if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
      websiteUrl = `https://${websiteUrl}`;
    }

    // SECURITY: Validate URL to prevent SSRF attacks
    const urlValidation = validateUrl(websiteUrl);
    if (!urlValidation.valid) {
      console.error(`SSRF blocked for deal website: ${websiteUrl} - ${urlValidation.reason}`);
      return ssrfErrorResponse(urlValidation.reason || 'Invalid URL');
    }
    websiteUrl = urlValidation.normalizedUrl || websiteUrl;

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
    if (!geminiApiKey) {
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
5. Geographic coverage - States/regions they operate in (use 2-letter US state codes like CA, TX, FL)
6. Number of locations - Physical office/branch count
7. Address/headquarters - Company headquarters location
8. Founded year - When the company was established
9. Customer types - Who they serve (commercial, residential, government, etc.)
10. Key differentiators - What makes them unique
11. Key risks - Any potential risk factors visible (single customer, aging tech, etc.)
12. Competitive position - Market positioning information
13. Technology/systems - Software, tools, or technology mentioned
14. Real estate - Information about facilities (owned vs leased)
15. Growth trajectory - Any growth indicators or history`;

    const userPrompt = `Analyze this website content from "${deal.title}" and extract business information.

Website Content:
${websiteContent.substring(0, 15000)}

Extract all available business information using the provided tool.`;

    const aiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: getGeminiHeaders(geminiApiKey),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
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
                  },
                  owner_goals: {
                    type: 'string',
                    description: 'Owner/seller goals for the transaction (exit, retirement, growth capital, partnership, etc.)'
                  },
                  key_risks: {
                    type: 'string',
                    description: 'Potential risk factors identified (one per line)'
                  },
                  competitive_position: {
                    type: 'string',
                    description: 'Market positioning, competitive advantages, market share information'
                  },
                  technology_systems: {
                    type: 'string',
                    description: 'Software, tools, or technology systems mentioned'
                  },
                  real_estate_info: {
                    type: 'string',
                    description: 'Information about facilities, whether owned or leased, square footage'
                  },
                  growth_trajectory: {
                    type: 'string',
                    description: 'Growth indicators, expansion history, or trajectory information'
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

    // Normalize geographic_states using shared module
    if (extracted.geographic_states) {
      extracted.geographic_states = normalizeStates(extracted.geographic_states as string[]);
    }

    // Build priority-aware updates using shared module
    const { updates, sourceUpdates } = buildPriorityUpdates(
      deal,
      deal.extraction_sources,
      extracted,
      'website'
    );

    // Add enriched_at timestamp
    const finalUpdates = {
      ...updates,
      enriched_at: new Date().toISOString(),
      extraction_sources: updateExtractionSources(deal.extraction_sources, sourceUpdates),
    };

    // Merge geographic states if both exist (website shouldn't overwrite existing)
    if (updates.geographic_states && deal.geographic_states?.length > 0) {
      finalUpdates.geographic_states = mergeStates(
        deal.geographic_states,
        updates.geographic_states as string[]
      );
    }

    // Update the listing
    const { error: updateError } = await supabase
      .from('listings')
      .update(finalUpdates)
      .eq('id', dealId);

    if (updateError) {
      console.error('Error updating listing:', updateError);
      throw updateError;
    }

    const fieldsUpdated = Object.keys(updates);
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
