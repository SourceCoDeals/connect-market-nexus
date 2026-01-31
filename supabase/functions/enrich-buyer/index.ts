import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

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
  'not specified', 'n/a', 'na', 'unknown', 'none', 'tbd', 'not available', ''
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
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Gemini API key not configured' }),
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

    // Get primary website - prefer platform_website, fall back to company_website
    const platformWebsite = buyer.platform_website || buyer.company_website;
    const peFirmWebsite = buyer.pe_firm_website;

    if (!platformWebsite && !peFirmWebsite) {
      return new Response(
        JSON.stringify({ success: false, error: 'Buyer has no website URL to scrape' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Enriching buyer: ${buyer.company_name}`);
    console.log(`Platform website: ${platformWebsite || 'none'}`);
    console.log(`PE Firm website: ${peFirmWebsite || 'none'}`);

    // Check for transcript data protection
    const existingSources = Array.isArray(buyer.extraction_sources) ? buyer.extraction_sources : [];
    const hasTranscriptSource = existingSources.some(
      (src: any) => src.type === 'transcript' || src.type === 'buyer_transcript'
    );
    console.log(`Has transcript data: ${hasTranscriptSource}`);

    const warnings: string[] = [];
    let platformContent: string | null = null;
    let peFirmContent: string | null = null;

    // Step 1: Scrape Platform Website
    if (platformWebsite) {
      const platformResult = await scrapeWebsite(platformWebsite, firecrawlApiKey);
      if (platformResult.success) {
        platformContent = platformResult.content;
        console.log(`Scraped platform website: ${platformContent.length} chars`);
      } else {
        warnings.push(`Platform website could not be scraped: ${platformResult.error}`);
        console.warn(`Platform scrape failed: ${platformResult.error}`);
      }
    }

    // Step 2: Scrape PE Firm Website (if different from platform)
    if (peFirmWebsite && peFirmWebsite !== platformWebsite) {
      const peFirmResult = await scrapeWebsite(peFirmWebsite, firecrawlApiKey);
      if (peFirmResult.success) {
        peFirmContent = peFirmResult.content;
        console.log(`Scraped PE firm website: ${peFirmContent.length} chars`);
      } else {
        warnings.push(`PE firm website could not be scraped: ${peFirmResult.error}`);
        console.warn(`PE firm scrape failed: ${peFirmResult.error}`);
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

    // Step 3: Run 6-prompt extraction strategy with fail-fast on billing errors
    const extractedData: Record<string, any> = {};
    const evidenceRecords: Array<{ type: string; url: string; extracted_at: string; fields_extracted: string[] }> = [];
    let billingError: { code: string; message: string } | null = null;
    let promptsRun = 0;
    let promptsSuccessful = 0;

    // Delay between prompts to avoid rate limiting (Gemini has ~10 RPM for free tier)
    const INTER_PROMPT_DELAY_MS = 600;
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    
    // Helper to check for billing errors and stop if found
    const checkBillingError = (result: { data: any; error?: { code: string; message: string } }) => {
      if (result.error && (result.error.code === 'payment_required' || result.error.code === 'rate_limited')) {
        billingError = result.error;
        return true;
      }
      return false;
    };

    // Prompts 1-3b: Platform website extractions
    if (platformContent && !billingError) {
      console.log('Extracting from platform website...');
      
      // Prompt 1: Business Overview
      promptsRun++;
      const overviewResult = await callAIWithRetry(
        getBusinessOverviewPrompt().system,
        getBusinessOverviewPrompt().user(platformContent, buyer.company_name),
        getBusinessOverviewPrompt().tool,
        geminiApiKey
      );
      if (checkBillingError(overviewResult)) {
        console.error('Billing error during business overview extraction');
      } else if (overviewResult.data) {
        Object.assign(extractedData, overviewResult.data);
        promptsSuccessful++;
        console.log('Extracted business overview:', Object.keys(overviewResult.data));
      }

      // Prompt 2: Customers/End Market (with delay)
      if (!billingError) {
        await delay(INTER_PROMPT_DELAY_MS);
        promptsRun++;
        const customersResult = await callAIWithRetry(
          getCustomersEndMarketPrompt().system,
          getCustomersEndMarketPrompt().user(platformContent),
          getCustomersEndMarketPrompt().tool,
          geminiApiKey
        );
        if (checkBillingError(customersResult)) {
          console.error('Billing error during customers extraction');
        } else if (customersResult.data) {
          Object.assign(extractedData, customersResult.data);
          promptsSuccessful++;
          console.log('Extracted customers:', Object.keys(customersResult.data));
        }
      }

      // Prompt 3: Geography/Footprint (with delay)
      if (!billingError) {
        await delay(INTER_PROMPT_DELAY_MS);
        promptsRun++;
        const geographyResult = await callAIWithRetry(
          getGeographyFootprintPrompt().system,
          getGeographyFootprintPrompt().user(platformContent),
          getGeographyFootprintPrompt().tool,
          geminiApiKey
        );
        if (checkBillingError(geographyResult)) {
          console.error('Billing error during geography extraction');
        } else if (geographyResult.data) {
          Object.assign(extractedData, geographyResult.data);
          promptsSuccessful++;
          console.log('Extracted geography:', Object.keys(geographyResult.data));
        }
      }

      // Prompt 3b: Platform Acquisitions (with delay)
      if (!billingError) {
        await delay(INTER_PROMPT_DELAY_MS);
        promptsRun++;
        const acquisitionsResult = await callAIWithRetry(
          getPlatformAcquisitionsPrompt().system,
          getPlatformAcquisitionsPrompt().user(platformContent),
          getPlatformAcquisitionsPrompt().tool,
          geminiApiKey
        );
        if (checkBillingError(acquisitionsResult)) {
          console.error('Billing error during acquisitions extraction');
        } else if (acquisitionsResult.data) {
          Object.assign(extractedData, acquisitionsResult.data);
          promptsSuccessful++;
          console.log('Extracted acquisitions:', Object.keys(acquisitionsResult.data));
        }
      }

      // Only add evidence if we extracted at least one field from platform
      const platformExtractedFields = Object.keys(extractedData);
      if (platformExtractedFields.length > 0) {
        evidenceRecords.push({
          type: 'website',
          url: platformWebsite!,
          extracted_at: new Date().toISOString(),
          fields_extracted: platformExtractedFields
        });
      }
    }

    // Prompts 4-6: PE Firm website extractions
    const preExtractionFieldCount = Object.keys(extractedData).length;
    if (peFirmContent && !billingError) {
      console.log('Extracting from PE firm website...');
      const peFirmFields: string[] = [];

      // Prompt 4: PE Investment Thesis (with delay from platform prompts)
      await delay(INTER_PROMPT_DELAY_MS);
      promptsRun++;
      const thesisResult = await callAIWithRetry(
        getPEInvestmentThesisPrompt().system,
        getPEInvestmentThesisPrompt().user(peFirmContent),
        getPEInvestmentThesisPrompt().tool,
        geminiApiKey
      );
      if (checkBillingError(thesisResult)) {
        console.error('Billing error during PE thesis extraction');
      } else if (thesisResult.data) {
        Object.assign(extractedData, thesisResult.data);
        peFirmFields.push(...Object.keys(thesisResult.data));
        promptsSuccessful++;
        console.log('Extracted PE thesis:', Object.keys(thesisResult.data));
      }

      // Prompt 5: PE Deal Structure (with delay)
      if (!billingError) {
        await delay(INTER_PROMPT_DELAY_MS);
        promptsRun++;
        const dealStructureResult = await callAIWithRetry(
          getPEDealStructurePrompt().system,
          getPEDealStructurePrompt().user(peFirmContent),
          getPEDealStructurePrompt().tool,
          geminiApiKey
        );
        if (checkBillingError(dealStructureResult)) {
          console.error('Billing error during deal structure extraction');
        } else if (dealStructureResult.data) {
          Object.assign(extractedData, dealStructureResult.data);
          peFirmFields.push(...Object.keys(dealStructureResult.data));
          promptsSuccessful++;
          console.log('Extracted deal structure:', Object.keys(dealStructureResult.data));
        }
      }

      // Prompt 6: PE Portfolio (with delay)
      if (!billingError) {
        await delay(INTER_PROMPT_DELAY_MS);
        promptsRun++;
        const portfolioResult = await callAIWithRetry(
          getPEPortfolioPrompt().system,
          getPEPortfolioPrompt().user(peFirmContent),
          getPEPortfolioPrompt().tool,
          geminiApiKey
        );
        if (checkBillingError(portfolioResult)) {
          console.error('Billing error during portfolio extraction');
        } else if (portfolioResult.data) {
          Object.assign(extractedData, portfolioResult.data);
          peFirmFields.push(...Object.keys(portfolioResult.data));
          promptsSuccessful++;
          console.log('Extracted portfolio:', Object.keys(portfolioResult.data));
        }
      }

      // Only add PE firm evidence if we extracted at least one field from PE firm
      if (peFirmFields.length > 0) {
        evidenceRecords.push({
          type: 'website',
          url: peFirmWebsite!,
          extracted_at: new Date().toISOString(),
          fields_extracted: peFirmFields
        });
      }
    }

    console.log(`Extraction complete: ${promptsSuccessful}/${promptsRun} prompts successful, ${Object.keys(extractedData).length} fields extracted`);

    // If billing error occurred, return partial data with error code
    if (billingError) {
      // Still save any partial data we extracted
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

    // Step 4: Apply intelligent merge logic
    const updateData = buildUpdateObject(buyer, extractedData, hasTranscriptSource, existingSources, evidenceRecords);

    // Update buyer record
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
            // Note: no raw data payload returned to avoid leaking PII
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
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const content = data.data?.markdown || data.markdown || '';
    
    if (!content || content.length < 100) {
      return { success: false, error: 'Insufficient content' };
    }

    return { success: true, content };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Enhanced AI call with comprehensive logging
async function callAI(
  systemPrompt: string, 
  userPrompt: string, 
  tool: any, 
  apiKey: string
): Promise<{ data: any | null; error?: { code: string; message: string } }> {
  try {
    console.log(`Calling AI with tool: ${tool.function.name}`);
    
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: getGeminiHeaders(apiKey),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: tool.function.name } }
      }),
    });

    // Handle billing/rate limit errors
    if (response.status === 402) {
      console.error('AI credits depleted (402)');
      return { 
        data: null, 
        error: { code: 'payment_required', message: 'AI credits depleted' } 
      };
    }
    
    if (response.status === 429) {
      console.error('Rate limited (429)');
      return { 
        data: null, 
        error: { code: 'rate_limited', message: 'Rate limit exceeded' } 
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI call failed: ${response.status}`, errorText.substring(0, 500));
      return { data: null };
    }

    // Parse response with detailed logging
    const responseText = await response.text();
    console.log(`AI response status: ${response.status}, length: ${responseText.length}`);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response JSON:', responseText.substring(0, 500));
      return { data: null };
    }

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      // Log what we actually received for debugging
      const messageContent = data.choices?.[0]?.message?.content || 'no content';
      const finishReason = data.choices?.[0]?.finish_reason || 'unknown';
      console.warn(`No tool call in AI response. Finish reason: ${finishReason}. Message content: ${JSON.stringify(messageContent).substring(0, 200)}`);
      return { data: null };
    }

    // Parse tool arguments
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      console.log(`Successfully parsed tool call for ${tool.function.name}: ${Object.keys(parsed).length} fields`);
      return { data: parsed };
    } catch (argParseError) {
      console.error(`Failed to parse tool arguments for ${tool.function.name}:`, toolCall.function.arguments?.substring(0, 500));
      return { data: null };
    }
  } catch (error) {
    console.error('AI extraction error:', error);
    return { data: null };
  }
}

// Retry wrapper with exponential backoff
async function callAIWithRetry(
  systemPrompt: string, 
  userPrompt: string, 
  tool: any, 
  apiKey: string,
  maxRetries = 3
): Promise<{ data: any | null; error?: { code: string; message: string } }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await callAI(systemPrompt, userPrompt, tool, apiKey);

    // Success
    if (result.data !== null) return result;

    // Billing error: never retry
    if (result.error?.code === 'payment_required') return result;

    // Rate limit: backoff + retry
    if (result.error?.code === 'rate_limited') {
      if (attempt < maxRetries) {
        // Gemini rate limits can require a longer cool-down. Use exponential backoff + jitter.
        const baseMs = 30_000 * Math.pow(2, attempt - 1); // 30s, 60s, 120s...
        const jitterMs = Math.floor(Math.random() * 2_000);
        const waitMs = baseMs + jitterMs;
        console.log(`Rate limited for ${tool.function.name}. Waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      return result;
    }

    // Other transient failures (e.g., parse issues). Short backoff.
    if (attempt < maxRetries) {
      const waitMs = attempt * 1000;
      console.log(`Attempt ${attempt} for ${tool.function.name} failed, retrying in ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    console.warn(`All ${maxRetries} attempts failed for ${tool.function.name}`);
    return { data: null };
  }

  return { data: null };
}

// ============= Prompt Definitions =============

function getBusinessOverviewPrompt() {
  return {
    tool: {
      type: 'function',
      function: {
        name: 'extract_business_overview',
        description: 'Extract business overview from platform company website',
        parameters: {
          type: 'object',
          properties: {
            services_offered: { type: 'string', description: 'Primary services or products offered' },
            business_summary: { type: 'string', description: 'Brief summary of what the company does' },
            business_type: { type: 'string', description: 'Type of business (e.g., Service Provider, Manufacturer)' },
            revenue_model: { type: 'string', description: 'How the company generates revenue' },
            industry_vertical: { type: 'string', description: 'Primary industry vertical' },
            specialized_focus: { type: 'string', description: 'Any specialized focus areas or niches' },
            pe_firm_name: { type: 'string', description: 'Name of the parent PE firm if mentioned' }
          }
        }
      }
    },
    system: `You are a business analyst extracting structured data from company websites.
Extract business overview information from the provided website content.
Focus on: core services, business model, industry classification, and specialized niches.
Be concise and factual. If information is not available, omit that field.`,
    user: (content: string, companyName: string) => 
      `Website Content for "${companyName}":\n\n${content.substring(0, 12000)}\n\nExtract business overview.`
  };
}

function getCustomersEndMarketPrompt() {
  return {
    tool: {
      type: 'function',
      function: {
        name: 'extract_customers_end_market',
        description: 'Extract customer and end market information',
        parameters: {
          type: 'object',
          properties: {
            primary_customer_size: { type: 'string', description: 'Primary customer size segment (SMB, Mid-market, Enterprise)' },
            customer_industries: { type: 'array', items: { type: 'string' }, description: 'Industries served by the company' },
            customer_geographic_reach: { type: 'string', description: 'Geographic reach of customer base' },
            target_customer_profile: { type: 'string', description: 'Description of ideal customer profile' }
          }
        }
      }
    },
    system: `Extract customer and market information from the company website.
Focus on: types and sizes of customers, industries served, geographic reach.
Be specific. Use actual industry names, not generic terms.`,
    user: (content: string) => 
      `Website Content:\n\n${content.substring(0, 12000)}\n\nExtract customer information.`
  };
}

function getGeographyFootprintPrompt() {
  return {
    tool: {
      type: 'function',
      function: {
        name: 'extract_geography_footprint',
        description: 'Extract CURRENT geographic locations where company has physical presence',
        parameters: {
          type: 'object',
          properties: {
            hq_city: { type: 'string', description: 'Headquarters city' },
            hq_state: { type: 'string', description: 'Headquarters state as 2-letter abbreviation (TX, CA, etc.)' },
            geographic_footprint: { 
              type: 'array', 
              items: { type: 'string' }, 
              description: 'US 2-letter state codes ONLY where they have physical locations. MUST be valid 2-letter codes.'
            },
            service_regions: {
              type: 'array',
              items: { type: 'string' },
              description: 'US states where company actively serves customers. Use 2-letter codes ONLY.'
            }
          }
        }
      }
    },
    system: `Extract geographic information about where the company CURRENTLY operates.

CRITICAL RULES:
1. geographic_footprint: ONLY 2-letter state codes where they have physical offices/locations
2. service_regions: ONLY states they serve FROM their physical locations
3. DO NOT include aspirational or marketing language about "serving nationwide"
4. Be conservative - regional companies are NOT national
5. All state codes MUST be valid 2-letter abbreviations (TX, CA, NY, etc.)`,
    user: (content: string) => 
      `Website Content:\n\n${content.substring(0, 12000)}\n\nExtract CURRENT geographic presence.`
  };
}

function getPlatformAcquisitionsPrompt() {
  return {
    tool: {
      type: 'function',
      function: {
        name: 'extract_platform_acquisitions',
        description: 'Extract acquisition history for the platform company itself',
        parameters: {
          type: 'object',
          properties: {
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
            acquisition_frequency: { type: 'string', description: 'How often they acquire' }
          }
        }
      }
    },
    system: `Extract acquisition history for THIS company (not their PE firm owner).
Look for press releases, news, or lists of acquired brands. Be specific with dates and locations.`,
    user: (content: string) => 
      `Website Content:\n\n${content.substring(0, 12000)}\n\nExtract acquisition history.`
  };
}

function getPEInvestmentThesisPrompt() {
  return {
    tool: {
      type: 'function',
      function: {
        name: 'extract_pe_investment_thesis',
        description: "Extract PE firm's investment thesis and strategy",
        parameters: {
          type: 'object',
          properties: {
            thesis_summary: { type: 'string', description: 'Summary of investment thesis and focus' },
            strategic_priorities: { type: 'array', items: { type: 'string' }, description: 'Key strategic priorities' },
            thesis_confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence based on specificity' },
            target_services: { type: 'array', items: { type: 'string' }, description: 'Services/products they seek in targets' },
            target_industries: { type: 'array', items: { type: 'string' }, description: 'Industries they invest in' },
            acquisition_appetite: { type: 'string', description: 'How active they are in acquiring' }
          }
        }
      }
    },
    system: `Extract the PE firm's investment thesis and target criteria.
Look for: investment focus statements, target sectors, strategic priorities.
Rate thesis_confidence: High (specific criteria), Medium (general focus), Low (vague info).`,
    user: (content: string) => 
      `PE Firm Website Content:\n\n${content.substring(0, 12000)}\n\nExtract investment thesis.`
  };
}

function getPEDealStructurePrompt() {
  return {
    tool: {
      type: 'function',
      function: {
        name: 'extract_pe_deal_structure',
        description: 'Extract deal structure preferences and financial criteria',
        parameters: {
          type: 'object',
          properties: {
            target_revenue_min: { type: 'number', description: 'Minimum revenue in dollars' },
            target_revenue_max: { type: 'number', description: 'Maximum revenue in dollars' },
            revenue_sweet_spot: { type: 'number', description: 'Preferred revenue level in dollars' },
            target_ebitda_min: { type: 'number', description: 'Minimum EBITDA in dollars' },
            target_ebitda_max: { type: 'number', description: 'Maximum EBITDA in dollars' },
            ebitda_sweet_spot: { type: 'number', description: 'Preferred EBITDA level in dollars' },
            acquisition_timeline: { type: 'string', description: 'Typical timeline from LOI to close' },
            deal_preferences: { type: 'string', description: 'Preferred deal structures or terms' }
          }
        }
      }
    },
    system: `Extract deal structure preferences and financial criteria from PE firm website.
Look for: revenue and EBITDA ranges, deal timelines, structure preferences.
Convert financial figures to actual numbers (e.g., "$5M" -> 5000000).`,
    user: (content: string) => 
      `PE Firm Website Content:\n\n${content.substring(0, 12000)}\n\nExtract deal structure preferences.`
  };
}

function getPEPortfolioPrompt() {
  return {
    tool: {
      type: 'function',
      function: {
        name: 'extract_pe_portfolio',
        description: 'Extract PE firm portfolio information',
        parameters: {
          type: 'object',
          properties: {
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
              description: 'Portfolio companies'
            },
            num_platforms: { type: 'number', description: 'Number of platform companies' }
          }
        }
      }
    },
    system: `Extract portfolio information about the PE firm's current investments.
Look for: lists of portfolio companies, number of platforms. Only include confirmed companies.`,
    user: (content: string) => 
      `PE Firm Website Content:\n\n${content.substring(0, 12000)}\n\nExtract portfolio.`
  };
}

// Intelligent merge logic with FIXED data completeness calculation
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

  // FIX: Calculate data completeness based on EXTRACTED data, not existing buyer data
  const keyFields = ['thesis_summary', 'target_services', 'target_geographies', 'geographic_footprint', 'hq_state', 'pe_firm_name', 'business_summary'];
  const extractedFields = keyFields.filter(f => extractedData[f]);
  const existingFields = keyFields.filter(f => buyer[f]);
  
  console.log(`Data completeness check: ${extractedFields.length} new fields, ${existingFields.length} existing fields`);
  console.log(`Extracted key fields: ${extractedFields.join(', ') || 'none'}`);
  
  // Only upgrade completeness if we actually extracted something
  if (extractedFields.length >= 4) {
    updateData.data_completeness = 'high';
  } else if (extractedFields.length >= 2) {
    updateData.data_completeness = 'medium';
  } else if (extractedFields.length === 0) {
    // If no extraction happened, don't change existing completeness
    // Only set to 'low' if this is first enrichment and nothing was extracted
    if (existingFields.length === 0) {
      updateData.data_completeness = 'low';
    }
    // Otherwise, leave it unchanged
  } else {
    // 1 field extracted - set to medium only if we didn't have medium/high already
    if (buyer.data_completeness !== 'medium' && buyer.data_completeness !== 'high') {
      updateData.data_completeness = 'medium';
    }
  }

  for (const field of Object.keys(extractedData)) {
    const newValue = extractedData[field];
    const existingValue = buyer[field];

    // Skip null/undefined values
    if (newValue === undefined || newValue === null) continue;

    // Skip fields that should NEVER come from website
    if (NEVER_UPDATE_FROM_WEBSITE.includes(field)) {
      console.log(`Skipping ${field}: never update from website`);
      continue;
    }

    // Check transcript protection
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

    // Handle strings
    if (typeof newValue === 'string') {
      const normalized = newValue.trim();
      
      // Skip placeholders
      if (!normalized || PLACEHOLDER_STRINGS.has(normalized.toLowerCase())) continue;
      
      // Only update if empty OR new is longer/better
      if (!existingValue || normalized.length > (existingValue?.length || 0)) {
        updateData[field] = normalized;
      }
      continue;
    }

    // Handle arrays
    if (Array.isArray(newValue)) {
      const normalized = newValue
        .filter(v => v && typeof v === 'string')
        .map(v => v.trim())
        .filter(v => v && !PLACEHOLDER_STRINGS.has(v.toLowerCase()));
      
      // De-duplicate
      const unique = [...new Set(normalized.map(v => v.toLowerCase()))].map(
        lower => normalized.find(v => v.toLowerCase() === lower)
      ).filter(Boolean);
      
      if (unique.length === 0) continue;
      
      // Only update if empty OR new has more items
      if (!existingValue || !Array.isArray(existingValue) || unique.length > existingValue.length) {
        updateData[field] = unique;
      }
      continue;
    }

    // Handle numbers
    if (typeof newValue === 'number') {
      if (existingValue === null || existingValue === undefined) {
        updateData[field] = newValue;
      }
      continue;
    }

    // Handle objects (like recent_acquisitions, portfolio_companies)
    if (typeof newValue === 'object' && !Array.isArray(newValue)) {
      if (!existingValue) {
        updateData[field] = newValue;
      }
      continue;
    }
  }

  return updateData;
}
