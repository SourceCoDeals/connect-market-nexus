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
    test: (q) => /^(pipeline|summary|overview|how.?s the pipeline|briefing|daily)/i.test(q),
    result: { category: 'PIPELINE_ANALYTICS', tier: 'QUICK', tools: ['get_pipeline_summary', 'get_analytics'], confidence: 0.9 },
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
    result: { category: 'BUYER_ANALYSIS', tier: 'STANDARD', tools: ['get_top_buyers_for_deal', 'get_score_breakdown'], confidence: 0.85 },
  },
  // Transcript / meeting questions
  {
    test: (q) => /\b(transcript|call|meeting|fireflies|recording|said|mentioned|discussed)\b/i.test(q),
    result: { category: 'MEETING_INTEL', tier: 'STANDARD', tools: ['search_transcripts', 'search_fireflies'], confidence: 0.8 },
  },
  // Select / filter / action on table rows
  {
    test: (q) => /\b(select|check|pick|highlight|filter|show only|narrow|within \d+ miles)\b/i.test(q),
    result: { category: 'REMARKETING', tier: 'STANDARD', tools: ['search_buyers', 'select_table_rows', 'apply_table_filter'], confidence: 0.85 },
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
  // Lead source queries
  {
    test: (q) => /\b(cp target|captarget|go partners|marketplace|lead source|source)\b/i.test(q),
    result: { category: 'BUYER_SEARCH', tier: 'STANDARD', tools: ['search_lead_sources', 'query_deals'], confidence: 0.85 },
  },
];

// ---------- LLM-based routing ----------

const ROUTER_SYSTEM_PROMPT = `You are an intent classifier for an M&A deal management platform. Classify the user's message into exactly one category and select the minimum tools needed.

Categories:
- DEAL_STATUS: Questions about specific deal details, status, stage, financials
- FOLLOW_UP: Tasks, to-dos, follow-ups, assignments, reminders
- BUYER_SEARCH: Finding or searching for buyers, leads, acquirers
- BUYER_ANALYSIS: Score breakdowns, rankings, fit analysis, comparisons
- MEETING_INTEL: Call transcripts, meeting notes, what was discussed
- PIPELINE_ANALYTICS: Pipeline overview, metrics, trends, reports
- DAILY_BRIEFING: Morning briefing, what's happening, daily summary
- ACTION: Creating tasks, adding notes, updating stages, granting access
- REMARKETING: Selecting rows, filtering tables, remarketing operations
- UI_ACTION: Navigating to pages, applying filters to UI tables
- MEETING_PREP: Meeting preparation, briefings for specific meetings
- OUTREACH_DRAFT: Drafting emails, outreach messages, communications
- GENERAL: Other / unclear intent

Available tools: query_deals, get_deal_details, get_deal_activities, get_deal_tasks, get_pipeline_summary, search_buyers, get_buyer_profile, get_score_breakdown, get_top_buyers_for_deal, search_lead_sources, search_transcripts, search_fireflies, get_meeting_action_items, get_outreach_status, get_analytics, get_current_user_context, create_deal_task, complete_deal_task, add_deal_note, log_deal_activity, update_deal_stage, grant_data_room_access, select_table_rows, apply_table_filter, navigate_to_page

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
