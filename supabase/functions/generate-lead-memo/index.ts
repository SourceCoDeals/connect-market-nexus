/**
 * generate-lead-memo: AI-generates a lead memo from deal data
 *
 * Admin-only. Collects all available deal data (transcripts, enrichment,
 * manual entries) and generates a structured memo via Claude Sonnet.
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
  ANTHROPIC_API_URL,
  DEFAULT_CLAUDE_MODEL,
  getAnthropicHeaders,
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
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;
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

    // GUARD: Anonymous Teaser requires a Final PDF of the Full Lead Memo
    if (memo_type === "anonymous_teaser" || memo_type === "both") {
      const { data: fullMemoPdf } = await supabaseAdmin
        .from("data_room_documents")
        .select("id")
        .eq("deal_id", deal_id)
        .eq("document_category", "full_memo")
        .limit(1);
      if (!fullMemoPdf?.length) {
        return new Response(
          JSON.stringify({ error: "Cannot generate Anonymous Teaser until a Final PDF of the Full Lead Memo has been uploaded." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
        anthropicApiKey,
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
        anthropicApiKey,
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

  // Transcript excerpts (highest priority)
  let transcriptExcerpts = "";
  if (transcripts.length > 0) {
    sources.push("transcripts");
    transcriptExcerpts = transcripts
      .map((t, i) => {
        const parts = [];
        if (t.title) parts.push(`Title: ${t.title}`);
        if (t.extracted_data) parts.push(`Extracted Insights: ${JSON.stringify(t.extracted_data)}`);
        if (t.transcript_text) {
          // Take first 25000 chars per transcript for comprehensive context
          parts.push(`Transcript: ${t.transcript_text.substring(0, 25000)}`);
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

// Banned words/phrases that must never appear in the output
const BANNED_WORDS = [
  "strong", "robust", "impressive", "attractive", "compelling",
  "well-positioned", "significant opportunity", "poised for growth",
  "track record of success", "best-in-class", "proven", "demonstrated",
  "synergies", "uniquely positioned", "market leader",
  "value creation opportunity",
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

  // Derive the actual region/state for anonymous codename
  const dealState = context.deal.address_state || "";
  const stateToRegion: Record<string, string> = {
    AL: "Southeast", AK: "Pacific Northwest", AZ: "Southwest", AR: "South Central",
    CA: "West Coast", CO: "Mountain West", CT: "Northeast", DE: "Mid-Atlantic",
    FL: "Southeast", GA: "Southeast", HI: "Pacific", ID: "Mountain West",
    IL: "Midwest", IN: "Midwest", IA: "Midwest", KS: "Central",
    KY: "Southeast", LA: "Gulf Coast", ME: "New England", MD: "Mid-Atlantic",
    MA: "New England", MI: "Great Lakes", MN: "Upper Midwest", MS: "Gulf Coast",
    MO: "Central", MT: "Mountain West", NE: "Central", NV: "Mountain West",
    NH: "New England", NJ: "Mid-Atlantic", NM: "Southwest", NY: "Northeast",
    NC: "Southeast", ND: "Upper Midwest", OH: "Great Lakes", OK: "South Central",
    OR: "Pacific Northwest", PA: "Mid-Atlantic", RI: "New England", SC: "Southeast",
    SD: "Upper Midwest", TN: "Southeast", TX: "South Central", UT: "Mountain West",
    VT: "New England", VA: "Mid-Atlantic", WA: "Pacific Northwest", WV: "Appalachian",
    WI: "Great Lakes", WY: "Mountain West", DC: "Mid-Atlantic",
  };
  const regionName = stateToRegion[dealState.toUpperCase()] || "Central";
  const projectCodename = `Project ${regionName}`;

  const systemPrompt = `You are a VP at a buy-side investment bank writing an investment memo for the partners at a private equity firm. This memo will go to the investment committee.
...
${isAnonymous ? `MEMO TYPE: Anonymous Teaser (blind profile)

CRITICAL ANONYMITY RULES:
- NO company name — use the codename "${projectCodename}" throughout the memo
- NO owner/CEO name
- NO street address, city — state or region only (e.g., "${regionName} U.S.")
- NO website URL, email, or phone number
- NO specific client or customer names
- Financial data as ranges only (e.g., "$8M-$10M revenue")
- Services described generically without identifying the specific company

REQUIRED SECTIONS (follow this exact structure):
1. key: "company_overview" / title: "Company Overview" — 2-3 paragraphs. What the company does, where it operates (region only), years in operation, employee count range. Factual narrative, not a sales pitch.
2. key: "financial_overview" / title: "Financial Overview" — Revenue range, EBITDA range, margin range. Present as a table. Brief narrative context.
3. key: "services_operations" / title: "Services & Operations" — What they do in detail (generic terms). Service line mix, operational footprint, certifications.
4. key: "market_industry" / title: "Market & Industry" — Industry size, growth trends, competitive landscape. Factual data only.
5. key: "transaction_overview" / title: "Transaction Overview" — What the owner is looking for: full sale, recap, partner. Timeline. No names.` : `MEMO TYPE: Full Lead Memo (confidential, post-NDA)

Include all identifying information: company name, owner, address, website, contact details. Use exact financial figures.

REQUIRED SECTIONS (follow this exact structure):
1. key: "header_block" / title: "Header" — Company name (or codename), date, branding. Confidential disclaimer.
2. key: "contact_information" / title: "Contact Information" — Company HQ address, phone, website. Owner/CEO name, email, phone.
3. key: "company_overview" / title: "Company Overview" — 2-4 paragraphs. What the company does, where it operates, how long in business, employees, what makes it distinct. Factual narrative only.
4. key: "ownership_management" / title: "Ownership & Management" — Owner/operator background, how they came to own, industry experience, day-to-day role, transaction goals.
5. key: "services_operations" / title: "Services & Operations" — Detailed services, revenue mix by service, customer types, operational footprint, equipment, facilities, technology, certifications.
6. key: "market_industry" / title: "Market & Industry" — Industry size, growth trends, competitive landscape, regulatory environment. Factual data only.
7. key: "financial_overview" / title: "Financial Overview" — Revenue, EBITDA, margins for last 3 years (or available). YTD numbers. Revenue concentration. Capex. Working capital. Present as a table with brief narrative.
8. key: "employees_workforce" / title: "Employees & Workforce" — Total headcount, breakdown by role, key personnel and tenure, compensation structure, union status.
9. key: "facilities_locations" / title: "Facilities & Locations" — Number of locations, owned vs leased, lease terms, square footage, condition, planned expansions.
10. key: "transaction_overview" / title: "Transaction Overview" — Full sale, majority recap, growth partner. Valuation expectations. Timeline. Broker involvement.`}

OUTPUT FORMAT:
Return a JSON object with a "sections" array. Each section has:
- "key": snake_case identifier (as specified above)
- "title": Display title (as specified above)
- "content": Rich text content using markdown: **bold**, *italic*, bullet points with -, tables with | header | header |

=== FEW-SHOT EXAMPLES ===

Example 1 — RIA/Wealth Management (Correct tone):
Company Overview:
"Brook Capital LLC is a fee-based registered investment advisory firm headquartered in Wayne, New Jersey. Founded in 2013 and originally based in New York City, the firm relocated to northern New Jersey in 2017. Brook Capital manages approximately $900 million in assets under management across more than 200 household client relationships, with an average client AUM of approximately $2-$3 million.

The firm employs 11 individuals, including 7 licensed financial advisors. Brook Capital operates a fee-based model and does not engage in commission-based product sales. The firm provides comprehensive wealth management services including portfolio management, financial planning, tax planning, and estate planning."

Example 2 — Defense Contractor (Correct terminology):
Company Overview:
"NES provides technical and engineering support services to the United States Navy, specializing in submarine maintenance, modernization, and repair. The company operates in close proximity to a major Navy shipyard and has maintained active contracts with the Department of Defense for over two decades.

The company holds the necessary security clearances and facility certifications required for classified defense work. NES maintains DCAA-compliant accounting systems. The workforce includes engineers, technicians, and project managers with specialized naval systems expertise."

Example 3 — Commercial Plumbing (Correct factual style):
Financial Overview:
"Revenue has ranged from approximately $15 million to $18 million over the past three fiscal years. EBITDA has been in the $2.5 million to $3.0 million range. The service and maintenance segment carries higher margins than the new construction segment, and ownership has been shifting the revenue mix toward recurring service contracts."

Notice: No opinions. No "strong reputation." Facts about AUM, headcount, fee model, and owner goals speak for themselves.`;

  const userPrompt = `Generate a ${isAnonymous ? "Anonymous Teaser" : "Full Lead Memo"} from the following company data.

=== CALL TRANSCRIPTS (highest priority — richest source of detail) ===
${context.transcriptExcerpts || "No transcripts available."}

=== ENRICHMENT DATA (website scrape + LinkedIn) ===
${context.enrichmentData || "No enrichment data available."}

=== MANUAL DATA ENTRIES & GENERAL NOTES ===
${context.manualEntries || "No manual entries or notes."}

=== VALUATION CALCULATOR DATA ===
${context.valuationData || "No valuation data."}

DATA SOURCE PRIORITY: Transcripts > General Notes > Enrichment/Website > Manual entries.
When sources conflict, prefer higher-priority sources. Flag conflicts with [VERIFY: description].

Follow the memo template exactly. Use only the sections specified. Present financial data in a table. Flag any data gaps with [DATA NEEDED: description].

Generate the memo now. Return ONLY the JSON object with "sections" array.`;

  const response = await fetchWithAutoRetry(
    ANTHROPIC_API_URL,
    {
      method: "POST",
      headers: getAnthropicHeaders(apiKey),
      body: JSON.stringify({
        model: DEFAULT_CLAUDE_MODEL,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 16384,
      }),
    },
    { callerName: "generate-lead-memo", maxRetries: 2 }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const content = result.content?.[0]?.text;

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
