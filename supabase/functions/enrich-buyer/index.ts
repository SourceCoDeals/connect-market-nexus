import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      const overviewResult = await extractBusinessOverview(platformContent, buyer.company_name, lovableApiKey);
      if (checkBillingError(overviewResult)) {
        console.error('Billing error during business overview extraction');
      } else if (overviewResult.data) {
        Object.assign(extractedData, overviewResult.data);
        console.log('Extracted business overview:', Object.keys(overviewResult.data));
      }

      // Prompt 2: Customers/End Market
      if (!billingError) {
        const customersResult = await extractCustomersEndMarket(platformContent, lovableApiKey);
        if (checkBillingError(customersResult)) {
          console.error('Billing error during customers extraction');
        } else if (customersResult.data) {
          Object.assign(extractedData, customersResult.data);
          console.log('Extracted customers:', Object.keys(customersResult.data));
        }
      }

      // Prompt 3: Geography/Footprint
      if (!billingError) {
        const geographyResult = await extractGeographyFootprint(platformContent, lovableApiKey);
        if (checkBillingError(geographyResult)) {
          console.error('Billing error during geography extraction');
        } else if (geographyResult.data) {
          Object.assign(extractedData, geographyResult.data);
          console.log('Extracted geography:', Object.keys(geographyResult.data));
        }
      }

      // Prompt 3b: Platform Acquisitions
      if (!billingError) {
        const acquisitionsResult = await extractPlatformAcquisitions(platformContent, lovableApiKey);
        if (checkBillingError(acquisitionsResult)) {
          console.error('Billing error during acquisitions extraction');
        } else if (acquisitionsResult.data) {
          Object.assign(extractedData, acquisitionsResult.data);
          console.log('Extracted acquisitions:', Object.keys(acquisitionsResult.data));
        }
      }

      if (Object.keys(extractedData).length > 0) {
        evidenceRecords.push({
          type: 'website',
          url: platformWebsite!,
          extracted_at: new Date().toISOString(),
          fields_extracted: Object.keys(extractedData)
        });
      }
    }

    // Prompts 4-6: PE Firm website extractions
    if (peFirmContent && !billingError) {
      console.log('Extracting from PE firm website...');
      const peFirmFields: string[] = [];

      // Prompt 4: PE Investment Thesis
      const thesisResult = await extractPEInvestmentThesis(peFirmContent, lovableApiKey);
      if (checkBillingError(thesisResult)) {
        console.error('Billing error during PE thesis extraction');
      } else if (thesisResult.data) {
        Object.assign(extractedData, thesisResult.data);
        peFirmFields.push(...Object.keys(thesisResult.data));
        console.log('Extracted PE thesis:', Object.keys(thesisResult.data));
      }

      // Prompt 5: PE Deal Structure
      if (!billingError) {
        const dealStructureResult = await extractPEDealStructure(peFirmContent, lovableApiKey);
        if (checkBillingError(dealStructureResult)) {
          console.error('Billing error during deal structure extraction');
        } else if (dealStructureResult.data) {
          Object.assign(extractedData, dealStructureResult.data);
          peFirmFields.push(...Object.keys(dealStructureResult.data));
          console.log('Extracted deal structure:', Object.keys(dealStructureResult.data));
        }
      }

      // Prompt 6: PE Portfolio
      if (!billingError) {
        const portfolioResult = await extractPEPortfolio(peFirmContent, lovableApiKey);
        if (checkBillingError(portfolioResult)) {
          console.error('Billing error during portfolio extraction');
        } else if (portfolioResult.data) {
          Object.assign(extractedData, portfolioResult.data);
          peFirmFields.push(...Object.keys(portfolioResult.data));
          console.log('Extracted portfolio:', Object.keys(portfolioResult.data));
        }
      }

      if (peFirmFields.length > 0) {
        evidenceRecords.push({
          type: 'website',
          url: peFirmWebsite!,
          extracted_at: new Date().toISOString(),
          fields_extracted: peFirmFields
        });
      }
    }

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
        JSON.stringify({ success: false, error: 'Failed to save enrichment data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fieldsUpdated = Object.keys(updateData).length;
    console.log(`Successfully enriched buyer ${buyer.company_name} with ${fieldsUpdated} fields`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          buyerId,
          fieldsUpdated,
          dataCompleteness: updateData.data_completeness || 'medium',
          extractedData,
          scraped: {
            platform: !!platformContent,
            peFirm: !!peFirmContent
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

async function callAI(
  systemPrompt: string, 
  userPrompt: string, 
  tool: any, 
  apiKey: string
): Promise<{ data: any | null; error?: { code: string; message: string } }> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
      console.error(`AI call failed: ${response.status}`);
      return { data: null };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.error('No tool call in AI response');
      return { data: null };
    }

    return { data: JSON.parse(toolCall.function.arguments) };
  } catch (error) {
    console.error('AI extraction error:', error);
    return { data: null };
  }
}

// Prompt 1: Business Overview (Platform)
async function extractBusinessOverview(content: string, companyName: string, apiKey: string) {
  const tool = {
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
  };

  const systemPrompt = `You are a business analyst extracting structured data from company websites.
Extract business overview information from the provided website content.
Focus on: core services, business model, industry classification, and specialized niches.
Be concise and factual. If information is not available, omit that field.`;

  const userPrompt = `Website Content for "${companyName}":\n\n${content.substring(0, 12000)}\n\nExtract business overview.`;

  return callAI(systemPrompt, userPrompt, tool, apiKey);
}

// Prompt 2: Customers/End Market (Platform)
async function extractCustomersEndMarket(content: string, apiKey: string) {
  const tool = {
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
  };

  const systemPrompt = `Extract customer and market information from the company website.
Focus on: types and sizes of customers, industries served, geographic reach.
Be specific. Use actual industry names, not generic terms.`;

  return callAI(systemPrompt, `Website Content:\n\n${content.substring(0, 12000)}\n\nExtract customer information.`, tool, apiKey);
}

// Prompt 3: Geography/Footprint (Platform)
async function extractGeographyFootprint(content: string, apiKey: string) {
  const tool = {
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
  };

  const systemPrompt = `Extract geographic information about where the company CURRENTLY operates.

CRITICAL RULES:
1. geographic_footprint: ONLY 2-letter state codes where they have physical offices/locations
2. service_regions: ONLY states they serve FROM their physical locations
3. DO NOT include aspirational or marketing language about "serving nationwide"
4. Be conservative - regional companies are NOT national
5. All state codes MUST be valid 2-letter abbreviations (TX, CA, NY, etc.)`;

  return callAI(systemPrompt, `Website Content:\n\n${content.substring(0, 12000)}\n\nExtract CURRENT geographic presence.`, tool, apiKey);
}

// Prompt 3b: Platform Acquisitions
async function extractPlatformAcquisitions(content: string, apiKey: string) {
  const tool = {
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
  };

  const systemPrompt = `Extract acquisition history for THIS company (not their PE firm owner).
Look for press releases, news, or lists of acquired brands. Be specific with dates and locations.`;

  return callAI(systemPrompt, `Website Content:\n\n${content.substring(0, 12000)}\n\nExtract acquisition history.`, tool, apiKey);
}

// Prompt 4: PE Investment Thesis
async function extractPEInvestmentThesis(content: string, apiKey: string) {
  const tool = {
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
  };

  const systemPrompt = `Extract the PE firm's investment thesis and target criteria.
Look for: investment focus statements, target sectors, strategic priorities.
Rate thesis_confidence: High (specific criteria), Medium (general focus), Low (vague info).`;

  return callAI(systemPrompt, `PE Firm Website Content:\n\n${content.substring(0, 12000)}\n\nExtract investment thesis.`, tool, apiKey);
}

// Prompt 5: PE Deal Structure
async function extractPEDealStructure(content: string, apiKey: string) {
  const tool = {
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
  };

  const systemPrompt = `Extract deal structure preferences and financial criteria from PE firm website.
Look for: revenue and EBITDA ranges, deal timelines, structure preferences.
Convert financial figures to actual numbers (e.g., "$5M" -> 5000000).`;

  return callAI(systemPrompt, `PE Firm Website Content:\n\n${content.substring(0, 12000)}\n\nExtract deal structure preferences.`, tool, apiKey);
}

// Prompt 6: PE Portfolio
async function extractPEPortfolio(content: string, apiKey: string) {
  const tool = {
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
  };

  const systemPrompt = `Extract portfolio information about the PE firm's current investments.
Look for: lists of portfolio companies, number of platforms. Only include confirmed companies.`;

  return callAI(systemPrompt, `PE Firm Website Content:\n\n${content.substring(0, 12000)}\n\nExtract portfolio.`, tool, apiKey);
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

  // Calculate data completeness
  const keyFields = ['thesis_summary', 'target_services', 'target_geographies', 'geographic_footprint', 'hq_state'];
  const filledFields = keyFields.filter(f => extractedData[f] || buyer[f]);
  updateData.data_completeness = filledFields.length >= 4 ? 'high' : filledFields.length >= 2 ? 'medium' : 'low';

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
