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
// NOTE: 'location' is intentionally excluded - it's for marketplace anonymity
const VALID_LISTING_UPDATE_KEYS = new Set([
  'internal_company_name', // extracted company name
  'title', // fallback if internal_company_name not set
  'executive_summary',
  'service_mix',
  'business_model',
  'industry',
  'geographic_states',
  'number_of_locations',
  // Structured address fields (for remarketing accuracy)
  'street_address',
  'address_city',
  'address_state',
  'address_zip',
  'address_country',
  'address', // legacy full address field
  'founded_year',
  'customer_types',
  'owner_goals',
  'key_risks',
  'competitive_position',
  'technology_systems',
  'real_estate_info',
  'growth_trajectory',
  // LinkedIn data from Apify
  'linkedin_employee_count',
  'linkedin_employee_range',
  'linkedin_url', // Extracted from website or entered manually
]);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const apiKeyHeader = req.headers.get('apikey');
    if (!authHeader && !apiKeyHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    // Check if this is a service role call (background processing) or user token
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    const isServiceRole = token === supabaseServiceKey || apiKeyHeader === supabaseServiceKey;

    let supabase;
    let userId: string;

    if (isServiceRole) {
      // Background processing via queue - use service role
      supabase = createClient(supabaseUrl, supabaseServiceKey);
      // Use a valid UUID for system operations (this is a reserved "system" UUID)
      userId = '00000000-0000-0000-0000-000000000000';
      console.log('Enrichment triggered by background queue processor');
    } else {
      // User-initiated - verify admin access
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader || `Bearer ${apiKeyHeader}` } }
      });

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

      userId = user.id;
    }

    // SECURITY: Check rate limit before making expensive AI calls
    const rateLimitResult = await checkRateLimit(supabase, userId, 'ai_enrichment', true);
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for ${userId} on ai_enrichment`);
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
    // IMPORTANT: Only use enriched_at, NOT updated_at as fallback
    // If enriched_at is null, the lock check uses .is('enriched_at', null)
    const lockVersion = deal.enriched_at;

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
    const SCRAPE_TIMEOUT_MS = 30000; // 30 seconds per page
    const AI_TIMEOUT_MS = 45000; // 45 seconds
    const MIN_CONTENT_LENGTH = 200; // Minimum chars to proceed with AI

    // Step 1: Scrape MULTIPLE pages using Firecrawl
    // We need to crawl Contact, About, and Services pages to find address information
    console.log('Scraping website with Firecrawl (multi-page)...');

    // Build list of pages to scrape - homepage + common important pages
    const baseUrl = new URL(websiteUrl);
    const pagesToScrape = [
      websiteUrl, // Homepage
    ];

    // Common paths where we find address, company info, services
    const importantPaths = [
      '/contact', '/contact-us', '/contactus',
      '/about', '/about-us', '/aboutus', '/about-us/',
      '/locations', '/location', '/our-locations',
      '/services', '/our-services',
    ];

    // Add important paths
    for (const path of importantPaths) {
      pagesToScrape.push(`${baseUrl.origin}${path}`);
    }

    console.log(`Will attempt to scrape up to ${pagesToScrape.length} pages`);

    // Scrape all pages in parallel (with limit)
    const scrapedPages: { url: string; content: string; success: boolean }[] = [];

    // Helper function to scrape a single page
    async function scrapePage(url: string): Promise<{ url: string; content: string; success: boolean }> {
      try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: url,
            formats: ['markdown'],
            onlyMainContent: true,
            waitFor: 2000,
          }),
          signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
        });

        if (!response.ok) {
          return { url, content: '', success: false };
        }

        const data = await response.json();
        const content = data.data?.markdown || data.markdown || '';
        return { url, content, success: content.length > 50 };
      } catch {
        return { url, content: '', success: false };
      }
    }

    // First, always scrape the homepage
    const homepageResult = await scrapePage(websiteUrl);
    scrapedPages.push(homepageResult);

    if (!homepageResult.success) {
      console.error('Failed to scrape homepage');
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to scrape website homepage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to find actual navigation links in the homepage to prioritize real pages
    const homepageContent = homepageResult.content.toLowerCase();
    const prioritizedPaths: string[] = [];

    // Check which paths are likely to exist based on homepage content
    for (const path of importantPaths) {
      const pathName = path.replace(/[/-]/g, ' ').trim();
      if (homepageContent.includes(pathName) || homepageContent.includes(path.slice(1))) {
        prioritizedPaths.push(`${baseUrl.origin}${path}`);
      }
    }

    // Scrape up to 4 additional pages (prioritized first, then fallback to common paths)
    const additionalPages = prioritizedPaths.length > 0
      ? prioritizedPaths.slice(0, 4)
      : importantPaths.slice(0, 4).map(p => `${baseUrl.origin}${p}`);

    console.log(`Scraping additional pages: ${additionalPages.join(', ')}`);

    // Scrape additional pages in parallel
    const additionalResults = await Promise.all(additionalPages.map(url => scrapePage(url)));
    scrapedPages.push(...additionalResults);

    // Count successful scrapes
    const successfulScrapes = scrapedPages.filter(p => p.success);
    console.log(`Successfully scraped ${successfulScrapes.length} of ${scrapedPages.length} pages`);

    // Combine all scraped content with page markers
    let websiteContent = '';
    for (const page of scrapedPages) {
      if (page.success && page.content.length > 50) {
        const pageName = new URL(page.url).pathname || 'homepage';
        websiteContent += `\n\n=== PAGE: ${pageName} ===\n\n${page.content}`;
      }
    }

    // Log which pages were scraped for diagnostics
    const scrapedPagesSummary = scrapedPages.map(p => ({
      url: p.url,
      success: p.success,
      chars: p.content.length
    }));
    console.log('Scrape summary:', JSON.stringify(scrapedPagesSummary));

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

const systemPrompt = `You are a business analyst specializing in M&A due diligence. Extract comprehensive company information from website content.

CRITICAL - COMPANY NAME EXTRACTION:
- Extract the REAL company name from the website (look in header, logo, footer, about page, legal notices)
- The company name should be the actual business name, NOT a generic description
- Examples of GOOD names: "Acme Plumbing Inc.", "Johnson HVAC Services", "Precision Solar LLC"
- Examples of BAD names: "Performance Marketing Agency", "Home Services Company", "Leading Provider"
- If you find a generic placeholder title, look harder for the real company name

CRITICAL - ADDRESS EXTRACTION (HIGHEST PRIORITY):
You MUST extract a physical address. This is required for deal matching. Search AGGRESSIVELY for address information.

WHERE TO FIND ADDRESS (search ALL of these):
1. **Footer** - Most common location, look for city/state near copyright or contact info
2. **Contact page** - "Contact Us", "Locations", "Get in Touch" sections
3. **About page** - "About Us", "Our Story", company history sections
4. **Header** - Sometimes addresses appear in top navigation
5. **Google Maps embed** - Look for embedded map with address
6. **Phone numbers** - Area codes can indicate location (e.g., 214 = Dallas, TX)
7. **Service area mentions** - "Serving the Dallas-Fort Worth area", "Based in Chicago"
8. **License/certification info** - Often includes state (e.g., "Licensed in Texas")
9. **Job postings** - Often mention office location
10. **Press releases** - Often include headquarters location
11. **Copyright notices** - May include city/state

EXTRACT INTO STRUCTURED COMPONENTS:
- street_address: Just the street number and name (e.g., "123 Main Street")
- address_city: City name ONLY (e.g., "Dallas", "Chicago", "Phoenix")
- address_state: 2-letter US state code ONLY (e.g., "TX", "IL", "AZ")
- address_zip: 5-digit ZIP code (e.g., "75201")
- address_country: Country code, default "US"

INFERENCE RULES (if explicit address not found):
- If you see "Serving Dallas-Fort Worth" → address_city: "Dallas", address_state: "TX"
- If you see "Chicago-based" → address_city: "Chicago", address_state: "IL"  
- If you see "Headquartered in Phoenix, Arizona" → address_city: "Phoenix", address_state: "AZ"
- If you see a phone area code, infer the city/state from it
- If you see state licensing info, use that state

DO NOT extract vague regions like "Midwest", "Southeast", "Texas area" for address fields.
The address_city and address_state fields must be specific - a real city name and 2-letter state code.

Focus on extracting:
1. Company name - The REAL business name (not a generic description)
2. **Structured address** - REQUIRED: Extract city and state at minimum
3. Executive summary - A clear 2-3 paragraph description of the business
4. Services offered - List of services/products they provide
5. Business model - How they make money (B2B, B2C, recurring revenue, project-based, etc.)
6. Industry/sector - Primary industry classification
7. Geographic coverage - States/regions they operate in (use 2-letter US state codes)
8. Number of locations - Physical office/branch count
9. Founded year - When the company was established
10. Customer types - Who they serve (commercial, residential, government, etc.)
11. Key risks - Any potential risk factors visible
12. Competitive position - Market positioning information
13. Technology/systems - Software, tools, or technology mentioned
14. Real estate - Information about facilities (owned vs leased)
15. Growth trajectory - Any growth indicators or history`;

    const userPrompt = `Analyze this website content from "${deal.title}" and extract business information.

IMPORTANT: You MUST find and extract the company's physical location (city and state). Look in the footer, contact page, about page, service area mentions, phone area codes, or any other location hints. This is required for deal matching.

Website Content:
${websiteContent.substring(0, 20000)}

Extract all available business information using the provided tool. The address_city and address_state fields are REQUIRED - use inference from service areas or phone codes if a direct address is not visible.`;


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
                  street_address: {
                    type: 'string',
                    description: 'Street address only (e.g., "123 Main Street", "456 Oak Ave Suite 200"). Do NOT include city/state/zip. Leave empty/null if not found - do NOT use placeholder values like "Not Found", "N/A", or "Unknown".'
                  },
                  address_city: {
                    type: 'string',
                    description: 'City name only (e.g., "Dallas", "Los Angeles"). Do NOT include state or zip.'
                  },
                  address_state: {
                    type: 'string',
                    description: '2-letter US state code (e.g., "TX", "CA", "FL") or Canadian province code (e.g., "ON", "BC"). Must be exactly 2 uppercase letters.'
                  },
                  address_zip: {
                    type: 'string',
                    description: '5-digit US ZIP code (e.g., "75201") or Canadian postal code (e.g., "M5V 1J2").'
                  },
                  address_country: {
                    type: 'string',
                    description: 'Country code. Use "US" for United States, "CA" for Canada. Default to "US" if not specified.'
                  },
                  address: {
                    type: 'string',
                    description: 'Full headquarters address as a single string (legacy field). Include street, city, state, zip if available.'
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
                  },
                  linkedin_url: {
                    type: 'string',
                    description: 'DIRECT LinkedIn company page URL only. Must be in the format "https://www.linkedin.com/company/company-name". Do NOT use Google search links or redirects. Only extract if you find a direct linkedin.com/company/ URL.'
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

    // Validate and clean structured address fields
    const US_STATE_CODES = new Set([
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR'
    ]);
    const CA_PROVINCE_CODES = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);

    // Validate address_state
    if (extracted.address_state) {
      const stateStr = String(extracted.address_state).trim().toUpperCase();
      if (stateStr.length === 2 && (US_STATE_CODES.has(stateStr) || CA_PROVINCE_CODES.has(stateStr))) {
        extracted.address_state = stateStr;
      } else {
        console.log(`Rejecting invalid address_state: "${extracted.address_state}"`);
        delete extracted.address_state;
      }
    }

    // Validate address_zip (US 5-digit or Canadian postal code)
    if (extracted.address_zip) {
      const zipStr = String(extracted.address_zip).trim();
      const usZipPattern = /^\d{5}(-\d{4})?$/;
      const caPostalPattern = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;
      if (!usZipPattern.test(zipStr) && !caPostalPattern.test(zipStr)) {
        console.log(`Rejecting invalid address_zip: "${extracted.address_zip}"`);
        delete extracted.address_zip;
      } else {
        extracted.address_zip = zipStr;
      }
    }

    // Clean address_city (remove trailing commas, state codes, reject placeholders)
    if (extracted.address_city) {
      let cityStr = String(extracted.address_city).trim();
      // Remove trailing ", ST" if accidentally included
      cityStr = cityStr.replace(/,\s*[A-Z]{2}$/, '').trim();
      // Reject placeholder values
      const placeholders = ['not found', 'n/a', 'unknown', 'none', 'null', 'undefined', 'tbd', 'not available'];
      if (cityStr.length > 0 && !placeholders.includes(cityStr.toLowerCase())) {
        extracted.address_city = cityStr;
      } else {
        delete extracted.address_city;
      }
    }

    // Clean street_address - reject placeholder values
    if (extracted.street_address) {
      const streetStr = String(extracted.street_address).trim();
      const placeholders = ['not found', 'n/a', 'unknown', 'none', 'null', 'undefined', 'tbd', 'not available', 'not specified'];
      if (streetStr.length > 0 && !placeholders.includes(streetStr.toLowerCase())) {
        extracted.street_address = streetStr;
      } else {
        console.log(`Rejecting placeholder street_address: "${extracted.street_address}"`);
        delete extracted.street_address;
      }
    }

    // Default address_country to US if we have other address fields
    if ((extracted.address_city || extracted.address_state) && !extracted.address_country) {
      extracted.address_country = 'US';
    }

    // IMPORTANT: Remove 'location' from extracted data - we never update it from enrichment
    // The 'location' field is for marketplace anonymity (e.g., "Southeast US")
    delete extracted.location;

    // Validate and normalize linkedin_url - must be a DIRECT linkedin.com/company/ URL
    if (extracted.linkedin_url) {
      const linkedinUrlStr = String(extracted.linkedin_url).trim();
      // Only accept direct LinkedIn company URLs, reject Google/search/redirect URLs
      const linkedinCompanyPattern = /^https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9_-]+\/?$/;
      if (linkedinCompanyPattern.test(linkedinUrlStr)) {
        // Normalize to consistent format
        const match = linkedinUrlStr.match(/linkedin\.com\/company\/([^\/\?]+)/);
        if (match) {
          extracted.linkedin_url = `https://www.linkedin.com/company/${match[1]}`;
          console.log(`Validated LinkedIn URL: ${extracted.linkedin_url}`);
        }
      } else {
        console.log(`Rejecting non-direct LinkedIn URL: "${linkedinUrlStr}"`);
        delete extracted.linkedin_url;
      }
    }

    // Try to fetch LinkedIn data if we have a URL or company name
    const linkedinUrl = extracted.linkedin_url as string | undefined;
    const companyName = (extracted.internal_company_name || deal.internal_company_name || deal.title) as string | undefined;
    
    if (linkedinUrl || companyName) {
      try {
        console.log(`Attempting LinkedIn enrichment for: ${linkedinUrl || companyName}`);
        
        const linkedinResponse = await fetch(`${supabaseUrl}/functions/v1/apify-linkedin-scrape`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            linkedinUrl,
            companyName,
            city: extracted.address_city || deal.address_city,
            state: extracted.address_state || deal.address_state,
            dealId: dealId, // Let the function update directly too as backup
          }),
          signal: AbortSignal.timeout(90000), // 90 seconds for Firecrawl search + scrape
        });

        if (linkedinResponse.ok) {
          const linkedinData = await linkedinResponse.json();
          if (linkedinData.success && linkedinData.scraped) {
            console.log('LinkedIn data retrieved:', linkedinData);
            
            // Add LinkedIn data to extracted fields
            if (linkedinData.linkedin_employee_count) {
              extracted.linkedin_employee_count = linkedinData.linkedin_employee_count;
            }
            if (linkedinData.linkedin_employee_range) {
              extracted.linkedin_employee_range = linkedinData.linkedin_employee_range;
            }
          } else {
            console.log('LinkedIn scrape returned no data:', linkedinData.error || 'No company found');
          }
        } else {
          console.warn('LinkedIn scrape failed:', linkedinResponse.status);
        }
      } catch (linkedinError) {
        // Non-blocking - LinkedIn enrichment is optional
        console.warn('LinkedIn enrichment failed (non-blocking):', linkedinError);
      }
    }

    // Try to fetch Google reviews data
    // Use company name and location for search
    const googleSearchName = companyName || deal.title;
    const googleLocation = (extracted.address_city && extracted.address_state)
      ? `${extracted.address_city}, ${extracted.address_state}`
      : (deal.address_city && deal.address_state)
        ? `${deal.address_city}, ${deal.address_state}`
        : deal.location;

    if (googleSearchName && !deal.google_review_count) {
      try {
        console.log(`Attempting Google reviews enrichment for: ${googleSearchName}`);

        const googleResponse = await fetch(`${supabaseUrl}/functions/v1/apify-google-reviews`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessName: googleSearchName,
            city: extracted.address_city || deal.address_city,
            state: extracted.address_state || deal.address_state,
            dealId: dealId, // Let the function update directly
          }),
          signal: AbortSignal.timeout(95000), // Slightly longer than Google scraper's 90s timeout
        });

        if (googleResponse.ok) {
          const googleData = await googleResponse.json();
          if (googleData.success && googleData.scraped) {
            console.log('Google reviews data retrieved:', googleData);
            // Note: apify-google-reviews updates the deal directly when dealId is provided
          } else {
            console.log('Google reviews scrape returned no data:', googleData.error || 'No business found');
          }
        } else {
          console.warn('Google reviews scrape failed:', googleResponse.status);
        }
      } catch (googleError) {
        // Non-blocking - Google enrichment is optional
        console.warn('Google reviews enrichment failed (non-blocking):', googleError);
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
    const finalUpdates: Record<string, unknown> = {
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
        // "What We Scraped" diagnostic report
        scrapeReport: {
          totalPagesAttempted: scrapedPages.length,
          successfulPages: successfulScrapes.length,
          totalCharactersScraped: websiteContent.length,
          pages: scrapedPagesSummary,
        },
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
