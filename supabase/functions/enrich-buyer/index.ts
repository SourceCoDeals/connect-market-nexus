import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateUrl, ssrfErrorResponse } from "../_shared/security.ts";
import { logAICallCost } from "../_shared/cost-tracker.ts";
import { GEMINI_API_URL, getGeminiHeaders } from "../_shared/ai-providers.ts";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const AI_CONFIG = {
  model: 'gemini-2.0-flash',
  max_tokens: 4096,
  temperature: 0, // Deterministic extraction
};

const MIN_CONTENT_LENGTH = 200;
const SCRAPE_TIMEOUT_MS = 15000;
const AI_TIMEOUT_MS = 45000;

// ============================================================================
// DATA PROVENANCE: CANONICAL FIELD OWNERSHIP CONTRACT
// ============================================================================
// This contract defines which fields may be populated from which source.
// Violations are REJECTED at write time and logged as errors.
// This is the SINGLE SOURCE OF TRUTH for data provenance rules.

type SourceType = 'platform_website' | 'pe_firm_website' | 'transcript' | 'csv' | 'manual';

// Fields that may ONLY be populated from platform website or transcripts — NEVER from PE firm website
const PLATFORM_OWNED_FIELDS = new Set([
  // Business Identity
  'company_name', 'business_summary', 'services_offered', 'business_type',
  'industry_vertical', 'specialized_focus', 'revenue_model',
  // Customer Profile
  'primary_customer_size', 'customer_industries', 'customer_geographic_reach', 'target_customer_profile',
  // HQ Location — PE firm HQ is NOT the platform's HQ
  'hq_city', 'hq_state', 'hq_country', 'hq_region',
  // Operating footprint — PE firm offices are NOT platform operating locations
  'operating_locations',
]);

// Fields that may ONLY be populated from TRANSCRIPTS — NEVER from any website
// num_platforms and deal_preferences are internal strategy details that can't be
// reliably distinguished from portfolio-level data on websites.
// NOTE: Size criteria (target_revenue, target_ebitda, sweet spots) were removed from
// this set because PE firm websites commonly publish their investment criteria ranges
// and blocking website extraction left 99.7% of buyers without any size data for scoring.
const TRANSCRIPT_ONLY_FIELDS = new Set([
  'num_platforms', 'deal_preferences',
]);

// Fields allowed to fall back from PE firm website when platform website is unavailable
// ONLY broad geographic coverage fields — NEVER HQ or operating locations
// PE firm HQ (e.g., Dallas TX) is NOT the platform company's HQ
const PE_FALLBACK_ALLOWED_FIELDS = new Set([
  'geographic_footprint', 'service_regions',
]);

// Fields that can be populated from either source (shared/neutral)
const SHARED_FIELDS = new Set([
  'target_industries', 'target_services', 'target_geographies',
  'deal_preferences', 'deal_breakers', 'acquisition_timeline',
  'acquisition_appetite', 'acquisition_frequency',
  'recent_acquisitions', 'portfolio_companies', 'total_acquisitions',
  'strategic_priorities', 'thesis_summary', 'thesis_confidence',
  'data_completeness', 'data_last_updated', 'extraction_sources',
  'key_quotes', 'notes', 'has_fee_agreement',
]);

/**
 * Validates whether a field may be written from a given source type.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
function validateFieldProvenance(
  fieldName: string,
  sourceType: SourceType,
): { allowed: boolean; reason?: string } {
  // Transcripts, CSV, and manual sources can write to any field
  if (sourceType === 'transcript' || sourceType === 'csv' || sourceType === 'manual') {
    return { allowed: true };
  }

  // PE firm website → platform-owned fields = FORBIDDEN
  if (sourceType === 'pe_firm_website' && PLATFORM_OWNED_FIELDS.has(fieldName)) {
    return {
      allowed: false,
      reason: `PROVENANCE VIOLATION: Attempted to write pe_firm_website data to platform-owned field '${fieldName}'. This is forbidden.`,
    };
  }

  // ANY website → transcript-only fields = FORBIDDEN
  // Deal structure (revenue/EBITDA ranges) can ONLY come from transcripts
  if ((sourceType === 'platform_website' || sourceType === 'pe_firm_website') && TRANSCRIPT_ONLY_FIELDS.has(fieldName)) {
    return {
      allowed: false,
      reason: `PROVENANCE VIOLATION: Attempted to write ${sourceType} data to transcript-only field '${fieldName}'. Deal structure can only come from transcripts.`,
    };
  }

  return { allowed: true };
}

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
  '/service-area',
  '/branches',
  '/offices',
  '/coverage',
  '/where-we-work',
  '/markets',
  '/about-us',
  '/about',
  '/contact',
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
// GEMINI AI EXTRACTION (via OpenAI-compatible endpoint)
// ============================================================================

const GEMINI_MAX_RETRIES = 3;
const GEMINI_RETRY_BASE_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call Gemini via OpenAI-compatible endpoint with tool calling.
 * Accepts Claude-format tool schemas ({name, description, input_schema}) and converts internally.
 */
async function callClaudeAI(
  systemPrompt: string,
  userPrompt: string,
  tool: { name: string; description: string; input_schema: any },
  apiKey: string,
  retryCount: number = 0
): Promise<{ data: any | null; error?: { code: string; message: string } }> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    return { data: null, error: { code: 'missing_api_key', message: 'GEMINI_API_KEY not configured' } };
  }

  try {
    console.log(`Calling Gemini Flash with tool: ${tool.name}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`);

    // Convert Claude tool format to OpenAI tool format
    const openAITool = {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    };

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: getGeminiHeaders(geminiApiKey),
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [openAITool],
        tool_choice: { type: 'function', function: { name: tool.name } },
        temperature: AI_CONFIG.temperature,
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    if (response.status === 429) {
      if (retryCount < GEMINI_MAX_RETRIES) {
        const retryAfter = response.headers.get('retry-after');
        const retryDelay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : GEMINI_RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
        const jitter = Math.random() * 1000;
        console.warn(`Gemini rate limited, waiting ${Math.round(retryDelay + jitter)}ms (attempt ${retryCount + 1}/${GEMINI_MAX_RETRIES})`);
        await sleep(retryDelay + jitter);
        return callClaudeAI(systemPrompt, userPrompt, tool, apiKey, retryCount + 1);
      }
      return { data: null, error: { code: 'rate_limited', message: 'Rate limit exceeded after retries' } };
    }

    if (response.status >= 500) {
      if (retryCount < GEMINI_MAX_RETRIES) {
        const retryDelay = GEMINI_RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
        console.warn(`Gemini server error (${response.status}), retrying in ${retryDelay}ms`);
        await sleep(retryDelay);
        return callClaudeAI(systemPrompt, userPrompt, tool, apiKey, retryCount + 1);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini call failed: ${response.status}`, errorText.substring(0, 500));
      return { data: null };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.warn(`No tool_call in Gemini response`);
      return { data: null };
    }

    const parsed = typeof toolCall.function.arguments === 'string'
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    console.log(`Gemini extracted ${Object.keys(parsed).length} fields via ${tool.name}`);

    const usage = data.usage ? {
      inputTokens: data.usage.prompt_tokens || 0,
      outputTokens: data.usage.completion_tokens || 0,
    } : null;

    return { data: parsed, usage, toolName: tool.name } as any;
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { data: null, error: { code: 'timeout', message: 'AI request timed out' } } as any;
    }
    console.error('Gemini extraction error:', error);
    return { data: null } as any;
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
      services_offered: { type: 'string', description: "Detailed description of the services offered. Write as a natural prose paragraph covering: what specific services they provide, revenue mix between service lines if mentioned, whether residential vs commercial, and any specializations. NOT a list — write 2-4 sentences." },
      business_summary: { type: 'string', description: '2-3 sentence overview of what the company does operationally' },
      business_type: { type: 'string', enum: ['Service Provider', 'Distributor', 'Manufacturer', 'Retailer', 'Software', 'Other'] },
      industry_vertical: { type: 'string', description: "Industry category (e.g., 'Home Services - HVAC')" },
      specialized_focus: { type: 'string', description: 'Any niche or specialization mentioned' },
      revenue_model: { type: 'string', description: 'Detailed description of how the company generates revenue — include contract types, customer payment models, recurring vs project-based work, franchise fees if applicable. Write 1-3 sentences.' },
    },
  },
};

const PROMPT_1_SYSTEM = `You are an M&A research analyst extracting PLATFORM COMPANY (operating company) information from its website for due diligence purposes.

CRITICAL DATA PROVENANCE RULE:
- You are analyzing the PLATFORM/OPERATING COMPANY website ONLY.
- Extract information about THIS company's operations, services, and business model.
- Do NOT use, reference, or infer any information from a PE firm, investment firm, or parent company.
- If the website content describes the PE firm's investment strategy instead of the operating company, return null for ALL fields.

Extract ONLY information that is explicitly stated in the content.
Do NOT infer, guess, or hallucinate any information.
If a field cannot be determined from the content, return null.

IMPORTANT for services_offered: Do NOT return a JSON array or bracketed list. Write a natural prose description of 2-4 sentences covering the service mix, any revenue breakdowns mentioned, and specializations. Example: "The company provides residential and commercial HVAC installation, repair, and maintenance services. They specialize in energy-efficient systems and offer 24/7 emergency service. Approximately 70% of revenue comes from residential customers."

IMPORTANT for revenue_model: Describe how money flows in 1-3 sentences. Include contract types, recurring vs one-time, franchise model if applicable.`;

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

const PROMPT_2_SYSTEM = `You are an M&A research analyst extracting PLATFORM COMPANY (operating company) customer profile information from its website.

CRITICAL DATA PROVENANCE RULE:
- You are analyzing the PLATFORM/OPERATING COMPANY website ONLY.
- Extract information about THIS company's customers, not the PE firm's portfolio or investment targets.
- If the website describes PE firm investment criteria instead of the company's customers, return null for ALL fields.

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
      hq_state: { type: 'string', description: '2-letter US state code (e.g., TX not Texas)' },
      hq_country: { type: 'string', default: 'USA' },
      geographic_footprint: { type: 'array', items: { type: 'string' }, description: 'Array of 2-letter state codes where company operates, has offices, or provides services. Include states from office addresses, service area lists, explicitly named states, and cities with known states.' },
      service_regions: { type: 'array', items: { type: 'string' }, description: 'All states where company provides services or has customers, as 2-letter codes. Superset of geographic_footprint.' },
      operating_locations: { type: 'array', items: { type: 'string' }, description: 'REQUIRED: Every physical office, branch, store, or location mentioned on the website as "City, ST" (e.g., "Dallas, TX", "Atlanta, GA"). Extract from addresses, location lists, footer, contact pages, and branch directories. This is a critical field — extract aggressively.' },
    },
  },
};

const PROMPT_3A_SYSTEM = `You are an M&A research analyst extracting geographic coverage from a company website.

EXTRACTION RULES:
1. Extract ALL states where the company operates, has offices, or provides services
2. Include states from:
   - Office/location addresses (e.g., "123 Main St, Atlanta, GA" → GA)
   - Service area descriptions (e.g., "Serving Minnesota, Wisconsin, and Iowa" → MN, WI, IA)
   - Named state lists (e.g., "Operating in FL, GA, and AL" → FL, GA, AL)
   - City mentions with known states (e.g., "serving Dallas and Houston" → TX)
   - "Locations" or "Branches" pages listing cities
   - Footer addresses or contact pages
3. geographic_footprint = states with physical presence (offices, branches, stores)
4. service_regions = ALL states where company provides services, has customers, or claims coverage.
   IMPORTANT: Expand regional language into state codes:
   - "Southeast" → FL, GA, AL, SC, NC, TN, MS, LA, AR, KY, VA, WV
   - "Northeast" → CT, ME, MA, NH, RI, VT, NJ, NY, PA
   - "Mid-Atlantic" → NJ, NY, PA, DE, MD, VA, DC
   - "Midwest" → IL, IN, MI, OH, WI, IA, KS, MN, MO, NE, ND, SD
   - "Southwest" → AZ, NM, TX, OK
   - "West" or "West Coast" → CA, OR, WA, NV, AZ, CO, UT
   - "Pacific Northwest" → WA, OR, ID
   - "Mountain West" → CO, MT, ID, WY, UT, NV
   - "Sun Belt" → FL, GA, TX, AZ, NV, SC, NC, TN, AL
   - "National" or "Nationwide" → set service_regions to ALL 50 state codes
   - "Gulf Coast" → TX, LA, MS, AL, FL
   - "Great Lakes" → MI, OH, WI, IL, IN, MN
5. operating_locations = CRITICAL FIELD: every "City, ST" pair found anywhere on the site.
   Example: ["Dallas, TX", "Atlanta, GA", "Chicago, IL", "Tampa, FL"]
6. hq_state MUST be a 2-letter code (e.g., TX not Texas)
7. hq_city MUST be a real city name (not a region like "West Coast")

IMPORTANT FOR M&A BUYERS:
- PE firms and platform companies often describe coverage using regional language.
  "We serve the Southeast and Mid-Atlantic" is VALID — expand into service_regions state codes.
- "National coverage" → service_regions should contain all 50 state codes.
- geographic_footprint stays strict (physical presence only).
- service_regions should be BROAD and inclusive — it's better to over-include than miss states.

DO NOT:
- Guess states based on industry norms alone
- Return full state names — always use 2-letter codes
- Use region names as hq_city (e.g., "West Coast" is NOT a city)

Return 2-letter state codes (e.g., MN not Minnesota).`;

async function extractGeography(content: string, apiKey: string): Promise<any> {
  console.log('Running Prompt 3a: Geographic Footprint');
  const userPrompt = `Website Content:\n\n${content.substring(0, 50000)}\n\nExtract geographic coverage information. Include states from addresses, service area descriptions, location pages, contact info, and any explicitly named states or cities where the company operates or serves customers. For each city found, add it to operating_locations as "City, ST" format. Always use 2-letter state codes.`;
  return await callClaudeAI(PROMPT_3A_SYSTEM, userPrompt, PROMPT_3A_GEOGRAPHY, apiKey);
}

// ============================================================================
// PROMPT 3b: COMBINED PE INTELLIGENCE (Acquisitions + Activity + Portfolio)
// ============================================================================

const PROMPT_3B_PE_INTELLIGENCE = {
  name: 'extract_pe_intelligence',
  description: 'Extract acquisition history, PE activity, and portfolio from website content',
  input_schema: {
    type: 'object',
    properties: {
      // Acquisition History
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
      // PE Activity (NO THESIS - thesis ONLY from transcripts)
      target_industries: { type: 'array', items: { type: 'string' }, description: 'Industries the PE firm focuses on' },
      target_services: { type: 'array', items: { type: 'string' }, description: 'Service types of interest' },
      acquisition_appetite: { type: 'string', description: "Activity level, e.g., 'Very Active - 15-20 deals annually'" },
      // Portfolio
      portfolio_companies: { type: 'array', items: { type: 'string' }, description: 'List of portfolio company names' },
      num_platforms: { type: 'integer', description: 'Number of platform investments' },
    },
  },
};

const PROMPT_3B_SYSTEM = `You are an M&A research analyst extracting PE firm intelligence from website content.

Extract THREE categories of information:
1. ACQUISITION HISTORY: Recent deals, total count, frequency
2. INVESTMENT FOCUS: Target industries, services, and activity level
3. PORTFOLIO: Current and past portfolio company names

CRITICAL: Do NOT extract investment thesis, strategic priorities, or thesis confidence.
These fields MUST come from direct conversations with the platform company, not websites.

Extract ONLY information that is explicitly stated in the content.
Do NOT infer or guess any information.`;

async function extractPEIntelligence(content: string, apiKey: string): Promise<any> {
  console.log('Running Prompt 3b: Combined PE Intelligence (Acquisitions + Activity + Portfolio)');
  const userPrompt = `Website Content:\n\n${content.substring(0, 50000)}\n\nExtract acquisition history, investment focus areas, and portfolio companies. Do NOT extract thesis, strategic priorities, or thesis confidence.`;
  return await callClaudeAI(PROMPT_3B_SYSTEM, userPrompt, PROMPT_3B_PE_INTELLIGENCE, apiKey);
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

  // Anti-hallucination check — only flag if service_regions is suspiciously large
  // with NO supporting evidence (no footprint, no operating locations, no HQ)
  const hasAnyGeoEvidence = (data.geographic_footprint?.length || 0) > 0 || 
    (data.operating_locations?.length || 0) > 0 || 
    data.hq_state;
  
  if (data.service_regions?.length > 30 && !hasAnyGeoEvidence) {
    console.warn('Possible hallucination in service_regions - no supporting evidence, reverting');
    data.service_regions = [];
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

  // Normalize operating_locations — extract state codes from "City, ST" entries
  if (data.operating_locations && Array.isArray(data.operating_locations)) {
    // Keep the "City, ST" format but also extract states into geographic_footprint
    const locStates: string[] = [];
    data.operating_locations = data.operating_locations.filter((loc: string) => {
      if (typeof loc !== 'string') return false;
      const stateMatch = loc.match(/,\s*([A-Z]{2})\s*$/i);
      if (stateMatch) {
        const code = stateMatch[1].toUpperCase();
        if (VALID_STATE_CODES.has(code)) locStates.push(code);
      }
      return true;
    });
    // Merge operating_locations states into geographic_footprint
    if (locStates.length > 0) {
      if (!data.geographic_footprint) data.geographic_footprint = [];
      for (const s of locStates) {
        if (!data.geographic_footprint.includes(s)) data.geographic_footprint.push(s);
      }
      console.log(`Added ${locStates.length} states from operating_locations to geographic_footprint`);
    }
  }

  // If geographic_footprint is empty but service_regions has data, promote service_regions
  if ((!data.geographic_footprint || data.geographic_footprint.length === 0) && data.service_regions?.length > 0) {
    console.log('Promoting service_regions to geographic_footprint (footprint was empty)');
    data.geographic_footprint = [...data.service_regions];
  }

  if (data.hq_state) {
    data.hq_state = normalizeStateCode(data.hq_state);
    if (VALID_STATE_CODES.has(data.hq_state)) {
      data.hq_region = getRegionFromState(data.hq_state);
      // Also ensure hq_state is in geographic_footprint
      if (!data.geographic_footprint) data.geographic_footprint = [];
      if (!data.geographic_footprint.includes(data.hq_state)) {
        data.geographic_footprint.push(data.hq_state);
      }
      // Also add HQ to operating_locations if not present
      if (data.hq_city) {
        const hqLoc = `${data.hq_city}, ${data.hq_state}`;
        if (!data.operating_locations) data.operating_locations = [];
        if (!data.operating_locations.some((l: string) => l.toLowerCase() === hqLoc.toLowerCase())) {
          data.operating_locations.push(hqLoc);
        }
      }
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
  existingSources: any[],
  newSourceType: SourceType = 'platform_website'
): boolean {
  // RULE 1: If field has been written by a transcript, NEVER allow any website to overwrite it.
  // This is absolute — transcripts are always higher priority than any website.
  if (newSourceType === 'platform_website' || newSourceType === 'pe_firm_website') {
    // Check if ANY transcript source has written this specific field
    const fieldHasTranscriptSource = existingSources.some(
      (src: any) => {
        const isTranscript = src.type === 'transcript' || src.type === 'buyer_transcript' || src.source === 'transcript';
        if (!isTranscript) return false;
        // Check if this specific field was extracted by a transcript
        const extractedFields = src.fields_extracted || src.fields || [];
        return extractedFields.includes(fieldName);
      }
    );

    if (fieldHasTranscriptSource) {
      const hasExistingData = existingValue !== null &&
        existingValue !== undefined &&
        (typeof existingValue !== 'string' || existingValue.trim() !== '') &&
        (!Array.isArray(existingValue) || existingValue.length > 0);

      if (hasExistingData) {
        console.log(`🛡️ TRANSCRIPT PROTECTION: Skipping ${fieldName} — already set by transcript, website cannot overwrite`);
        return false;
      }
    }
  }

  // RULE 2: Never overwrite transcript-protected fields if buyer has ANY transcript source
  // (even if we can't confirm the specific field was from a transcript)
  if (TRANSCRIPT_PROTECTED_FIELDS.includes(fieldName) && hasTranscriptSource) {
    const hasExistingData = existingValue !== null &&
      existingValue !== undefined &&
      (typeof existingValue !== 'string' || existingValue.trim() !== '') &&
      (!Array.isArray(existingValue) || existingValue.length > 0);

    if (hasExistingData && (newSourceType === 'platform_website' || newSourceType === 'pe_firm_website')) {
      console.log(`🛡️ PROTECTED FIELD: Skipping ${fieldName} — transcript-protected and buyer has transcript data`);
      return false;
    }
  }

  // Existing value is empty/null → always overwrite
  const existingIsEmpty = existingValue === null || existingValue === undefined || existingValue === '' ||
    (Array.isArray(existingValue) && existingValue.length === 0);
  if (existingIsEmpty) return true;

  // For strings: overwrite if new value is non-empty
  if (typeof newValue === 'string') {
    return newValue.trim().length > 0;
  }

  // For arrays: overwrite if new value has items
  if (Array.isArray(newValue)) {
    return newValue.length > 0;
  }

  // For numbers: only overwrite if existing is null (already handled above)
  if (typeof newValue === 'number') {
    return false;
  }

  return true;
}

function buildUpdateObject(
  buyer: any,
  extractedData: Record<string, any>,
  hasTranscriptSource: boolean,
  existingSources: any[],
  evidenceRecords: any[],
  fieldSourceMap: Record<string, SourceType> = {},
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

    // WRITE-TIME PROVENANCE ENFORCEMENT (second layer — belt AND suspenders)
    const fieldSource = fieldSourceMap[field];
    if (fieldSource) {
      const validation = validateFieldProvenance(field, fieldSource);
      if (!validation.allowed) {
        console.error(`🚫 WRITE-TIME BLOCK: ${validation.reason}`);
        continue;
      }
    }

    // Skip placeholder values
    if (typeof value === 'string' && PLACEHOLDER_STRINGS.has(value.toLowerCase())) continue;

    // Check overwrite rules — pass the source type so we can enforce transcript > website
    const sourceType = fieldSourceMap[field] || 'platform_website';
    if (!shouldOverwrite(field, buyer[field], value, hasTranscriptSource, existingSources, sourceType)) {
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

    // Normalize services_offered: if it looks like a JSON array, convert to prose
    if (field === 'services_offered' && typeof value === 'string') {
      let cleanValue = value.trim();
      if (cleanValue.startsWith('[')) {
        try {
          const parsed = JSON.parse(cleanValue);
          if (Array.isArray(parsed)) {
            cleanValue = parsed.join(', ');
          }
        } catch {
          // Not valid JSON, strip brackets
          cleanValue = cleanValue.replace(/^\[|\]$/g, '').replace(/"/g, '');
        }
      }
      updateData[field] = cleanValue;
      fieldsUpdated++;
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
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    console.log('[enrich-buyer] request received');
    const { buyerId, skipLock } = await req.json();

    if (!buyerId) {
      return new Response(
        JSON.stringify({ success: false, error: 'buyerId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!firecrawlApiKey || !geminiApiKey || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error - missing API keys (FIRECRAWL_API_KEY, GEMINI_API_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // ATOMIC ENRICHMENT LOCK: Prevent concurrent enrichments via single UPDATE + WHERE clause
    // Skip lock when called from queue worker (queue already manages concurrency via status)
    if (!skipLock) {
      // Use a short lock window — just enough to prevent true concurrent calls.
      // After successful enrichment the timestamp is updated, so the next call only
      // needs to wait out the remaining window (not the full duration).
      const ENRICHMENT_LOCK_SECONDS = 15;
      const lockCutoff = new Date(Date.now() - ENRICHMENT_LOCK_SECONDS * 1000).toISOString();

      const { data: lockData } = await supabase
        .from('remarketing_buyers')
        .update({ data_last_updated: new Date().toISOString() })
        .eq('id', buyerId)
        .or(`data_last_updated.is.null,data_last_updated.lt.${lockCutoff}`)
        .select('id');

      if (!lockData || lockData.length === 0) {
        console.log(`[enrich-buyer] Lock acquisition failed for buyer ${buyerId}: enrichment already in progress (lock window: ${ENRICHMENT_LOCK_SECONDS}s)`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Enrichment already in progress for this buyer. Please wait ${ENRICHMENT_LOCK_SECONDS} seconds and try again.`,
            statusCode: 429
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Queue-based call: just update timestamp without lock check
      await supabase
        .from('remarketing_buyers')
        .update({ data_last_updated: new Date().toISOString() })
        .eq('id', buyerId);
      console.log(`[enrich-buyer] Skipping lock (queue-based call) for buyer ${buyerId}`);
    }

    console.log(`Starting 4-prompt enrichment for buyer: ${buyer.company_name || buyer.pe_firm_name || buyerId}`);
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

    // Start firecrawlMap discovery in parallel (will be awaited before geography extraction)
    let locationPagePromise: Promise<string | null> | null = null;

    for (const { type, result } of scrapeResults) {
      if (type === 'platform') {
        if (result.success && result.content) {
          platformContent = result.content;
          sources.platform = platformWebsite!;
          console.log(`Scraped platform website: ${platformContent.length} chars`);

          // PERF: Start location page discovery immediately (runs in parallel with Claude batch 1)
          locationPagePromise = firecrawlMap(platformWebsite!, firecrawlApiKey)
            .then(async (links) => {
              const locationPage = links.find(link =>
                LOCATION_PATTERNS.some(p => link.toLowerCase().includes(p))
              );
              if (locationPage) {
                console.log(`Found location page: ${locationPage}`);
                const locationResult = await scrapeWebsite(locationPage, firecrawlApiKey);
                if (locationResult.success && locationResult.content) {
                  return locationResult.content;
                }
              }
              return null;
            })
            .catch((err) => {
              console.warn('Location page discovery failed:', err);
              return null;
            });
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
    // RUN EXTRACTION PROMPTS (2 BATCHES to avoid Anthropic RPM limits)
    // ========================================================================

    const allExtracted: Record<string, any> = {};
    // Track which source type each field came from for provenance enforcement
    const fieldSourceMap: Record<string, SourceType> = {};
    const evidenceRecords: any[] = [];
    const timestamp = new Date().toISOString();
    let promptsRun = 0;
    let promptsSuccessful = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let billingError: { code: string; message: string } | null = null;
    let provenanceViolations: string[] = [];

    // Determine source type from URL
    const getSourceType = (url: string | null | undefined): SourceType => {
      if (!url) return 'manual';
      const normalizedUrl = url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const normalizedPE = peFirmWebsite?.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (normalizedPE && normalizedUrl === normalizedPE) return 'pe_firm_website';
      return 'platform_website';
    };

    // Helper to process batch results with provenance tracking
    const processBatchResults = (results: PromiseSettledResult<{ name: string; result: any; url: string | null | undefined }>[]) => {
      for (const settled of results) {
        if (settled.status === 'fulfilled') {
          const { name, result, url } = settled.value;
          const sourceType = getSourceType(url);

          if (result.error?.code === 'payment_required' || result.error?.code === 'rate_limited') {
            if (!billingError) billingError = result.error;
            continue;
          }

          if (result.data) {
            // Special handling for PE Intelligence: filter out thesis fields
            let dataToMerge = result.data;
            if (name === 'pe_intelligence') {
              const { thesis_summary, strategic_priorities, thesis_confidence, ...safeData } = result.data;
              if (thesis_summary || strategic_priorities || thesis_confidence) {
                console.warn('WARNING: PE Intelligence returned thesis fields - discarding (transcript-only)');
              }
              dataToMerge = safeData;
            }

            // Track source type per field and validate provenance BEFORE merging
            const acceptedFields: string[] = [];
            for (const [field, value] of Object.entries(dataToMerge)) {
              if (value === null || value === undefined) continue;
              
              const mappedField = FIELD_TO_COLUMN_MAP[field] || field;
              const validation = validateFieldProvenance(mappedField, sourceType);
              
              if (!validation.allowed) {
                console.error(`🚫 ${validation.reason}`);
                provenanceViolations.push(validation.reason!);
                // DO NOT merge this field
                continue;
              }
              
              allExtracted[field] = value;
              fieldSourceMap[mappedField] = sourceType;
              acceptedFields.push(field);
            }

            if (acceptedFields.length > 0) {
              promptsSuccessful++;
              // Accumulate actual token usage from Claude API responses
              if (result.usage) {
                totalInputTokens += result.usage.inputTokens || 0;
                totalOutputTokens += result.usage.outputTokens || 0;
              }
              evidenceRecords.push({
                type: 'website',
                source_type: sourceType,
                url,
                extracted_at: timestamp,
                fields_extracted: acceptedFields,
              });
            }
          }
        } else {
          console.error(`Prompt failed:`, settled.reason);
        }
      }
    };

    // ALL PROMPTS IN SINGLE PARALLEL BATCH (no more sequential batches)
    const allPromises: Promise<{ name: string; result: any; url: string | null | undefined }>[] = [];
    
    if (platformContent) {
      allPromises.push(
        extractBusinessOverview(platformContent, geminiApiKey).then(r => ({ name: 'business', result: r, url: platformWebsite })),
        extractGeography(platformContent, geminiApiKey).then(r => ({ name: 'geography', result: validateGeography(r), url: platformWebsite })),
        extractCustomerProfile(platformContent, geminiApiKey).then(r => ({ name: 'customer', result: r, url: platformWebsite })),
        extractPEIntelligence(platformContent, geminiApiKey).then(r => ({ name: 'pe_intelligence', result: r, url: platformWebsite })),
      );
    } else if (peContent) {
      // No platform content — only extract geography from PE site
      console.log('Platform website unavailable — extracting geographic_footprint/service_regions ONLY from PE firm website');
      allPromises.push(
        extractGeography(peContent, geminiApiKey).then(r => {
          const validated = validateGeography(r);
          if (validated?.data) {
            delete validated.data.hq_city;
            delete validated.data.hq_state;
            delete validated.data.hq_country;
            delete validated.data.hq_region;
            delete validated.data.operating_locations;
            delete validated.data.service_regions;
          }
          return { name: 'geography', result: validated, url: peFirmWebsite };
        }),
      );
    }

    if (peContent) {
      allPromises.push(
        extractPEIntelligence(peContent, geminiApiKey).then(r => ({ name: 'pe_intelligence', result: r, url: peFirmWebsite })),
      );
    }

    if (allPromises.length > 0) {
      promptsRun += allPromises.length;

      // Await location page discovery (was running in parallel with scraping)
      if (locationPagePromise) {
        const locationContent = await locationPagePromise;
        if (locationContent) {
          platformContent += '\n\n--- LOCATION DATA ---\n\n' + locationContent;
          console.log('Appended location page data to platform content');
        }
      }

      const allResults = await Promise.allSettled(allPromises);
      processBatchResults(allResults);
      console.log(`All prompts complete: ${promptsSuccessful}/${promptsRun} successful`);
    }

    console.log(`Extraction complete: ${promptsSuccessful}/${promptsRun} prompts successful, ${Object.keys(allExtracted).length} fields extracted`);

    // Handle billing errors with partial save
    if (billingError as { code: string; message: string } | null) {
      const be = billingError as { code: string; message: string };
      const fieldsExtracted = Object.keys(allExtracted).length;
      if (fieldsExtracted > 0) {
        const partialUpdate = buildUpdateObject(buyer, allExtracted, hasTranscriptSource, existingSources, evidenceRecords, fieldSourceMap);
        await supabase.from('remarketing_buyers').update(partialUpdate).eq('id', buyerId);
      }

      // If we got rate limited but still extracted data, return success with warning
      if (be.code === 'rate_limited' && fieldsExtracted > 0) {
        console.log(`Partial enrichment saved despite rate limit: ${fieldsExtracted} fields for buyer ${buyerId}`);
        return new Response(
          JSON.stringify({
            success: true,
            fieldsUpdated: fieldsExtracted,
            sources,
            warnings: [...warnings, `Partial enrichment: ${promptsSuccessful}/${promptsRun} prompts completed before rate limit. Data was saved.`],
            extractionDetails: {
              promptsRun,
              promptsSuccessful,
              platformScraped: !!platformContent,
              peFirmScraped: !!peContent,
              rateLimited: true,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Payment required or no data extracted - return error
      return new Response(
        JSON.stringify({
          success: false,
          error: be.message,
          error_code: be.code,
          fieldsUpdated: fieldsExtracted,
          recoverable: be.code === 'rate_limited',
        }),
        { status: be.code === 'payment_required' ? 402 : 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // SAVE TO DATABASE
    // ========================================================================

    const updateData = buildUpdateObject(buyer, allExtracted, hasTranscriptSource, existingSources, evidenceRecords, fieldSourceMap);

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

    // Cost tracking: log aggregate AI usage (non-blocking)
    logAICallCost(supabase, 'enrich-buyer', 'gemini', AI_CONFIG.model, 
      {
        inputTokens: totalInputTokens > 0 ? totalInputTokens : promptsRun * 12000,
        outputTokens: totalOutputTokens > 0 ? totalOutputTokens : promptsSuccessful * 800,
      },
      undefined, { buyerId, promptsRun, promptsSuccessful }
    ).catch(() => {});

    // Log provenance violations as prominent warnings
    if (provenanceViolations.length > 0) {
      console.error(`⚠️ PROVENANCE REPORT: ${provenanceViolations.length} violation(s) blocked during enrichment of buyer ${buyerId}:`);
      for (const v of provenanceViolations) {
        console.error(`  → ${v}`);
      }
      warnings.push(...provenanceViolations.map(v => `[BLOCKED] ${v}`));
    }

    return new Response(
      JSON.stringify({
        success: true,
        fieldsUpdated,
        sources,
        warnings: warnings.length > 0 ? warnings : undefined,
        provenanceViolations: provenanceViolations.length > 0 ? provenanceViolations : undefined,
        extractionDetails: {
          promptsRun,
          promptsSuccessful,
          platformScraped: !!platformContent,
          peFirmScraped: !!peContent,
          provenanceViolationsBlocked: provenanceViolations.length,
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
