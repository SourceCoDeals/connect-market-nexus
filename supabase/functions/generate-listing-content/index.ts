/**
 * generate-listing-content: AI-generates all marketplace listing & landing page fields
 *
 * Admin-only. Collects all available deal data (transcripts, enrichment,
 * manual entries, notes, valuation) and generates comprehensive listing
 * content via Claude Sonnet — maintaining strict anonymity throughout.
 *
 * POST body:
 *   - deal_id: UUID (required)
 *   - field: optional string — if provided, only regenerate that specific field
 *           (e.g., "title", "hero_description", "description", "investment_thesis",
 *            "custom_sections", "services", "growth_drivers", etc.)
 *
 * Returns generated content as JSON (does NOT save to database).
 * The frontend uses this to pre-fill the listing editor for admin review.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';
import {
  ANTHROPIC_API_URL,
  DEFAULT_CLAUDE_MODEL,
  getAnthropicHeaders,
  fetchWithAutoRetry,
} from '../_shared/ai-providers.ts';

// ─── Types ───

interface CustomSection {
  title: string;
  description: string;
}

interface ListingContent {
  title_options: string[];
  hero_description: string;
  description: string;
  investment_thesis: string;
  custom_sections: CustomSection[];
  services: string[];
  growth_drivers: string[];
  competitive_position: string;
  ownership_structure: string;
  seller_motivation: string;
  business_model: string;
  customer_geography: string;
  customer_types: string;
  revenue_model: string;
  end_market_description: string;
}

interface DataContext {
  deal: Record<string, unknown>;
  transcriptExcerpts: string;
  enrichmentData: string;
  manualEntries: string;
  valuationData: string;
  sources: string[];
}

// ─── Banned Words ───

const BANNED_WORDS = [
  'strong',
  'robust',
  'impressive',
  'attractive',
  'compelling',
  'well-positioned',
  'significant opportunity',
  'poised for growth',
  'track record of success',
  'best-in-class',
  'proven',
  'demonstrated',
  'synergies',
  'uniquely positioned',
  'market leader',
  'value creation opportunity',
];

// ─── State-to-Region Mapping ───

const STATE_TO_REGION: Record<string, string> = {
  AL: 'Southeast',
  AK: 'Pacific Northwest',
  AZ: 'Southwest',
  AR: 'South Central',
  CA: 'West Coast',
  CO: 'Mountain West',
  CT: 'Northeast',
  DE: 'Mid-Atlantic',
  FL: 'Southeast',
  GA: 'Southeast',
  HI: 'Pacific',
  ID: 'Mountain West',
  IL: 'Midwest',
  IN: 'Midwest',
  IA: 'Midwest',
  KS: 'Central',
  KY: 'Southeast',
  LA: 'Gulf Coast',
  ME: 'New England',
  MD: 'Mid-Atlantic',
  MA: 'New England',
  MI: 'Great Lakes',
  MN: 'Upper Midwest',
  MS: 'Gulf Coast',
  MO: 'Central',
  MT: 'Mountain West',
  NE: 'Central',
  NV: 'Mountain West',
  NH: 'New England',
  NJ: 'Mid-Atlantic',
  NM: 'Southwest',
  NY: 'Northeast',
  NC: 'Southeast',
  ND: 'Upper Midwest',
  OH: 'Great Lakes',
  OK: 'South Central',
  OR: 'Pacific Northwest',
  PA: 'Mid-Atlantic',
  RI: 'New England',
  SC: 'Southeast',
  SD: 'Upper Midwest',
  TN: 'Southeast',
  TX: 'South Central',
  UT: 'Mountain West',
  VT: 'New England',
  VA: 'Mid-Atlantic',
  WA: 'Pacific Northwest',
  WV: 'Appalachian',
  WI: 'Great Lakes',
  WY: 'Mountain West',
  DC: 'Mid-Atlantic',
};

// All valid listing content fields that can be individually regenerated
const VALID_FIELDS = [
  'title',
  'hero_description',
  'description',
  'investment_thesis',
  'custom_sections',
  'services',
  'growth_drivers',
  'competitive_position',
  'ownership_structure',
  'seller_motivation',
  'business_model',
  'customer_geography',
  'customer_types',
  'revenue_model',
  'end_market_description',
];

// ─── Main Handler ───

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const auth = await requireAdmin(req, supabaseAdmin);
  if (!auth.isAdmin) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.authenticated ? 403 : 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { deal_id, field } = await req.json();

    if (!deal_id) {
      return new Response(JSON.stringify({ error: 'deal_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (field && !VALID_FIELDS.includes(field)) {
      return new Response(
        JSON.stringify({
          error: `Invalid field "${field}". Valid fields: ${VALID_FIELDS.join(', ')}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch deal data
    const { data: deal, error: dealError } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('id', deal_id)
      .single();

    if (dealError || !deal) {
      return new Response(JSON.stringify({ error: 'Deal not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch transcripts
    const { data: transcripts } = await supabaseAdmin
      .from('deal_transcripts')
      .select('transcript_text, extracted_data, call_date, title, extraction_status')
      .eq('listing_id', deal_id)
      .not('extraction_status', 'eq', 'failed')
      .order('call_date', { ascending: false })
      .limit(10);

    // Fetch valuation data
    const { data: valuationData } = await supabaseAdmin
      .from('valuation_leads')
      .select('*')
      .eq('pushed_listing_id', deal_id)
      .maybeSingle();

    // Build data context
    const dataContext = buildDataContext(deal, transcripts || [], valuationData);

    // Generate listing content via AI
    const content = await generateListingContent(anthropicApiKey, dataContext, field || null);

    return new Response(JSON.stringify({ success: true, content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Generate listing content error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate listing content',
        details: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// ─── Data Context Builder ───

function buildDataContext(
  deal: Record<string, unknown>,
  transcripts: unknown[],
  valuationData: Record<string, unknown> | null,
): DataContext {
  const sources: string[] = [];

  // Transcript excerpts (highest priority)
  let transcriptExcerpts = '';
  if (transcripts.length > 0) {
    sources.push('transcripts');
    transcriptExcerpts = transcripts
      .map(
        (
          t: {
            title?: string;
            extracted_data?: unknown;
            transcript_text?: string;
            call_date?: string;
          },
          i: number,
        ) => {
          const parts = [];
          if (t.title) parts.push(`Title: ${t.title}`);
          if (t.extracted_data)
            parts.push(`Extracted Insights: ${JSON.stringify(t.extracted_data)}`);
          if (t.transcript_text) {
            // Take first 25000 chars per transcript for comprehensive context
            parts.push(`Transcript: ${t.transcript_text.substring(0, 25000)}`);
          }
          return `--- Call ${i + 1} (${t.call_date || 'unknown date'}) ---\n${parts.join('\n')}`;
        },
      )
      .join('\n\n');
  }

  // General Notes (separate data source)
  let notesExcerpt = '';
  if (deal.internal_notes && deal.internal_notes.trim()) {
    sources.push('general_notes');
    notesExcerpt = deal.internal_notes;
  }

  // Enrichment data (website scrape + LinkedIn)
  const enrichmentFields = [
    'description',
    'executive_summary',
    'services',
    'service_mix',
    'geographic_states',
    'address_city',
    'address_state',
    'linkedin_employee_count',
    'linkedin_industry',
    'founded_year',
    'end_market_description',
    'customer_segments',
    'industry',
    'category',
    'revenue',
    'ebitda',
    'ebitda_margin',
    'employee_count',
    'number_of_locations',
  ];
  const enrichmentData = enrichmentFields
    .filter((f) => deal[f] != null && deal[f] !== '')
    .map((f) => `${f}: ${JSON.stringify(deal[f])}`)
    .join('\n');
  if (enrichmentData) sources.push('enrichment');

  // Manual data entries (structured fields entered by admin)
  const manualFields = [
    'internal_company_name',
    'title',
    'website',
    'main_contact_name',
    'main_contact_email',
    'main_contact_phone',
    'main_contact_title',
    'owner_response',
    'seller_motivation',
    'owner_goals',
    'transition_preferences',
    'revenue_breakdown',
    'asking_price',
    'valuation_multiple',
  ];
  const manualEntries = manualFields
    .filter((f) => deal[f] != null && deal[f] !== '')
    .map((f) => `${f}: ${JSON.stringify(deal[f])}`)
    .join('\n');
  if (manualEntries) sources.push('manual_entries');

  // Valuation data
  let valuationStr = '';
  if (valuationData) {
    sources.push('valuation_calculator');
    const valFields = [
      'revenue',
      'ebitda',
      'industry',
      'state',
      'years_in_business',
      'growth_rate',
      'recurring_revenue_percentage',
    ];
    valuationStr = valFields
      .filter((f) => valuationData[f] != null)
      .map((f) => `${f}: ${JSON.stringify(valuationData[f])}`)
      .join('\n');
  }

  return {
    deal,
    transcriptExcerpts,
    enrichmentData,
    manualEntries:
      manualEntries + (notesExcerpt ? `\n\n--- GENERAL NOTES ---\n${notesExcerpt}` : ''),
    valuationData: valuationStr,
    sources,
  };
}

// ─── Banned Words Enforcement ───

function enforceBannedWordsOnString(text: string): string {
  let cleaned = text;
  for (const banned of BANNED_WORDS) {
    const regex = new RegExp(`\\b${banned}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }
  // Clean up double spaces left by removals
  cleaned = cleaned.replace(/  +/g, ' ').replace(/ ,/g, ',').replace(/ \./g, '.');
  return cleaned;
}

function enforceBannedWordsOnContent(content: unknown): unknown {
  if (typeof content === 'string') {
    return enforceBannedWordsOnString(content);
  }
  if (Array.isArray(content)) {
    return content.map((item) => enforceBannedWordsOnContent(item));
  }
  if (content && typeof content === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(content)) {
      cleaned[key] = enforceBannedWordsOnContent(value);
    }
    return cleaned;
  }
  return content;
}

// ─── AI Listing Content Generation ───

async function generateListingContent(
  apiKey: string,
  context: DataContext,
  singleField: string | null,
): Promise<Partial<ListingContent>> {
  const dealState = context.deal.address_state || '';
  const regionName = STATE_TO_REGION[dealState.toUpperCase()] || 'Central';
  const projectCodename = `Project ${regionName}`;

  const fieldInstructions = singleField
    ? getSingleFieldInstruction(singleField)
    : getAllFieldsInstruction();

  const systemPrompt = `You are a VP at a buy-side investment bank preparing an anonymous listing for a marketplace. Your goal is to write listing content that will attract qualified buyers while maintaining strict anonymity about the target company.

CRITICAL ANONYMITY RULES:
- NO company name — use the codename "${projectCodename}" or generic descriptors like "the Company" or "the Business"
- NO owner/CEO name or any individual's name
- NO street address, city — refer to region only (e.g., "${regionName} U.S.")
- NO website URL, email, or phone number
- NO specific client or customer names
- Financial data as ranges only (e.g., "$8M-$10M revenue", "28%-32% EBITDA margin")
- Services described generically without identifying the specific company

WRITING STYLE RULES:
- Write in a factual, measured tone — let the data speak for itself
- Avoid superlatives and marketing language
- Use specific numbers and data points where available (as ranges)
- Be direct and concise — do not pad sentences
- ABSOLUTELY DO NOT USE any of these banned words/phrases: ${BANNED_WORDS.map((w) => `"${w}"`).join(', ')}

The company is located in the ${regionName} region of the U.S.${dealState ? ` (${dealState})` : ''}.

${fieldInstructions}

OUTPUT FORMAT:
Return ONLY a valid JSON object with the requested fields. No markdown code fences, no explanation — just the JSON.`;

  const userPrompt = `Generate ${singleField ? `the "${singleField}" field` : 'all listing content fields'} from the following company data.

=== CALL TRANSCRIPTS (highest priority — richest source of detail) ===
${context.transcriptExcerpts || 'No transcripts available.'}

=== ENRICHMENT DATA (website scrape + LinkedIn) ===
${context.enrichmentData || 'No enrichment data available.'}

=== MANUAL DATA ENTRIES & GENERAL NOTES ===
${context.manualEntries || 'No manual entries or notes.'}

=== VALUATION CALCULATOR DATA ===
${context.valuationData || 'No valuation data.'}

DATA SOURCE PRIORITY: Transcripts > General Notes > Enrichment/Website > Manual entries.
When sources conflict, prefer higher-priority sources.

Generate the listing content now. Return ONLY the JSON object.`;

  const response = await fetchWithAutoRetry(
    ANTHROPIC_API_URL,
    {
      method: 'POST',
      headers: getAnthropicHeaders(apiKey),
      body: JSON.stringify({
        model: DEFAULT_CLAUDE_MODEL,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.4,
        max_tokens: 8192,
      }),
    },
    { callerName: 'generate-listing-content', maxRetries: 2 },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const rawContent = result.content?.[0]?.text;

  if (!rawContent) {
    throw new Error('No content returned from AI');
  }

  let parsed: Partial<ListingContent>;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  // Post-process: enforce banned words removal across all string values
  const cleaned = enforceBannedWordsOnContent(parsed);

  return cleaned;
}

// ─── Field Instructions ───

function getAllFieldsInstruction(): string {
  return `Generate a comprehensive JSON object with ALL of the following fields:

{
  "title_options": [
    "string — anonymous title option 1",
    "string — anonymous title option 2",
    "string — anonymous title option 3"
  ],
  "hero_description": "string — a compelling 1-2 sentence preview of the opportunity (max 500 characters). This is the first thing a buyer sees on the marketplace card.",
  "description": "string — a detailed 3-5 paragraph anonymized description of the business. Cover what the company does, its market position, operational strengths, financial profile, and why it represents a good acquisition target. Use markdown formatting.",
  "investment_thesis": "string — 2-3 paragraphs explaining the core investment thesis: why this business is attractive to acquirers, what the key value drivers are, and what a buyer could do to accelerate growth. Use markdown formatting.",
  "custom_sections": [
    { "title": "string — section heading (e.g., Revenue Quality)", "description": "string — 1-3 paragraph detailed content for this section" },
    "...3-5 total sections covering topics like: Revenue Quality, Strategic Assets, Growth Acceleration Opportunity, Operational Infrastructure, Market Position, Workforce & Talent, Customer Relationships, etc."
  ],
  "services": ["string — core service offering 1", "...5-8 total service offerings"],
  "growth_drivers": ["string — growth opportunity 1", "...3-5 total growth opportunities"],
  "competitive_position": "string — 1-2 paragraphs describing the company's competitive advantages and market positioning",
  "ownership_structure": "string — 1-2 sentence summary of the ownership structure (e.g., founder-owned, partnership, etc.) without naming anyone",
  "seller_motivation": "string — 1-2 sentence summary of why the owner is considering a transaction",
  "business_model": "string — short label describing the business model (e.g., 'Recurring Revenue + Project-Based')",
  "customer_geography": "string — short label describing customer geography (e.g., 'Regional — Southeast U.S.')",
  "customer_types": "string — short label describing customer types (e.g., 'Commercial & Residential')",
  "revenue_model": "string — short label describing the revenue model (e.g., 'Service Contracts + T&M Projects')",
  "end_market_description": "string — 1-2 paragraphs describing the end markets served and industry dynamics"
}

IMPORTANT GUIDELINES FOR EACH FIELD:
- title_options: Generate 3 VARIED anonymous titles. Do NOT make them all follow the pattern "Established X Business in Y Region". Vary structure — use different openings, some can lead with the value proposition, industry niche, or financial profile.
- hero_description: Must be 500 characters or fewer. Should hook a buyer's interest immediately.
- custom_sections: Generate 3-5 sections. Pick the most relevant topics based on the available data. Each section should add unique insight — do not repeat content from other fields.
- services: List 5-8 specific service offerings based on the data. Be specific but anonymous.
- growth_drivers: List 3-5 concrete, actionable growth opportunities a buyer could pursue.`;
}

function getSingleFieldInstruction(field: string): string {
  const fieldDescriptions: Record<string, string> = {
    title: `Generate ONLY the "title_options" field: an array of 3 varied anonymous title options. Do NOT make them all follow the pattern "Established X Business in Y Region". Vary structure.
Return: { "title_options": ["...", "...", "..."] }`,

    hero_description: `Generate ONLY the "hero_description" field: a compelling 1-2 sentence preview of the opportunity, max 500 characters.
Return: { "hero_description": "..." }`,

    description: `Generate ONLY the "description" field: a detailed 3-5 paragraph anonymized description of the business. Cover what the company does, its market position, operational strengths, financial profile, and why it represents a good acquisition target. Use markdown formatting.
Return: { "description": "..." }`,

    investment_thesis: `Generate ONLY the "investment_thesis" field: 2-3 paragraphs explaining the core investment thesis. Use markdown formatting.
Return: { "investment_thesis": "..." }`,

    custom_sections: `Generate ONLY the "custom_sections" field: an array of 3-5 objects with {title, description}. Pick the most relevant topics based on the data (e.g., Revenue Quality, Strategic Assets, Growth Acceleration Opportunity, Operational Infrastructure, Market Position, etc.).
Return: { "custom_sections": [{"title": "...", "description": "..."}, ...] }`,

    services: `Generate ONLY the "services" field: an array of 5-8 core service offerings. Be specific but anonymous.
Return: { "services": ["...", "...", ...] }`,

    growth_drivers: `Generate ONLY the "growth_drivers" field: an array of 3-5 concrete, actionable growth opportunities a buyer could pursue.
Return: { "growth_drivers": ["...", "...", ...] }`,

    competitive_position: `Generate ONLY the "competitive_position" field: 1-2 paragraphs describing competitive advantages and market positioning.
Return: { "competitive_position": "..." }`,

    ownership_structure: `Generate ONLY the "ownership_structure" field: 1-2 sentence summary of the ownership structure without naming anyone.
Return: { "ownership_structure": "..." }`,

    seller_motivation: `Generate ONLY the "seller_motivation" field: 1-2 sentence summary of why the owner is considering a transaction.
Return: { "seller_motivation": "..." }`,

    business_model: `Generate ONLY the "business_model" field: a short label (e.g., "Recurring Revenue + Project-Based").
Return: { "business_model": "..." }`,

    customer_geography: `Generate ONLY the "customer_geography" field: a short label (e.g., "Regional — Southeast U.S.").
Return: { "customer_geography": "..." }`,

    customer_types: `Generate ONLY the "customer_types" field: a short label (e.g., "Commercial & Residential").
Return: { "customer_types": "..." }`,

    revenue_model: `Generate ONLY the "revenue_model" field: a short label (e.g., "Service Contracts + T&M Projects").
Return: { "revenue_model": "..." }`,

    end_market_description: `Generate ONLY the "end_market_description" field: 1-2 paragraphs describing the end markets served and industry dynamics.
Return: { "end_market_description": "..." }`,
  };

  return (
    fieldDescriptions[field] ||
    `Generate ONLY the "${field}" field. Return it wrapped in a JSON object: { "${field}": ... }`
  );
}
