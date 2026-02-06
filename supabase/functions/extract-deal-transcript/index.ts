import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStates, mergeStates } from "../_shared/geography.ts";
import { buildPriorityUpdates, updateExtractionSources, createFieldSource } from "../_shared/source-priority.ts";
import { callClaudeWithTool, DEFAULT_CLAUDE_MODEL } from "../_shared/ai-providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FinancialExtraction {
  value?: number;
  confidence: 'high' | 'medium' | 'low';
  is_inferred?: boolean;
  source_quote?: string;
  inference_method?: string;
}

interface ExtractionResult {
  // Financial (structured per spec)
  revenue?: FinancialExtraction;
  ebitda?: {
    amount?: number;
    margin_percentage?: number;
    confidence: 'high' | 'medium' | 'low';
    is_inferred?: boolean;
    source_quote?: string;
  };
  financial_followup_questions?: string[];
  financial_notes?: string;
  
  // Business basics
  full_time_employees?: number;
  location?: string;
  headquarters_address?: string;
  founded_year?: number;
  industry?: string;
  website?: string;
  
  // Services & Business model
  services?: string[];
  service_mix?: string;
  business_model?: string;
  
  // Geography
  geographic_states?: string[];
  number_of_locations?: number;
  
  // Owner & Transaction
  owner_goals?: string;
  transition_preferences?: string;
  special_requirements?: string;
  timeline_notes?: string;
  
  // Customers
  customer_types?: string;
  end_market_description?: string;
  customer_concentration?: string;
  customer_geography?: string;
  
  // Strategic info
  executive_summary?: string;
  competitive_position?: string;
  growth_trajectory?: string;
  key_risks?: string[];
  technology_systems?: string;
  real_estate_info?: string;
  
  // Contact info
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  
  // Metadata
  key_quotes?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth: Allow either:
    // 1. Internal service calls via x-internal-secret header (matches service role key)
    // 2. End-user calls with a valid Supabase JWT in Authorization header
    const internalSecret = req.headers.get('x-internal-secret') || '';
    const authHeader = req.headers.get('authorization') || '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : '';

    const isInternalCall = internalSecret === supabaseKey;

    if (!isInternalCall) {
      // Not an internal call — require a valid user JWT
      if (!bearer) {
        return new Response(JSON.stringify({ error: 'Missing Authorization bearer token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Also accept service role key directly in Authorization (legacy/fallback)
      if (bearer !== supabaseKey) {
        const { data: userData, error: userErr } = await supabase.auth.getUser(bearer);
        if (userErr || !userData?.user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const { transcriptId, transcriptText: providedText, dealInfo, applyToDeal = true } = await req.json();

    if (!transcriptId) {
      return new Response(
        JSON.stringify({ error: 'Missing transcriptId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch transcript text from database if not provided
    let transcriptText = providedText;
    if (!transcriptText) {
      const { data: transcript, error: fetchError } = await supabase
        .from('deal_transcripts')
        .select('transcript_text, listing_id')
        .eq('id', transcriptId)
        .single();

      if (fetchError || !transcript) {
        return new Response(
          JSON.stringify({ error: 'Transcript not found or has no text content' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      transcriptText = transcript.transcript_text;

      if (!transcriptText || transcriptText.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'Transcript has no text content to extract from' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Extracting intelligence from transcript ${transcriptId}, text length: ${transcriptText.length}`);

    // Use AI to extract intelligence
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const extractionPrompt = `You are a senior M&A analyst conducting due diligence on a potential acquisition target. You are reviewing a call transcript or meeting notes between our team and a business owner, broker, or company representative.

Your job is to extract EVERY piece of deal intelligence from this transcript. Be EXHAUSTIVE, not conservative. If something is mentioned even briefly, capture it. Read the ENTIRE transcript word by word — do not skip ANY section.

${dealInfo ? `CURRENT DEAL PROFILE (for context — update if transcript has newer/better info):
Company: ${dealInfo.company_name || 'Unknown'}
Industry: ${dealInfo.industry || 'Unknown'}
Location: ${dealInfo.location || 'Not specified'}
Revenue: ${dealInfo.revenue ? '$' + dealInfo.revenue.toLocaleString() : 'Unknown'}
EBITDA: ${dealInfo.ebitda ? '$' + dealInfo.ebitda.toLocaleString() : 'Unknown'}
` : ''}

TRANSCRIPT/NOTES TO ANALYZE:
"""
${transcriptText}
"""

---

FIELD-BY-FIELD EXTRACTION INSTRUCTIONS:

=== FINANCIAL FIELDS ===

**Revenue** (structured object):
- Extract annual revenue as a raw number in dollars (e.g., 7500000 for $7.5M).
- ALWAYS convert to raw numeric: "2 million" or "2M" or "$2M" = 2000000; "$500K" = 500000.
- If a RANGE is given ("we do about 6, 7, 8 million"), use the MIDPOINT (7000000) with confidence "medium".
- If hedged language ("roughly", "about", "around"), extract the number but set confidence to "medium".
- If inferred from employee count, industry benchmarks, or other data, set is_inferred=true and explain the inference_method.
- CRITICAL: Do NOT confuse revenue with EBITDA. Revenue = total top-line sales. EBITDA = earnings after costs.
- Include the EXACT quote where revenue was mentioned in source_quote.
- Confidence: "high" = explicit number stated; "medium" = range or hedged; "low" = inferred from indirect data.

**EBITDA** (structured object):
- Extract EBITDA (Earnings Before Interest, Taxes, Depreciation, Amortization) as a raw number.
- If they say "SDE" (Seller's Discretionary Earnings), note this is NOT EBITDA — capture the number but flag "SDE reported, not EBITDA" in financial_notes.
- If margin percentage is mentioned (e.g., "18% margins"), extract as margin_percentage (the number 18, NOT 0.18).
- If EBITDA isn't stated but revenue and margin are both known, calculate: amount = revenue × (margin/100). Set is_inferred=true.
- CRITICAL: Do NOT confuse EBITDA with revenue or SDE.

**Financial Notes**:
- Capture ALL financial context: seasonality patterns, revenue trends (growing/declining/flat), add-backs/adjustments, debt load, capex requirements, tax structure, working capital needs.
- Note any concerning items: declining revenue, customer losses, pending lawsuits, regulatory issues, one-time income.
- Include year-over-year growth rates if mentioned.

**Financial Follow-up Questions** (array):
- Generate questions for anything unclear or contradictory about financials.
- Examples: "Is the $8M figure revenue or total billings including pass-throughs?", "What are the owner add-backs beyond salary?"

=== BUSINESS OVERVIEW ===

**Executive Summary**:
- Write 3-5 sentences summarizing the COMPLETE business opportunity.
- MUST include: what the company does, approximate size (revenue and/or employees), key strengths, geographic presence, growth trajectory, and why it is attractive as an acquisition target.
- Reference SPECIFIC facts and numbers from the transcript.
- Style: Professional M&A analyst tone. No fluff. Lead with the most important fact.

**Services** (array):
- List EVERY service or product line mentioned anywhere in the transcript, even minor ones.
- Include sub-services. Example: ["fire restoration", "water restoration", "mold remediation", "roofing", "textile cleaning", "content inventory", "board-up services"]

**Service Mix**:
- Describe ALL services with revenue breakdown percentages if discussed.
- Example: "Fire restoration (40%), water restoration (35%), roofing (15%), textile cleaning and content inventory (10%). Primarily residential with growing commercial segment."

**Business Model**:
- Describe HOW the business makes money in detail.
- Include: revenue model (recurring vs project-based), pricing structure, contract types, insurance work vs direct, residential vs commercial split, average project size if mentioned.
- Example: "Project-based restoration with some recurring service contracts; insurance-driven (70%) and direct customer (30%); average project $15K-$50K; revenue recognized over project duration."

=== LOCATION & GEOGRAPHY ===

**Location**:
- Format as "City, State" (e.g., "Sellersburg, IN", "Dallas, TX").
- Map cities to states: Minneapolis=MN, Dallas=TX, Phoenix=AZ, Indianapolis=IN, Chicago=IL, etc.

**Headquarters Address**:
- Full address if mentioned. Otherwise "City, ST" format.

**Geographic States** (array):
- 2-letter US state codes ONLY: ["IN", "KY", "OH"]
- Include ALL states where they: operate, have customers, hold licenses, or plan to expand.
- If "tri-state area" is mentioned, map to the specific 3 states based on context.

**Number of Locations**:
- Count ALL physical locations: offices, branches, shops, warehouses, satellite offices.
- "One main shop plus a satellite office" = 2. Single location business = 1.

=== OWNER & TRANSACTION ===

**Owner Goals**:
- Be VERY specific about what the owner wants. Don't just say "exit strategy" — describe their exact motivations.
- Include: primary motivation (retirement, burnout, growth, health), desired deal type (full sale, majority sale, partnership), financial expectations (price, multiples mentioned), and beyond-money goals (employee welfare, legacy, community).
- Example: "Looking to create an exit strategy and partner with someone who can take the business to the next level. Wants growth capital and operational support, not just a buyout. Open to staying on 2-3 years during transition. Concerned about employees being taken care of."

**Ownership Structure**:
- How the business is owned: sole proprietor, partnership, family-owned, LLC, S-corp, multiple partners.
- Include ownership percentages if mentioned (e.g., "60/40 partnership between founder and brother").

**Transition Preferences**:
- How long the owner will stay post-acquisition, desired role, training period, flexibility.
- Example: "Willing to stay 2-3 years, flexible on role. Would prefer advisory rather than day-to-day. Wants to ensure smooth handoff of insurance adjuster relationships."

**Special Requirements**:
- Any deal breakers, must-haves, or non-negotiable requirements.
- Example: "Wants to retain all current employees, requires earnout structure, won't sell to competitors, needs to keep business name."

**Timeline Notes**:
- When they want to close, urgency factors, phases, dependencies.
- Example: "Wants to close by Q3 2025. No immediate urgency but motivated to start the process. Lease renewal in 18 months is a factor."

=== CUSTOMER INTELLIGENCE ===

**Customer Types**:
- Specific customer segments with percentages if available.
- Example: "Residential homeowners (60%), commercial property managers (25%), insurance companies (15%). Mix of direct customers and insurance referrals."

**End Market Description**:
- WHO the ultimate customers are, what they look like, how they find the company, typical customer profile.

**Customer Concentration**:
- Top customer %, top 10 concentration, key account dependencies, diversification.
- Example: "No single customer over 10% of revenue. Top 10 customers = 35% of revenue. Heavily reliant on State Farm referrals."

**Customer Geography**:
- Where customers are located, service radius, coverage area.
- Example: "Primarily serves a 50-mile radius around Indianapolis. Some commercial projects statewide."

=== STRATEGIC INTELLIGENCE ===

**Competitive Position**:
- What makes them different from competitors? Market position, reputation, years in business, certifications, unique capabilities, customer relationships, brand recognition.
- Example: "One of only 3 certified fire restoration companies in southern Indiana. 30+ years of relationships with insurance adjusters. Known for quality work and fast response times."

**Growth Trajectory**:
- Historical growth AND future growth potential with specific numbers.
- Example: "Grew from $2M to $8M over 5 years. Recently added roofing division generating $1.2M in first year. Owner believes company can reach $15M with investment in sales team and equipment."

**Key Risks** (array):
- List EVERY risk factor mentioned or implied. Be specific, not generic.
- Categories to check: key person dependency, customer concentration, regulatory exposure, seasonal patterns, workforce challenges, equipment age/condition, lease expiration, insurance company dependency, technology debt, pending litigation, supplier concentration.
- Format: ["Key person risk — owner personally manages all insurance adjuster relationships", "Seasonal — Q1 typically 30% lower revenue", "No formal CRM — customer data in owner's head", "Lease expires 2026 with no extension option"]

**Technology Systems**:
- ALL software, CRM, fleet management, scheduling, accounting, estimating tools mentioned.
- Example: "Uses Xactimate for estimating, QuickBooks for accounting, no formal CRM. Fleet tracked via GPS. Looking to implement ServiceTitan."

**Real Estate Info**:
- Owned vs leased, square footage, warehouse space, office space, lease terms, property value.
- Example: "Leases 15,000 sq ft warehouse + 3,000 sq ft office. Lease expires Dec 2026 at $8K/mo. Landlord willing to negotiate extension."

=== COMPANY BASICS ===

**Industry**: Primary industry classification (e.g., "Fire & Water Restoration", "HVAC", "Commercial Plumbing", "IT Managed Services").

**Founded Year**: Year founded. If they say "been doing this 20 years" and it's 2025, set founded_year = 2005.

**Full-time Employees**: Count ALL full-time staff mentioned: field crews, office staff, technicians, managers, sales, admin.

**Part-time Employees**: Seasonal or part-time workers if mentioned separately.

**Website**: Company website URL if mentioned.

**Primary Contact**: Name, email, and phone of the main contact person (owner, broker, or representative).

=== KEY QUOTES (CRITICAL — 8-10 VERBATIM) ===

Extract 8-10 EXACT VERBATIM quotes from the transcript. These are the most valuable data points for deal evaluation.
- Priority order: financial statements > growth indicators > owner motivation/goals > competitive advantages > risk factors > customer insights.
- Include the most insightful and revealing statements.
- Must be EXACT words from the transcript, not paraphrased.
- Examples: "We did about seven and a half million last year", "I've been wanting to find a partner who can help us get to the next level", "Our biggest risk is probably that I know all the adjusters personally"

---

IMPORTANT: You MUST populate as many fields as possible. Do not leave fields empty if there is ANY relevant information in the transcript. Use the extract_deal_info tool to return structured data.`;

    // Tool schema for Claude — descriptions kept concise since the extraction prompt already has full instructions
    const tool = {
      type: 'function',
      function: {
        name: 'extract_deal_info',
        description: 'Extract comprehensive deal intelligence from a transcript or meeting notes. Populate as many fields as possible.',
        parameters: {
          type: 'object',
          properties: {
            // === FINANCIAL (structured) ===
            revenue: {
              type: 'object',
              properties: {
                value: { type: 'number', description: 'Annual revenue in dollars (raw number, e.g., 7500000 for $7.5M). Use midpoint for ranges.' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'high=explicit, medium=hedged/range, low=inferred' },
                is_inferred: { type: 'boolean', description: 'True if calculated/inferred from other data rather than stated directly' },
                source_quote: { type: 'string', description: 'Exact verbatim quote where revenue was mentioned' },
                inference_method: { type: 'string', description: 'How value was inferred (e.g., "based on 50 employees at ~$150K revenue/employee")' }
              },
              required: ['confidence']
            },
            ebitda: {
              type: 'object',
              properties: {
                amount: { type: 'number', description: 'EBITDA in dollars (raw number). NOT SDE — flag SDE in financial_notes.' },
                margin_percentage: { type: 'number', description: 'EBITDA margin as a percentage NUMBER (e.g., 18 for 18%, NOT 0.18)' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                is_inferred: { type: 'boolean', description: 'True if calculated from revenue × margin or other indirect data' },
                source_quote: { type: 'string', description: 'Exact verbatim quote supporting the EBITDA figure' }
              },
              required: ['confidence']
            },
            financial_notes: { type: 'string', description: 'Financial context: seasonality, trends, add-backs, debt, capex, tax structure, SDE vs EBITDA notes, concerning items' },
            financial_followup_questions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Questions to clarify unclear/contradictory financial data in follow-up calls'
            },

            // === BUSINESS OVERVIEW ===
            executive_summary: { type: 'string', description: '3-5 sentences: what the company does, size (revenue/employees), strengths, geography, growth trajectory, acquisition attractiveness. Reference specific facts.' },
            services: {
              type: 'array',
              items: { type: 'string' },
              description: 'Every service/product line mentioned, including sub-services. e.g., ["fire restoration", "water restoration", "mold remediation", "roofing"]'
            },
            service_mix: { type: 'string', description: 'All services with revenue % breakdown if discussed. e.g., "Fire restoration (40%), water restoration (35%), roofing (15%), textile cleaning (10%)"' },
            business_model: { type: 'string', description: 'How they make money: recurring vs project-based, pricing, contract types, insurance vs direct, residential vs commercial split, avg project size' },

            // === LOCATION & GEOGRAPHY ===
            location: { type: 'string', description: 'City, State format. e.g., "Sellersburg, IN", "Dallas, TX"' },
            headquarters_address: { type: 'string', description: 'Full address if mentioned, otherwise City, ST' },
            geographic_states: {
              type: 'array',
              items: { type: 'string' },
              description: '2-letter US state codes for ALL states: operations, customers, licenses, expansion plans. e.g., ["IN", "KY", "OH"]'
            },
            number_of_locations: { type: 'number', description: 'Count of ALL physical locations: offices, branches, shops, warehouses, satellites' },

            // === OWNER & TRANSACTION ===
            owner_goals: { type: 'string', description: 'Primary motivation, desired deal type, financial expectations, beyond-money goals. Be very specific with their exact words.' },
            ownership_structure: { type: 'string', description: 'Sole proprietor, partnership (with %), family-owned, LLC, S-corp, etc.' },
            transition_preferences: { type: 'string', description: 'Post-acquisition stay duration, desired role, training period, flexibility, handoff plan' },
            special_requirements: { type: 'string', description: 'Deal breakers, must-haves, non-negotiables (employee retention, earnout, name preservation, etc.)' },
            timeline_notes: { type: 'string', description: 'Desired close timing, urgency factors, phases, dependencies (lease renewals, etc.)' },

            // === CUSTOMERS ===
            customer_types: { type: 'string', description: 'Customer segments with % breakdown. e.g., "Residential homeowners (60%), commercial property managers (25%), insurance referrals (15%)"' },
            end_market_description: { type: 'string', description: 'Who the end customers are, their profile, how they find the company' },
            customer_concentration: { type: 'string', description: 'Largest customer %, top 10 concentration, key account dependencies, diversification' },
            customer_geography: { type: 'string', description: 'Where customers are located, service radius, coverage area' },

            // === STRATEGIC ===
            competitive_position: { type: 'string', description: 'Differentiators, market position, certifications, unique capabilities, reputation, years in business' },
            growth_trajectory: { type: 'string', description: 'Historical growth with numbers AND future potential. e.g., "Grew from $2M to $8M over 5 years, targeting $15M"' },
            key_risks: {
              type: 'array',
              items: { type: 'string' },
              description: 'Every risk: key person, concentration, regulatory, seasonal, workforce, equipment, lease, insurance dependency, tech debt, litigation'
            },
            technology_systems: { type: 'string', description: 'All software/tools: CRM, accounting, estimating, fleet mgmt, scheduling. Note gaps.' },
            real_estate_info: { type: 'string', description: 'Owned vs leased, sq footage, lease terms/expiry, property value, landlord relationship' },

            // === COMPANY BASICS ===
            industry: { type: 'string', description: 'Primary industry: "Fire & Water Restoration", "HVAC", "IT Managed Services", etc.' },
            founded_year: { type: 'number', description: 'Year founded. If "20 years in business" and current year 2025, use 2005.' },
            full_time_employees: { type: 'number', description: 'Total FT staff: field crews + office + technicians + managers + sales + admin' },
            part_time_employees: { type: 'number', description: 'Part-time or seasonal workers if mentioned separately' },
            website: { type: 'string', description: 'Company website URL if mentioned' },

            // === CONTACT ===
            primary_contact_name: { type: 'string', description: 'Full name of main contact (owner, broker, or representative)' },
            primary_contact_email: { type: 'string', description: 'Email address if mentioned' },
            primary_contact_phone: { type: 'string', description: 'Phone number if mentioned' },

            // === KEY QUOTES (8-10 VERBATIM) ===
            key_quotes: {
              type: 'array',
              items: { type: 'string' },
              description: '8-10 EXACT verbatim quotes. Priority: financial > growth > owner motivation > competitive > risk > customer insights'
            }
          }
        }
      }
    };

    const systemPrompt = 'You are a senior M&A analyst conducting due diligence on acquisition targets. Your job is to extract EVERY piece of structured data from call transcripts and meeting notes. Be exhaustive — populate as many fields as possible. If information is mentioned even briefly, or can be reasonably inferred from context, include it. Never leave a field empty if there is any relevant information. For financial figures, always convert to raw numbers (e.g., "$7.5M" = 7500000). For key_quotes, extract 8-10 exact verbatim quotes prioritizing financial, growth, motivation, and risk statements.';

    // Call Claude API with 90s timeout for long transcripts, 8192 max tokens for detailed extraction
    const { data: extracted, error: aiError } = await callClaudeWithTool(
      systemPrompt,
      extractionPrompt,
      tool,
      anthropicApiKey,
      DEFAULT_CLAUDE_MODEL,
      90000,
      8192
    ) as { data: ExtractionResult | null; error?: { code: string; message: string } };

    if (aiError) {
      console.error('Claude API error:', aiError);
      throw new Error(`AI extraction failed: ${aiError.message}`);
    }

    if (!extracted) {
      throw new Error('No extraction result from AI');
    }

    // Normalize geographic_states using shared module
    if (extracted.geographic_states) {
      extracted.geographic_states = normalizeStates(extracted.geographic_states);
    }

    // Update the transcript with extracted data
    const { data: transcriptRecord, error: fetchError } = await supabase
      .from('deal_transcripts')
      .select('listing_id')
      .eq('id', transcriptId)
      .single();

    if (fetchError || !transcriptRecord) {
      console.error('Failed to fetch transcript record:', fetchError);
      throw new Error(`Failed to fetch transcript record: ${fetchError?.message || 'Not found'}`);
    }

    const { error: updateTranscriptError } = await supabase
      .from('deal_transcripts')
      .update({
        extracted_data: extracted,
        processed_at: new Date().toISOString(),
      })
      .eq('id', transcriptId);

    if (updateTranscriptError) {
      console.error('Error updating transcript:', updateTranscriptError);
      throw updateTranscriptError;
    }

    // ========== KEY SPEC REQUIREMENT: Apply to listings table ==========
    let dealUpdated = false;
    let fieldsUpdated: string[] = [];
    
    if (applyToDeal && transcriptRecord?.listing_id) {
      const listingId = transcriptRecord.listing_id;
      
      // Fetch current listing with extraction_sources
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('*, extraction_sources')
        .eq('id', listingId)
        .single();

      if (listingError || !listing) {
        console.error('Failed to fetch listing for enrichment:', listingError);
        throw new Error(`Failed to fetch listing ${listingId}: ${listingError?.message || 'Not found'}`);
      }

      if (listing) {
        // Flatten extracted data for priority updates
        const flatExtracted: Record<string, unknown> = {};

        const toFiniteNumber = (v: unknown): number | undefined => {
          if (typeof v === 'number' && Number.isFinite(v)) return v;
          if (typeof v === 'string') {
            const n = Number(v.replace(/[$,]/g, '').trim());
            if (Number.isFinite(n)) return n;
          }
          return undefined;
        };

        // Handle structured revenue
        {
          const revenueValue = toFiniteNumber(extracted.revenue?.value);
          if (revenueValue != null) {
            flatExtracted.revenue = revenueValue;
            flatExtracted.revenue_confidence = extracted.revenue?.confidence;
            flatExtracted.revenue_is_inferred = extracted.revenue?.is_inferred || false;
            flatExtracted.revenue_source_quote = extracted.revenue?.source_quote;
          }
        }

        // Handle structured EBITDA
        {
          const ebitdaAmount = toFiniteNumber(extracted.ebitda?.amount);
          if (ebitdaAmount != null) flatExtracted.ebitda = ebitdaAmount;

          const marginPct = toFiniteNumber(extracted.ebitda?.margin_percentage);
          if (marginPct != null) flatExtracted.ebitda_margin = marginPct / 100; // Store as decimal

          if (extracted.ebitda) {
            flatExtracted.ebitda_confidence = extracted.ebitda.confidence;
            flatExtracted.ebitda_is_inferred = extracted.ebitda.is_inferred || false;
            flatExtracted.ebitda_source_quote = extracted.ebitda.source_quote;
          }
        }

        // Map other fields
        if (extracted.geographic_states?.length) flatExtracted.geographic_states = extracted.geographic_states;
        {
          const n = toFiniteNumber(extracted.number_of_locations);
          if (n != null) flatExtracted.number_of_locations = n;
        }
        {
          const n = toFiniteNumber(extracted.full_time_employees);
          if (n != null) flatExtracted.full_time_employees = n;
        }
        {
          const n = toFiniteNumber(extracted.founded_year);
          if (n != null) flatExtracted.founded_year = n;
        }
        if (extracted.service_mix) flatExtracted.service_mix = extracted.service_mix;
        if (extracted.business_model) flatExtracted.business_model = extracted.business_model;
        if (extracted.owner_goals) flatExtracted.owner_goals = extracted.owner_goals;
        if (extracted.transition_preferences) flatExtracted.transition_preferences = extracted.transition_preferences;
        if (extracted.special_requirements) flatExtracted.special_requirements = extracted.special_requirements;
        if (extracted.customer_types) flatExtracted.customer_types = extracted.customer_types;
        if (extracted.customer_concentration) flatExtracted.customer_concentration = extracted.customer_concentration;
        if (extracted.customer_geography) flatExtracted.customer_geography = extracted.customer_geography;
        if (extracted.end_market_description) flatExtracted.end_market_description = extracted.end_market_description;
        if (extracted.executive_summary) flatExtracted.executive_summary = extracted.executive_summary;
        if (extracted.competitive_position) flatExtracted.competitive_position = extracted.competitive_position;
        if (extracted.growth_trajectory) flatExtracted.growth_trajectory = extracted.growth_trajectory;
        if (extracted.key_risks?.length) flatExtracted.key_risks = extracted.key_risks.join('\n');
        if (extracted.technology_systems) flatExtracted.technology_systems = extracted.technology_systems;
        if (extracted.real_estate_info) flatExtracted.real_estate_info = extracted.real_estate_info;
        if (extracted.key_quotes?.length) flatExtracted.key_quotes = extracted.key_quotes;
        if (extracted.financial_notes) flatExtracted.financial_notes = extracted.financial_notes;
        if (extracted.financial_followup_questions?.length) {
          flatExtracted.financial_followup_questions = extracted.financial_followup_questions;
        }
        if (extracted.primary_contact_name) flatExtracted.primary_contact_name = extracted.primary_contact_name;
        if (extracted.primary_contact_email) flatExtracted.primary_contact_email = extracted.primary_contact_email;
        if (extracted.primary_contact_phone) flatExtracted.primary_contact_phone = extracted.primary_contact_phone;
        if (extracted.industry) flatExtracted.industry = extracted.industry;
        if (extracted.website) flatExtracted.website = extracted.website;
        if (extracted.location) flatExtracted.location = extracted.location;
        if (extracted.headquarters_address) flatExtracted.headquarters_address = extracted.headquarters_address;
        if (extracted.ownership_structure) flatExtracted.ownership_structure = extracted.ownership_structure;
        if (extracted.timeline_notes) flatExtracted.timeline_notes = extracted.timeline_notes;
        if (extracted.services?.length) flatExtracted.services = extracted.services;
        {
          const n = toFiniteNumber(extracted.part_time_employees);
          if (n != null) flatExtracted.part_time_employees = n;
        }

        // SAFETY: Only update columns that actually exist on the listings row.
        // PostgREST rejects the entire update when any unknown column is present.
        const listingKeys = new Set(Object.keys(listing as Record<string, unknown>));
        const filteredExtracted: Record<string, unknown> = {};
        const droppedKeys: string[] = [];
        for (const [k, v] of Object.entries(flatExtracted)) {
          if (listingKeys.has(k)) filteredExtracted[k] = v;
          else droppedKeys.push(k);
        }
        if (droppedKeys.length > 0) {
          console.log(`Dropping ${droppedKeys.length} non-listing fields:`, droppedKeys);
        }

        // Build priority-aware updates using shared module (transcript has highest priority)
        const { updates, sourceUpdates } = buildPriorityUpdates(
          listing,
          listing.extraction_sources,
          filteredExtracted,
          'transcript',
          transcriptId
        );

        // Merge geographic_states instead of replacing
        if (updates.geographic_states && listing.geographic_states?.length > 0) {
          updates.geographic_states = mergeStates(
            listing.geographic_states,
            updates.geographic_states as string[]
          );
        }

        if (Object.keys(updates).length > 0) {
          const finalUpdates = {
            ...updates,
            enriched_at: new Date().toISOString(),
            extraction_sources: updateExtractionSources(listing.extraction_sources, sourceUpdates),
          };

          const { error: listingUpdateError } = await supabase
            .from('listings')
            .update(finalUpdates)
            .eq('id', listingId);

          if (listingUpdateError) {
            console.error('Error updating listing:', listingUpdateError);
            throw new Error(`Failed to update listing: ${listingUpdateError.message}`);
          } else {
            dealUpdated = true;
            fieldsUpdated = Object.keys(updates);
            console.log(`Updated ${fieldsUpdated.length} fields on listing:`, fieldsUpdated);
          }
        }

        // Mark transcript as applied ONLY if we actually updated the deal
        // (older runs could mark applied even when listing updates were skipped)
        if (dealUpdated) {
          await supabase
            .from('deal_transcripts')
            .update({
              applied_to_deal: true,
              applied_at: new Date().toISOString(),
            })
            .eq('id', transcriptId);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        extracted,
        fieldsExtracted: Object.keys(extracted).filter(k => extracted[k as keyof ExtractionResult] != null).length,
        dealUpdated,
        fieldsUpdated,
        message: dealUpdated 
          ? `Intelligence extracted and ${fieldsUpdated.length} fields applied to deal`
          : 'Intelligence extracted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-deal-transcript:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
