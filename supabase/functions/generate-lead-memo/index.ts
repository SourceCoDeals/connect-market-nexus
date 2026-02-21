/**
 * generate-lead-memo: AI-generates lead memos from deal data
 *
 * Two-step system:
 *   Step 1 — Full Detail Memo: Generated from raw Fireflies transcripts.
 *            Internal SourceCo document with all real names/details.
 *   Step 2 — Anonymous Teaser: Generated FROM the uploaded Full Detail Memo PDF.
 *            The AI reads the PDF and applies anonymization rules.
 *
 * POST body:
 *   - deal_id: UUID
 *   - memo_type: "full_memo" | "anonymous_teaser"
 *   - branding: "sourceco" | "new_heritage" | "renovus" | "cortec" | custom
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import {
  GEMINI_API_URL,
  GEMINI_API_BASE,
  DEFAULT_GEMINI_MODEL,
  getGeminiHeaders,
  fetchWithAutoRetry,
} from "../_shared/ai-providers.ts";

// Memo section structure
interface MemoSection {
  key: string;
  title: string;
  content: string;
}

interface MemoContent {
  sections: MemoSection[];
  memo_type: string;
  branding: string;
  generated_at: string;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const auth = await requireAdmin(req, supabaseAdmin);
  if (!auth.isAdmin) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.authenticated ? 403 : 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { deal_id, memo_type, branding = "sourceco" } = await req.json();

    if (!deal_id) {
      return new Response(JSON.stringify({ error: "deal_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["anonymous_teaser", "full_memo"].includes(memo_type)) {
      return new Response(
        JSON.stringify({ error: "memo_type must be anonymous_teaser or full_memo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch deal data
    const { data: deal, error: dealError } = await supabaseAdmin
      .from("listings")
      .select("*")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) {
      return new Response(JSON.stringify({ error: "Deal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any = {};

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: FULL DETAIL MEMO — generated from transcripts
    // ═══════════════════════════════════════════════════════════════
    if (memo_type === "full_memo") {
      // Fetch transcripts
      const { data: transcripts } = await supabaseAdmin
        .from("deal_transcripts")
        .select("transcript_text, extracted_data, call_date, title, extraction_status")
        .eq("listing_id", deal_id)
        .not("extraction_status", "eq", "failed")
        .order("call_date", { ascending: false })
        .limit(10);

      // Fetch valuation data
      const { data: valuationData } = await supabaseAdmin
        .from("valuation_leads")
        .select("*")
        .eq("pushed_listing_id", deal_id)
        .maybeSingle();

      const dataContext = buildDataContext(deal, transcripts || [], valuationData);
      const fullContent = await generateFullDetailMemo(geminiApiKey, dataContext, branding);

      const { data: fullMemo, error: fullError } = await supabaseAdmin
        .from("lead_memos")
        .insert({
          deal_id,
          memo_type: "full_memo",
          branding,
          content: fullContent,
          html_content: sectionsToHtml(fullContent.sections, "full_memo", branding),
          status: "draft",
          generated_from: {
            sources: dataContext.sources,
            generated_at: new Date().toISOString(),
          },
          created_by: auth.userId,
        })
        .select()
        .single();

      if (fullError) throw fullError;
      results.full_memo = fullMemo;
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: ANONYMOUS TEASER — generated from uploaded full memo PDF
    // ═══════════════════════════════════════════════════════════════
    if (memo_type === "anonymous_teaser") {
      // Require project_name on the deal
      if (!deal.project_name?.trim()) {
        return new Response(
          JSON.stringify({ error: "Project Name must be set on the deal before generating an Anonymous Teaser. Go to Internal Company Information and enter a Project Name (e.g. 'Project Restoration')." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find the uploaded full_memo PDF in data_room_documents
      const { data: fullMemoPdf } = await supabaseAdmin
        .from("data_room_documents")
        .select("storage_path, file_name")
        .eq("deal_id", deal_id)
        .eq("document_category", "full_memo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!fullMemoPdf) {
        return new Response(
          JSON.stringify({ error: "No Full Detail Memo PDF has been uploaded for this deal. Generate and finalize the Full Detail Memo first, then upload it as a PDF before generating the Anonymous Teaser." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Download the PDF from Supabase storage
      const { data: pdfData, error: downloadError } = await supabaseAdmin.storage
        .from("data-room")
        .download(fullMemoPdf.storage_path);

      if (downloadError || !pdfData) {
        throw new Error(`Failed to download full memo PDF: ${downloadError?.message || "unknown error"}`);
      }

      // Convert PDF to base64 for Gemini
      const pdfArrayBuffer = await pdfData.arrayBuffer();
      const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfArrayBuffer)));

      // Generate anonymous teaser from the PDF
      const teaserContent = await generateAnonymousTeaserFromPdf(
        geminiApiKey,
        pdfBase64,
        deal.project_name.trim(),
        branding
      );

      const { data: teaser, error: teaserError } = await supabaseAdmin
        .from("lead_memos")
        .insert({
          deal_id,
          memo_type: "anonymous_teaser",
          branding,
          content: teaserContent,
          html_content: sectionsToHtml(teaserContent.sections, "anonymous_teaser", branding),
          status: "draft",
          generated_from: {
            sources: ["uploaded_full_memo_pdf"],
            source_document: fullMemoPdf.file_name,
            generated_at: new Date().toISOString(),
          },
          created_by: auth.userId,
        })
        .select()
        .single();

      if (teaserError) throw teaserError;
      results.anonymous_teaser = teaser;
    }

    // Log audit event
    await supabaseAdmin.rpc("log_data_room_event", {
      p_deal_id: deal_id,
      p_user_id: auth.userId,
      p_action: "generate_memo",
      p_metadata: {
        memo_type,
        branding,
        memo_ids: Object.values(results).map((r: any) => r.id),
      },
      p_ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      p_user_agent: req.headers.get("user-agent") || null,
    });

    return new Response(JSON.stringify({ success: true, memos: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate memo error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate memo", details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Data Context Builder ───

interface DataContext {
  deal: any;
  transcriptExcerpts: string;
  enrichmentData: string;
  manualEntries: string;
  valuationData: string;
  sources: string[];
}

function buildDataContext(deal: any, transcripts: any[], valuationData: any): DataContext {
  const sources: string[] = [];

  // Transcript excerpts (highest priority — use FULL text)
  let transcriptExcerpts = "";
  if (transcripts.length > 0) {
    sources.push("transcripts");
    transcriptExcerpts = transcripts
      .map((t, i) => {
        const parts = [];
        if (t.title) parts.push(`Title: ${t.title}`);
        if (t.transcript_text) {
          // Full transcript text — prompt requires word-for-word reading.
          // Cap at 50 000 chars per transcript to stay within model limits.
          parts.push(`Transcript:\n${t.transcript_text.substring(0, 50000)}`);
        }
        // Extracted data goes AFTER raw text so the AI uses transcripts first
        if (t.extracted_data) {
          parts.push(`AI-Extracted Data (VERIFY against raw transcript above): ${JSON.stringify(t.extracted_data)}`);
        }
        return `--- Call ${i + 1} (${t.call_date || "unknown date"}) ---\n${parts.join("\n")}`;
      })
      .join("\n\n");
  }

  // General Notes (broker notes, call summaries, etc.)
  let notesExcerpt = "";
  if (deal.internal_notes && deal.internal_notes.trim()) {
    sources.push("general_notes");
    notesExcerpt = deal.internal_notes;
  }

  // Enrichment data (website scrape + LinkedIn)
  const enrichmentFields = [
    "description", "executive_summary", "services", "service_mix",
    "geographic_states", "address_city", "address_state",
    "linkedin_employee_count", "linkedin_specialties", "linkedin_industry",
    "founded_year", "end_market_description", "customer_segments",
    "industry", "category", "revenue", "ebitda", "ebitda_margin",
    "employee_count", "number_of_locations",
  ];
  const enrichmentData = enrichmentFields
    .filter(f => deal[f] != null && deal[f] !== "")
    .map(f => `${f}: ${JSON.stringify(deal[f])}`)
    .join("\n");
  if (enrichmentData) sources.push("enrichment");

  // Manual data entries
  const manualFields = [
    "internal_company_name", "project_name", "title", "website",
    "main_contact_name", "main_contact_email", "main_contact_phone",
    "main_contact_title", "owner_response", "seller_motivation",
    "owner_goals", "transition_preferences",
    "revenue_breakdown", "asking_price", "valuation_multiple",
  ];
  const manualEntries = manualFields
    .filter(f => deal[f] != null && deal[f] !== "")
    .map(f => `${f}: ${JSON.stringify(deal[f])}`)
    .join("\n");
  if (manualEntries) sources.push("manual_entries");

  // Valuation data
  let valuationStr = "";
  if (valuationData) {
    sources.push("valuation_calculator");
    const valFields = [
      "revenue", "ebitda", "industry", "state", "years_in_business",
      "growth_rate", "recurring_revenue_percentage",
    ];
    valuationStr = valFields
      .filter(f => valuationData[f] != null)
      .map(f => `${f}: ${JSON.stringify(valuationData[f])}`)
      .join("\n");
  }

  return {
    deal,
    transcriptExcerpts,
    enrichmentData,
    manualEntries: manualEntries + (notesExcerpt ? `\n\n--- GENERAL NOTES ---\n${notesExcerpt}` : ""),
    valuationData: valuationStr,
    sources,
  };
}

// ─── Banned Words ───

const BANNED_WORDS = [
  "attractive", "leading", "differentiated", "strong", "compelling",
  "best-in-class", "unique", "robust", "impressive", "well-positioned",
  "significant opportunity", "poised for growth", "track record of success",
  "proven", "demonstrated", "synergies", "uniquely positioned",
  "market leader", "value creation opportunity",
];

function enforceBannedWords(sections: MemoSection[]): MemoSection[] {
  return sections.map(s => {
    let content = s.content;
    for (const banned of BANNED_WORDS) {
      const regex = new RegExp(`\\b${banned}\\b`, "gi");
      content = content.replace(regex, "");
    }
    content = content.replace(/  +/g, " ").replace(/ ,/g, ",").replace(/ \./g, ".");
    return { ...s, content };
  });
}

// ═══════════════════════════════════════════════════════════════════
// PROMPT 1: FULL DETAIL MEMO — from transcripts
// ═══════════════════════════════════════════════════════════════════

async function generateFullDetailMemo(
  apiKey: string,
  context: DataContext,
  branding: string
): Promise<MemoContent> {
  const companyName = context.deal.internal_company_name || context.deal.title || "Unknown Company";
  const projectName = context.deal.project_name || "";

  const systemPrompt = `ROLE
You are a Private Equity Investment Analyst at SourceCo preparing an internal deal memo.
Your objective is NOT to summarize.
Your objective is to extract ALL available factual information about the business and present it in a structured, institutional-grade memo.
This document is for internal use only. Use all real names, exact locations, and complete detail. Do not anonymize anything.
Assume the reader will never see the transcripts. This document must capture everything known about the company.
You are rewarded for completeness, not brevity.

CRITICAL RULE: TRANSCRIPTS ONLY
You will be given full call transcripts. Read them word for word.
DO NOT use AI-generated summaries — they contain errors on headcount, revenue, and other key figures. Only use statements made directly by a participant in the conversation.
When the same figure appears differently across multiple calls, include both and flag: [VERIFY: Owner stated X on [date] and Y on [date]]

CRITICAL BEHAVIOR
DO NOT SUMMARIZE. EXTRACT EXHAUSTIVELY.

Bad output: "The company provides services to commercial clients."
Correct output must include:
- What type of service
- Revenue breakdown by service line with dollar figures
- Margin by service line if stated
- Who the customer is and how they are described
- How work is won
- What the engagement lifecycle looks like
- What differentiates their service delivery

DEPTH REQUIREMENTS — Hunt for and extract ALL of the following:

Revenue & Financials:
- Total revenue by year (every year mentioned)
- Revenue by service line or division
- Gross margin by service line if stated
- Overall EBITDA or net profit margin — note whether confirmed or estimated
- Owner compensation: salary, distributions, draws (list separately)
- All add-backs mentioned: personal expenses, one-time items, related party transactions, off-book receipts
- AR/AP levels if discussed
- Working capital notes
- Any debt, credit lines, or financing discussed

Business Model:
- How work flows in — every lead source mentioned, ranked if the owner ranked them
- How the sales process works
- Customer acquisition method
- Contract or engagement structure (project-based, recurring, retainer, etc.)
- Pricing approach if described
- Repeat business and referral mechanics
- Any bundled or cross-sell strategies described

Operations:
- Total employee count — ONLY use figures stated by the owner in the transcript, never from AI summaries
- Org structure: every named role, every team described, headcount per team
- W-2 vs 1099 or subcontractor breakdown
- In-house vs outsourced capabilities
- Equipment, tools, or technology systems used
- Facilities: size, location, owned vs rented, any owner-related real estate
- Geographic footprint and service coverage
- Any proprietary systems, processes, or capabilities described

Management Depth:
- Every named person and their role
- Tenure of key staff
- Whether business runs without the owner (key buyer question)
- Family members in the business
- Key man risk signals
- Succession readiness indicators

Competitive Positioning:
- How the owner describes their differentiation
- Named competitors or competitive dynamics mentioned
- Certifications, licenses, or preferred relationships
- Geographic market share commentary
- Why customers come back or refer others

Transaction Context — CRITICAL, do not omit:
- Which buyers have been introduced or are in active conversation
- Any LOI or offer terms already presented: valuation, structure, cash/rollover/earnout breakdown
- Owner's stated timeline
- Owner's stated goals: stay on, step back, full exit, equity roll preference
- Owner's concerns or hesitations
- Attorney or advisor involvement
- Owner's emotional readiness signals based on what was said

FACTUAL LANGUAGE RULES
Allowed: "The owner stated...", "Management described...", "The company reported...", "[Name] confirmed..."
NOT allowed: attractive, leading, differentiated, strong, compelling, best-in-class, unique, robust, impressive, well-positioned, significant opportunity, poised for growth, track record of success, proven, demonstrated, synergies, uniquely positioned, market leader, value creation opportunity
If industry or market data is needed but not in the transcripts, write: [DATA NEEDED: e.g. industry market size — do not fabricate]

DOCUMENT HEADER INFO:
Company Name: ${companyName}
${projectName ? `Project Name: ${projectName}` : ""}
This is an INTERNAL document — SourceCo Internal Only | DO NOT DISTRIBUTE TO BUYERS

REQUIRED SECTIONS (output as JSON — each section has "key", "title", "content"):
1. key: "snapshot" / title: "Snapshot" — Three sentences: what the company does, where it operates, how big it is.
2. key: "investment_highlights" / title: "Investment Highlights" — 5-8 bullets. Only include points directly supported by transcript evidence. Each bullet must contain a specific fact, not a generic statement.
3. key: "company_overview" / title: "Company Overview" — Founded year and context, exact location(s) and service territory, total employee count (transcript-sourced only), ownership structure, brief business model summary, customer and revenue concentration notes.
4. key: "business_model" / title: "Business Model" — Explain in detail: How revenue originates. Customer acquisition method and primary lead sources. Engagement or contract structure. Pricing approach if described. Repeat business and referral mechanics. Any bundled or cross-sell strategies. This section must be detailed. Do not compress.
5. key: "services_operations" / title: "Services & Operations" — For each service line or division, provide a markdown table with columns: Service/Division, Est. Revenue, % of Total, Gross Margin, Notes. Then describe: facilities (size, exact location, owned/rented, any owner-related real estate), in-house capabilities vs subcontracted, proprietary equipment/systems/processes, technology and software used, geographic coverage.
6. key: "management_team" / title: "Management & Team Structure" — Provide a markdown table with columns: Role, Name, Tenure, Notes. Include every named person and their full name. Then answer: Can the business operate without the owner? Any key man risk signals?
7. key: "financial_profile" / title: "Financial Profile" — Revenue by year table. EBITDA/Margin details (note whether CONFIRMED or NEEDS VERIFICATION). Owner compensation breakdown (salary, distributions, draws — list separately). Add-backs identified table with columns: Item, Amount, Status (CONFIRMED IN TRANSCRIPT / NEEDS VERIFICATION). Working capital and balance sheet notes. AR/AP levels. Debt and credit lines.
8. key: "competitive_positioning" / title: "Competitive Positioning" — Geographic focus and untapped markets described by owner. Key customer or partner relationships (use real names). Named competitors. Competitive advantages as stated by owner. Growth initiatives mentioned.
9. key: "transaction_overview" / title: "Transaction Overview" — Active buyers in process (real names). Deal terms presented (if any): valuation, structure, cash/rollover/earnout breakdown, earnout mechanics. Owner's stated timeline. Owner's goals. Attorney or advisor engaged (name if given). Owner's stated concerns. Seller readiness signals based on transcript.
10. key: "additional_key_information" / title: "Additional Key Information" — Include anything meaningful mentioned in the transcripts that does not fit neatly into the sections above. Owner's backstory, anecdotes about operations, industry trend comments, relationships/partnerships mentioned in passing, risks the owner acknowledged, plans/ambitions referenced. Do not omit information.
11. key: "data_flags" / title: "Data Flags" — Markdown table with columns: Item, Issue, Priority (HIGH / MEDIUM).
12. key: "whats_still_missing" / title: "What's Still Missing" — Checklist of all information a buyer would typically want that was NOT discussed. Standard items: 3 years of P&L statements, balance sheet, adjusted EBITDA calculation, customer concentration (top accounts), key employee compensation details, lease terms on facilities, outstanding legal issues or claims, equipment and asset inventory, ownership structure documentation.

OUTPUT FORMAT:
Return a JSON object with a "sections" array. Each section has:
- "key": snake_case identifier (as specified above)
- "title": Display title (as specified above)
- "content": Rich text content using markdown: **bold**, *italic*, bullet points with -, tables with | header | header |

QUALITY CONTROL — Before outputting, confirm:
- Every number traces back to a direct statement in a transcript
- All real names, exact locations, and full detail are preserved — nothing anonymized
- Org structure includes every named role with real names
- Every add-back the owner mentioned is listed
- Deal terms already on the table are captured with buyer names
- Unverified items are flagged vs confirmed
- "What's Still Missing" section is complete
- Everything meaningful said in the transcripts appears somewhere in this document — nothing left behind
- A senior deal professional would learn everything known about this business from this document`;

  const userPrompt = `Generate a Full Detail Memo (internal, all real names and details) from the following company data.

=== FULL CALL TRANSCRIPTS (highest priority — read word for word) ===
${context.transcriptExcerpts || "No transcripts available."}

=== ENRICHMENT DATA (website scrape + LinkedIn — lower priority than transcripts) ===
${context.enrichmentData || "No enrichment data available."}

=== MANUAL DATA ENTRIES & GENERAL NOTES ===
${context.manualEntries || "No manual entries or notes."}

=== VALUATION CALCULATOR DATA ===
${context.valuationData || "No valuation data."}

DATA SOURCE PRIORITY: Transcripts > General Notes > Enrichment/Website > Manual entries.
When sources conflict, prefer higher-priority sources. Flag conflicts with [VERIFY: description].

CRITICAL: Extract EVERY factual detail from the transcripts. Do not summarize — be exhaustive. If a number, name, date, dollar amount, or fact was stated in the transcript, it must appear in the memo. The buyer will never see these transcripts.

Generate the memo now. Return ONLY the JSON object with "sections" array.`;

  const response = await fetchWithAutoRetry(
    GEMINI_API_URL,
    {
      method: "POST",
      headers: getGeminiHeaders(apiKey),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 16384,
        response_format: { type: "json_object" },
      }),
    },
    { callerName: "generate-full-memo", maxRetries: 2 }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content returned from AI");

  const parsed = parseJsonResponse(content);
  const cleanedSections = enforceBannedWords(parsed.sections || []);

  return {
    sections: cleanedSections,
    memo_type: "full_memo",
    branding,
    generated_at: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════
// PROMPT 2: ANONYMOUS TEASER — from uploaded full memo PDF
// ═══════════════════════════════════════════════════════════════════

async function generateAnonymousTeaserFromPdf(
  apiKey: string,
  pdfBase64: string,
  projectName: string,
  branding: string
): Promise<MemoContent> {

  const anonymizationPrompt = `ROLE
You are a Private Equity Investment Analyst at SourceCo preparing a buyer-facing anonymous teaser.
You will be given the Full Detail Memo PDF for a deal. Your job is to produce an anonymous version of that memo by applying the anonymization rules below.
You are NOT reading transcripts. You are NOT summarizing. You are transforming the Full Detail Memo into its anonymous equivalent — every fact stays, every identifier is removed or generalized according to the rules.
The anonymous teaser must be 100% consistent with the Full Detail Memo. Do not add, invent, or infer anything not already in the Full Detail Memo.

PROJECT NAME: ${projectName}

ANONYMIZATION RULES — Apply every rule to every section without exception.

RULE 1 — COMPANY NAME
Replace the real company name with "${projectName}".

RULE 2 — GEOGRAPHY
Cities and states are too identifying. Apply both levels:
Step 1 — Remove all cities and towns. Never reference a specific city, town, or metro area.
Step 2 — Convert all states to regions using this mapping:
- Maine, New Hampshire, Vermont, Massachusetts, Rhode Island, Connecticut → New England
- New York, New Jersey, Pennsylvania → Mid-Atlantic
- Ohio, Indiana, Illinois, Michigan, Wisconsin → Midwest
- Minnesota, Iowa, Missouri, North Dakota, South Dakota, Nebraska, Kansas → Great Plains
- Delaware, Maryland, Virginia, West Virginia, North Carolina, South Carolina, Georgia, Florida → Southeast
- Kentucky, Tennessee, Alabama, Mississippi → South
- Arkansas, Louisiana, Oklahoma, Texas → South Central
- Montana, Idaho, Wyoming, Colorado, New Mexico, Arizona, Utah, Nevada → Mountain West
- Washington, Oregon, California, Alaska, Hawaii → West Coast
Apply the same rule to service territory descriptions. If a company serves multiple regions, list all applicable regions.

RULE 3 — OWNER AND EMPLOYEE NAMES
Remove all personal names. Replace with role titles only.
- Owner's name → "the owner"
- Named employees → their role title only
- If two people share the same title, use "a senior [title]" and "a second [title]"
- Never use initials, first names, last names, or nicknames

RULE 4 — NAMED CUSTOMERS AND KEY ACCOUNTS
Remove all specific customer, carrier, or account names. Replace with a description of the customer type.
Examples: "State Farm" → "a national insurance carrier", "Contractor Connection" → "a third-party administrator"
If multiple named customers of the same type, consolidate: "State Farm, Liberty Mutual, and Farm Bureau" → "multiple national and regional insurance carriers"

RULE 5 — NAMED COMPETITORS
Remove all competitor names. Replace with a description: "a regional competitor", "a national franchise competitor"

RULE 6 — NAMED BUYERS AND PE FIRMS
Replace buyer/firm names in Transaction Overview with generic buyer type descriptions.
Keep deal terms (valuation, structure) but remove the buyer's name from context.

RULE 7 — PROFESSIONAL ADVISORS
Remove names of attorneys, accountants, and other advisors. Replace with role only: "an acquisition attorney", "an outside accounting firm"

RULE 8 — ANYTHING ELSE THAT COULD IDENTIFY THE COMPANY
After applying Rules 1-7, do a final pass: could a reader use any remaining detail to identify the specific company? If yes, generalize it.
- Very specific equipment with a trademarked name → describe the function
- Hyper-specific founding story → keep the year, remove the identifying narrative
- Unique proprietary process with a trademarked name → describe what it does

WHAT STAYS THE SAME — Everything not covered by the anonymization rules:
- All financial figures (revenue, EBITDA, margins, add-backs)
- Employee headcount totals
- Service line breakdown and percentages
- Founding year
- Business model description
- Operational capabilities
- Growth opportunities described by the owner
- Owner's goals and transaction readiness
- Data flags and missing information notes
- "What's Still Missing" section

The anonymous teaser must be substantively identical to the Full Detail Memo in every area that does not require anonymization.

REQUIRED SECTIONS (same structure as Full Detail Memo, with anonymization applied):
1. key: "snapshot" / title: "Snapshot"
2. key: "investment_highlights" / title: "Investment Highlights"
3. key: "company_overview" / title: "Company Overview"
4. key: "business_model" / title: "Business Model"
5. key: "services_operations" / title: "Services & Operations"
6. key: "management_team" / title: "Management & Team Structure"
7. key: "financial_profile" / title: "Financial Profile"
8. key: "competitive_positioning" / title: "Competitive Positioning"
9. key: "transaction_overview" / title: "Transaction Overview"
10. key: "additional_key_information" / title: "Additional Key Information"
11. key: "data_flags" / title: "Data Flags"
12. key: "whats_still_missing" / title: "What's Still Missing"

OUTPUT FORMAT:
Return a JSON object with a "sections" array. Each section has:
- "key": snake_case identifier
- "title": Display title
- "content": Rich text content using markdown

QUALITY CONTROL — Before outputting, confirm:
- Every city and town has been removed
- Every state has been converted to a region
- All personal names replaced with role titles
- All customer and account names replaced with type descriptions
- All competitor names replaced with descriptions
- All buyer and PE firm names replaced with buyer type descriptions
- All advisor names replaced with role titles
- Final pass completed for any remaining identifying details
- All financial figures, headcounts, and operational facts are identical to the Full Detail Memo
- Nothing was added or invented that is not in the Full Detail Memo
- The Project Name "${projectName}" appears in the document

Read the attached Full Detail Memo PDF and produce the anonymous teaser. Return ONLY the JSON object with "sections" array.`;

  // Use Gemini native API for PDF support (not OpenAI-compatible endpoint)
  const nativeUrl = `${GEMINI_API_BASE}/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetchWithAutoRetry(
    nativeUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: anonymizationPrompt },
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: pdfBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16384,
          responseMimeType: "application/json",
        },
      }),
    },
    { callerName: "generate-anon-teaser", maxRetries: 2 }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  // Native Gemini API response format
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) throw new Error("No content returned from AI for anonymous teaser");

  const parsed = parseJsonResponse(textContent);
  const cleanedSections = enforceBannedWords(parsed.sections || []);

  return {
    sections: cleanedSections,
    memo_type: "anonymous_teaser",
    branding,
    generated_at: new Date().toISOString(),
  };
}

// ─── Shared Helpers ───

function parseJsonResponse(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    throw new Error("Failed to parse AI response as JSON");
  }
}

// ─── HTML Generation ───

function sectionsToHtml(
  sections: MemoSection[],
  memoType: string,
  branding: string
): string {
  const brandName = branding === "sourceco" ? "SourceCo"
    : branding === "new_heritage" ? "New Heritage Capital"
    : branding === "renovus" ? "Renovus Capital"
    : branding === "cortec" ? "Cortec Group"
    : branding;

  const isAnonymous = memoType === "anonymous_teaser";

  let html = `<div class="lead-memo ${memoType}">`;
  html += `<div class="memo-header">`;
  html += `<h1>${isAnonymous ? "Anonymous Teaser" : "Full Detail Memo"}</h1>`;
  html += `<p class="brand">${brandName}</p>`;
  html += `<p class="memo-type">${isAnonymous ? "FOR INTENDED RECIPIENT ONLY" : "INTERNAL ONLY — DO NOT DISTRIBUTE TO BUYERS"}</p>`;
  html += `<p class="date">${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>`;
  html += `</div>`;

  for (const section of sections) {
    html += `<div class="memo-section" data-key="${section.key}">`;
    html += `<h2>${section.title}</h2>`;
    html += `<div class="section-content">${markdownToHtml(section.content)}</div>`;
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function markdownToHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.*)/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith("<")) return match;
      return `<p>${match}</p>`;
    });
}
