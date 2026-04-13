/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase client used with untyped tables */
/**
 * Buyer Introduction Tools
 *
 * Queries the `buyer_introductions` table (the Kanban pipeline for buyer
 * outreach on a deal). Enables AI chat to answer questions like:
 *   - "Which buyers have been introduced to this deal?"
 *   - "What's the conversion rate from introduction to pipeline?"
 *   - "Show me all buyers I've pitched [buyer X] to across all deals."
 *
 * Previously there was no tool that queried `buyer_introductions`, so
 * introduction-related questions always failed (WF-13 gap).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
type SupabaseClient = ReturnType<typeof createClient>;
import type { ClaudeTool } from '../../_shared/claude-client.ts';
import type { ToolResult } from './index.ts';

// ---------- Tool definitions ----------

export const introductionTools: ClaudeTool[] = [
  {
    name: 'get_deal_introductions',
    description:
      'List buyer introductions for a specific deal (the Kanban pipeline of buyers being pitched on this listing). Returns each introduction with buyer name, PE firm, current Kanban status, score snapshot, and dates. Use when the user asks "which buyers have we introduced to this deal?", "who is in the pipeline for deal X?", "show me the Kanban for [deal]".',
    input_schema: {
      type: 'object',
      properties: {
        listing_id: {
          type: 'string',
          description: 'UUID of the deal/listing to fetch introductions for.',
        },
        status: {
          type: 'string',
          description:
            'Optional filter by introduction_status: need_to_show_deal, outreach_initiated, meeting_scheduled, fit_and_interested, not_a_fit, deal_created',
        },
        limit: {
          type: 'number',
          description: 'Max introductions to return (default 50)',
        },
      },
      required: ['listing_id'],
    },
  },
  {
    name: 'get_buyer_introductions_history',
    description:
      'Show every deal a given buyer has been introduced to, with the current Kanban status and dates. Use when the user asks "which deals have we pitched [buyer] on?", "what is [buyer]\'s introduction history?", "has [buyer] ever been approved for a deal?".',
    input_schema: {
      type: 'object',
      properties: {
        buyer_id: {
          type: 'string',
          description: 'UUID of the buyer (remarketing_buyer_id).',
        },
        limit: {
          type: 'number',
          description: 'Max introductions to return (default 50)',
        },
      },
      required: ['buyer_id'],
    },
  },
  {
    name: 'get_introduction_conversion_stats',
    description:
      'Calculate conversion funnel stats for buyer introductions on one deal OR across all deals. Returns counts and percentages for each stage: need_to_show_deal → outreach_initiated → meeting_scheduled → fit_and_interested → deal_created, plus not_a_fit. Use when the user asks "what is the conversion rate from introduction to pipeline on this deal?", "how many introductions turned into meetings?", "what\'s the pipeline conversion funnel?".',
    input_schema: {
      type: 'object',
      properties: {
        listing_id: {
          type: 'string',
          description:
            'Optional listing UUID. If omitted, stats are calculated across all active deals.',
        },
        days: {
          type: 'number',
          description: 'Restrict to introductions created in the last N days (default: all time).',
        },
      },
      required: [],
    },
  },
];

// ---------- Executor ----------

export async function executeIntroductionTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'get_deal_introductions':
        return await getDealIntroductions(supabase, args);
      case 'get_buyer_introductions_history':
        return await getBuyerIntroductionsHistory(supabase, args);
      case 'get_introduction_conversion_stats':
        return await getIntroductionConversionStats(supabase, args);
      default:
        return { error: `Unknown introduction tool: ${toolName}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function getDealIntroductions(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const listingId = args.listing_id as string;
  const status = args.status as string | undefined;
  const limit = (args.limit as number) || 50;

  if (!listingId) return { error: 'listing_id is required' };

  let query = (supabase as any)
    .from('buyer_introductions')
    .select(
      'id, buyer_name, buyer_firm_name, remarketing_buyer_id, introduction_status, introduction_date, passed_date, passed_reason, score_snapshot, created_at, updated_at',
    )
    .eq('listing_id', listingId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('introduction_status', status);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    data: {
      count: (data || []).length,
      introductions: (data || []).map((row: any) => ({
        id: row.id,
        buyer_name: row.buyer_name,
        buyer_firm_name: row.buyer_firm_name,
        buyer_id: row.remarketing_buyer_id,
        status: row.introduction_status,
        composite_score: row.score_snapshot?.composite_score ?? null,
        tier: row.score_snapshot?.tier ?? null,
        pe_firm_name: row.score_snapshot?.pe_firm_name ?? null,
        introduction_date: row.introduction_date,
        passed_date: row.passed_date,
        passed_reason: row.passed_reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    },
  };
}

async function getBuyerIntroductionsHistory(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const buyerId = args.buyer_id as string;
  const limit = (args.limit as number) || 50;

  if (!buyerId) return { error: 'buyer_id is required' };

  const { data, error } = await (supabase as any)
    .from('buyer_introductions')
    .select(
      'id, listing_id, buyer_name, buyer_firm_name, introduction_status, introduction_date, passed_date, passed_reason, score_snapshot, created_at, updated_at',
    )
    .eq('remarketing_buyer_id', buyerId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { error: error.message };

  // Enrich with listing titles so the AI can reference them by name.
  const listingIds = Array.from(
    new Set((data || []).map((r: any) => r.listing_id).filter(Boolean)),
  );
  let listingMap: Record<string, string> = {};
  if (listingIds.length > 0) {
    const { data: listings } = await (supabase as any)
      .from('listings')
      .select('id, title, internal_company_name')
      .in('id', listingIds);
    listingMap = Object.fromEntries(
      (listings || []).map((l: any) => [l.id, l.internal_company_name || l.title || 'Untitled']),
    );
  }

  return {
    data: {
      count: (data || []).length,
      introductions: (data || []).map((row: any) => ({
        id: row.id,
        listing_id: row.listing_id,
        listing_title: row.listing_id ? listingMap[row.listing_id] || null : null,
        status: row.introduction_status,
        composite_score: row.score_snapshot?.composite_score ?? null,
        introduction_date: row.introduction_date,
        passed_date: row.passed_date,
        passed_reason: row.passed_reason,
        created_at: row.created_at,
      })),
    },
  };
}

async function getIntroductionConversionStats(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const listingId = args.listing_id as string | undefined;
  const days = args.days as number | undefined;

  let query = (supabase as any)
    .from('buyer_introductions')
    .select('introduction_status, created_at')
    .is('archived_at', null);

  if (listingId) {
    query = query.eq('listing_id', listingId);
  }
  if (days && days > 0) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', since);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  const rows = (data || []) as Array<{ introduction_status: string }>;
  const total = rows.length;

  // Count each terminal status. An introduction can progress through stages,
  // so "conversion" uses current status snapshot, not full history.
  const counts = {
    need_to_show_deal: 0,
    outreach_initiated: 0,
    meeting_scheduled: 0,
    fit_and_interested: 0,
    deal_created: 0,
    not_a_fit: 0,
  };
  for (const row of rows) {
    const s = row.introduction_status;
    if (s in counts) (counts as Record<string, number>)[s]++;
  }

  const reached = (target: number) => (total > 0 ? Math.round((target / total) * 1000) / 10 : 0);

  // Funnel: buyers that advanced to or beyond each stage.
  const beyondNeedToShow =
    counts.outreach_initiated +
    counts.meeting_scheduled +
    counts.fit_and_interested +
    counts.deal_created;
  const beyondMeeting = counts.fit_and_interested + counts.deal_created;
  const beyondInterest = counts.deal_created;

  return {
    data: {
      scope: listingId ? 'single_deal' : 'all_deals',
      listing_id: listingId || null,
      window_days: days || null,
      total_introductions: total,
      counts_by_status: counts,
      funnel: {
        introduced_pct: reached(beyondNeedToShow),
        meeting_pct: reached(beyondMeeting),
        interested_pct: reached(beyondInterest),
        deal_pipeline_pct: reached(counts.deal_created),
        not_a_fit_pct: reached(counts.not_a_fit),
      },
      summary:
        total === 0
          ? 'No introductions found in scope.'
          : `${total} introductions — ${beyondNeedToShow} moved past initial show (${reached(beyondNeedToShow)}%), ${counts.deal_created} became pipeline deals (${reached(counts.deal_created)}%), ${counts.not_a_fit} passed (${reached(counts.not_a_fit)}%).`,
    },
  };
}
