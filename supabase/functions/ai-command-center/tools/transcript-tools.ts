/**
 * Transcript & Meeting Intelligence Tools
 * Search call transcripts, Fireflies meetings, and extract action items.
 *
 * MERGED Feb 2026: search_buyer_transcripts, search_transcripts, search_fireflies
 * → unified search_transcripts with a `source` parameter.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from '../../_shared/claude-client.ts';
import type { ToolResult } from './index.ts';

// ---------- Tool definitions ----------

export const transcriptTools: ClaudeTool[] = [
  {
    name: 'search_transcripts',
    description:
      'Search call transcripts and meeting recordings across all sources (call transcripts, buyer transcripts, Fireflies deal transcripts). Use the `source` parameter to target a specific source, or omit it to search all. Returns matching transcript excerpts with key quotes, insights, and extracted data.',
    input_schema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          enum: ['call_transcripts', 'buyer_transcripts', 'fireflies', 'all'],
          description:
            'Which transcript source to search: "call_transcripts" for deal call transcripts, "buyer_transcripts" for buyer-specific transcripts, "fireflies" for Fireflies meeting recordings, "all" for all sources (default "all")',
        },
        deal_id: { type: 'string', description: 'Filter by deal/listing UUID' },
        buyer_id: { type: 'string', description: 'Filter by buyer UUID' },
        keywords: {
          type: 'string',
          description:
            'Search keywords across transcript text, key quotes, insights, and extracted data. Also used as the "search" term for Fireflies transcripts.',
        },
        ceo_detected: {
          type: 'boolean',
          description: 'Filter call transcripts where CEO was detected',
        },
        call_type: { type: 'string', description: 'Filter call transcripts by call type' },
        has_extracted_data: {
          type: 'boolean',
          description: 'Only return Fireflies transcripts with extracted data',
        },
        limit: { type: 'number', description: 'Max results per source (default 10, max 25)' },
      },
      required: [],
    },
  },
  {
    name: 'get_meeting_action_items',
    description:
      'Extract action items and follow-ups from deal meeting transcripts. Consolidates extracted_data from recent transcripts into a task list.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        limit: { type: 'number', description: 'Max transcripts to scan (default 5)' },
      },
      required: ['deal_id'],
    },
  },
];

// ---------- Executor ----------

export async function executeTranscriptTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    // Merged tool
    case 'search_transcripts':
      return searchTranscriptsUnified(supabase, args);
    // Backward compatibility aliases for old tool names
    case 'search_buyer_transcripts':
      return searchTranscriptsUnified(supabase, { ...args, source: 'buyer_transcripts' });
    case 'search_fireflies':
      return searchTranscriptsUnified(supabase, {
        ...args,
        source: 'fireflies',
        keywords: args.search || args.keywords,
      });
    // Standalone
    case 'get_meeting_action_items':
      return getMeetingActionItems(supabase, args);
    default:
      return { error: `Unknown transcript tool: ${toolName}` };
  }
}

// ---------- Unified search_transcripts ----------

async function searchTranscriptsUnified(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const source = (args.source as string) || 'all';
  const limit = Math.min(Number(args.limit) || 10, 25);

  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  // Search call_transcripts
  if (source === 'all' || source === 'call_transcripts') {
    const res = await searchCallTranscripts(supabase, args, limit);
    if (res.error) errors.push(`call_transcripts: ${res.error}`);
    else results.call_transcripts = res.data;
  }

  // Search buyer_transcripts
  if (source === 'all' || source === 'buyer_transcripts') {
    const res = await searchBuyerTranscripts(supabase, args, limit);
    if (res.error) errors.push(`buyer_transcripts: ${res.error}`);
    else results.buyer_transcripts = res.data;
  }

  // Search fireflies (deal_transcripts)
  if (source === 'all' || source === 'fireflies') {
    const res = await searchFireflies(supabase, args, limit);
    if (res.error) errors.push(`fireflies: ${res.error}`);
    else results.fireflies = res.data;
  }

  // Compute totals
  const totalCount =
    ((results.call_transcripts as any)?.total || 0) +
    ((results.buyer_transcripts as any)?.total || 0) +
    ((results.fireflies as any)?.total || 0);

  return {
    data: {
      source_filter: source,
      ...results,
      total_across_sources: totalCount,
      ...(errors.length > 0 ? { errors } : {}),
    },
  };
}

// ---------- call_transcripts source ----------

async function searchCallTranscripts(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  limit: number,
): Promise<ToolResult> {
  let query = supabase
    .from('call_transcripts')
    .select(
      'id, created_at, call_type, ceo_detected, key_quotes, extracted_insights, transcript_text, listing_id, buyer_id',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.deal_id) query = query.eq('listing_id', args.deal_id as string);
  if (args.buyer_id) query = query.eq('buyer_id', args.buyer_id as string);
  if (args.ceo_detected === true) query = query.eq('ceo_detected', true);
  if (args.call_type) query = query.eq('call_type', args.call_type as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  let results = data || [];

  // Client-side keyword search
  if (args.keywords) {
    const term = (args.keywords as string).toLowerCase();
    results = results.filter((t: any) => {
      const text = (t.transcript_text || '').toLowerCase();
      const quotes = JSON.stringify(t.key_quotes || []).toLowerCase();
      const insights = JSON.stringify(t.extracted_insights || []).toLowerCase();
      return text.includes(term) || quotes.includes(term) || insights.includes(term);
    });
  }

  // Return summaries (truncate transcript_text for response size)
  const summaries = results.map((t: any) => ({
    id: t.id,
    deal_id: t.listing_id,
    buyer_id: t.buyer_id,
    created_at: t.created_at,
    call_type: t.call_type,
    ceo_detected: t.ceo_detected,
    key_quotes: t.key_quotes,
    extracted_insights: t.extracted_insights,
    preview: t.transcript_text?.substring(0, 500) || null,
  }));

  return {
    data: {
      transcripts: summaries,
      total: summaries.length,
    },
  };
}

// ---------- buyer_transcripts source ----------

async function searchBuyerTranscripts(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  limit: number,
): Promise<ToolResult> {
  let query = supabase
    .from('buyer_transcripts')
    .select(
      'id, buyer_id, created_at, transcript_text, extracted_data, extracted_insights, extraction_status, fireflies_transcript_id, fireflies_url',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.buyer_id) query = query.eq('buyer_id', args.buyer_id as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  let results = data || [];

  // Client-side keyword filter
  if (args.keywords) {
    const term = (args.keywords as string).toLowerCase();
    results = results.filter((t: any) => {
      const text = (t.transcript_text || '').toLowerCase();
      const insights = JSON.stringify(t.extracted_insights || {}).toLowerCase();
      const extractedData = JSON.stringify(t.extracted_data || {}).toLowerCase();
      return text.includes(term) || insights.includes(term) || extractedData.includes(term);
    });
  }

  const summaries = results.map((t: any) => ({
    id: t.id,
    buyer_id: t.buyer_id,
    created_at: t.created_at,
    extraction_status: t.extraction_status,
    extracted_insights: t.extracted_insights,
    extracted_data: t.extracted_data,
    has_fireflies: !!t.fireflies_transcript_id,
    preview: t.transcript_text?.substring(0, 500) || null,
  }));

  return {
    data: {
      transcripts: summaries,
      total: summaries.length,
    },
  };
}

// ---------- fireflies / deal_transcripts source ----------

async function searchFireflies(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  limit: number,
): Promise<ToolResult> {
  let query = supabase
    .from('deal_transcripts')
    .select(
      'id, title, listing_id, call_date, duration_minutes, source, meeting_attendees, external_participants, extracted_data, extraction_status, transcript_text, fireflies_meeting_id, created_at',
    )
    .order('call_date', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (args.deal_id) query = query.eq('listing_id', args.deal_id as string);
  if (args.has_extracted_data === true) query = query.not('extracted_data', 'is', null);

  const { data, error } = await query;
  if (error) return { error: error.message };

  let results = data || [];

  // Client-side search (keywords param used as search term for fireflies)
  const searchTerm = args.keywords || args.search;
  if (searchTerm) {
    const term = (searchTerm as string).toLowerCase();
    results = results.filter(
      (t: any) =>
        t.title?.toLowerCase().includes(term) ||
        t.transcript_text?.toLowerCase().includes(term) ||
        t.meeting_attendees?.some((a: string) => a.toLowerCase().includes(term)) ||
        t.external_participants?.some((p: string) => p.toLowerCase().includes(term)) ||
        JSON.stringify(t.extracted_data || {})
          .toLowerCase()
          .includes(term),
    );
  }

  // Truncate transcript for response size
  const summaries = results.map((t: any) => ({
    id: t.id,
    title: t.title,
    deal_id: t.listing_id,
    call_date: t.call_date,
    duration_minutes: t.duration_minutes,
    source: t.source,
    attendees: t.meeting_attendees,
    external_participants: t.external_participants,
    extracted_data: t.extracted_data,
    extraction_status: t.extraction_status,
    has_fireflies: !!t.fireflies_meeting_id,
    preview: t.transcript_text?.substring(0, 500) || null,
  }));

  return {
    data: {
      meetings: summaries,
      total: summaries.length,
    },
  };
}

// ---------- get_meeting_action_items ----------

async function getMeetingActionItems(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const limit = Math.min(Number(args.limit) || 5, 10);

  // Fetch recent deal transcripts with extracted data
  const { data: transcripts, error } = await supabase
    .from('deal_transcripts')
    .select('id, title, call_date, extracted_data, meeting_attendees')
    .eq('listing_id', dealId)
    .not('extracted_data', 'is', null)
    .order('call_date', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) return { error: error.message };

  // Also fetch call_transcripts for the deal
  const { data: callTranscripts } = await supabase
    .from('call_transcripts')
    .select('id, created_at, extracted_insights, key_quotes, call_type')
    .eq('listing_id', dealId)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Consolidate action items from extracted_data
  const actionItems: Array<{
    source: string;
    meeting_date: string | null;
    meeting_title: string | null;
    items: unknown;
  }> = [];

  for (const t of transcripts || []) {
    const extracted = t.extracted_data as Record<string, unknown> | null;
    if (extracted) {
      actionItems.push({
        source: 'deal_transcript',
        meeting_date: t.call_date,
        meeting_title: t.title,
        items: extracted.action_items || extracted.follow_ups || extracted.next_steps || extracted,
      });
    }
  }

  // Also include insights from call_transcripts
  for (const ct of callTranscripts || []) {
    if (ct.extracted_insights) {
      actionItems.push({
        source: 'call_transcript',
        meeting_date: ct.created_at,
        meeting_title: `${ct.call_type || 'Call'} transcript`,
        items: ct.extracted_insights,
      });
    }
  }

  return {
    data: {
      action_items: actionItems,
      total_meetings_scanned: (transcripts || []).length + (callTranscripts || []).length,
      deal_id: dealId,
    },
  };
}
