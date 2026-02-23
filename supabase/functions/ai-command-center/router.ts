/**
 * AI Command Center - Intent Router
 * Uses Haiku for fast intent classification (< 500ms).
 * Context bypass: skips LLM when page context makes intent obvious.
 */

import { callClaude, CLAUDE_MODELS } from "../_shared/claude-client.ts";

// ---------- Router output ----------

export interface RouterResult {
  category: string;
  tier: 'QUICK' | 'STANDARD' | 'DEEP';
  tools: string[];
  confidence: number;
  bypassed: boolean;
}

// ---------- Context bypass rules ----------

interface PageContext {
  page?: string;         // Current page: 'deal_detail', 'buyers_list', 'pipeline', 'remarketing', etc.
  entity_id?: string;    // Current deal/buyer ID if on a detail page
  entity_type?: string;  // 'deal', 'buyer', 'universe'
  tab?: string;          // Current tab within the page
}

const BYPASS_RULES: Array<{
  test: (query: string, ctx: PageContext) => boolean;
  result: Omit<RouterResult, 'bypassed'>;
}> = [
  // Pipeline overview questions
  {
    test: (q) => /^(pipeline|summary|overview|how.?s the pipeline|briefing|daily|good morning|what.?s new|catch me up)/i.test(q),
    result: { category: 'DAILY_BRIEFING', tier: 'STANDARD', tools: ['get_follow_up_queue', 'get_analytics', 'get_cross_deal_analytics'], confidence: 0.9 },
  },
  // Deal lookup by name — "what kind of company is X", "tell me about [deal name]", "what is [company]"
  {
    test: (q) => /\b(what kind of|what type of|tell me about|what is|info on|details on|look up|pull up)\b.*(company|deal|business|firm|listing)/i.test(q) || /\b(company|deal|business|firm|listing)\b.*(what kind|what type|tell me|what is)/i.test(q),
    result: { category: 'DEAL_STATUS', tier: 'STANDARD', tools: ['query_deals', 'get_deal_details'], confidence: 0.9 },
  },
  // Deal-specific questions when on a deal page
  {
    test: (q, ctx) => !!ctx.entity_id && ctx.entity_type === 'deal' && /^(status|where|stage|update|what.?s happening)/i.test(q),
    result: { category: 'DEAL_STATUS', tier: 'QUICK', tools: ['get_deal_details'], confidence: 0.95 },
  },
  // Tasks / follow-ups
  {
    test: (q) => /\b(task|todo|to-do|follow.?up|overdue|pending|assigned)\b/i.test(q),
    result: { category: 'FOLLOW_UP', tier: 'QUICK', tools: ['get_deal_tasks', 'get_current_user_context'], confidence: 0.85 },
  },
  // Buyer search
  {
    test: (q) => /\b(buyer|acquirer|PE firm|strategic|search buyer|find buyer)\b/i.test(q) && /\b(search|find|show|list|who|which)\b/i.test(q),
    result: { category: 'BUYER_SEARCH', tier: 'STANDARD', tools: ['search_buyers'], confidence: 0.85 },
  },
  // Score questions
  {
    test: (q) => /\b(score|scoring|rank|top buyer|best buyer|fit)\b/i.test(q),
    result: { category: 'BUYER_ANALYSIS', tier: 'STANDARD', tools: ['get_top_buyers_for_deal', 'explain_buyer_score'], confidence: 0.85 },
  },
  // Transcript / meeting questions
  {
    test: (q) => /\b(transcript|call|meeting|fireflies|recording|said|mentioned|discussed)\b/i.test(q),
    result: { category: 'MEETING_INTEL', tier: 'STANDARD', tools: ['semantic_transcript_search', 'search_transcripts', 'search_fireflies'], confidence: 0.8 },
  },
  // Select / filter / sort / action on table rows
  {
    test: (q) => /\b(select|check|pick|highlight|filter|show only|narrow|within \d+ miles|sort|order by|arrange|sort by)\b/i.test(q),
    result: { category: 'REMARKETING', tier: 'STANDARD', tools: ['search_buyers', 'query_deals', 'select_table_rows', 'apply_table_filter', 'sort_table_column'], confidence: 0.85 },
  },
  // Create task / add note
  {
    test: (q) => /\b(create task|add task|new task|add note|log|remind me)\b/i.test(q),
    result: { category: 'ACTION', tier: 'STANDARD', tools: ['create_deal_task', 'add_deal_note'], confidence: 0.9 },
  },
  // Stage change
  {
    test: (q) => /\b(update stage|change stage|move to|advance|promote)\b/i.test(q),
    result: { category: 'ACTION', tier: 'STANDARD', tools: ['update_deal_stage'], confidence: 0.9 },
  },
  // Data room access
  {
    test: (q) => /\b(data room|grant access|give access|open data room)\b/i.test(q),
    result: { category: 'ACTION', tier: 'STANDARD', tools: ['grant_data_room_access'], confidence: 0.9 },
  },
  // Analytics / reports
  {
    test: (q) => /\b(analytics|report|metrics|performance|trend|chart|dashboard)\b/i.test(q),
    result: { category: 'PIPELINE_ANALYTICS', tier: 'STANDARD', tools: ['get_analytics', 'get_pipeline_summary'], confidence: 0.8 },
  },
  // Meeting prep / content generation
  {
    test: (q) => /\b(prep|prepare|meeting prep|brief me|briefing|get me ready)\b/i.test(q),
    result: { category: 'MEETING_PREP', tier: 'DEEP', tools: ['get_deal_details', 'get_top_buyers_for_deal', 'search_transcripts', 'get_deal_tasks'], confidence: 0.85 },
  },
  // Outreach drafting
  {
    test: (q) => /\b(draft|write|compose|email|outreach|message)\b/i.test(q),
    result: { category: 'OUTREACH_DRAFT', tier: 'DEEP', tools: ['get_deal_details', 'get_buyer_profile'], confidence: 0.8 },
  },
  // Lead source queries — captarget, valuation calculator leads, go partners, etc.
  {
    test: (q) => /\b(cp target|captarget|go partners|marketplace|lead source|source|valuation lead|calculator lead|leads tracker)\b/i.test(q),
    result: { category: 'BUYER_SEARCH', tier: 'STANDARD', tools: ['search_lead_sources', 'search_valuation_leads', 'query_deals'], confidence: 0.85 },
  },
  // Buyer universe geographic questions — "how many buyers in X universe are in [state]"
  {
    test: (q) => /\b(buyer universe|universe|how many buyer|buyers.*in.*[A-Z]{2}|buyers.*locat|location.*buyer)\b/i.test(q),
    result: { category: 'BUYER_UNIVERSE', tier: 'STANDARD', tools: ['search_buyer_universes', 'get_universe_details', 'get_top_buyers_for_deal', 'search_buyers'], confidence: 0.87 },
  },
  // Outreach tracking — NDA, contacted, meeting, follow-up pipeline
  {
    test: (q) => /\b(outreach|nda|contacted|who.?ve we|who have we|follow.?up pipeline|overdue action|next action|meeting scheduled|cim sent)\b/i.test(q),
    result: { category: 'FOLLOW_UP', tier: 'STANDARD', tools: ['get_outreach_records', 'get_remarketing_outreach', 'get_deal_tasks'], confidence: 0.85 },
  },
  // Engagement signals — buyer engagement events
  {
    test: (q) => /\b(engagement signal|buyer signal|how engaged|site visit|ioi|loi|letter of intent|indication of interest|ceo involved|financial request)\b/i.test(q),
    result: { category: 'ENGAGEMENT', tier: 'STANDARD', tools: ['get_engagement_signals', 'get_buyer_decisions', 'get_score_history'], confidence: 0.87 },
  },
  // Buyer decisions — approved, passed, pass reasons
  {
    test: (q) => /\b(pass.?reason|passed on|why.?pass|approve.?decision|declined|rejected|pass categor)\b/i.test(q),
    result: { category: 'ENGAGEMENT', tier: 'STANDARD', tools: ['get_buyer_decisions', 'get_engagement_signals'], confidence: 0.85 },
  },
  // Inbound leads — website leads, form submissions
  {
    test: (q) => /\b(inbound lead|website lead|form lead|lead status|lead source|new lead|pending lead|converted lead)\b/i.test(q),
    result: { category: 'LEAD_INTEL', tier: 'STANDARD', tools: ['search_inbound_leads', 'get_referral_data'], confidence: 0.85 },
  },
  // Referral partners / broker submissions
  {
    test: (q) => /\b(referral partner|broker partner|referral submission|deal submission|advisor partner|submitted deal)\b/i.test(q),
    result: { category: 'LEAD_INTEL', tier: 'STANDARD', tools: ['get_referral_data', 'search_inbound_leads'], confidence: 0.87 },
  },
  // PE / platform contacts — find who to call, email at a firm
  {
    test: (q) => /\b(contact at|contact for|who.?s the|find contact|email for|phone for|partner at|principal at|deal team|pe contact|platform contact)\b/i.test(q),
    result: { category: 'BUYER_ANALYSIS', tier: 'STANDARD', tools: ['search_pe_contacts', 'get_buyer_profile'], confidence: 0.87 },
  },
  // Deal documents and memos
  {
    test: (q) => /\b(document|data room file|teaser|memo|investment memo|cim|anonymous teaser|full memo)\b/i.test(q),
    result: { category: 'DEAL_STATUS', tier: 'STANDARD', tools: ['get_deal_documents', 'get_deal_memos', 'get_deal_details'], confidence: 0.85 },
  },
  // Score history
  {
    test: (q) => /\b(score history|score change|score over time|historical score|score trend)\b/i.test(q),
    result: { category: 'ENGAGEMENT', tier: 'STANDARD', tools: ['get_score_history', 'explain_buyer_score'], confidence: 0.87 },
  },
  // Why did buyer score X — explainable scoring
  {
    test: (q) => /\b(why.*score|explain.*score|score.*because|score.*breakdown|how.*score.*calculated)\b/i.test(q),
    result: { category: 'BUYER_ANALYSIS', tier: 'STANDARD', tools: ['explain_buyer_score'], confidence: 0.92 },
  },
  // Cross-deal / cross-universe analytics
  {
    test: (q) => /\b(cross.?deal|compare.*universe|compare.*deal|conversion rate|which universe|best.*universe|worst.*universe|across.*deal)\b/i.test(q),
    result: { category: 'CROSS_DEAL', tier: 'STANDARD', tools: ['get_cross_deal_analytics'], confidence: 0.9 },
  },
  // Semantic transcript search — intent-based
  {
    test: (q) => /\b(what did.*say|what was said|anyone.*mention|discuss.*about|talk.*about|sentiment|intent)\b/i.test(q),
    result: { category: 'SEMANTIC_SEARCH', tier: 'STANDARD', tools: ['semantic_transcript_search'], confidence: 0.88 },
  },
  // Enrichment status
  {
    test: (q) => /\b(enrichment|enrich status|data enrich|enrichment job|enrichment queue)\b/i.test(q),
    result: { category: 'PIPELINE_ANALYTICS', tier: 'QUICK', tools: ['get_enrichment_status'], confidence: 0.9 },
  },
  // Connection requests — buyer intake pipeline
  {
    test: (q) => /\b(connection request|buyer request|connect request|who requested|requested access|request.*deal|buyer.*connect|intake)\b/i.test(q),
    result: { category: 'CONNECTION', tier: 'STANDARD', tools: ['get_connection_requests', 'get_connection_messages'], confidence: 0.87 },
  },
  // Conversation / messages on a deal
  {
    test: (q) => /\b(message|conversation|thread|what.?did.*say|chat|correspondence|communication)\b/i.test(q),
    result: { category: 'CONNECTION', tier: 'STANDARD', tools: ['get_connection_messages', 'get_deal_conversations', 'get_connection_requests'], confidence: 0.82 },
  },
  // NDA logs / fee agreement audit
  {
    test: (q) => /\b(nda log|fee agreement|fee log|agreement signed|who signed|firm agreement|agreement status)\b/i.test(q),
    result: { category: 'CONTACTS', tier: 'STANDARD', tools: ['get_firm_agreements', 'get_nda_logs'], confidence: 0.87 },
  },
  // Deal referrals
  {
    test: (q) => /\b(deal referral|referral email|shared.*deal|referred.*deal|referral.*convert|deal.*share)\b/i.test(q),
    result: { category: 'LEAD_INTEL', tier: 'STANDARD', tools: ['get_deal_referrals', 'get_referral_data'], confidence: 0.85 },
  },
  // Buyer learning history
  {
    test: (q) => /\b(learning history|buyer learning|decision history|what.*buyer.*decision|score.*when.*pass|score.*when.*approv)\b/i.test(q),
    result: { category: 'ENGAGEMENT', tier: 'STANDARD', tools: ['get_buyer_learning_history', 'get_buyer_decisions'], confidence: 0.85 },
  },
  // Industry trackers
  {
    test: (q) => /\b(industry tracker|tracker|which industries|industry vertical|vertical.*deal|scoring config)\b/i.test(q),
    result: { category: 'INDUSTRY', tier: 'QUICK', tools: ['get_industry_trackers', 'search_buyer_universes'], confidence: 0.85 },
  },
  // Deal comments
  {
    test: (q) => /\b(comment|internal note|deal note|team comment|who comment|what.*comment)\b/i.test(q),
    result: { category: 'DEAL_STATUS', tier: 'QUICK', tools: ['get_deal_comments', 'get_deal_details'], confidence: 0.85 },
  },
  // Scoring adjustments
  {
    test: (q) => /\b(scoring adjustment|weight multiplier|custom.*scoring|scoring instruction|why.*score.*different)\b/i.test(q),
    result: { category: 'DEAL_STATUS', tier: 'STANDARD', tools: ['get_deal_scoring_adjustments', 'get_deal_details'], confidence: 0.85 },
  },
];

// ---------- LLM-based routing ----------

const ROUTER_SYSTEM_PROMPT = `You are an intent classifier for an M&A deal management platform. Classify the user's message into exactly one category and select the minimum tools needed.

Categories:
- DEAL_STATUS: Questions about specific deal details, status, stage, financials, documents, memos
- FOLLOW_UP: Tasks, to-dos, follow-ups, assignments, reminders, outreach tracking (NDA, meetings, next actions)
- BUYER_SEARCH: Finding or searching for buyers, leads, acquirers
- BUYER_ANALYSIS: Score breakdowns, rankings, fit analysis, comparisons, buyer contacts, explainable scoring
- BUYER_UNIVERSE: Buyer universe queries, universe details, geographic counts within a universe
- MEETING_INTEL: Call transcripts, meeting notes, what was discussed, semantic transcript search
- PIPELINE_ANALYTICS: Pipeline overview, metrics, trends, reports, enrichment status
- CROSS_DEAL: Cross-deal/universe comparisons, conversion rates, buyer type analysis, source quality
- SEMANTIC_SEARCH: Intent-based transcript search, "what did X say about Y"
- DAILY_BRIEFING: Morning briefing, what's happening, daily summary
- ACTION: Creating tasks, adding notes, updating stages, granting access
- REMARKETING: Selecting rows, filtering tables, remarketing operations
- UI_ACTION: Navigating to pages, applying filters to UI tables
- MEETING_PREP: Meeting preparation, briefings for specific meetings
- OUTREACH_DRAFT: Drafting emails, outreach messages, communications
- LEAD_INTEL: Inbound leads, referral partners, referral submissions, deal referrals, lead sources
- ENGAGEMENT: Engagement signals, buyer decisions (approve/pass), score history, interest signals, buyer learning history
- CONNECTION: Buyer connection requests, deal conversation messages, buyer intake pipeline
- CONTACTS: PE contacts, platform contacts, firm agreements, NDA logs
- INDUSTRY: Industry trackers, vertical scoring configs
- GENERAL: Other / unclear intent

Available tools: query_deals, get_deal_details, get_deal_activities, get_deal_tasks, get_deal_documents, get_deal_memos, get_deal_comments, get_deal_scoring_adjustments, get_deal_referrals, get_deal_conversations, get_pipeline_summary, search_buyers, get_buyer_profile, get_score_breakdown, get_top_buyers_for_deal, get_buyer_decisions, get_score_history, get_buyer_learning_history, search_lead_sources, search_valuation_leads, search_inbound_leads, get_referral_data, search_pe_contacts, get_firm_agreements, get_nda_logs, get_connection_requests, get_connection_messages, search_buyer_universes, get_universe_details, get_outreach_records, get_remarketing_outreach, get_engagement_signals, get_interest_signals, search_transcripts, search_buyer_transcripts, search_fireflies, get_meeting_action_items, get_outreach_status, get_analytics, get_enrichment_status, get_industry_trackers, get_current_user_context, create_deal_task, complete_deal_task, add_deal_note, log_deal_activity, update_deal_stage, grant_data_room_access, select_table_rows, apply_table_filter, sort_table_column, navigate_to_page

Respond with JSON only:
{"category":"CATEGORY","tier":"QUICK|STANDARD|DEEP","tools":["tool1","tool2"],"confidence":0.0-1.0}

Rules:
- Tier QUICK: Simple lookups, single tool, clear intent
- Tier STANDARD: Multi-tool queries, search + analysis
- Tier DEEP: Content generation, complex analysis, meeting prep
- Select 1-4 tools maximum
- Prefer fewer tools when intent is clear`;

export async function routeIntent(
  query: string,
  pageContext?: PageContext,
): Promise<RouterResult> {
  // 1. Try context bypass rules first (no LLM call needed)
  if (pageContext) {
    for (const rule of BYPASS_RULES) {
      if (rule.test(query, pageContext)) {
        console.log(`[ai-cc] Router bypassed → ${rule.result.category} (confidence: ${rule.result.confidence})`);

        // Inject entity_id context into tool args hint
        const tools = [...rule.result.tools];

        return {
          ...rule.result,
          tools,
          bypassed: true,
        };
      }
    }
  }

  // 2. Fall back to LLM classification (Haiku for speed)
  try {
    const response = await callClaude({
      model: CLAUDE_MODELS.haiku,
      maxTokens: 200,
      systemPrompt: ROUTER_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: pageContext
            ? `Page context: ${pageContext.page || 'unknown'}, entity: ${pageContext.entity_id || 'none'} (${pageContext.entity_type || 'none'})\n\nUser query: ${query}`
            : query,
        },
      ],
      timeoutMs: 3000,
    });

    // Extract JSON from response
    const text = response.content.find(b => b.type === 'text')?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('No JSON in router response');

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      category: parsed.category || 'GENERAL',
      tier: parsed.tier || 'STANDARD',
      tools: parsed.tools || [],
      confidence: parsed.confidence || 0.5,
      bypassed: false,
    };
  } catch (err) {
    console.error(`[ai-cc] Router LLM failed: ${err instanceof Error ? err.message : err}`);

    // Fallback to general category
    return {
      category: 'GENERAL',
      tier: 'STANDARD',
      tools: ['get_current_user_context'],
      confidence: 0.3,
      bypassed: false,
    };
  }
}
