import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStates, mergeStates } from "../_shared/geography.ts";
import { buildPriorityUpdates, updateExtractionSources, createFieldSource } from "../_shared/source-priority.ts";
import { callGeminiWithTool, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

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
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const extractionPrompt = `You are a senior M&A analyst conducting due diligence on a potential acquisition target. You are reviewing a call transcript or meeting notes between our team and a business owner, broker, or company representative.

Your job is to extract EVERY piece of deal intelligence from this transcript. Be EXHAUSTIVE, not conservative. If something is mentioned even briefly, capture it. Read the ENTIRE transcript word by word — do not skip ANY section. Owners reveal critical information throughout the conversation, not just when directly asked.

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

# FIELD-BY-FIELD EXTRACTION INSTRUCTIONS

## SECTION 1: FINANCIALS

### Revenue (structured object)

Search the entire transcript for any mention of revenue, sales, top-line, gross revenue, annual revenue, run rate, or total sales. Apply these rules in order:

1. **Exact number stated:** "we do $8 million a year" → value=8000000, confidence="high", is_inferred=false.
2. **Range given:** "somewhere between 5 and 7 million" → use MIDPOINT (6000000), confidence="medium". Include exact range in source_quote.
3. **Approximate/hedged language:** "about", "roughly", "around", "ballpark" with a single number → use that number, confidence="medium".
4. **Inferred from other data:** "20% EBITDA margins on $1.2M EBITDA" → revenue ≈ $6M. OR "500 jobs/year at $15K average" → $7.5M. Set is_inferred=true, explain math in inference_method.
5. **Multiple revenue figures at different times:** "we did $5M last year but tracking to $7M this year" → use MOST CURRENT figure. Note historical in inference_method.
6. **Not mentioned:** value=null, confidence="low", source_quote=null.

**Common mistakes to avoid:**
- Do NOT confuse revenue with EBITDA, profit, or cash flow.
- Do NOT confuse a single project value with annual revenue.
- Do NOT use enterprise value or asking price as revenue.
- "We bill about $600K a month" → ANNUALIZE to $7,200,000.
- Always store as a raw number with no dollar signs, commas, or abbreviations.

### EBITDA (structured object)

Search for EBITDA, earnings, cash flow, profit, margin, SDE, owner's benefit, adjusted earnings, or net income.

1. **EBITDA stated directly:** "our EBITDA is $1.5 million" → amount=1500000, confidence="high".
2. **Margin stated directly:** "we run at about 18% margins" → margin_percentage=18. If revenue known, calculate amount = revenue × (margin/100), set is_inferred=true.
3. **Margin calculable:** If both revenue and EBITDA stated, calculate margin_percentage = (EBITDA / revenue) × 100.
4. **SDE vs EBITDA:** If speaker says SDE/"seller's discretionary earnings"/"owner's benefit", use that number but note in financial_notes: "Figure represents SDE, not adjusted EBITDA. SDE includes owner compensation."
5. **Adjusted vs unadjusted:** Always prefer ADJUSTED figure. Note which was used in inference_method.
6. **Ranges/approximations:** Same as revenue — midpoint for ranges, confidence="medium" for hedged.

**Common mistakes to avoid:**
- Do NOT confuse gross margin with EBITDA margin.
- Do NOT use revenue as EBITDA.
- "We keep about 20 cents on every dollar" → margin_percentage=20.
- "After I pay myself $300K, the business throws off another $800K" — this is likely SDE territory. Flag it.

### Financial Notes (string — detailed paragraph)

Scan the ENTIRE transcript for financial context beyond revenue/EBITDA. Include ALL of the following if mentioned:
- **Seasonality:** "70% of revenue comes Q2-Q3", "December is dead month"
- **Revenue trends:** "Revenue grown 15% YoY for 3 years", "down year in 2023"
- **One-time items:** "$500K insurance claim inflated last year", "bought new fleet — unusual capex"
- **Owner compensation:** ALWAYS capture this — "I pay myself $250K plus car and health insurance." Affects SDE/EBITDA adjustments.
- **Add-backs:** Personal expenses through business, one-time legal, family on payroll not working full-time, above-market rent to related entity
- **Debt/liens:** Business debt, SBA loans, equipment financing, lines of credit
- **Pending changes:** "Just signed $2M contract starting next quarter", "about to lose biggest customer"
- **Capex:** Equipment needs, deferred maintenance
- **Tax structure:** S-corp, C-corp, LLC, sole proprietor — how taxes affect reported earnings
- **Working capital needs:** AR/AP cycles, inventory requirements

If NOTHING beyond revenue/EBITDA mentioned: "No additional financial context provided in this call."

### Financial Follow-up Questions (array)

Generate questions for ACTUAL gaps — do NOT include all of these every time:
1. Revenue not stated/vague → "Can you provide TTM revenue?"
2. EBITDA not stated → "What is your adjusted EBITDA or SDE?"
3. Margins unusually high (>30%) or low (<5%) → "Can you walk through major cost categories?"
4. Revenue and EBITDA seem contradictory → point out the math
5. No owner compensation mentioned → "What is total owner compensation including salary, benefits, personal expenses?"
6. Growth claims without numbers → "Can you share revenue for each of the last 3 years?"
7. SDE used instead of EBITDA → "What owner compensation is included in the SDE figure?"
8. Unclear gross vs net → "Is that gross revenue or net revenue after returns/refunds?"
If financials are comprehensive and clear, return empty array.

## SECTION 2: EXECUTIVE SUMMARY (string — 3-5 sentences)

Write a summary a PE investor could scan in 30 seconds. MUST include ALL available:
1. **What the company does** — primary services/products in plain language
2. **Size indicators** — revenue, EBITDA, employee count (use whichever are available)
3. **Geographic presence** — where they operate, locations, service radius
4. **Key strengths** — recurring revenue, long relationships, certifications, proprietary processes, reputation
5. **Growth trajectory** — how fast they've grown AND where they could go with investment
6. **Acquisition attractiveness** — platform opportunity? strong add-on? geographic gap filler?

**Style rules:**
- Write in third person ("The company..." not "They...").
- Use SPECIFIC numbers from the transcript, not vague language.
- Do NOT include risks in executive summary — that goes elsewhere.
- Do NOT include owner goals/transition preferences here.
- Lead with the most compelling aspect.

**Example:** "ABC Restoration is a $8.2M revenue fire and water restoration company based in Sellersburg, IN, operating across southern Indiana and the Louisville metro area. The company employs 45 full-time staff across two locations and generates approximately $1.5M in adjusted EBITDA (18% margins). Founded in 2005, the business has grown from $2M to $8.2M over five years, driven by expansion into roofing and a growing commercial segment. The company holds IICRC certifications, maintains preferred vendor relationships with three major insurance carriers, and has built a strong regional reputation. This represents an attractive platform opportunity in the fragmented restoration services market with clear organic growth levers and add-on acquisition potential."

## SECTION 3: SERVICES & BUSINESS MODEL

### Services (array of strings)

List EVERY distinct service/product mentioned ANYWHERE in the transcript — not just the "what do you do" section. Owners reveal additional services casually later.
- Listen for direct statements: "We do X, Y, and Z."
- Listen for indirect mentions: "We also started doing roofing about two years ago"
- Listen for sub-services: If "restoration" → does that mean fire, water, mold, storm, smoke, or all?
- Listen for ancillary services: "We have our own textile cleaning facility"
- Mark planned services: "commercial HVAC (planned)"
- Use lowercase except proper nouns. Be specific: "fire restoration" not "restoration".
- Include sub-services as SEPARATE items: ["fire restoration", "water restoration", "mold remediation"] NOT ["restoration"]

### Service Mix (string — detailed paragraph)

1. **Primary services with revenue percentages** if owner gave them: "Fire restoration ~40%, water restoration ~35%"
2. **How services interrelate:** "Water damage calls frequently lead to mold remediation, creating natural cross-sell"
3. **Residential vs commercial split** if mentioned
4. **Recurring vs project-based split** if mentioned
5. **In-house vs subcontracted** for each service
6. **Recently added or planned services**
If owner didn't provide percentage breakdowns, say so explicitly. Do NOT make up percentages.

### Business Model (string — detailed paragraph)

Describe HOW the business makes money (different from WHAT services they offer):
1. **Revenue model:** Project-based? Recurring contracts? Subscription? Retainer? T&M? Fixed bid?
2. **How they get paid:** Insurance claims? Direct from customer? Government? Property management?
3. **Pricing structure:** Per square foot? Xactimate estimates? Competitive bid? Cost-plus?
4. **Residential vs commercial** with detail on how model differs
5. **Average job size** if mentioned
6. **Sales cycle:** Lead to closed job timeline. How customers find them.
7. **Contract structure:** Long-term contracts, preferred vendor agreements, MSAs?
8. **Repeat business:** What % from repeat customers or ongoing relationships?

## SECTION 4: GEOGRAPHIC COVERAGE

### Location (string — "City, ST" format)
Primary location/headquarters. Use suburb name if mentioned ("Sellersburg, IN" not "Louisville area"). If home-based, use owner's stated city. If multiple locations, use first mentioned or described as "main."

### Headquarters Address (string or null)
Only populate if specific STREET ADDRESS mentioned. Do NOT guess or look up.

### Geographic States (array of 2-letter codes)
Include EVERY state where company: operates, has customers, holds licenses, or plans to expand.
- Map ALL city mentions to states: Minneapolis→MN, Dallas→TX, Louisville→KY, Nashville→TN, etc.
- "Licensed in six states" → identify all six from context.
- Past project mentions: "big job in St. Louis" → MO.
- Future plans: "expanding into Tennessee" → include TN.
- ALWAYS include home state.

### Number of Locations (integer)
Count ALL: offices, shops, warehouses, branches, satellites, storage facilities (owned + leased).
- Home office = 1 if only location
- "Two shops and a warehouse" = 3
- Do NOT count job sites or temporary project locations

## SECTION 5: OWNER GOALS & TRANSITION

### Owner Goals (string — detailed paragraph)
This is one of the MOST IMPORTANT fields for buyer matching. Include:
1. **Primary motivation:** Retirement? Growth capital? Burnout? Health? Partner buyout? Estate planning? "Take chips off the table"?
2. **Desired deal type:** Full sale? Majority recap? Minority investment? Strategic partner? Merger?
3. **Financial expectations:** Valuation expectations? Multiple mentioned? "Walk away with $X"?
4. **Beyond-money goals:** Legacy preservation? Employee retention? Brand name? Continued involvement? Community impact?
5. **Owner's exact words** where possible: Include their actual quotes.
Do NOT editorialize or interpret. Report what the owner actually said. If vague ("just exploring options"), say that.

### Ownership Structure (string)
- Entity type: LLC, S-corp, C-corp, sole proprietorship, partnership
- Number of owners with percentages if stated
- Family involvement: "Husband and wife 50/50", "Father founded, son runs it"
- Silent partners or investors
- Employee equity if mentioned
- Trust or estate structures
If not discussed: "Ownership structure not discussed on this call."

### Transition Preferences (string — detailed paragraph)
1. **Duration:** How long will they stay? "1-2 years" or "out in 90 days"
2. **Role:** Full-time? Part-time? Advisory? Operations? Sales?
3. **Willing vs not willing:** "Help with customer relationships but not day-to-day operations"
4. **Key relationships held:** Customer/vendor relationships only the owner manages (transition risk)
5. **Training plan:** Knowledge transfer readiness, is there a #2 in place?
6. **Non-compete willingness**
If not discussed: "Transition preferences not discussed on this call."

### Special Requirements (string or null)
Deal-breakers, must-haves, non-negotiables. CRITICAL for buyer matching:
- "Will NOT sell to a competitor"
- "All employees must keep jobs"
- "Need an earnout"
- "Buyer has to be local"
- "Won't consider below 5x EBITDA"
- "Partner has to agree"
- "Need to close before year-end for tax reasons"
If none mentioned, set to null.

### Timeline Notes (string or null)
- Desired close date: "Done by Q4"
- Urgency factors: Health, lease expiration, key employee leaving, partner pressure, market timing
- Constraints: "After busy season", "Contract renews in March"
- Previous attempts: "Tried to sell two years ago"
- Broker timelines: "On market by June"
If not discussed, set to null.

## SECTION 6: CUSTOMERS

### Customer Types (string — detailed paragraph with percentages)
1. **Segments with percentages** if provided: "Residential homeowners (60%), commercial property managers (25%), insurance companies (15%)"
2. **Description of each segment:** Who specifically? Large enterprises? Small businesses? Homeowners?
3. **How segments behave differently:** Residential one-time vs commercial ongoing contracts?
4. **Growing vs shrinking segments**
5. **Segments they want to grow into**
If no percentages: describe qualitatively and note "Specific revenue breakdown by segment not provided."

### End Market Description (string)
Describe ultimate end customers — who uses/benefits from the service (can differ from who pays). Include: typical customer profile, how they find the company, what triggers their need, decision-making process.

### Customer Concentration (string — detailed text)
Assess concentration risk:
1. **Largest single customer %:** "Biggest customer is ~15% of revenue"
2. **Top 5/10 concentration:** "Top 10 = ~40% of revenue"
3. **Key account dependencies:** "Losing ServiceMaster contract = $2M hit"
4. **Insurance/government dependencies:** "80% of work through State Farm and Allstate"
5. **Contractual vs at-will**
If not discussed: "Customer concentration not discussed. Recommend follow-up."

### Customer Geography (string)
- Service radius: "50-mile radius around Indianapolis"
- Coverage map: "All of southern Indiana and Louisville metro"
- Remote/national accounts
- Urban vs rural mix
- Geographic expansion plans

## SECTION 7: STRATEGIC ANALYSIS

### Competitive Position (string — detailed paragraph)
Pull from ANYWHERE in the transcript — owners reveal advantages indirectly:
1. **Market position:** Leader? Niche? Low-cost? Premium?
2. **Reputation:** "20 years, 4.9 Google rating"
3. **Certifications/credentials:** IICRC, ISO, trade licenses, preferred vendor status
4. **Unique capabilities:** Proprietary processes, specialized equipment, in-house capabilities competitors outsource
5. **Customer relationships:** "Customers for 15+ years"
6. **Barriers to entry:** What would it take to replicate?
7. **Named competitors** and how they compare

### Growth Trajectory (string — detailed paragraph, TWO parts)
**Part 1 — Historical (what HAS happened):**
- Revenue over time: "Grew from $2M to $8M over 5 years"
- Employee growth: "10 employees 3 years ago, 45 now"
- New services, locations, markets added
- Key inflection points: "Took off after State Farm contract in 2020"

**Part 2 — Future potential (what COULD happen):**
- Owner's view: "Can be a $15M business with right partner"
- Specific growth levers: geographic expansion, adding services, hiring sales, commercial growth
- What's holding them back: "Can't grow faster because I manage everything"
- Acquisition opportunities: "Two smaller competitors I could acquire"
Use SPECIFIC NUMBERS. Do not generalize.

### Key Risks (array of specific strings)
List EVERY risk — both explicit AND inferred. Tag inferred with "(inferred)":
- **Key person dependency:** Owner holds sales/operations/relationships?
- **Customer concentration:** Any customer >15% of revenue?
- **Workforce:** Hiring difficulty, turnover, skilled labor reliance, union?
- **Regulatory/licensing:** Compliance requirements, license renewals?
- **Seasonality:** Revenue concentrated in certain months?
- **Technology:** Outdated systems, no CRM, manual processes?
- **Lease/real estate:** Expiration, above-market rent to related party?
- **Insurance dependency:** Carrier relationships that could change?
- **Equipment age:** Fleet/equipment needing replacement?
- **Litigation:** Pending or past lawsuits?
- **Environmental:** Contamination, hazmat, EPA?
- **Supplier dependency:** Single-source suppliers?
- **Succession gap:** No clear #2 beyond owner?
Be SPECIFIC: "Owner personally manages all insurance adjuster relationships, creating key person risk" NOT just "Key person risk."

### Technology Systems (string — organized by category)
List EVERY tool mentioned. Organize by category:
- **Accounting:** QuickBooks, Xero, Sage, etc.
- **CRM:** Salesforce, HubSpot, "we use a spreadsheet", "we don't have one"
- **Estimating:** Xactimate, PlanSwift, custom spreadsheets
- **Scheduling/dispatch:** ServiceTitan, Jobber, Housecall Pro
- **Fleet management:** GPS tracking, fuel cards
- **Communication:** Slack, Teams, email-only
- **Industry-specific:** Specialized tools for their trade
- **Marketing:** WordPress, Google Ads, SEO provider
ABSENCE of systems is just as important: "No formal CRM" or "Everything managed through spreadsheets."

### Real Estate Info (string or null)
- **Owned vs leased** for each location
- **Square footage:** offices, shops, warehouses
- **Lease terms:** Monthly rent, expiration, renewal options, related-party leases
- **Property value** if owned and mentioned
- **Zoning or special use permits**
- **Real estate plans:** "Sell building separately", "Buyer assumes lease"
- **Equipment stored on-site** affecting space needs
If not discussed, set to null.

## SECTION 8: COMPANY BASICS

### Industry (string)
Use MOST SPECIFIC category: "Fire & Water Restoration" NOT "Restoration" or "Construction". "Commercial HVAC Services" NOT "HVAC". If spans multiple, lead with largest revenue contributor.

### Founded Year (integer)
"Started in 2005" → 2005. "Been around 20 years" → calculate from current year. "Dad started it in the '80s" → estimate and note.

### Full-time Employees (integer)
Count ALL FT staff. Owners mention employees in fragments — add them up:
- "12 guys in field and 3 in office" = 15 (+ owner if FT = 16)
- "4 crews of 3" = 12 field minimum
- "About 40-45 people" → use 43 (midpoint)
- Do NOT include subcontractors unless owner explicitly counts them

### Part-time Employees (integer or null)
Seasonal/temporary/part-time. "10 extra guys in summer" = 10. "Part-time bookkeeper" = 1.

### Website (string or null)
Full URL format: "https://www.example.com". If company name mentioned but no URL, leave null — do NOT guess.

### Primary Contact
Name, email, phone of main contact person (usually the speaker). Note their role (owner, broker, CEO, partner).

## SECTION 9: KEY QUOTES (8-10 EXACT VERBATIM)

Select the 8-10 most revealing quotes — the "highlights reel" a buyer scans to understand the opportunity.
Priority order:
1. **Financial specifics:** "We did $8.2 million last year with about $1.5 million in EBITDA."
2. **Growth statements:** "I honestly think this could be a $15 million business with the right investment."
3. **Owner motivation:** "I'm 62 and I've been doing this for 30 years. I want to enjoy my grandkids."
4. **Competitive advantages:** "We're the only company in the region that handles fire, water, AND roofing in-house."
5. **Risk revelations:** "If I got hit by a bus tomorrow, I'm honestly not sure the business could run without me."
6. **Customer insights:** "State Farm sends us probably 60% of our work."
7. **Operational details:** "We just invested $500K in a new textile cleaning facility."
8. **Deal preferences:** "I'm not looking for a full buyout — I want a partner who can bring capital and expertise."

**Rules:**
- MUST be exact verbatim quotes — NOT paraphrased
- Include enough context that quote makes sense standalone (2-3 sentences OK)
- Do NOT include small talk, pleasantries, or filler
- Do NOT include quotes from the interviewer — only from the business owner/seller

---

## GLOBAL RULES (apply to ALL fields):

1. **Search the ENTIRE transcript.** A question about employees might prompt a revenue disclosure. A question about customers might reveal geography.
2. **Use exact quotes for source_quote fields.** Copy-paste exact words. Do not paraphrase.
3. **When data conflicts, use the most specific and most recent statement.** "$7M" early → "$7.2M" later when more precise → use $7.2M.
4. **When data is missing, say so explicitly.** Never fabricate. Use null for structured fields, "Not discussed on this call" for text fields.
5. **Flag inconsistencies.** Owner says 45 employees but describes only 3 crews of 3 → note discrepancy.
6. **Numbers as raw integers.** 8000000 not "$8M" or "8,000,000".
7. **Percentages as numbers.** 18 not "18%" or 0.18. (margin_percentage=18 means 18%)
8. **State codes: 2-letter uppercase.** "IN" not "Indiana".
9. **Don't over-extract.** Jokes or hypotheticals are not data points.
10. **Prioritize accuracy over completeness.** Null is better than wrong. Wrong data causes bad buyer matches.

IMPORTANT: Populate as MANY fields as possible with MAXIMUM DETAIL. Use the extract_deal_info tool to return structured data.`;

    // Tool schema — descriptions reinforce the prompt rules with format specs
    const tool = {
      type: 'function',
      function: {
        name: 'extract_deal_info',
        description: 'Extract comprehensive deal intelligence from a transcript or meeting notes. Populate as many fields as possible with maximum detail. Every field should have rich, specific content — not generic summaries.',
        parameters: {
          type: 'object',
          properties: {
            // === FINANCIAL (structured) ===
            revenue: {
              type: 'object',
              properties: {
                value: { type: 'number', description: 'Annual revenue as raw integer (8000000 not "$8M"). Annualize monthly ("$600K/mo"→7200000). Use midpoint for ranges.' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'high=explicit stated, medium=range/hedged/approximate, low=inferred from indirect data' },
                is_inferred: { type: 'boolean', description: 'True if calculated from other data (e.g., employee count × industry benchmark, or EBITDA ÷ margin)' },
                source_quote: { type: 'string', description: 'EXACT verbatim quote where revenue was mentioned. Copy-paste, do not paraphrase.' },
                inference_method: { type: 'string', description: 'Explain calculation if inferred. E.g., "500 jobs/yr × $15K avg = $7.5M". Null if not inferred.' }
              },
              required: ['confidence']
            },
            ebitda: {
              type: 'object',
              properties: {
                amount: { type: 'number', description: 'EBITDA as raw integer. If SDE stated, use that number but flag in financial_notes. If only "net income" or "profit" or "bottom line" is mentioned, use that as EBITDA and flag in financial_notes. Prefer adjusted over unadjusted.' },
                margin_percentage: { type: 'number', description: 'EBITDA margin as percentage NUMBER: 18 means 18%. NOT 0.18. Calculate from revenue if both known.' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                is_inferred: { type: 'boolean', description: 'True if calculated from revenue × margin or other indirect method' },
                source_quote: { type: 'string', description: 'EXACT verbatim quote. "We keep about 20 cents on every dollar" → margin_percentage=20.' }
              },
              required: ['confidence']
            },
            financial_notes: { type: 'string', description: 'DETAILED paragraph: seasonality patterns, YoY trends, owner compensation (ALWAYS capture), add-backs, debt/SBA loans, capex needs, tax structure (S-corp/C-corp/LLC), working capital, one-time items, pending changes. If SDE reported instead of EBITDA, explain here.' },
            financial_followup_questions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Only questions for ACTUAL gaps. Empty array if financials are clear and comprehensive.'
            },

            // === EXECUTIVE SUMMARY ===
            executive_summary: { type: 'string', description: '3-5 sentences for PE investor. MUST include: what company does, size (revenue + employees), strengths, geography, growth trajectory, acquisition attractiveness. Third person. Specific numbers. No risks or owner goals here. Lead with most compelling fact. See example in prompt.' },

            // === SERVICES & BUSINESS MODEL ===
            services: {
              type: 'array',
              items: { type: 'string' },
              description: 'EVERY service as separate items. Include sub-services individually. Lowercase. Mark planned with "(planned)". E.g., ["fire restoration", "water restoration", "mold remediation", "roofing", "content pack-out", "board-up services", "commercial HVAC (planned)"]'
            },
            service_mix: { type: 'string', description: 'DETAILED paragraph: services with revenue %, how they interrelate (cross-sell), residential/commercial split, recurring/project split, in-house vs subcontracted, recently added/planned. If no % given, state that explicitly.' },
            business_model: { type: 'string', description: 'DETAILED paragraph: revenue model (recurring/project/subscription), how they get paid (insurance/direct/government), pricing structure (per sq ft/Xactimate/bid), res/com differences, avg job size, sales cycle, contract types (MSAs/preferred vendor), repeat business %.' },

            // === LOCATION & GEOGRAPHY ===
            location: { type: 'string', description: 'Primary HQ in "City, ST" format. Use suburb not metro ("Sellersburg, IN" not "Louisville area").' },
            headquarters_address: { type: 'string', description: 'Full street address ONLY if explicitly mentioned. Otherwise "City, ST". Do NOT guess.' },
            geographic_states: {
              type: 'array',
              items: { type: 'string' },
              description: '2-letter codes for ALL states: operations, customers, licenses, expansion plans. Map city mentions to states. Always include home state. E.g., ["IN", "KY", "OH", "TN"]'
            },
            number_of_locations: { type: 'number', description: 'ALL physical locations (offices+shops+warehouses+satellites). Home office=1. "Two shops and warehouse"=3. NOT job sites.' },

            // === OWNER & TRANSACTION ===
            owner_goals: { type: 'string', description: 'DETAILED paragraph: primary motivation (retirement/burnout/growth/health), desired deal type (full sale/recap/partnership), financial expectations (price/multiples), beyond-money goals (legacy/employees/brand). Include owner\'s EXACT WORDS. Do NOT editorialize.' },
            ownership_structure: { type: 'string', description: 'Entity type, # of owners with %, family involvement, silent partners, employee equity, trust/estate. If not discussed: "Ownership structure not discussed on this call."' },
            transition_preferences: { type: 'string', description: 'DETAILED: stay duration, desired role (FT/PT/advisory), willing vs not willing, key relationships held (transition risk), training plan, #2 in place?, non-compete. If not discussed: "Transition preferences not discussed on this call."' },
            special_requirements: { type: 'string', description: 'Deal-breakers and must-haves: employee retention, earnout, no competitors, local buyer, minimum multiple, partner approval, tax timing. Null if none mentioned.' },
            timeline_notes: { type: 'string', description: 'Close date target, urgency factors (health/lease/employee), constraints (seasonality), previous sale attempts, broker timelines. Null if not discussed.' },

            // === CUSTOMERS ===
            customer_types: { type: 'string', description: 'DETAILED paragraph: segments with % breakdown, description of each segment, how they behave differently, growing/shrinking segments, planned new segments. If no %: note "breakdown not provided" and describe qualitatively.' },
            end_market_description: { type: 'string', description: 'Ultimate end customers: who they are, profile, how they find company, what triggers need, decision process. May differ from who pays (e.g., insurance pays but homeowner is end market).' },
            customer_concentration: { type: 'string', description: 'DETAILED text: largest customer %, top 5/10 concentration, key account dependencies, insurance/government dependencies, contractual vs at-will. If not discussed: "Customer concentration not discussed. Recommend follow-up."' },
            customer_geography: { type: 'string', description: 'Service radius, coverage map, national accounts, urban/rural mix, geographic expansion plans for customer reach.' },

            // === STRATEGIC ===
            competitive_position: { type: 'string', description: 'DETAILED paragraph: market position (leader/niche/premium), reputation + years, certifications (IICRC/ISO/licenses), unique capabilities, customer relationship depth, barriers to entry, named competitors and comparison.' },
            growth_trajectory: { type: 'string', description: 'DETAILED paragraph in TWO parts: (1) Historical — revenue over time with numbers, employee growth, new services/locations, inflection points. (2) Future — owner\'s view with specific targets, growth levers, what\'s holding them back, acquisition opportunities. Use SPECIFIC NUMBERS.' },
            key_risks: {
              type: 'array',
              items: { type: 'string' },
              description: 'EVERY risk, SPECIFIC not generic. Tag inferred: "(inferred)". Check: key person, customer concentration, workforce, regulatory, seasonal, technology debt, lease/RE, insurance dependency, equipment age, litigation, environmental, supplier, succession gap. Format: "Key person risk — owner personally manages all insurance adjuster relationships"'
            },
            technology_systems: { type: 'string', description: 'ALL tools organized by category: Accounting (QuickBooks etc), CRM (Salesforce/none), Estimating (Xactimate), Scheduling (ServiceTitan), Fleet (GPS), Communication, Industry-specific, Marketing. Note ABSENCE of systems too.' },
            real_estate_info: { type: 'string', description: 'Each location: owned/leased, sq footage, lease terms (rent/expiry/renewal/related-party), property value if owned, zoning, RE plans ("sell separately"/"buyer assumes lease"), equipment stored. Null if not discussed.' },

            // === COMPANY BASICS ===
            industry: { type: 'string', description: 'MOST SPECIFIC category: "Fire & Water Restoration" not "Restoration". "Commercial HVAC Services" not "HVAC". If multi-industry, lead with largest.' },
            founded_year: { type: 'number', description: 'Year. "20 years in business" + current year 2026 → 2006. "Dad started in the 80s" → estimate (1985).' },
            full_time_employees: { type: 'number', description: 'ALL FT staff summed: field crews + office + techs + mgmt + sales + admin + owner if FT. "12 field + 3 office" = 15 + owner = 16. Midpoint for ranges.' },
            part_time_employees: { type: 'number', description: 'Seasonal/PT only. "10 extra in summer"=10. Null if not mentioned.' },
            website: { type: 'string', description: 'Full URL: "https://www.example.com". Do NOT guess from company name. Null if not mentioned.' },

            // === CONTACT ===
            primary_contact_name: { type: 'string', description: 'Full name of main contact person from the call (owner, broker, CEO, partner).' },
            primary_contact_email: { type: 'string', description: 'Email if mentioned at any point (often beginning/end of call). Null if not.' },
            primary_contact_phone: { type: 'string', description: 'Phone if mentioned. Null if not.' },

            // === KEY QUOTES (8-10 VERBATIM) ===
            key_quotes: {
              type: 'array',
              items: { type: 'string' },
              description: '8-10 EXACT verbatim quotes (NOT paraphrased). Priority: financial specifics > growth > owner motivation > competitive advantages > risk revelations > customer insights > operational details > deal preferences. Only from the seller/owner, not the interviewer. Include enough context for standalone reading.'
            }
          }
        }
      }
    };

    const systemPrompt = `You are a senior M&A analyst at an investment bank conducting due diligence on lower-middle-market acquisition targets (typically $500K–$10M EBITDA businesses). Your job is to extract EVERY piece of structured data from this call transcript.

CORE RULES:

1. EXHAUSTIVE EXTRACTION: Read the ENTIRE transcript from start to finish. Owners reveal critical information throughout the conversation — not just when directly asked. A question about employees might prompt a revenue disclosure. A question about customers might reveal geographic information. Do NOT stop scanning after the first mention of a topic.

2. ACCURACY OVER COMPLETENESS: It is better to return null than to return wrong data. Wrong data in the deal page causes bad buyer matches and wastes everyone's time. If information was not stated or cannot be reasonably calculated, use null. Never fabricate, guess, or fill in data that was not mentioned.

3. NUMBERS AS RAW INTEGERS: All dollar amounts must be stored as raw numbers with no formatting. "$7.5M" = 7500000. "about two million" = 2000000. "six hundred thousand" = 600000. Never return "$7.5M" or "7,500,000" or "$7.5 million."

4. PERCENTAGES AS INTEGERS: margin_percentage=18 means 18%. Do NOT use 0.18. The application layer converts to decimal.

5. STATE CODES: Always 2-letter uppercase. "IN" not "Indiana." "KY" not "Kentucky."

6. VERBATIM QUOTES: When a field calls for source_quote or key_quotes, copy-paste the EXACT words from the transcript. Do not paraphrase, clean up grammar, or summarize.

7. CONFLICT RESOLUTION: When the speaker gives contradictory information, use the MOST SPECIFIC and MOST RECENT statement. If the owner says "$7M" early on and "$7.2M" later with more precision, use 7200000.

8. FLAG INCONSISTENCIES: If data points contradict each other (e.g., "45 employees" but only describes 3 crews of 3 people), note the discrepancy in financial_notes or follow_up_questions. Do not silently pick one.

9. DO NOT OVER-EXTRACT: If the owner makes an obvious joke, hypothetical, or aspirational statement ("if we had a million dollars…"), do not extract that as a financial figure. Only extract data that reflects the actual current or historical state of the business, or explicitly stated future plans.

10. IGNORE THE INTERVIEWER: Extract data from the business owner/seller's statements only. Do not extract questions or comments from the SourceCo interviewer as data points (exception: if the interviewer states facts about the business that the owner confirms).`;

    // Call Gemini API with 90s timeout for long transcripts, 8192 max tokens for detailed extraction
    const { data: extracted, error: aiError } = await callGeminiWithTool(
      systemPrompt,
      extractionPrompt,
      tool,
      geminiApiKey,
      DEFAULT_GEMINI_MODEL,
      90000,
      8192
    ) as { data: ExtractionResult | null; error?: { code: string; message: string } };

    if (aiError) {
      console.error('Gemini API error:', aiError);
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
        // customer_concentration is NUMERIC in DB but Claude returns rich text.
        // Append the text to customer_types so the detail isn't lost,
        // and try to extract a numeric value for the DB column.
        if (extracted.customer_concentration) {
          const concText = String(extracted.customer_concentration);
          // Try to extract a percentage number from the text (e.g., "largest customer is 15%" → 15)
          const pctMatch = concText.match(/(\d{1,3})(?:\s*%|\s*percent)/i);
          if (pctMatch) {
            const n = Number(pctMatch[1]);
            if (Number.isFinite(n) && n > 0 && n <= 100) flatExtracted.customer_concentration = n;
          }
          // Append concentration details to customer_types so the rich text is preserved
          if (flatExtracted.customer_types) {
            flatExtracted.customer_types += '\n\nCustomer Concentration: ' + concText;
          } else {
            flatExtracted.customer_types = 'Customer Concentration: ' + concText;
          }
        }
        if (extracted.customer_geography) flatExtracted.customer_geography = extracted.customer_geography;
        if (extracted.end_market_description) flatExtracted.end_market_description = extracted.end_market_description;
        if (extracted.executive_summary) flatExtracted.executive_summary = extracted.executive_summary;
        if (extracted.competitive_position) flatExtracted.competitive_position = extracted.competitive_position;
        if (extracted.growth_trajectory) flatExtracted.growth_trajectory = extracted.growth_trajectory;
        if (extracted.key_risks) {
          // Store as bullet-pointed text for the text DB column
          // Each risk on its own line with a bullet for readability
          flatExtracted.key_risks = Array.isArray(extracted.key_risks)
            ? extracted.key_risks.map(r => `• ${r}`).join('\n')
            : String(extracted.key_risks);
        }
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
        if ((extracted as any).ownership_structure) flatExtracted.ownership_structure = (extracted as any).ownership_structure;
        if (extracted.timeline_notes) flatExtracted.timeline_notes = extracted.timeline_notes;
        if (extracted.services?.length) flatExtracted.services = extracted.services;
        {
          const n = toFiniteNumber((extracted as any).part_time_employees);
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

        // SAFETY: Sanitize numeric fields — Claude sometimes returns prose for numeric columns.
        // A single bad value causes PostgREST to reject the entire update.
        const NUMERIC_FIELDS = new Set([
          'revenue', 'ebitda', 'ebitda_margin', 'number_of_locations',
          'full_time_employees', 'part_time_employees', 'founded_year',
          'linkedin_employee_count', 'team_page_employee_count', 'customer_concentration',
        ]);
        const removedNumeric: Array<{ key: string; value: unknown }> = [];
        for (const [k, v] of Object.entries(filteredExtracted)) {
          if (!NUMERIC_FIELDS.has(k)) continue;
          if (typeof v === 'string') {
            const cleaned = v.replace(/[$,%]/g, '').trim();
            const n = Number(cleaned);
            if (Number.isFinite(n)) { filteredExtracted[k] = n; continue; }
          }
          if (typeof v !== 'number' || !Number.isFinite(v)) {
            removedNumeric.push({ key: k, value: v });
            delete filteredExtracted[k];
          }
        }
        if (removedNumeric.length > 0) {
          console.warn('Removed non-numeric values from numeric fields:', removedNumeric);
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
