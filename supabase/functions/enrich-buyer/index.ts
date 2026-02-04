import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, validateUrl, rateLimitResponse, ssrfErrorResponse } from "../_shared/security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const AI_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  temperature: 0, // Deterministic extraction
};

const MIN_CONTENT_LENGTH = 200;
const SCRAPE_TIMEOUT_MS = 15000;
const AI_TIMEOUT_MS = 20000;

// 26 fields that are NEVER overwritten from website if they have transcript source
const TRANSCRIPT_PROTECTED_FIELDS = [
  // Investment Thesis
  'thesis_summary',
  'strategic_priorities',
  'thesis_confidence',
  
  // Size Criteria (using actual column names)
  'target_revenue_min', 'target_revenue_max', 'revenue_sweet_spot',
  'target_ebitda_min', 'target_ebitda_max', 'ebitda_sweet_spot',
  
  // Deal Structure
  'deal_breakers',
  'deal_preferences',
  
  // Geographic Targeting
  'target_geographies',
  
  // Business Model Targeting
  'target_industries',
  'target_services',
  
  // Activity
  'acquisition_appetite',
  'acquisition_timeline',
  'acquisition_frequency',
];

// Location page patterns for discovery
const LOCATION_PATTERNS = [
  '/locations',
  '/our-locations',
  '/service-areas',
  '/branches',
  '/offices',
];

const PLACEHOLDER_STRINGS = new Set([
  'not specified', 'n/a', 'na', 'unknown', 'none', 'tbd', 'not available', '',
  '<unknown>', '<UNKNOWN>', 'undefined', 'null'
]);

// State name to code mapping
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
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC'
};

const VALID_STATE_CODES = new Set(Object.values(STATE_NAME_TO_CODE));

const REGION_MAP: Record<string, string> = {
  'CT': 'Northeast', 'ME': 'Northeast', 'MA': 'Northeast', 'NH': 'Northeast',
  'RI': 'Northeast', 'VT': 'Northeast', 'NJ': 'Northeast', 'NY': 'Northeast', 'PA': 'Northeast',
  'IL': 'Midwest', 'IN': 'Midwest', 'MI': 'Midwest', 'OH': 'Midwest', 'WI': 'Midwest',
  'IA': 'Midwest', 'KS': 'Midwest', 'MN': 'Midwest', 'MO': 'Midwest',
  'NE': 'Midwest', 'ND': 'Midwest', 'SD': 'Midwest',
  'DE': 'South', 'FL': 'South', 'GA': 'South', 'MD': 'South', 'NC': 'South',
  'SC': 'South', 'VA': 'South', 'DC': 'South', 'WV': 'South',
  'AL': 'South', 'KY': 'South', 'MS': 'South', 'TN': 'South',
  'AR': 'South', 'LA': 'South', 'OK': 'South', 'TX': 'South',
  'AZ': 'West', 'CO': 'West', 'ID': 'West', 'MT': 'West', 'NV': 'West',
  'NM': 'West', 'UT': 'West', 'WY': 'West',
  'AK': 'West', 'CA': 'West', 'HI': 'West', 'OR': 'West', 'WA': 'West',
};

// Valid columns in remarketing_buyers table (verified against actual schema)
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
  'recent_acquisitions', 'portfolio_companies', 'total_acquisitions', 'num_platforms',
  'strategic_priorities', 'specialized_focus', 'industry_vertical',
  'data_completeness', 'data_last_updated', 'extraction_sources',
  'key_quotes', 'notes', 'has_fee_agreement',
  'services_offered', 'business_type', 'revenue_model',
]);

// Map AI-extracted field names to actual database columns
const FIELD_TO_COLUMN_MAP: Record<string, string> = {
  'platform_company_name': 'company_name',
  'min_revenue': 'target_revenue_min',
  'max_revenue': 'target_revenue_max',
  'min_ebitda': 'target_ebitda_min',
  'max_ebitda': 'target_ebitda_max',
  'preferred_ebitda': 'ebitda_sweet_spot',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function normalizeStateCode(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 2 && VALID_STATE_CODES.has(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }
  const code = STATE_NAME_TO_CODE[trimmed.toLowerCase()];
  return code || trimmed;
}

function getRegionFromState(stateCode: string): string | null {
  return REGION_MAP[stateCode] || null;
}

// ============================================================================
// FIRECRAWL FUNCTIONS
// ============================================================================

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
      return { success: false, error: `Insufficient content (${content.length} chars)` };
    }

    return { success: true, content };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { success: false, error: `Timed out after ${SCRAPE_TIMEOUT_MS / 1000}s` };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function firecrawlMap(url: string, apiKey: string, limit = 100): Promise<string[]> {
  try {
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const response = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        limit,
        includeSubdomains: false,
      }),
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return [];
    }

    return data.links || [];
  } catch (error) {
    console.error('Firecrawl map error:', error);
    return [];
  }
}

// ============================================================================
// CLAUDE AI EXTRACTION
// ============================================================================

async function callClaudeAI(
  systemPrompt: string,
  userPrompt: string,
  tool: { name: string; description: string; input_schema: any },
  apiKey: string
): Promise<{ data: any | null; error?: { code: string; message: string } }> {
  try {
    console.log(`Calling Claude with tool: ${tool.name}`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        max_tokens: AI_CONFIG.max_tokens,
        temperature: AI_CONFIG.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    if (response.status === 402) {
      return { data: null, error: { code: 'payment_required', message: 'AI credits depleted' } };
    }
    if (response.status === 429) {
      return { data: null, error: { code: 'rate_limited', message: 'Rate limit exceeded' } };
    }
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Claude call failed: ${response.status}`, errorText.substring(0, 500));
      return { data: null };
    }

    const data = await response.json();
    const toolUse = data.content?.find((c: any) => c.type === 'tool_use');
    
    if (!toolUse?.input) {
      console.warn(`No tool_use in Claude response`);
      return { data: null };
    }

    console.log(`Claude extracted ${Object.keys(toolUse.input).length} fields via ${tool.name}`);
    return { data: toolUse.input };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { data: null, error: { code: 'timeout', message: 'AI request timed out' } };
    }
    console.error('Claude extraction error:', error);
    return { data: null };
  }
}

// ============================================================================
// PROMPT 1: BUSINESS OVERVIEW & SERVICES
// ============================================================================

const PROMPT_1_BUSINESS = {
  name: 'extract_business_overview',
  description: 'Extract business overview from website content',
  input_schema: {
    type: 'object',
    properties: {
      company_name: { type: 'string', description: 'Official company name as stated on website' },
      services_offered: { type: 'string', description: "Comma-separated list of services (e.g., 'HVAC installation, repair, maintenance')" },
      business_summary: { type: 'string', description: '2-3 sentence overview of what the company does operationally' },
      business_type: { type: 'string', enum: ['Service Provider', 'Distributor', 'Manufacturer', 'Retailer', 'Software', 'Other'] },
      industry_vertical: { type: 'string', description: "Industry category (e.g., 'Home Services - HVAC')" },
      specialized_focus: { type: 'string', description: 'Any niche or specialization mentioned' },
      revenue_model: { type: 'string', description: 'How the company makes money' },
    },
  },
};

const PROMPT_1_SYSTEM = `You are an M&A research analyst extracting company information from website content.
Extract ONLY information that is explicitly stated in the content.
Do NOT infer, guess, or hallucinate any information.
If a field cannot be determined from the content, return null.`;

async function extractBusinessOverview(content: string, apiKey: string): Promise<any> {
  console.log('Running Prompt 1: Business Overview & Services');
  const userPrompt = `Website Content:\n\n${content.substring(0, 50000)}\n\nExtract the business overview information from this company website.`;
  return await callClaudeAI(PROMPT_1_SYSTEM, userPrompt, PROMPT_1_BUSINESS, apiKey);
}

// ============================================================================
// PROMPT 2: CUSTOMER PROFILE
// ============================================================================

const PROMPT_2_CUSTOMER = {
  name: 'extract_customer_profile',
  description: 'Extract customer profile from website content',
  input_schema: {
    type: 'object',
    properties: {
      primary_customer_size: { type: 'string', description: "Target customer size (e.g., 'Residential homeowners', 'Mid-market businesses')" },
      customer_industries: { type: 'array', items: { type: 'string' }, description: "Industries served (e.g., ['Residential', 'Commercial', 'Industrial'])" },
      customer_geographic_reach: { type: 'string', description: "Geographic scope of customers (e.g., 'Southeast US', 'National')" },
      target_customer_profile: { type: 'string', description: 'Ideal customer description' },
    },
  },
};

const PROMPT_2_SYSTEM = `You are an M&A research analyst extracting customer profile information from website content.
Extract ONLY information that is explicitly stated in the content.
Do NOT infer, guess, or hallucinate any information.`;

async function extractCustomerProfile(content: string, apiKey: string): Promise<any> {
  console.log('Running Prompt 2: Customer Profile');
  const userPrompt = `Website Content:\n\n${content.substring(0, 50000)}\n\nExtract the customer profile information from this company website.`;
  return await callClaudeAI(PROMPT_2_SYSTEM, userPrompt, PROMPT_2_CUSTOMER, apiKey);
}

// ============================================================================
// PROMPT 3a: GEOGRAPHIC FOOTPRINT
// ============================================================================

const PROMPT_3A_GEOGRAPHY = {
  name: 'extract_geography',
  description: 'Extract geographic information from website content',
  input_schema: {
    type: 'object',
    properties: {
      hq_city: { type: 'string' },
      hq_state: { type: 'string', description: '2-letter state code' },
      hq_country: { type: 'string', default: 'USA' },
      geographic_footprint: { type: 'array', items: { type: 'string' }, description: 'Array of 2-letter state codes where company has PHYSICAL LOCATIONS' },
      service_regions: { type: 'array', items: { type: 'string' }, description: 'States where company provides services' },
    },
  },
};

const PROMPT_3A_SYSTEM = `CRITICAL GEOGRAPHIC EXTRACTION RULES:
1. ONLY extract states that appear AS EXPLICIT ADDRESSES or LOCATION NAMES
2. Do NOT infer states from phrases like "serving the Southeast"
3. Do NOT expand "national coverage" into a list of states
4. If a state is not explicitly named as a location, do NOT include it
5. Return empty array if no explicit locations found

Examples of VALID extractions:
- "123 Main St, Atlanta, GA" → ["GA"]
- "Locations in Florida, Georgia, and Alabama" → ["FL", "GA", "AL"]

Examples of INVALID extractions:
- "Serving the Southeast" → [] (NOT ["GA", "FL", "AL", "SC"])
- "National coverage" → [] (NOT all 50 states)`;

async function extractGeography(content: string, apiKey: string): Promise<any> {
  console.log('Running Prompt 3a: Geographic Footprint');
  const userPrompt = `Website Content:\n\n${content.substring(0, 50000)}\n\nExtract geographic footprint information. Only include states that are EXPLICITLY mentioned as physical locations.`;
  return await callClaudeAI(PROMPT_3A_SYSTEM, userPrompt, PROMPT_3A_GEOGRAPHY, apiKey);
}

// ============================================================================
// PROMPT 3b: ACQUISITION HISTORY
// ============================================================================

const PROMPT_3B_ACQUISITIONS = {
  name: 'extract_acquisitions',
  description: 'Extract acquisition history from website content',
  input_schema: {
    type: 'object',
    properties: {
      recent_acquisitions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            company_name: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM or YYYY-Q# format' },
            location: { type: 'string' },
          },
        },
      },
      total_acquisitions: { type: 'integer', description: 'Total number of acquisitions mentioned' },
      acquisition_frequency: { type: 'string', description: "e.g., '2-3 per year', 'Monthly'" },
    },
  },
};

const PROMPT_3B_SYSTEM = `You are an M&A research analyst extracting acquisition history from website content.
Extract ONLY information that is explicitly stated in the content.
Do NOT infer or guess acquisition information.`;

async function extractAcquisitions(content: string, apiKey: string): Promise<any> {
  console.log('Running Prompt 3b: Acquisition History');
  const userPrompt = `Website Content:\n\n${content.substring(0, 50000)}\n\nExtract any acquisition history mentioned on this website.`;
  return await callClaudeAI(PROMPT_3B_SYSTEM, userPrompt, PROMPT_3B_ACQUISITIONS, apiKey);
}

// ============================================================================
// PROMPT 4: PE FIRM ACTIVITY (NO THESIS - thesis ONLY from transcripts)
// ============================================================================
// CRITICAL: thesis_summary, strategic_priorities, thesis_confidence are NEVER
// extracted from websites. They MUST come from call transcripts or notes only.
// This ensures the thesis reflects the platform company's perspective, not the
// PE firm's marketing materials.

const PROMPT_4_PE_ACTIVITY = {
  name: 'extract_pe_activity',
  description: 'Extract PE firm activity data (NOT thesis - thesis only from transcripts)',
  input_schema: {
    type: 'object',
    properties: {
      // ONLY non-thesis fields extracted from PE website
      target_industries: { type: 'array', items: { type: 'string' }, description: 'Industries the PE firm focuses on' },
      target_services: { type: 'array', items: { type: 'string' }, description: 'Service types of interest' },
      acquisition_appetite: { type: 'string', description: "Activity level, e.g., 'Very Active - 15-20 deals annually'" },
    },
  },
};

const PROMPT_4_SYSTEM = `You are analyzing a private equity firm's website to extract their acquisition activity.

CRITICAL: Do NOT extract investment thesis, strategic priorities, or thesis confidence.
These fields MUST come from direct conversations with the platform company, not websites.

Only extract:
- Target industries they invest in
- Target services/business types
- Acquisition activity level`;

async function extractPEActivity(content: string, apiKey: string): Promise<any> {
  console.log('Running Prompt 4: PE Firm Activity (thesis excluded - transcript only)');
  const userPrompt = `PE Firm Website Content:\n\n${content.substring(0, 50000)}\n\nExtract acquisition activity data. Do NOT extract thesis, strategic priorities, or thesis confidence.`;
  return await callClaudeAI(PROMPT_4_SYSTEM, userPrompt, PROMPT_4_PE_ACTIVITY, apiKey);
}

// ============================================================================
// PROMPT 5: PORTFOLIO COMPANIES (PE FIRM)
// ============================================================================

const PROMPT_5_PORTFOLIO = {
  name: 'extract_portfolio',
  description: 'Extract portfolio companies from PE firm website',
  input_schema: {
    type: 'object',
    properties: {
      portfolio_companies: { type: 'array', items: { type: 'string' }, description: 'List of portfolio company names' },
      num_platforms: { type: 'integer', description: 'Number of platform investments' },
    },
  },
};

const PROMPT_5_SYSTEM = `You are an M&A research analyst extracting portfolio company information from a PE firm's website.
Extract ONLY information that is explicitly stated in the content.`;

async function extractPortfolio(content: string, apiKey: string): Promise<any> {
  console.log('Running Prompt 5: Portfolio Companies');
  const userPrompt = `PE Firm Website Content:\n\n${content.substring(0, 50000)}\n\nExtract the portfolio companies mentioned on this PE firm's website.`;
  return await callClaudeAI(PROMPT_5_SYSTEM, userPrompt, PROMPT_5_PORTFOLIO, apiKey);
}

// ============================================================================
// PROMPT 6: SIZE CRITERIA (PE FIRM)
// ============================================================================

const PROMPT_6_SIZE = {
  name: 'extract_size_criteria',
  description: 'Extract size/financial criteria from PE firm website',
  input_schema: {
    type: 'object',
    properties: {
      min_revenue: { type: 'integer', description: 'Minimum revenue in dollars (e.g., 10000000 for $10M)' },
      max_revenue: { type: 'integer', description: 'Maximum revenue in dollars' },
      revenue_sweet_spot: { type: 'integer', description: 'Ideal revenue target in dollars' },
      min_ebitda: { type: 'integer', description: 'Minimum EBITDA in dollars' },
      max_ebitda: { type: 'integer', description: 'Maximum EBITDA in dollars' },
      ebitda_sweet_spot: { type: 'integer', description: 'Ideal EBITDA target in dollars' },
      preferred_ebitda: { type: 'integer', description: 'Preferred EBITDA in dollars' },
    },
  },
};

const PROMPT_6_SYSTEM = `Extract revenue and EBITDA criteria from PE firm website.

CRITICAL RULES:
1. Revenue and EBITDA values must be in DOLLARS, not multiples
2. If you see "5x EBITDA" - this is a MULTIPLE, not a dollar amount. Return null.
3. Valid examples: "$5M EBITDA", "$5 million EBITDA", "EBITDA of $5,000,000"
4. Invalid examples: "5x EBITDA", "5-7x", "mid-single digit multiples"

If no dollar amounts are explicitly stated, return null for all fields.`;

async function extractSizeCriteria(content: string, apiKey: string): Promise<any> {
  console.log('Running Prompt 6: Size Criteria');
  const userPrompt = `PE Firm Website Content:\n\n${content.substring(0, 50000)}\n\nExtract the size/financial criteria. Only extract DOLLAR amounts, not multiples.`;
  return await callClaudeAI(PROMPT_6_SYSTEM, userPrompt, PROMPT_6_SIZE, apiKey);
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function validateGeography(extracted: any): any {
  if (!extracted?.data) return extracted;
  const data = extracted.data;

  // Anti-hallucination check
  if (data.service_regions?.length > (data.geographic_footprint?.length || 0) * 3) {
    console.warn('Possible hallucination in service_regions - reverting to conservative estimate');
    data.service_regions = [...(data.geographic_footprint || [])];
  }

  // Normalize state codes
  if (data.geographic_footprint) {
    data.geographic_footprint = data.geographic_footprint
      .map((s: string) => normalizeStateCode(s))
      .filter((s: string) => VALID_STATE_CODES.has(s));
  }

  if (data.service_regions) {
    data.service_regions = data.service_regions
      .map((s: string) => normalizeStateCode(s))
      .filter((s: string) => VALID_STATE_CODES.has(s));
  }

  if (data.hq_state) {
    data.hq_state = normalizeStateCode(data.hq_state);
    if (VALID_STATE_CODES.has(data.hq_state)) {
      data.hq_region = getRegionFromState(data.hq_state);
    }
  }

  return { ...extracted, data };
}

function validateSizeCriteria(extracted: any): any {
  if (!extracted?.data) return extracted;
  const data = extracted.data;

  // Check for EBITDA multiple confusion (values under 100 are likely multiples, not dollars)
  const checkForMultiple = (value: number | null) => {
    if (value && value < 100) {
      console.warn('Possible EBITDA multiple detected, clearing value');
      return null;
    }
    return value;
  };

  data.min_ebitda = checkForMultiple(data.min_ebitda);
  data.max_ebitda = checkForMultiple(data.max_ebitda);
  data.ebitda_sweet_spot = checkForMultiple(data.ebitda_sweet_spot);
  data.preferred_ebitda = checkForMultiple(data.preferred_ebitda);

  return { ...extracted, data };
}

// ============================================================================
// FIELD UPDATE LOGIC
// ============================================================================

function shouldOverwrite(
  fieldName: string,
  existingValue: any,
  newValue: any,
  hasTranscriptSource: boolean,
  existingSources: any[]
): boolean {
  // Never overwrite transcript-protected fields if they have transcript source
  if (TRANSCRIPT_PROTECTED_FIELDS.includes(fieldName)) {
    // Check if field has transcript source
    const fieldHasTranscript = existingSources.some(
      (src: any) => 
        (src.type === 'transcript' || src.type === 'buyer_transcript' || src.source === 'transcript') &&
        (src.fields_extracted?.includes(fieldName) || src.fields?.includes(fieldName))
    );

    if (fieldHasTranscript || hasTranscriptSource) {
      const hasExistingData = existingValue !== null &&
        existingValue !== undefined &&
        (typeof existingValue !== 'string' || existingValue.trim() !== '') &&
        (!Array.isArray(existingValue) || existingValue.length > 0);

      if (hasExistingData) {
        console.log(`Skipping ${fieldName}: protected by transcript data`);
        return false;
      }
    }
  }

  // For strings: new value must be longer or existing is empty
  if (typeof newValue === 'string') {
    if (!existingValue || existingValue === '') return true;
    if (typeof existingValue === 'string') {
      return newValue.length > existingValue.length;
    }
    return true;
  }

  // For arrays: new value must have more items or existing is empty
  if (Array.isArray(newValue)) {
    if (!existingValue || !Array.isArray(existingValue) || existingValue.length === 0) return true;
    return newValue.length > existingValue.length;
  }

  // For numbers: only overwrite if existing is null
  if (typeof newValue === 'number') {
    return existingValue === null || existingValue === undefined;
  }

  // Default: overwrite if existing is empty
  return existingValue === null || existingValue === undefined || existingValue === '';
}

function buildUpdateObject(
  buyer: any,
  extractedData: Record<string, any>,
  hasTranscriptSource: boolean,
  existingSources: any[],
  evidenceRecords: any[]
): Record<string, any> {
  const updateData: Record<string, any> = {
    data_last_updated: new Date().toISOString(),
    extraction_sources: [...existingSources, ...evidenceRecords],
  };

  let fieldsUpdated = 0;

  for (const [rawField, value] of Object.entries(extractedData)) {
    if (value === null || value === undefined) continue;

    // Remap extracted field names to actual database columns
    const field = FIELD_TO_COLUMN_MAP[rawField] || rawField;

    // Check if valid column
    if (!VALID_BUYER_COLUMNS.has(field)) {
      console.warn(`Skipping non-existent column: ${rawField} (mapped to: ${field})`);
      continue;
    }

    // Skip placeholder values
    if (typeof value === 'string' && PLACEHOLDER_STRINGS.has(value.toLowerCase())) continue;

    // Check overwrite rules
    if (!shouldOverwrite(field, buyer[field], value, hasTranscriptSource, existingSources)) {
      continue;
    }

    // Handle state code normalization for geographic fields
    if (field === 'hq_state') {
      const normalized = normalizeStateCode(value);
      if (VALID_STATE_CODES.has(normalized)) {
        updateData[field] = normalized;
        fieldsUpdated++;
      }
      continue;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      let normalized = value
        .filter(v => v && typeof v === 'string')
        .map(v => v.trim())
        .filter(v => v && !PLACEHOLDER_STRINGS.has(v.toLowerCase()));

      // Normalize state codes for geographic fields
      if (field === 'geographic_footprint' || field === 'service_regions' || field === 'target_geographies') {
        normalized = normalized
          .map(v => normalizeStateCode(v))
          .filter(v => VALID_STATE_CODES.has(v));
      }

      if (normalized.length > 0) {
        const unique = [...new Set(normalized)];
        updateData[field] = unique;
        fieldsUpdated++;
      }
      continue;
    }

    // Handle strings and other values
    updateData[field] = value;
    fieldsUpdated++;
  }

  // Calculate data completeness
  const keyFields = ['thesis_summary', 'target_services', 'target_geographies', 'geographic_footprint', 'hq_state', 'pe_firm_name', 'business_summary'];
  const extractedKeyFields = keyFields.filter(f => extractedData[f] || buyer[f]);

  if (extractedKeyFields.length >= 5) {
    updateData.data_completeness = 'high';
  } else if (extractedKeyFields.length >= 3) {
    updateData.data_completeness = 'medium';
  } else {
    updateData.data_completeness = buyer.data_completeness || 'low';
  }

  console.log(`Built update with ${fieldsUpdated} field changes`);
  return updateData;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { buyerId } = await req.json();

    if (!buyerId) {
      return new Response(
        JSON.stringify({ success: false, error: 'buyerId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!firecrawlApiKey || !anthropicApiKey || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error - missing API keys' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit check
    const authHeader = req.headers.get('Authorization');
    let userId = 'system';
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    const rateLimitResult = await checkRateLimit(supabase, userId, 'ai_enrichment', false);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult);
    }

    // Fetch buyer
    const { data: buyer, error: buyerError } = await supabase
      .from('remarketing_buyers')
      .select('*')
      .eq('id', buyerId)
      .single();

    if (buyerError || !buyer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Buyer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const platformWebsite = buyer.platform_website || buyer.company_website;
    const peFirmWebsite = buyer.pe_firm_website;

    if (!platformWebsite && !peFirmWebsite) {
      return new Response(
        JSON.stringify({ success: false, error: 'No website URLs provided. Add platform_website or pe_firm_website first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SSRF validation
    if (platformWebsite) {
      const validation = validateUrl(platformWebsite);
      if (!validation.valid) {
        return ssrfErrorResponse(`Platform website: ${validation.reason}`);
      }
    }
    if (peFirmWebsite) {
      const validation = validateUrl(peFirmWebsite);
      if (!validation.valid) {
        return ssrfErrorResponse(`PE firm website: ${validation.reason}`);
      }
    }

    console.log(`Starting 6-prompt enrichment for buyer: ${buyer.company_name || buyer.pe_firm_name || buyerId}`);
    console.log(`Platform website: ${platformWebsite || 'none'}`);
    console.log(`PE firm website: ${peFirmWebsite || 'none'}`);

    const existingSources = Array.isArray(buyer.extraction_sources) ? buyer.extraction_sources : [];
    const hasTranscriptSource = existingSources.some(
      (src: any) => src.type === 'transcript' || src.type === 'buyer_transcript' || src.source === 'transcript'
    );

    const warnings: string[] = [];
    const sources: { platform?: string; pe_firm?: string } = {};
    let platformContent = '';
    let peContent = '';

    // ========================================================================
    // SCRAPE WEBSITES IN PARALLEL
    // ========================================================================

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
        if (result.success && result.content) {
          platformContent = result.content;
          sources.platform = platformWebsite!;
          console.log(`Scraped platform website: ${platformContent.length} chars`);

          // Try to find and scrape location page
          const links = await firecrawlMap(platformWebsite!, firecrawlApiKey);
          const locationPage = links.find(link =>
            LOCATION_PATTERNS.some(p => link.toLowerCase().includes(p))
          );

          if (locationPage) {
            console.log(`Found location page: ${locationPage}`);
            const locationResult = await scrapeWebsite(locationPage, firecrawlApiKey);
            if (locationResult.success && locationResult.content) {
              platformContent += '\n\n--- LOCATION DATA ---\n\n' + locationResult.content;
            }
          }
        } else {
          warnings.push(`Platform website scrape failed: ${result.error}`);
        }
      } else if (type === 'peFirm') {
        if (result.success && result.content) {
          peContent = result.content;
          sources.pe_firm = peFirmWebsite!;
          console.log(`Scraped PE firm website: ${peContent.length} chars`);
        } else {
          warnings.push(`PE firm website scrape failed: ${result.error}`);
        }
      }
    }

    if (!platformContent && !peContent) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not scrape any website content', warnings }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // RUN 6 EXTRACTION PROMPTS
    // ========================================================================

    const allExtracted: Record<string, any> = {};
    const evidenceRecords: any[] = [];
    const timestamp = new Date().toISOString();
    let promptsRun = 0;
    let promptsSuccessful = 0;
    let billingError: { code: string; message: string } | null = null;

    // PLATFORM PROMPTS (1-3b)
    if (platformContent && !billingError) {
      // Prompt 1: Business Overview
      promptsRun++;
      const businessResult = await extractBusinessOverview(platformContent, anthropicApiKey);
      if (businessResult.error?.code === 'payment_required' || businessResult.error?.code === 'rate_limited') {
        billingError = businessResult.error;
      } else if (businessResult.data) {
        Object.assign(allExtracted, businessResult.data);
        promptsSuccessful++;
        evidenceRecords.push({
          type: 'website',
          url: platformWebsite,
          extracted_at: timestamp,
          fields_extracted: Object.keys(businessResult.data),
        });
      }

      // Prompt 2: Customer Profile
      if (!billingError) {
        promptsRun++;
        const customerResult = await extractCustomerProfile(platformContent, anthropicApiKey);
        if (customerResult.error?.code === 'payment_required' || customerResult.error?.code === 'rate_limited') {
          billingError = customerResult.error;
        } else if (customerResult.data) {
          Object.assign(allExtracted, customerResult.data);
          promptsSuccessful++;
          evidenceRecords.push({
            type: 'website',
            url: platformWebsite,
            extracted_at: timestamp,
            fields_extracted: Object.keys(customerResult.data),
          });
        }
      }

      // Prompt 3a: Geography
      if (!billingError) {
        promptsRun++;
        let geoResult = await extractGeography(platformContent, anthropicApiKey);
        geoResult = validateGeography(geoResult);
        if (geoResult.error?.code === 'payment_required' || geoResult.error?.code === 'rate_limited') {
          billingError = geoResult.error;
        } else if (geoResult.data) {
          Object.assign(allExtracted, geoResult.data);
          promptsSuccessful++;
          evidenceRecords.push({
            type: 'website',
            url: platformWebsite,
            extracted_at: timestamp,
            fields_extracted: Object.keys(geoResult.data),
          });
        }
      }

      // Prompt 3b: Acquisitions
      if (!billingError) {
        promptsRun++;
        const acqResult = await extractAcquisitions(platformContent, anthropicApiKey);
        if (acqResult.error?.code === 'payment_required' || acqResult.error?.code === 'rate_limited') {
          billingError = acqResult.error;
        } else if (acqResult.data) {
          Object.assign(allExtracted, acqResult.data);
          promptsSuccessful++;
          evidenceRecords.push({
            type: 'website',
            url: platformWebsite,
            extracted_at: timestamp,
            fields_extracted: Object.keys(acqResult.data),
          });
        }
      }
    }

    // PE FIRM PROMPTS (4-6) - NOTE: Prompt 4 no longer extracts thesis
    if (peContent && !billingError) {
      // Prompt 4: PE Activity (thesis fields NEVER extracted from website)
      // thesis_summary, strategic_priorities, thesis_confidence ONLY from transcripts
      promptsRun++;
      const activityResult = await extractPEActivity(peContent, anthropicApiKey);
      if (activityResult.error?.code === 'payment_required' || activityResult.error?.code === 'rate_limited') {
        billingError = activityResult.error;
      } else if (activityResult.data) {
        // Filter out any thesis fields that might slip through
        const { thesis_summary, strategic_priorities, thesis_confidence, ...safeData } = activityResult.data;
        if (thesis_summary || strategic_priorities || thesis_confidence) {
          console.warn('WARNING: Prompt 4 returned thesis fields - these are being discarded (transcript-only)');
        }
        Object.assign(allExtracted, safeData);
        promptsSuccessful++;
        evidenceRecords.push({
          type: 'website',
          url: peFirmWebsite,
          extracted_at: timestamp,
          fields_extracted: Object.keys(safeData),
        });
      }

      // Prompt 5: Portfolio
      if (!billingError) {
        promptsRun++;
        const portfolioResult = await extractPortfolio(peContent, anthropicApiKey);
        if (portfolioResult.error?.code === 'payment_required' || portfolioResult.error?.code === 'rate_limited') {
          billingError = portfolioResult.error;
        } else if (portfolioResult.data) {
          Object.assign(allExtracted, portfolioResult.data);
          promptsSuccessful++;
          evidenceRecords.push({
            type: 'website',
            url: peFirmWebsite,
            extracted_at: timestamp,
            fields_extracted: Object.keys(portfolioResult.data),
          });
        }
      }

      // Prompt 6: Size Criteria
      if (!billingError) {
        promptsRun++;
        let sizeResult = await extractSizeCriteria(peContent, anthropicApiKey);
        sizeResult = validateSizeCriteria(sizeResult);
        if (sizeResult.error?.code === 'payment_required' || sizeResult.error?.code === 'rate_limited') {
          billingError = sizeResult.error;
        } else if (sizeResult.data) {
          Object.assign(allExtracted, sizeResult.data);
          promptsSuccessful++;
          evidenceRecords.push({
            type: 'website',
            url: peFirmWebsite,
            extracted_at: timestamp,
            fields_extracted: Object.keys(sizeResult.data),
          });
        }
      }
    }

    console.log(`Extraction complete: ${promptsSuccessful}/${promptsRun} prompts successful, ${Object.keys(allExtracted).length} fields extracted`);

    // Handle billing errors with partial save
    if (billingError) {
      if (Object.keys(allExtracted).length > 0) {
        const partialUpdate = buildUpdateObject(buyer, allExtracted, hasTranscriptSource, existingSources, evidenceRecords);
        await supabase.from('remarketing_buyers').update(partialUpdate).eq('id', buyerId);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: billingError.message,
          error_code: billingError.code,
          fieldsUpdated: Object.keys(allExtracted).length,
          recoverable: billingError.code === 'rate_limited',
        }),
        { status: billingError.code === 'payment_required' ? 402 : 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // SAVE TO DATABASE
    // ========================================================================

    const updateData = buildUpdateObject(buyer, allExtracted, hasTranscriptSource, existingSources, evidenceRecords);

    const { error: updateError } = await supabase
      .from('remarketing_buyers')
      .update(updateData)
      .eq('id', buyerId);

    if (updateError) {
      console.error('Database update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save enrichment', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fieldsUpdated = Object.keys(updateData).length - 2; // Exclude metadata fields
    console.log(`Successfully enriched buyer ${buyerId}: ${fieldsUpdated} fields updated`);

    return new Response(
      JSON.stringify({
        success: true,
        fieldsUpdated,
        sources,
        warnings: warnings.length > 0 ? warnings : undefined,
        extractionDetails: {
          promptsRun,
          promptsSuccessful,
          platformScraped: !!platformContent,
          peFirmScraped: !!peContent,
        },
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
