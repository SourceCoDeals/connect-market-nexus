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

    // Fetch transcripts
    const { data: transcripts } = await supabaseAdmin
      .from("deal_transcripts")
      .select("transcript_text, summary, extracted_data, call_date")
      .eq("listing_id", deal_id)
      .order("call_date", { ascending: false })
      .limit(5);

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

  // Transcript excerpts (highest priority)
  let transcriptExcerpts = "";
  if (transcripts.length > 0) {
    sources.push("transcripts");
    transcriptExcerpts = transcripts
      .map((t, i) => {
        const parts = [];
        if (t.summary) parts.push(`Summary: ${t.summary}`);
        if (t.extracted_data) parts.push(`Extracted: ${JSON.stringify(t.extracted_data)}`);
        if (t.transcript_text) {
          // Take first 3000 chars of transcript
          parts.push(`Transcript: ${t.transcript_text.substring(0, 3000)}`);
        }
        return `--- Call ${i + 1} (${t.call_date || "unknown date"}) ---\n${parts.join("\n")}`;
      })
      .join("\n\n");
  }

  // Enrichment data (website scrape + LinkedIn)
  sources.push("enrichment");
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

  // Manual data entries
  const manualFields = [
    "internal_company_name", "title", "website", "main_contact_name",
    "main_contact_email", "main_contact_phone", "main_contact_title",
    "owner_response", "seller_motivation", "owner_goals",
    "transition_preferences", "internal_notes",
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
    manualEntries,
    valuationData: valuationStr,
    sources,
  };
}

// ─── AI Memo Generation ───

async function generateMemo(
  apiKey: string,
  context: DataContext,
  memoType: "anonymous_teaser" | "full_memo",
  branding: string
): Promise<MemoContent> {
  const isAnonymous = memoType === "anonymous_teaser";

  const systemPrompt = `You are a senior M&A analyst at SourceCo, a tech-enabled investment bank. You are drafting a professional lead memo for a business being sold.

MEMO TYPE: ${isAnonymous ? "Anonymous Teaser" : "Full Lead Memo"}

${isAnonymous ? `CRITICAL ANONYMITY RULES:
- Do NOT include: company name, owner name, street address, website URL, email, phone number, or any client/customer names
- Use "[Industry] Company" or a codename like "Project [Region]" as the reference
- Location: State only, no city or address
- Financial data: Use ranges (e.g., "$3M-$5M revenue") rather than exact figures
- Services: Describe what they do without naming the specific company
- Do NOT include any information that could identify the specific company` : `FULL MEMO RULES:
- Include all identifying information: company name, owner, address, website, contact info
- Use exact financial figures when available
- Include complete operational details`}

OUTPUT FORMAT:
Return a JSON object with a "sections" array. Each section has:
- "key": snake_case identifier
- "title": Display title
- "content": Rich text content (use markdown formatting: **bold**, *italic*, bullet points with -, tables with |)

${isAnonymous ? `Required sections for Anonymous Teaser:
1. company_overview - 2-3 paragraphs describing the business without naming it
2. financial_overview - Revenue range, EBITDA range, margin percentage
3. services_operations - What they do, service mix percentages
4. market_position - Geographic presence (state only), competitive advantages
5. transaction_notes - Owner goals, exit preferences, transition timeline` : `Required sections for Full Lead Memo:
1. company_info - Company name, HQ address, website, employee count, contact info
2. company_overview - 1-2 paragraphs describing the business
3. business_overview - Founded date, industry experience, growth story, management
4. financials - Revenue (current + prior years), EBITDA, margins, breakdown by service
5. operations - Service details, facilities, locations, certifications, advantages
6. customer_base - Mix (residential/commercial), key verticals, concentration
7. valuation_and_plans - Ownership structure, exit goals, valuation expectations, timeline
8. contact - Full contact details for the business owner`}

Write professionally but accessibly. Use concrete data where available. If data is missing for a section, write what you can and note what additional information would strengthen the memo.`;

  const userPrompt = `Generate a ${isAnonymous ? "anonymous teaser" : "full lead memo"} from the following deal data:

--- TRANSCRIPT EXCERPTS (highest priority — most detailed and accurate) ---
${context.transcriptExcerpts || "No transcripts available"}

--- ENRICHMENT DATA (website scrape + LinkedIn) ---
${context.enrichmentData || "No enrichment data available"}

--- MANUAL DATA ENTRIES ---
${context.manualEntries || "No manual entries"}

--- VALUATION CALCULATOR DATA ---
${context.valuationData || "No valuation data"}

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
        temperature: 0.4,
        max_tokens: 8192,
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

  return {
    sections: parsed.sections || [],
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
