import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  ANTHROPIC_API_URL, 
  getAnthropicHeaders, 
  DEFAULT_CLAUDE_FAST_MODEL,
  toAnthropicTool,
  parseAnthropicToolResponse
} from "../_shared/ai-providers.ts";
import { checkRateLimit, validateUrl, rateLimitResponse, ssrfErrorResponse } from "../_shared/security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fields that should NEVER be overwritten by website enrichment if they came from a transcript
const TRANSCRIPT_PROTECTED_FIELDS = [
  'thesis_summary',
  'strategic_priorities',
  'thesis_confidence',
  'target_geographies',
  'geographic_exclusions',
  'target_revenue_min',
  'target_revenue_max',
  'revenue_sweet_spot',
  'target_ebitda_min',
  'target_ebitda_max',
  'ebitda_sweet_spot',
  'deal_breakers',
  'deal_preferences',
  'owner_roll_requirement',
  'owner_transition_goals',
  'acquisition_timeline',
  'acquisition_appetite',
  'target_services',
  'target_industries',
  'key_quotes',
];

// Fields that should NEVER be updated from website (only from transcripts)
const NEVER_UPDATE_FROM_WEBSITE = [
  'target_geographies',
  'geographic_exclusions',
  'deal_breakers',
  'owner_roll_requirement',
  'owner_transition_goals',
  'key_quotes',
];

const PLACEHOLDER_STRINGS = new Set([
  'not specified', 'n/a', 'na', 'unknown', 'none', 'tbd', 'not available', '',
  '<unknown>', '<UNKNOWN>', 'undefined', 'null'
]);

// State name to code mapping for normalization
const STATE_NAME_TO_CODE: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
};

const VALID_STATE_CODES = new Set(Object.values(STATE_NAME_TO_CODE));

function normalizeStateCode(value: string): string {
  const trimmed = value.trim();
  // Already a valid 2-letter code
  if (trimmed.length === 2 && VALID_STATE_CODES.has(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }
  // Try to map from full name
  const code = STATE_NAME_TO_CODE[trimmed.toLowerCase()];
  return code || trimmed; // Return original if not found
}

// Valid columns in remarketing_buyers table - prevents schema mismatch errors
const VALID_BUYER_COLUMNS = new Set([
  'company_name', 'company_website', 'platform_website', 'pe_firm_name', 'pe_firm_website',
  'business_summary', 'thesis_summary', 'thesis_confidence', 'buyer_type',
  'hq_city', 'hq_state', 'hq_country', 'hq_region',
  'geographic_footprint', 'service_regions', 'operating_locations',
  'primary_customer_size', 'customer_geographic_reach', 'customer_industries', 'target_customer_profile',
  'target_revenue_min', 'target_revenue_max', 'revenue_sweet_spot',
  'target_ebitda_min', 'target_ebitda_max', 'ebitda_sweet_spot',
  'target_services', 'target_industries', 'target_geographies',
  'deal_preferences', 'deal_breakers', 'acquisition_timeline', 'acquisition_appetite', 'acquisition_frequency',
  'owner_roll_requirement', 'owner_transition_goals',
  'recent_acquisitions', 'portfolio_companies', 'total_acquisitions', 'num_platforms',
  'strategic_priorities', 'specialized_focus', 'industry_vertical',
  'data_completeness', 'data_last_updated', 'extraction_sources',
  'key_quotes', 'notes', 'has_fee_agreement',
  'services_offered', 'business_type', 'revenue_model',
]);

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
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Anthropic API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // SECURITY: Check rate limit before making expensive AI calls
    const authHeader = req.headers.get('Authorization');
    let userId = 'system';
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    const rateLimitResult = await checkRateLimit(supabase, userId, 'ai_enrichment', false);
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for user ${userId} on ai_enrichment`);
      return rateLimitResponse(rateLimitResult);
    }

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

    const platformWebsite = buyer.platform_website || buyer.company_website;
    const peFirmWebsite = buyer.pe_firm_website;

    if (!platformWebsite && !peFirmWebsite) {
      return new Response(
        JSON.stringify({ success: false, error: 'Buyer has no website URL to scrape' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Validate URLs to prevent SSRF attacks
    if (platformWebsite) {
      const platformUrlValidation = validateUrl(platformWebsite);
      if (!platformUrlValidation.valid) {
        console.error(`SSRF blocked for platform website: ${platformWebsite} - ${platformUrlValidation.reason}`);
        return ssrfErrorResponse(`Platform website: ${platformUrlValidation.reason}`);
      }
    }
    if (peFirmWebsite) {
      const peFirmUrlValidation = validateUrl(peFirmWebsite);
      if (!peFirmUrlValidation.valid) {
        console.error(`SSRF blocked for PE firm website: ${peFirmWebsite} - ${peFirmUrlValidation.reason}`);
        return ssrfErrorResponse(`PE firm website: ${peFirmUrlValidation.reason}`);
      }
    }

    console.log(`Enriching buyer: ${buyer.company_name}`);
    console.log(`Platform website: ${platformWebsite || 'none'}`);
    console.log(`PE Firm website: ${peFirmWebsite || 'none'}`);

    const existingSources = Array.isArray(buyer.extraction_sources) ? buyer.extraction_sources : [];
    const hasTranscriptSource = existingSources.some(
      (src: any) => src.type === 'transcript' || src.type === 'buyer_transcript'
    );
    console.log(`Has transcript data: ${hasTranscriptSource}`);

    const warnings: string[] = [];
    let platformContent: string | null = null;
    let peFirmContent: string | null = null;

    // Step 1: Scrape websites in PARALLEL for speed
    const scrapePromises: Promise<{ type: string; result: { success: boolean; content?: string; error?: string } }>[] = [];
    
    if (platformWebsite) {
      scrapePromises.push(
        scrapeWebsite(platformWebsite, firecrawlApiKey).then(result => ({ type: 'platform', result }))
      );
    }
    if (peFirmWebsite && peFirmWebsite !== platformWebsite) {
      scrapePromises.push(
        scrapeWebsite(peFirmWebsite, firecrawlApiKey).then(result => ({ type: 'peFirm', result }))
      );
    }

    const scrapeResults = await Promise.all(scrapePromises);
    
    for (const { type, result } of scrapeResults) {
      if (type === 'platform') {
        if (result.success) {
          platformContent = result.content ?? null;
          if (platformContent) console.log(`Scraped platform website: ${platformContent.length} chars`);
        } else {
          warnings.push(`Platform website could not be scraped: ${result.error}`);
          console.warn(`Platform scrape failed: ${result.error}`);
        }
      } else if (type === 'peFirm') {
        if (result.success) {
          peFirmContent = result.content ?? null;
          if (peFirmContent) console.log(`Scraped PE firm website: ${peFirmContent.length} chars`);
        } else {
          warnings.push(`PE firm website could not be scraped: ${result.error}`);
          console.warn(`PE firm scrape failed: ${result.error}`);
        }
      }
    }

    if (!platformContent && !peFirmContent) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not scrape any website content',
          warning: warnings.join('; ')
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Run ONLY 2 consolidated AI prompts (vs 6 previously)
    // This reduces rate limit risk and improves speed
    const extractedData: Record<string, any> = {};
    const evidenceRecords: Array<{ type: string; url: string; extracted_at: string; fields_extracted: string[] }> = [];
    let billingError: { code: string; message: string } | null = null;
    let promptsRun = 0;
    let promptsSuccessful = 0;

    // Prompt 1: Platform Company Intelligence (combines Business + Customers + Geography + Acquisitions)
    if (platformContent && !billingError) {
      console.log('Extracting platform company intelligence...');
      promptsRun++;
      
      const platformResult = await callClaudeAI(
        getPlatformIntelligencePrompt().system,
        getPlatformIntelligencePrompt().user(platformContent, buyer.company_name),
        getPlatformIntelligencePrompt().tool,
        anthropicApiKey
      );
      
      if (platformResult.error) {
        if (platformResult.error.code === 'payment_required' || platformResult.error.code === 'rate_limited') {
          billingError = platformResult.error;
          console.error(`Billing/rate error during platform extraction: ${platformResult.error.code}`);
        }
      } else if (platformResult.data) {
        Object.assign(extractedData, platformResult.data);
        promptsSuccessful++;
        console.log('Extracted platform intelligence:', Object.keys(platformResult.data));
        
        evidenceRecords.push({
          type: 'website',
          url: platformWebsite!,
          extracted_at: new Date().toISOString(),
          fields_extracted: Object.keys(platformResult.data)
        });
      }
    }

    // Prompt 2: PE Firm Intelligence (combines Thesis + Deal Structure + Portfolio)
    if (peFirmContent && !billingError) {
      console.log('Extracting PE firm intelligence...');
      promptsRun++;
      
      const peFirmResult = await callClaudeAI(
        getPEFirmIntelligencePrompt().system,
        getPEFirmIntelligencePrompt().user(peFirmContent),
        getPEFirmIntelligencePrompt().tool,
        anthropicApiKey
      );
      
      if (peFirmResult.error) {
        if (peFirmResult.error.code === 'payment_required' || peFirmResult.error.code === 'rate_limited') {
          billingError = peFirmResult.error;
          console.error(`Billing/rate error during PE firm extraction: ${peFirmResult.error.code}`);
        }
      } else if (peFirmResult.data) {
        Object.assign(extractedData, peFirmResult.data);
        promptsSuccessful++;
        console.log('Extracted PE firm intelligence:', Object.keys(peFirmResult.data));
        
        evidenceRecords.push({
          type: 'website',
          url: peFirmWebsite!,
          extracted_at: new Date().toISOString(),
          fields_extracted: Object.keys(peFirmResult.data)
        });
      }
    }

    console.log(`Extraction complete: ${promptsSuccessful}/${promptsRun} prompts successful, ${Object.keys(extractedData).length} fields extracted`);

    // If billing error occurred, return partial data with error code
    if (billingError) {
      if (Object.keys(extractedData).length > 0) {
        const partialUpdateData = buildUpdateObject(buyer, extractedData, hasTranscriptSource, existingSources, evidenceRecords);
        await supabase
          .from('remarketing_buyers')
          .update(partialUpdateData)
          .eq('id', buyerId);
      }

      const statusCode = billingError.code === 'payment_required' ? 402 : 429;
      return new Response(
        JSON.stringify({
          success: false,
          error: billingError.message,
          error_code: billingError.code,
          partial_data: extractedData,
          fields_extracted: Object.keys(extractedData).length,
          recoverable: billingError.code === 'rate_limited'
        }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Apply intelligent merge logic and save
    const updateData = buildUpdateObject(buyer, extractedData, hasTranscriptSource, existingSources, evidenceRecords);

    const { error: updateError } = await supabase
      .from('remarketing_buyers')
      .update(updateData)
      .eq('id', buyerId);

    if (updateError) {
      console.error('Failed to update buyer:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to save enrichment data',
          error_code: 'db_update_failed',
          details: {
            message: (updateError as any)?.message,
            code: (updateError as any)?.code,
            hint: (updateError as any)?.hint,
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fieldsUpdated = Object.keys(updateData).length;
    const fieldsExtracted = Object.keys(extractedData);
    console.log(`Successfully enriched buyer ${buyer.company_name} with ${fieldsUpdated} fields updated, ${fieldsExtracted.length} fields extracted`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          buyerId,
          fieldsUpdated,
          fieldsExtracted,
          dataCompleteness: updateData.data_completeness || buyer.data_completeness || 'low',
          extractedData,
          scraped: {
            platform: !!platformContent,
            peFirm: !!peFirmContent
          },
          extractionDetails: {
            platformScraped: !!platformContent,
            platformContentLength: platformContent?.length || 0,
            peFirmScraped: !!peFirmContent,
            peFirmContentLength: peFirmContent?.length || 0,
            promptsRun,
            promptsSuccessful
          }
        },
        warning: warnings.length > 0 ? warnings.join('; ') : undefined
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

// ============= Helper Functions =============

const MIN_CONTENT_LENGTH = 200;
const SCRAPE_TIMEOUT_MS = 15000; // 15 seconds (reduced from 30s to fit in 60s edge function limit)
const AI_TIMEOUT_MS = 20000; // 20 seconds (reduced from 45s to fit in 60s edge function limit)

async function scrapeWebsite(url: string, apiKey: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const content = data.data?.markdown || data.markdown || '';
    
    if (!content || content.length < MIN_CONTENT_LENGTH) {
      return { success: false, error: `Insufficient content (${content.length} chars, need ${MIN_CONTENT_LENGTH}+)` };
    }

    return { success: true, content };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { success: false, error: `Scrape timed out after ${SCRAPE_TIMEOUT_MS / 1000}s` };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Claude AI call with proper Anthropic API format
async function callClaudeAI(
  systemPrompt: string, 
  userPrompt: string, 
  tool: any, 
  apiKey: string
): Promise<{ data: any | null; error?: { code: string; message: string } }> {
  try {
    console.log(`Calling Claude with tool: ${tool.function.name}`);
    
    // Convert OpenAI tool format to Anthropic format
    const anthropicTool = toAnthropicTool(tool);
    
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: getAnthropicHeaders(apiKey),
      body: JSON.stringify({
        model: DEFAULT_CLAUDE_FAST_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        tools: [anthropicTool],
        tool_choice: { type: 'tool', name: anthropicTool.name }
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    // Handle billing/rate limit errors
    if (response.status === 402) {
      console.error('Claude credits depleted (402)');
      return { 
        data: null, 
        error: { code: 'payment_required', message: 'AI credits depleted' } 
      };
    }
    
    if (response.status === 429) {
      console.error('Claude rate limited (429)');
      return { 
        data: null, 
        error: { code: 'rate_limited', message: 'Rate limit exceeded' } 
      };
    }
    
    if (response.status === 529) {
      console.error('Claude overloaded (529)');
      return { 
        data: null, 
        error: { code: 'service_overloaded', message: 'AI service temporarily overloaded' } 
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Claude call failed: ${response.status}`, errorText.substring(0, 500));
      return { data: null };
    }

    const responseText = await response.text();
    console.log(`Claude response status: ${response.status}, length: ${responseText.length}`);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Claude response JSON:', responseText.substring(0, 500));
      return { data: null };
    }

    // Parse Anthropic tool_use response
    const toolResult = parseAnthropicToolResponse(data);
    
    if (!toolResult) {
      console.warn(`No tool_use in Claude response. Stop reason: ${data.stop_reason}`);
      return { data: null };
    }

    console.log(`Successfully parsed Claude tool call for ${tool.function.name}: ${Object.keys(toolResult as object).length} fields`);
    return { data: toolResult };
    
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.error(`Claude call timed out after ${AI_TIMEOUT_MS / 1000}s`);
      return { data: null, error: { code: 'timeout', message: 'AI request timed out' } };
    }
    console.error('Claude extraction error:', error);
    return { data: null };
  }
}

// ============= Consolidated Prompt Definitions (2 prompts vs 6) =============

function getPlatformIntelligencePrompt() {
  return {
    tool: {
      type: 'function',
      function: {
        name: 'extract_platform_intelligence',
        description: 'Extract comprehensive business intelligence from a platform company website',
        parameters: {
          type: 'object',
          properties: {
            // Business Overview
            services_offered: { type: 'string', description: 'Primary services or products offered' },
            business_summary: { type: 'string', description: 'Brief summary of what the company does (2-3 sentences)' },
            business_type: { type: 'string', description: 'Type of business (e.g., Service Provider, Manufacturer)' },
            revenue_model: { type: 'string', description: 'How the company generates revenue' },
            industry_vertical: { type: 'string', description: 'Primary industry vertical' },
            specialized_focus: { type: 'string', description: 'Any specialized focus areas or niches' },
            pe_firm_name: { type: 'string', description: 'Name of the parent PE firm if mentioned on the site' },
            
            // Customer/End Market
            primary_customer_size: { type: 'string', description: 'Primary customer size segment (SMB, Mid-market, Enterprise)' },
            customer_industries: { type: 'array', items: { type: 'string' }, description: 'Industries served' },
            customer_geographic_reach: { type: 'string', description: 'Geographic reach of customer base' },
            target_customer_profile: { type: 'string', description: 'Description of ideal customer profile' },
            
            // Geography/Footprint
            hq_city: { type: 'string', description: 'Headquarters city name (actual city like Atlanta, not region)' },
            hq_state: { type: 'string', description: 'Headquarters state as 2-letter code (e.g., GA, TX)' },
            geographic_footprint: { type: 'array', items: { type: 'string' }, description: 'US 2-letter state codes where they have physical presence' },
            service_regions: { type: 'array', items: { type: 'string' }, description: 'US state codes where company serves customers' },
            
            // Acquisitions
            recent_acquisitions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  company_name: { type: 'string' },
                  date: { type: 'string' },
                  location: { type: 'string' }
                }
              },
              description: 'List of companies acquired by this platform'
            },
            total_acquisitions: { type: 'number', description: 'Total number of acquisitions made' },
            acquisition_frequency: { type: 'string', description: 'How often they acquire (e.g., 1-2 per year)' }
          }
        }
      }
    },
    system: `You are a senior M&A analyst extracting structured business intelligence from company websites.

Extract ALL available information about:
1. BUSINESS OVERVIEW: What they do, services, business model, industry focus
2. CUSTOMERS: Who they sell to, customer size, industries served
3. GEOGRAPHY: Where they are located and operate (use 2-letter state codes ONLY)
4. ACQUISITIONS: Any mentions of companies they've acquired

CRITICAL RULES:
- hq_city MUST be an actual city name (Atlanta, Dallas, Phoenix) - NEVER a region (Southeast, Midwest)
- hq_state MUST be a 2-letter state code (GA, TX, AZ)
- All geographic_footprint and service_regions entries MUST be 2-letter state codes
- Be concise and factual. If information is not available, omit that field.
- Do NOT make up information that isn't clearly stated on the website.`,
    user: (content: string, companyName: string) => 
      `Website Content for "${companyName}":\n\n${content.substring(0, 20000)}\n\nExtract all available business intelligence.`
  };
}

function getPEFirmIntelligencePrompt() {
  return {
    tool: {
      type: 'function',
      function: {
        name: 'extract_pe_firm_intelligence',
        description: 'Extract comprehensive investment intelligence from a PE firm website',
        parameters: {
          type: 'object',
          properties: {
            // Investment Thesis
            thesis_summary: { type: 'string', description: 'Summary of investment thesis and focus (2-3 sentences)' },
            strategic_priorities: { type: 'array', items: { type: 'string' }, description: 'Key strategic priorities' },
            thesis_confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence based on specificity of thesis' },
            target_services: { type: 'array', items: { type: 'string' }, description: 'Services/products they seek in acquisition targets' },
            target_industries: { type: 'array', items: { type: 'string' }, description: 'Industries they invest in' },
            acquisition_appetite: { type: 'string', description: 'How active they are in acquiring (e.g., Very Active, Selective)' },
            
            // Deal Structure
            target_revenue_min: { type: 'number', description: 'Minimum target revenue in dollars (e.g., 5000000 for $5M)' },
            target_revenue_max: { type: 'number', description: 'Maximum target revenue in dollars' },
            revenue_sweet_spot: { type: 'number', description: 'Preferred/ideal revenue level in dollars' },
            target_ebitda_min: { type: 'number', description: 'Minimum target EBITDA in dollars' },
            target_ebitda_max: { type: 'number', description: 'Maximum target EBITDA in dollars' },
            ebitda_sweet_spot: { type: 'number', description: 'Preferred/ideal EBITDA level in dollars' },
            acquisition_timeline: { type: 'string', description: 'Typical timeline from LOI to close' },
            deal_preferences: { type: 'string', description: 'Preferred deal structures or terms' },
            
            // Portfolio
            portfolio_companies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  website: { type: 'string' },
                  locations: { type: 'array', items: { type: 'string' } }
                }
              },
              description: 'Current portfolio companies'
            },
            num_platforms: { type: 'number', description: 'Number of platform companies in portfolio' }
          }
        }
      }
    },
    system: `You are a senior M&A analyst extracting investment intelligence from private equity firm websites.

Extract ALL available information about:
1. INVESTMENT THESIS: What sectors they focus on, strategic priorities, target criteria
2. DEAL STRUCTURE: Revenue/EBITDA ranges, deal timelines, structure preferences
3. PORTFOLIO: Current portfolio companies

CRITICAL RULES:
- Convert ALL financial figures to actual numbers: "$5M" = 5000000, "$10-20M" = min:10000000, max:20000000
- Rate thesis_confidence: high (specific criteria stated), medium (general focus areas), low (vague/generic)
- Be concise and factual. If information is not available, omit that field.
- Do NOT make up information that isn't clearly stated on the website.`,
    user: (content: string) => 
      `PE Firm Website Content:\n\n${content.substring(0, 20000)}\n\nExtract all available investment intelligence.`
  };
}

// Intelligent merge logic
function buildUpdateObject(
  buyer: any,
  extractedData: Record<string, any>,
  hasTranscriptSource: boolean,
  existingSources: any[],
  evidenceRecords: any[]
): Record<string, any> {
  const updateData: Record<string, any> = {
    data_last_updated: new Date().toISOString(),
    extraction_sources: [...existingSources, ...evidenceRecords]
  };

  const keyFields = ['thesis_summary', 'target_services', 'target_geographies', 'geographic_footprint', 'hq_state', 'pe_firm_name', 'business_summary'];
  const extractedFields = keyFields.filter(f => extractedData[f]);
  const existingFields = keyFields.filter(f => buyer[f]);
  
  console.log(`Data completeness check: ${extractedFields.length} new fields, ${existingFields.length} existing fields`);
  console.log(`Extracted key fields: ${extractedFields.join(', ') || 'none'}`);
  
  if (extractedFields.length >= 4) {
    updateData.data_completeness = 'high';
  } else if (extractedFields.length >= 2) {
    updateData.data_completeness = 'medium';
  } else if (extractedFields.length === 0) {
    if (existingFields.length === 0) {
      updateData.data_completeness = 'low';
    }
  } else {
    if (buyer.data_completeness !== 'medium' && buyer.data_completeness !== 'high') {
      updateData.data_completeness = 'medium';
    }
  }

  for (const field of Object.keys(extractedData)) {
    const newValue = extractedData[field];
    const existingValue = buyer[field];

    if (newValue === undefined || newValue === null) continue;

    if (!VALID_BUYER_COLUMNS.has(field)) {
      console.warn(`Skipping non-existent column: ${field}`);
      continue;
    }

    if (NEVER_UPDATE_FROM_WEBSITE.includes(field)) {
      console.log(`Skipping ${field}: never update from website`);
      continue;
    }

    if (hasTranscriptSource && TRANSCRIPT_PROTECTED_FIELDS.includes(field)) {
      const hasExistingData = existingValue !== null && 
                              existingValue !== undefined &&
                              (typeof existingValue !== 'string' || existingValue.trim() !== '') &&
                              (!Array.isArray(existingValue) || existingValue.length > 0);
      
      if (hasExistingData) {
        console.log(`Skipping ${field}: protected by transcript data`);
        continue;
      }
    }

    // Handle strings (with special cases for state codes and comma-separated array fields)
    if (typeof newValue === 'string') {
      let normalized = newValue.trim();
      
      // Skip placeholders
      if (!normalized || PLACEHOLDER_STRINGS.has(normalized.toLowerCase())) continue;
      
      // Normalize state codes for hq_state field
      if (field === 'hq_state') {
        normalized = normalizeStateCode(normalized);
        // For state codes, always prefer the normalized 2-letter code
        if (VALID_STATE_CODES.has(normalized)) {
          updateData[field] = normalized;
          continue;
        }
      }
      
      // CRITICAL FIX: Claude sometimes returns comma-separated strings for array fields
      // Convert to array if field should be an array in the database
      const arrayFields = new Set([
        'target_geographies', 'target_services', 'target_industries', 'geographic_footprint',
        'service_regions', 'operating_locations', 'customer_industries', 'strategic_priorities'
      ]);

      if (arrayFields.has(field) && normalized.includes(',')) {
        // Convert "A, B, C" to ["A", "B", "C"]
        let arrayValue = normalized
          .split(',')
          .map(v => v.trim())
          .filter(v => v && !PLACEHOLDER_STRINGS.has(v.toLowerCase()));

        // Normalize state codes for geographic fields
        if (field === 'geographic_footprint' || field === 'service_regions' || field === 'target_geographies') {
          arrayValue = arrayValue.map(v => normalizeStateCode(v));
        }

        if (arrayValue.length > 0) {
          // De-duplicate
          const unique = [...new Set(arrayValue.map(v => v.toLowerCase()))].map(
            lower => arrayValue.find(v => v.toLowerCase() === lower)
          ).filter(Boolean);

          if (!existingValue || !Array.isArray(existingValue) || unique.length > existingValue.length) {
            updateData[field] = unique;
          }
        }
        continue;
      }

      // Regular string field
      if (!existingValue || normalized.length > (existingValue?.length || 0)) {
        updateData[field] = normalized;
      }
      continue;
    }

      if (!existingValue || normalized.length > (existingValue?.length || 0)) {
        updateData[field] = normalized;
      }
      continue;
    }

    if (Array.isArray(newValue)) {
      let normalized = newValue
        .filter(v => v && typeof v === 'string')
        .map(v => v.trim())
        .filter(v => v && !PLACEHOLDER_STRINGS.has(v.toLowerCase()));
      
      // Normalize state codes for geographic fields
      if (field === 'geographic_footprint' || field === 'service_regions') {
        normalized = normalized.map(v => normalizeStateCode(v));
      }
      
      const unique = [...new Set(normalized.map(v => v.toLowerCase()))].map(
        lower => normalized.find(v => v.toLowerCase() === lower)
      ).filter(Boolean);
      
      if (unique.length === 0) continue;
      if (!existingValue || !Array.isArray(existingValue) || unique.length > existingValue.length) {
        updateData[field] = unique;
      }
      continue;
    }

    if (typeof newValue === 'number') {
      if (existingValue === null || existingValue === undefined) {
        updateData[field] = newValue;
      }
      continue;
    }

    if (typeof newValue === 'object' && !Array.isArray(newValue)) {
      if (!existingValue) {
        updateData[field] = newValue;
      }
      continue;
    }
  }

  return updateData;
}
