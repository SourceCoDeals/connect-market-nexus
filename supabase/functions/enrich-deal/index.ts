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

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    return String((error as any).message);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
};

// Only allow updates to real listings columns (prevents schema-cache 500s)
const VALID_LISTING_UPDATE_KEYS = new Set([
  'internal_company_name', // extracted company name
  'title', // fallback if internal_company_name not set
  'executive_summary',
  'service_mix',
  'business_model',
  'industry',
  'geographic_states',
  'number_of_locations',
  'location', // must be City, ST
  'address',
  'founded_year',
  'customer_types',
  'owner_goals',
  'key_risks',
  'competitive_position',
  'technology_systems',
  'real_estate_info',
  'growth_trajectory',
]);

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

    // Fetch the deal/listing with extraction_sources (includes version for optimistic lock)
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

    // Capture version for optimistic locking
    const lockVersion = deal.enriched_at || deal.updated_at;

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

    // Timeout constants for external API calls
    const SCRAPE_TIMEOUT_MS = 30000; // 30 seconds
    const AI_TIMEOUT_MS = 45000; // 45 seconds
    const MIN_CONTENT_LENGTH = 200; // Minimum chars to proceed with AI

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
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
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

    if (!websiteContent || websiteContent.length < MIN_CONTENT_LENGTH) {
      console.log(`Insufficient website content scraped: ${websiteContent.length} chars (need ${MIN_CONTENT_LENGTH}+)`);
      return new Response(
        JSON.stringify({ success: false, error: `Could not extract sufficient content from website (${websiteContent.length} chars, need ${MIN_CONTENT_LENGTH}+)` }),
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

CRITICAL - COMPANY NAME EXTRACTION:
- Extract the REAL company name from the website (look in header, logo, footer, about page, legal notices)
- The company name should be the actual business name, NOT a generic description
- Examples of GOOD names: "Acme Plumbing Inc.", "Johnson HVAC Services", "Precision Solar LLC"
- Examples of BAD names: "Performance Marketing Agency", "Home Services Company", "Leading Provider"
- If you find a generic placeholder title, look harder for the real company name

CRITICAL LOCATION RULE: The "location" field MUST be in strict "City, ST" format (e.g., "Dallas, TX", "Chicago, IL").
- Extract the actual city and 2-letter state code from the company's physical address on their website
- Look in footer, contact page, about us, or header for address information
- NEVER use region names like "Midwest", "Southeast", "Texas area"
- NEVER use just a state name or just a city name
- If you cannot find a specific city, leave location empty rather than guessing

Also extract "address" if available:
- "address" may be a full street address (street/city/state/zip)
- If you only find city/state, set "location" and leave "address" empty

Focus on extracting:
1. Company name - The REAL business name (not a generic description)
2. Executive summary - A clear 2-3 paragraph description of the business
3. Services offered - List of services/products they provide
4. Business model - How they make money (B2B, B2C, recurring revenue, project-based, etc.)
5. Industry/sector - Primary industry classification
6. Geographic coverage - States/regions they operate in (use 2-letter US state codes like CA, TX, FL)
7. Number of locations - Physical office/branch count
8. Location/headquarters - MUST be "City, ST" format (e.g., "Dallas, TX")
9. Address/headquarters - Full address if present (street/city/state/zip)
10. Founded year - When the company was established
11. Customer types - Who they serve (commercial, residential, government, etc.)
12. Key risks - Any potential risk factors visible (one per line)
13. Competitive position - Market positioning information
14. Technology/systems - Software, tools, or technology mentioned
15. Real estate - Information about facilities (owned vs leased)
16. Growth trajectory - Any growth indicators or history`;

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
                  internal_company_name: {
                    type: 'string',
                    description: 'The REAL company name extracted from the website (from logo, header, footer, legal notices). Must be an actual business name, NOT a generic description like "Marketing Agency" or "Home Services Company".'
                  },
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
                  location: {
                    type: 'string',
                    description: 'Company headquarters in strict "City, ST" format only (e.g., "Dallas, TX", "Chicago, IL"). Extract from physical address on website. Leave empty if specific city cannot be determined.'
                  },
                  address: {
                    type: 'string',
                    description: 'Full headquarters address if available (may include street, city, state, zip). Leave empty if not found.'
                  },
                  founded_year: {
                    type: 'number',
                    description: 'Year the company was founded (e.g., 2005)'
                  },
                  customer_types: {
                    type: 'string',
                    description: 'Types of customers served (e.g., Commercial, Residential, Government, Industrial)'
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
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
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

    // Drop any unexpected keys so we never attempt to write missing columns
    for (const key of Object.keys(extracted)) {
      if (!VALID_LISTING_UPDATE_KEYS.has(key)) {
        delete (extracted as Record<string, unknown>)[key];
      }
    }

    // Normalize geographic_states using shared module
    if (extracted.geographic_states) {
      extracted.geographic_states = normalizeStates(extracted.geographic_states as string[]);
    }

    // Validate location is in strict "City, ST" format - reject non-conforming values
    if (extracted.location) {
      const locationStr = String(extracted.location).trim();
      // Pattern: "City Name, ST" where ST is 2-letter state code
      const cityStatePattern = /^[A-Za-z\s\.\-']+,\s*[A-Z]{2}$/;
      if (!cityStatePattern.test(locationStr)) {
        console.log(`Rejecting invalid location format: "${locationStr}" - must be "City, ST" format`);
        delete extracted.location;
      }
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

    // Update the listing with optimistic locking
    let updateQuery = supabase
      .from('listings')
      .update(finalUpdates)
      .eq('id', dealId);

    // Apply optimistic lock: only update if version hasn't changed
    if (lockVersion) {
      updateQuery = updateQuery.eq('enriched_at', lockVersion);
    } else {
      // If never enriched before, ensure it's still null
      updateQuery = updateQuery.is('enriched_at', null);
    }

    const { data: updateResult, error: updateError } = await updateQuery.select('id');

    if (updateError) {
      console.error('Error updating listing:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: getErrorMessage(updateError),
          error_code: (updateError as any)?.code,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for optimistic lock conflict
    if (!updateResult || updateResult.length === 0) {
      console.warn(`Optimistic lock conflict for deal ${dealId} - record was modified by another process`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Record was modified by another process. Please refresh and try again.',
          error_code: 'concurrent_modification',
          recoverable: true
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    const message = getErrorMessage(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
