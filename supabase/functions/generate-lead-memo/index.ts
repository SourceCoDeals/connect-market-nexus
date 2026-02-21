/**
 * generate-lead-memo: AI-generates a lead memo from deal data
 *
 * Admin-only. Collects all available deal data (transcripts, enrichment,
 * manual entries) and generates a structured memo via Gemini.
 *
 * POST body:
 *   - deal_id: UUID
 *   - memo_type: "anonymous_teaser" | "full_memo" | "both"
 *   - branding: "sourceco" | "new_heritage" | "renovus" | "cortec" | custom
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import {
  GEMINI_API_URL,
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

    if (!["anonymous_teaser", "full_memo", "both"].includes(memo_type)) {
      return new Response(
        JSON.stringify({ error: "memo_type must be anonymous_teaser, full_memo, or both" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all deal data
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

    // Fetch transcripts (deal_transcripts schema: no 'summary' column)
    const { data: transcripts } = await supabaseAdmin
      .from("deal_transcripts")
      .select("transcript_text, extracted_data, call_date, title, extraction_status")
      .eq("listing_id", deal_id)
      .not("extraction_status", "eq", "failed")
      .order("call_date", { ascending: false })
      .limit(10);

    // Fetch valuation data if applicable
    const { data: valuationData } = await supabaseAdmin
      .from("valuation_leads")
      .select("*")
      .eq("pushed_listing_id", deal_id)
      .maybeSingle();

    // Build data context for AI
    const dataContext = buildDataContext(deal, transcripts || [], valuationData);

    // Generate memo(s)
    const results: any = {};

    if (memo_type === "anonymous_teaser" || memo_type === "both") {
      const teaserContent = await generateMemo(
        geminiApiKey,
        dataContext,
        "anonymous_teaser",
        branding
      );

      // Save to lead_memos
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
            sources: dataContext.sources,
            generated_at: new Date().toISOString(),
          },
          created_by: auth.userId,
        })
        .select()
        .single();

      if (teaserError) throw teaserError;
      results.anonymous_teaser = teaser;
    }

    if (memo_type === "full_memo" || memo_type === "both") {
      const fullContent = await generateMemo(
        geminiApiKey,
        dataContext,
        "full_memo",
        branding
      );

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

    // Log audit event
    await supabaseAdmin.rpc("log_data_room_event", {
      p_deal_id: deal_id,
      p_user_id: auth.userId,
      p_action: "generate_memo",
      p_metadata: {
        memo_type,
        branding,
        sources_used: dataContext.sources,
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

  // Transcript excerpts (highest priority — use FULL text per v4 prompt rules)
  let transcriptExcerpts = "";
  if (transcripts.length > 0) {
    sources.push("transcripts");
    transcriptExcerpts = transcripts
      .map((t, i) => {
        const parts = [];
        if (t.title) parts.push(`Title: ${t.title}`);
        if (t.transcript_text) {
          // Full transcript text — v4 prompt requires word-for-word reading.
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

  // General Notes (separate data source — broker notes, call summaries, etc.)
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

  // Manual data entries (structured fields entered by admin)
  const manualFields = [
    "internal_company_name", "title", "website", "main_contact_name",
    "main_contact_email", "main_contact_phone", "main_contact_title",
    "owner_response", "seller_motivation", "owner_goals",
    "transition_preferences",
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

// ─── AI Memo Generation ───

// Banned words/phrases that must never appear in the output (v4 factual language rules)
const BANNED_WORDS = [
  "attractive", "leading", "differentiated", "strong", "compelling",
  "best-in-class", "unique", "robust", "impressive", "well-positioned",
  "significant opportunity", "poised for growth", "track record of success",
  "proven", "demonstrated", "synergies", "uniquely positioned",
  "market leader", "value creation opportunity",
];

// Post-process: strip any banned words that slipped through
function enforceBannedWords(sections: MemoSection[]): MemoSection[] {
  return sections.map(s => {
    let content = s.content;
    for (const banned of BANNED_WORDS) {
      const regex = new RegExp(`\\b${banned}\\b`, "gi");
      content = content.replace(regex, "");
    }
    // Clean up double spaces left by removals
    content = content.replace(/  +/g, " ").replace(/ ,/g, ",").replace(/ \./g, ".");
    return { ...s, content };
  });
}

async function generateMemo(
  apiKey: string,
  context: DataContext,
  memoType: "anonymous_teaser" | "full_memo",
  branding: string
): Promise<MemoContent> {
  const isAnonymous = memoType === "anonymous_teaser";

  // ─── SourceCo Master Teaser Prompt v4 ───
  const systemPrompt = `ROLE
You are a Private Equity Investment Analyst at SourceCo preparing acquisition teasers for institutional buyers.
Your objective is NOT to summarize.
Your objective is to extract ALL available factual information about the business and present it in a structured, institutional-grade memo.
Assume the buyer will never see the transcripts. This document must capture everything known about the company.
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

DEPTH REQUIREMENTS — You must specifically hunt for and extract the following categories regardless of whether they appear obvious or minor:

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

${isAnonymous ? `MEMO TYPE: Anonymous Teaser (blind profile)

CRITICAL ANONYMITY RULES:
- NO company name — use a project codename like "Project [Region]" (e.g., "Project Southeast")
- NO owner/CEO name — refer to "the owner" or "management"
- NO street address, city — state or region only (e.g., "Southeast U.S.")
- NO website URL, email, or phone number
- NO specific client or customer names
- Financial data as ranges only (e.g., "$8M-$10M revenue")
- Services described generically without identifying the specific company` : `MEMO TYPE: Full Lead Memo (confidential, post-NDA)

Include all identifying information: company name, owner, address, website, contact details. Use exact financial figures.
Include a header_block with company name, date, and confidential disclaimer.
Include a contact_information section with company HQ address, phone, website, owner/CEO name, email, phone.`}

REQUIRED SECTIONS (output as JSON — each section has "key", "title", "content"):

${isAnonymous ? `1. key: "snapshot" / title: "Snapshot" — Three sentences: what the company does, where it operates, how big it is.
2. key: "investment_highlights" / title: "Investment Highlights" — 5-8 bullets. Only include points directly supported by transcript evidence. Each bullet must contain a specific fact, not a generic statement.
3. key: "company_overview" / title: "Company Overview" — Founded year and context, location and service territory, total employee count (transcript-sourced only), ownership structure, brief business model summary, customer and revenue concentration notes.
4. key: "business_model" / title: "Business Model" — Explain in detail: How revenue originates. Customer acquisition method and primary lead sources. Engagement or contract structure. Pricing approach if described. Repeat business and referral mechanics. Any bundled or cross-sell strategies. This section must be detailed. Do not compress.
5. key: "services_operations" / title: "Services & Operations" — For each service line or division mentioned, provide a markdown table with columns: Service/Division, Est. Revenue, % of Total, Gross Margin, Notes. Then describe: facilities (size, location, owned/rented), in-house capabilities vs subcontracted, proprietary equipment/systems/processes, technology and software used, geographic coverage.
6. key: "management_team" / title: "Management & Team Structure" — Provide a markdown table with columns: Role, Name, Tenure, Notes. Then answer: Can the business operate without the owner? Any key man risk signals?
7. key: "financial_profile" / title: "Financial Profile" — Revenue by year table. EBITDA/Margin details (note whether CONFIRMED or NEEDS VERIFICATION). Add-backs identified table with columns: Item, Amount, Status (CONFIRMED IN TRANSCRIPT / NEEDS VERIFICATION). Working capital and balance sheet notes.
8. key: "competitive_positioning" / title: "Competitive Positioning" — Geographic focus and untapped markets described by owner. Key customer or partner relationships named. Competitive advantages as stated by owner. Growth initiatives mentioned.
9. key: "transaction_overview" / title: "Transaction Overview" — Active buyers in process (names). Deal terms presented (if any): valuation, structure, cash/rollover/earnout breakdown, earnout mechanics. Owner's stated timeline. Owner's goals (stay on/step back/full exit/equity roll preference). Attorney or advisor engaged. Owner's stated concerns. Seller readiness signals based on transcript.
10. key: "data_flags" / title: "Data Flags" — Markdown table with columns: Item, Issue, Priority (HIGH / MEDIUM). List every fact that needs checking or verification.
11. key: "whats_still_missing" / title: "What's Still Missing" — List every piece of information a buyer would typically want that was NOT discussed in any transcript. Use a checklist format. Standard items to check: 3 years of P&L statements, balance sheet, adjusted EBITDA calculation, customer concentration (top accounts), key employee compensation details, lease terms on facilities, any outstanding legal issues or claims, equipment and asset inventory, ownership structure documentation.
12. key: "additional_key_information" / title: "Additional Key Information" — Include anything meaningful mentioned in the transcripts that does not fit neatly into the sections above. Examples: owner's backstory, anecdotes about operations, industry trend comments, relationships/partnerships mentioned in passing, risks the owner acknowledged, plans/ambitions referenced. Do not omit information simply because it doesn't fit a defined category.` : `1. key: "header_block" / title: "Header" — Company name, date, branding. Confidential disclaimer.
2. key: "contact_information" / title: "Contact Information" — Company HQ address, phone, website. Owner/CEO name, email, phone.
3. key: "snapshot" / title: "Snapshot" — Three sentences: what the company does, where it operates, how big it is.
4. key: "investment_highlights" / title: "Investment Highlights" — 5-8 bullets. Only include points directly supported by transcript evidence. Each bullet must contain a specific fact, not a generic statement.
5. key: "company_overview" / title: "Company Overview" — Founded year and context, location and service territory, total employee count (transcript-sourced only), ownership structure, brief business model summary, customer and revenue concentration notes.
6. key: "business_model" / title: "Business Model" — Explain in detail: How revenue originates. Customer acquisition method and primary lead sources. Engagement or contract structure. Pricing approach if described. Repeat business and referral mechanics. Any bundled or cross-sell strategies. This section must be detailed. Do not compress.
7. key: "services_operations" / title: "Services & Operations" — For each service line or division, provide a markdown table with columns: Service/Division, Est. Revenue, % of Total, Gross Margin, Notes. Then describe: facilities (size, location, owned/rented), in-house capabilities vs subcontracted, proprietary equipment/systems/processes, technology and software used, geographic coverage.
8. key: "management_team" / title: "Management & Team Structure" — Provide a markdown table with columns: Role, Name, Tenure, Notes. Then answer: Can the business operate without the owner? Any key man risk signals? Family members in the business? Succession readiness?
9. key: "financial_profile" / title: "Financial Profile" — Revenue by year table. EBITDA/Margin details (note whether CONFIRMED or NEEDS VERIFICATION). Owner compensation breakdown. Add-backs identified table with columns: Item, Amount, Status. Working capital and balance sheet notes. AR/AP levels. Debt and credit lines.
10. key: "employees_workforce" / title: "Employees & Workforce" — Total headcount, breakdown by role, W-2 vs 1099, key personnel and tenure, compensation structure.
11. key: "facilities_locations" / title: "Facilities & Locations" — Number of locations, owned vs leased, lease terms, square footage, condition, planned expansions, any owner-related real estate.
12. key: "competitive_positioning" / title: "Competitive Positioning" — Geographic focus and untapped markets described by owner. Key customer or partner relationships named. Competitive advantages as stated by owner. Certifications, licenses, or preferred relationships. Growth initiatives mentioned.
13. key: "transaction_overview" / title: "Transaction Overview" — Active buyers in process (names). Deal terms presented (if any): valuation, structure, cash/rollover/earnout breakdown, earnout mechanics. Owner's stated timeline. Owner's goals. Attorney or advisor engaged. Owner's stated concerns. Seller readiness signals.
14. key: "data_flags" / title: "Data Flags" — Markdown table with columns: Item, Issue, Priority (HIGH / MEDIUM).
15. key: "whats_still_missing" / title: "What's Still Missing" — Checklist of all information a buyer would typically want that was NOT discussed. Standard items to check: 3 years of P&L statements, balance sheet, adjusted EBITDA calculation, customer concentration, key employee compensation details, lease terms, outstanding legal issues, equipment and asset inventory, ownership structure documentation.
16. key: "additional_key_information" / title: "Additional Key Information" — Include anything meaningful from transcripts that doesn't fit above. Owner backstory, operational anecdotes, industry trend comments, partnerships, risks acknowledged, plans/ambitions referenced. Do not omit information.`}

OUTPUT FORMAT:
Return a JSON object with a "sections" array. Each section has:
- "key": snake_case identifier (as specified above)
- "title": Display title (as specified above)
- "content": Rich text content using markdown: **bold**, *italic*, bullet points with -, tables with | header | header |

QUALITY CONTROL — Before outputting, confirm to yourself:
- Every number traces back to a direct statement in a transcript
- Org structure includes every named role
- Every add-back the owner mentioned is listed
- Deal terms already on the table are captured
- Unverified items are flagged vs confirmed
- "What's Still Missing" section is complete
- Everything meaningful said in the transcripts appears somewhere in this document — nothing left behind
- A PE partner would learn everything known about this business from this document`;

  const userPrompt = `Generate a ${isAnonymous ? "Anonymous Teaser" : "Full Lead Memo"} from the following company data.

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
    { callerName: "generate-lead-memo", maxRetries: 2 }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content returned from AI");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      throw new Error("Failed to parse AI response as JSON");
    }
  }

  // Post-process: enforce banned words removal
  const cleanedSections = enforceBannedWords(parsed.sections || []);

  return {
    sections: cleanedSections,
    memo_type: memoType,
    branding,
    generated_at: new Date().toISOString(),
  };
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
  html += `<h1>Lead Memo</h1>`;
  html += `<p class="brand">${brandName}</p>`;
  html += `<p class="memo-type">${isAnonymous ? "Anonymous Teaser" : "Confidential Lead Memo"}</p>`;
  html += `<p class="date">${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>`;
  html += `</div>`;

  for (const section of sections) {
    html += `<div class="memo-section" data-key="${section.key}">`;
    html += `<h2>${section.title}</h2>`;
    // Convert markdown-like content to basic HTML
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
