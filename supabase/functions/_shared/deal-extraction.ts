/**
 * Deal Extraction Module
 *
 * Contains all deal-specific extraction logic:
 * - Valid listing column whitelist
 * - Financial field blocking (website scraping policy)
 * - AI prompt + tool schema for deal intelligence extraction
 * - Address validation and cleaning
 * - Location count extraction (regex fallback)
 * - LinkedIn URL validation
 * - Transcript-to-listing field mapping
 *
 * This module is imported by enrich-deal/index.ts (the orchestrator).
 * All functions are pure — no DB writes, no side effects.
 */

import { normalizeState } from "./geography.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

export const DEAL_SCRAPE_TIMEOUT_MS = 30000; // 30 seconds per page
export const DEAL_AI_TIMEOUT_MS = 45000; // 45 seconds
export const DEAL_MIN_CONTENT_LENGTH = 50; // Minimum chars to proceed with AI

export const DEAL_AI_RETRY_CONFIG = {
  maxRetries: 3,
  delays: [2000, 5000, 10000], // exponential backoff
};

// ============================================================================
// COLUMN WHITELIST
// ============================================================================

// Only allow updates to real listings columns (prevents schema-cache 500s)
// NOTE: 'location' is intentionally excluded - it's for marketplace anonymity
export const VALID_LISTING_UPDATE_KEYS = new Set([
  'internal_company_name', // extracted company name
  'title', // fallback if internal_company_name not set
  'executive_summary',
  'services',
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
  'headquarters_address',
  'founded_year',
  'full_time_employees',
  'part_time_employees',
  'website',
  'customer_types',
  'end_market_description',
  'customer_concentration',
  'customer_geography',
  'owner_goals',
  'ownership_structure',
  'transition_preferences',
  'special_requirements',
  'timeline_notes',
  'key_risks',
  'competitive_position',
  'technology_systems',
  'real_estate_info',
  'growth_trajectory',
  'key_quotes',
  'primary_contact_name',
  'primary_contact_email',
  'primary_contact_phone',
  // LinkedIn data from Apify
  'linkedin_employee_count',
  'linkedin_employee_range',
  'linkedin_url', // Extracted from website or entered manually
  // Financial tracking fields per spec
  'revenue',
  'ebitda',
  'revenue_confidence',
  'revenue_is_inferred',
  'revenue_source_quote',
  'ebitda_margin',
  'ebitda_confidence',
  'ebitda_is_inferred',
  'ebitda_source_quote',
  'financial_notes',
  'financial_followup_questions',
]);

// Financial data must NEVER come from website scraping — only from transcripts or manual entry
export const FINANCIAL_FIELDS_BLOCKED_FROM_WEBSITES = [
  'revenue', 'revenue_value', 'revenue_confidence', 'revenue_is_inferred', 'revenue_source_quote',
  'ebitda', 'ebitda_amount', 'ebitda_margin', 'ebitda_margin_percentage',
  'ebitda_confidence', 'ebitda_is_inferred', 'ebitda_source_quote',
  'financial_notes', 'financial_followup_questions',
];

// Numeric columns that need special sanitization (LLM often returns prose for these)
export const NUMERIC_LISTING_FIELDS = new Set([
  'revenue',
  'ebitda',
  'ebitda_margin',
  'number_of_locations',
  'full_time_employees',
  'founded_year',
  'linkedin_employee_count',
  'part_time_employees',
  'team_page_employee_count',
  'customer_concentration', // numeric column — LLM often returns prose
]);

// Placeholder values to reject from any field
export const WEBSITE_PLACEHOLDERS = ['<unknown>', 'unknown', 'n/a', 'none', 'null', 'not found', 'not specified', 'not provided'];
export const ADDRESS_PLACEHOLDERS = ['not found', 'n/a', 'unknown', 'none', 'null', 'undefined', 'tbd', 'not available', 'not specified'];

// ============================================================================
// AI PROMPT + TOOL SCHEMA
// ============================================================================

export const DEAL_SYSTEM_PROMPT = `You are a SENIOR M&A analyst conducting deep due diligence on an acquisition target. Extract EVERY piece of intelligence from this website content. Be EXHAUSTIVE — capture every detail, no matter how minor. Your output directly drives buyer matching and deal scoring.

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

DEPTH REQUIREMENTS — Every field must be DETAILED and CONTEXTUAL:

1. **Executive Summary** (3-5 sentences MINIMUM): Write a PE-investor-grade overview. MUST include what the company does, approximate size indicators (employees, locations, years in business), geographic footprint, key differentiators, and why this is an attractive acquisition target. Use specific facts from the website, not vague language. Lead with the most compelling aspect.

2. **Service Mix** (2-4 sentences): Don't just list services — describe the revenue model. Include residential vs commercial split if visible, recurring vs project-based work, how services interrelate, and any specializations or certifications that create competitive moats.

3. **Business Model** (2-4 sentences): Explain HOW the company makes money. Include revenue model (project-based, recurring, subscription, retainer), customer acquisition channels, pricing structure if visible, and contract types. Mention B2B vs B2C split.

4. **Competitive Position** (2-3 sentences): Market positioning, competitive advantages, certifications, awards, years of experience, unique capabilities, preferred vendor relationships, insurance carrier partnerships, or franchise affiliations that differentiate them.

5. **Growth Trajectory** (2-3 sentences): Growth indicators — new locations, expanding service areas, recently added services, hiring signals, new equipment investments, customer testimonials about recent growth, awards for growth. If no explicit growth data, note what expansion levers exist.

6. **Technology Systems** (1-2 sentences): Software platforms, CRM, ERP, scheduling tools, fleet management, industry-specific technology, mobile apps, customer portals mentioned on the site.

7. **Customer Types** (1-2 sentences): Don't just say "residential and commercial" — describe the customer segments with detail. E.g., "Primarily serves property management companies (60%+) and commercial building owners, with a growing residential segment through insurance restoration referrals."

8. **Key Risks** (bullet points): Identify real risk factors visible from the website — owner dependency, single-location concentration, narrow service offering, geographic limitation, regulatory exposure, customer concentration hints.

9. **Real Estate Info**: Owned vs leased facilities, warehouse/shop/office details, facility size if mentioned, multiple location details.

10. **End Market Description** (1-2 sentences): The broader market context — industry trends, demand drivers, fragmentation level, regulatory environment.`;

export function buildDealUserPrompt(dealTitle: string, websiteContent: string): string {
  return `Analyze this website content from "${dealTitle || 'Unknown Company'}" and extract DEEP business intelligence. This data drives M&A buyer matching — every detail matters.

IMPORTANT: You MUST find and extract the company's physical location (city and state). Look in the footer, contact page, about page, service area mentions, phone area codes, or any other location hints. This is required for deal matching.

DEPTH REQUIREMENTS:
- Executive summary: Write 3-5 rich sentences a PE investor can scan in 30 seconds. Include what they do, how big they are, where they operate, what makes them special, and why a buyer would want them.
- Service mix: Describe the full service portfolio with context — don't just list services. Explain how they fit together, what drives revenue, residential vs commercial mix.
- Business model: Explain the revenue engine — how they get customers, how they charge, recurring vs one-time, contract structures.
- Competitive position: What makes them defensible? Certifications, partnerships, reputation, proprietary processes, market share indicators.
- Growth trajectory: What signals growth or stagnation? New locations, expanding teams, new services, awards, customer volume trends.
- Customer types: Be specific about segments — not just "commercial" but what KIND of commercial customers.
- Technology systems: Any software, platforms, tools, or technology investments visible.
- Key risks: Real operational risks visible from the website.

FINANCIAL DATA POLICY:
- Do NOT extract any financial information (revenue, EBITDA, margins, etc.) from websites.
- Financial data may ONLY come from transcripts or manual entry, never from web scraping.
- If financial figures appear on the website, IGNORE them entirely.

LOCATION COUNT RULES:
- Count ALL physical locations: offices, branches, shops, stores, facilities
- Look for patterns: "X locations", "operate out of X", "facilities in"
- Count individual location mentions if total not stated
- Single location business = 1

Website Content:
${websiteContent.substring(0, 25000)}

Extract all available business information using the provided tool. Be EXHAUSTIVE — capture every detail. The address_city and address_state fields are REQUIRED.`;
}

export const DEAL_TOOL_SCHEMA = {
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
          description: 'A 3-5 sentence PE-investor-grade summary. MUST include: what the company does, size indicators (employees, locations, years), geographic footprint, key differentiators, and acquisition attractiveness. Use specific facts, not vague language. Lead with the most compelling aspect.'
        },
        service_mix: {
          type: 'string',
          description: 'Detailed 2-4 sentence description of the full service portfolio. Include how services interrelate, residential vs commercial split, recurring vs project-based, specializations, and certifications. Do NOT just list services — describe the revenue model.'
        },
        business_model: {
          type: 'string',
          description: 'Detailed 2-4 sentence description of HOW the business makes money. Include revenue model (project-based, recurring, subscription), customer acquisition channels, pricing structure, B2B vs B2C split, average job size indicators, and contract types.'
        },
        industry: {
          type: 'string',
          description: 'REQUIRED. Primary industry classification. Be specific but concise (2-4 words). Examples: "HVAC Services", "Commercial Plumbing", "IT Managed Services", "Residential Landscaping", "Environmental Remediation", "Healthcare Staffing", "Commercial Cleaning", "Electrical Contracting". Always provide your best classification based on available information — never leave blank.'
        },
        geographic_states: {
          type: 'array',
          items: { type: 'string' },
          description: 'Two-letter US state codes where the company has CONFIRMED physical presence or operations explicitly stated in the text. Do NOT infer neighboring states. Only include states explicitly mentioned. (e.g., ["CA", "TX"])'
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
          description: 'ZIP code (e.g., "75201", "90210")'
        },
        address_country: {
          type: 'string',
          description: 'Country code, typically "US" or "CA"'
        },
        founded_year: {
          type: 'number',
          description: 'Year the company was founded'
        },
        customer_types: {
          type: 'string',
          description: 'Detailed 1-2 sentence description of customer segments. Be specific — not just "residential and commercial" but what KIND of customers, their profile, and any concentration patterns visible.'
        },
        end_market_description: {
          type: 'string',
          description: 'Broader market context: industry trends, demand drivers, fragmentation level, regulatory environment, and market size indicators (1-2 sentences).'
        },
        owner_goals: {
          type: 'string',
          description: 'Any mentioned goals from the owner (exit, growth, succession, etc.)'
        },
        key_risks: {
          type: 'string',
          description: 'Bullet-pointed risk factors: owner dependency, single-location risk, narrow service offering, geographic limitation, regulatory exposure, customer concentration, key-man risk, or competitive threats visible from the website.'
        },
        competitive_position: {
          type: 'string',
          description: 'Detailed 2-3 sentence market positioning: certifications, awards, years of experience, unique capabilities, preferred vendor relationships, insurance carrier partnerships, franchise affiliations, market share indicators, and what creates a defensible moat.'
        },
        technology_systems: {
          type: 'string',
          description: 'Detailed description of software platforms, CRM, ERP, scheduling tools, fleet management, industry-specific technology, mobile apps, customer portals, and any digital transformation investments visible on the site.'
        },
        real_estate_info: {
          type: 'string',
          description: 'Detailed facility information: owned vs leased, warehouse/shop/office details, facility size, multiple location descriptions, recent facility investments or expansions.'
        },
        growth_trajectory: {
          type: 'string',
          description: 'Detailed 2-3 sentence growth assessment: new locations, expanding service areas, recently added services, hiring signals, new equipment investments, customer testimonials about growth, awards for growth, and what organic/inorganic expansion levers exist.'
        },
        linkedin_url: {
          type: 'string',
          description: 'LinkedIn company page URL if found on the website'
        },
        // Financial fields REMOVED — financial data must NEVER be scraped from websites.
      },
      required: ['industry']
    }
  }
};

// ============================================================================
// POST-EXTRACTION VALIDATORS
// ============================================================================

// Valid US state and Canadian province codes
const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR'
]);
const CA_PROVINCE_CODES = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);

/**
 * Strip financial fields from website-extracted data.
 * Financial data must NEVER come from website scraping.
 */
export function stripFinancialFields(extracted: Record<string, unknown>): void {
  for (const field of FINANCIAL_FIELDS_BLOCKED_FROM_WEBSITES) {
    if (extracted[field] !== undefined) {
      console.log(`FINANCIAL SCRAPING BLOCKED: Stripping '${field}' from website-extracted data`);
      delete extracted[field];
    }
  }
}

/**
 * Remove any keys not in VALID_LISTING_UPDATE_KEYS and the 'location' field.
 */
export function filterToValidKeys(extracted: Record<string, unknown>): void {
  for (const key of Object.keys(extracted)) {
    if (!VALID_LISTING_UPDATE_KEYS.has(key)) {
      delete extracted[key];
    }
  }
  // 'location' is for marketplace anonymity — never update from enrichment
  delete extracted.location;
}

/**
 * Validate and normalize address_state to 2-letter code.
 * Returns true if valid, false if rejected.
 */
export function validateAddressState(extracted: Record<string, unknown>): void {
  if (!extracted.address_state) return;

  const normalized = normalizeState(String(extracted.address_state));
  if (normalized && (US_STATE_CODES.has(normalized) || CA_PROVINCE_CODES.has(normalized))) {
    extracted.address_state = normalized;
  } else {
    console.log(`Rejecting invalid address_state: "${extracted.address_state}"`);
    delete extracted.address_state;
  }
}

/**
 * Validate address_zip (US 5-digit or Canadian postal code).
 */
export function validateAddressZip(extracted: Record<string, unknown>): void {
  if (!extracted.address_zip) return;

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

/**
 * Clean address_city — AI sometimes puts full address in city field.
 * Extracts just the city name, and may populate street_address as a side effect.
 */
export function cleanAddressCity(extracted: Record<string, unknown>): void {
  if (!extracted.address_city) return;

  let cityStr = String(extracted.address_city).trim();

  // Pattern 1: Full address with comma-separated city,state,zip at end
  // e.g., "123 Main St, Dallas, TX 75201"
  const fullAddressPattern = /^(.+?),\s*([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5})?$/;
  const fullMatch = cityStr.match(fullAddressPattern);
  if (fullMatch) {
    cityStr = fullMatch[2].trim();
    if (!extracted.street_address && fullMatch[1]) {
      extracted.street_address = fullMatch[1].trim();
    }
    console.log(`Extracted city "${cityStr}" from full address, street: "${fullMatch[1]}"`);
  }

  // Pattern 2: Street address followed by city name without proper separators
  if (!fullMatch) {
    const streetIndicators = /(St\.?|Street|Ave\.?|Avenue|Rd\.?|Road|Dr\.?|Drive|Blvd\.?|Boulevard|Ln\.?|Lane|Way|Ct\.?|Court|Pkwy\.?|Parkway|Pl\.?|Place|Cir\.?|Circle|Park)\s+/i;
    const streetMatch = cityStr.match(streetIndicators);
    if (streetMatch && streetMatch.index !== undefined) {
      const lastStreetIndex = cityStr.lastIndexOf(streetMatch[0]);
      if (lastStreetIndex > 0) {
        const afterStreet = cityStr.substring(lastStreetIndex + streetMatch[0].length).trim();
        const cleanedCity = afterStreet.replace(/,?\s*[A-Z]{2}\s*(\d{5})?$/, '').trim();

        if (cleanedCity.length > 0 && cleanedCity.length < 50 && !/\d/.test(cleanedCity)) {
          if (!extracted.street_address) {
            extracted.street_address = cityStr.substring(0, lastStreetIndex + streetMatch[0].length - 1).trim();
          }
          cityStr = cleanedCity;
          console.log(`Parsed city "${cityStr}" from combined address, street: "${extracted.street_address}"`);
        }
      }
    }
  }

  // Pattern 3: Simple trailing ", ST" pattern
  cityStr = cityStr.replace(/,\s*[A-Z]{2}$/, '').trim();

  // Pattern 4: Remove trailing ZIP code
  cityStr = cityStr.replace(/\s+\d{5}(-\d{4})?$/, '').trim();

  // Reject placeholder values
  if (cityStr.length > 0 && cityStr.length < 50 && !ADDRESS_PLACEHOLDERS.includes(cityStr.toLowerCase())) {
    extracted.address_city = cityStr;
  } else {
    console.log(`Rejecting invalid/placeholder address_city: "${extracted.address_city}"`);
    delete extracted.address_city;
  }
}

/**
 * Clean street_address — reject placeholder values.
 */
export function cleanStreetAddress(extracted: Record<string, unknown>): void {
  if (!extracted.street_address) return;

  const streetStr = String(extracted.street_address).trim();
  if (streetStr.length > 0 && !ADDRESS_PLACEHOLDERS.includes(streetStr.toLowerCase())) {
    extracted.street_address = streetStr;
  } else {
    console.log(`Rejecting placeholder street_address: "${extracted.street_address}"`);
    delete extracted.street_address;
  }
}

/**
 * Default address_country to US if we have other address fields.
 */
export function defaultAddressCountry(extracted: Record<string, unknown>): void {
  if ((extracted.address_city || extracted.address_state) && !extracted.address_country) {
    extracted.address_country = 'US';
  }
}

/**
 * Extract location count from website content via regex when AI didn't find it.
 */
export function extractLocationCount(extracted: Record<string, unknown>, websiteContent: string): void {
  if (extracted.number_of_locations) return;

  const locationPatterns = [
    /(\d+)\s+(?:staffed\s+)?locations?/i,
    /(\d+)\s+offices?/i,
    /(\d+)\s+branches?/i,
    /(\d+)\s+stores?/i,
    /(\d+)\s+shops?/i,
    /(\d+)\s+facilities/i,
    /operate\s+out\s+of\s+(\d+)/i,
    /(\d+)\s+sites?\s+across/i,
  ];

  for (const pattern of locationPatterns) {
    const match = websiteContent.match(pattern);
    if (match) {
      const count = parseInt(match[1], 10);
      if (count > 0 && count < 1000) {
        extracted.number_of_locations = count;
        console.log(`Extracted location count via regex: ${count}`);
        return;
      }
    }
  }

  // Fallback: "multiple locations" → estimate 3
  if (/multiple\s+locations?/i.test(websiteContent)) {
    extracted.number_of_locations = 3;
    console.log('Inferred multiple locations as 3');
  } else if (/several\s+locations?/i.test(websiteContent)) {
    extracted.number_of_locations = 4;
    console.log('Inferred several locations as 4');
  }
}

/**
 * Validate and normalize linkedin_url — must be a DIRECT linkedin.com/company/ URL.
 */
export function validateLinkedInUrl(extracted: Record<string, unknown>): void {
  if (!extracted.linkedin_url) return;

  const linkedinUrlStr = String(extracted.linkedin_url).trim();
  const linkedinCompanyPattern = /^https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9_-]+\/?$/;
  if (linkedinCompanyPattern.test(linkedinUrlStr)) {
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

/**
 * Run all post-extraction validations on extracted deal data.
 * Modifies the extracted object in-place.
 */
export function validateDealExtraction(extracted: Record<string, unknown>, websiteContent: string): void {
  stripFinancialFields(extracted);
  filterToValidKeys(extracted);
  validateAddressState(extracted);
  validateAddressZip(extracted);
  cleanAddressCity(extracted);
  cleanStreetAddress(extracted);
  defaultAddressCountry(extracted);
  extractLocationCount(extracted, websiteContent);
  validateLinkedInUrl(extracted);
}

// ============================================================================
// TRANSCRIPT → LISTING FIELD MAPPING
// ============================================================================

// Placeholder strings shared across transcript processing
export const TRANSCRIPT_PLACEHOLDER_STRINGS = new Set([
  'unknown', '<unknown>', 'n/a', 'na', 'not specified', 'not provided', 'none', 'null', '-', '—',
]);

/**
 * Check if a value is a placeholder that should be rejected.
 */
export function isPlaceholder(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  const raw = v.trim().toLowerCase();
  const normalized = raw.replace(/^<|>$/g, '').trim();
  return raw.length === 0 || TRANSCRIPT_PLACEHOLDER_STRINGS.has(raw) || TRANSCRIPT_PLACEHOLDER_STRINGS.has(normalized);
}

/**
 * Convert a value to a finite number, or undefined.
 */
export function toFiniteNumber(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    if (isPlaceholder(v)) return undefined;
    const cleaned = v.replace(/[$,]/g, '').trim();
    const pct = cleaned.endsWith('%') ? cleaned.slice(0, -1).trim() : cleaned;
    const n = Number(pct);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Map transcript extracted_data to flat listing columns.
 * @param extracted - The extracted_data from deal_transcripts
 * @param listingKeys - Set of known listing column names
 * @returns Flat key-value pairs ready for listing update
 */
export function mapTranscriptToListing(extracted: any, listingKeys: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // Structured revenue
  {
    const revenueValue = toFiniteNumber(extracted?.revenue?.value);
    if (revenueValue != null) {
      out.revenue = revenueValue;
      if (extracted?.revenue?.confidence) out.revenue_confidence = extracted.revenue.confidence;
      out.revenue_is_inferred = !!extracted?.revenue?.is_inferred;
      if (extracted?.revenue?.source_quote) out.revenue_source_quote = extracted.revenue.source_quote;
    }
  }

  // Structured EBITDA
  {
    const ebitdaAmount = toFiniteNumber(extracted?.ebitda?.amount);
    if (ebitdaAmount != null) out.ebitda = ebitdaAmount;

    const marginPct = toFiniteNumber(extracted?.ebitda?.margin_percentage);
    if (marginPct != null) out.ebitda_margin = marginPct / 100;

    if (extracted?.ebitda?.confidence) out.ebitda_confidence = extracted.ebitda.confidence;
    if (extracted?.ebitda) out.ebitda_is_inferred = !!extracted.ebitda.is_inferred;
    if (extracted?.ebitda?.source_quote) out.ebitda_source_quote = extracted.ebitda.source_quote;
  }

  // Common fields
  if (Array.isArray(extracted?.geographic_states) && extracted.geographic_states.length) out.geographic_states = extracted.geographic_states;

  {
    const n = toFiniteNumber(extracted?.number_of_locations);
    if (n != null) out.number_of_locations = n;
  }
  {
    const n = toFiniteNumber(extracted?.full_time_employees);
    if (n != null) out.full_time_employees = n;
  }
  {
    const n = toFiniteNumber(extracted?.founded_year);
    if (n != null) out.founded_year = n;
  }

  if (extracted?.service_mix) out.service_mix = extracted.service_mix;
  if (extracted?.business_model) out.business_model = extracted.business_model;
  if (extracted?.industry) out.industry = extracted.industry;

  if (extracted?.owner_goals) out.owner_goals = extracted.owner_goals;
  if (extracted?.transition_preferences) out.transition_preferences = extracted.transition_preferences;
  if (extracted?.special_requirements) out.special_requirements = extracted.special_requirements;
  if (extracted?.timeline_notes) out.timeline_notes = extracted.timeline_notes;

  if (extracted?.customer_types) out.customer_types = extracted.customer_types;
  // customer_concentration: DB is NUMERIC but LLM often returns text.
  if (extracted?.customer_concentration) {
    const concText = String(extracted.customer_concentration);
    const pctMatch = concText.match(/(\d{1,3})(?:\s*%|\s*percent)/i);
    if (pctMatch) {
      const n = Number(pctMatch[1]);
      if (Number.isFinite(n) && n > 0 && n <= 100) out.customer_concentration = n;
    }
    if (out.customer_types) {
      out.customer_types += '\n\nCustomer Concentration: ' + concText;
    } else {
      out.customer_types = 'Customer Concentration: ' + concText;
    }
  }
  if (extracted?.customer_geography) out.customer_geography = extracted.customer_geography;
  if (extracted?.end_market_description) out.end_market_description = extracted.end_market_description;

  if (extracted?.executive_summary) out.executive_summary = extracted.executive_summary;
  if (extracted?.competitive_position) out.competitive_position = extracted.competitive_position;
  if (extracted?.growth_trajectory) out.growth_trajectory = extracted.growth_trajectory;
  if (Array.isArray(extracted?.key_risks) && extracted.key_risks.length) {
    out.key_risks = extracted.key_risks.map((r: string) => `• ${r}`).join('\n');
  }
  if (extracted?.technology_systems) out.technology_systems = extracted.technology_systems;
  if (extracted?.real_estate_info) out.real_estate_info = extracted.real_estate_info;

  if (Array.isArray(extracted?.key_quotes) && extracted.key_quotes.length) out.key_quotes = extracted.key_quotes;
  if (extracted?.financial_notes) out.financial_notes = extracted.financial_notes;
  if (Array.isArray(extracted?.financial_followup_questions) && extracted.financial_followup_questions.length) {
    out.financial_followup_questions = extracted.financial_followup_questions;
  }

  if (extracted?.primary_contact_name) out.primary_contact_name = extracted.primary_contact_name;
  if (extracted?.primary_contact_email) out.primary_contact_email = extracted.primary_contact_email;
  if (extracted?.primary_contact_phone) out.primary_contact_phone = extracted.primary_contact_phone;

  if (extracted?.ownership_structure) out.ownership_structure = extracted.ownership_structure;
  if (extracted?.headquarters_address) out.headquarters_address = extracted.headquarters_address;
  if (Array.isArray(extracted?.services) && extracted.services.length) out.services = extracted.services;
  if (extracted?.website) out.website = extracted.website;
  if (extracted?.location) out.location = extracted.location;
  {
    const pt = toFiniteNumber(extracted?.part_time_employees);
    if (pt != null) out.part_time_employees = pt;
  }

  // Filter to known listing columns (defensive)
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(out)) {
    if (listingKeys.has(k)) filtered[k] = v;
  }
  return filtered;
}

/**
 * Sanitize update payload — remove invalid numeric fields and placeholder strings.
 * Returns sanitized copy of the updates object.
 */
export function sanitizeListingUpdates(updates: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...updates };
  const removed: Array<{ key: string; value: unknown }> = [];
  const removedPlaceholders: Array<{ key: string; value: unknown }> = [];

  for (const [k, v] of Object.entries(sanitized)) {
    if (!NUMERIC_LISTING_FIELDS.has(k)) continue;

    // Coerce numeric strings
    if (typeof v === 'string') {
      const cleaned = v.replace(/[$,]/g, '').trim();
      const n = Number(cleaned);
      if (Number.isFinite(n)) {
        sanitized[k] = n;
        continue;
      }
    }

    if (typeof v !== 'number' || !Number.isFinite(v)) {
      removed.push({ key: k, value: v });
      delete sanitized[k];
    }
  }

  // Strip placeholder strings from ANY field
  for (const [k, v] of Object.entries(sanitized)) {
    if (typeof v === 'string' && isPlaceholder(v)) {
      removedPlaceholders.push({ key: k, value: v });
      delete sanitized[k];
    }
  }

  if (removed.length > 0) {
    console.warn('[Transcripts] Removed invalid numeric fields from updates:', removed);
  }
  if (removedPlaceholders.length > 0) {
    console.warn('[Transcripts] Removed placeholder string fields from updates:', removedPlaceholders);
  }

  return sanitized;
}
