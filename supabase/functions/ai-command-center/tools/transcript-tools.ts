/**
 * Transcript & Meeting Intelligence Tools
 * Search call transcripts, Fireflies meetings, and extract action items.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- Tool definitions ----------

export const transcriptTools: ClaudeTool[] = [
  {
    name: 'search_buyer_transcripts',
    description: 'Search transcripts linked to a specific buyer — buyer-level meeting recordings, Fireflies calls with buyer contacts, extracted insights and key quotes from buyer interactions.',
    input_schema: {
      type: 'object',
      properties: {
        buyer_id: { type: 'string', description: 'Filter by buyer UUID' },
        keywords: { type: 'string', description: 'Search keywords across transcript text and insights' },
        limit: { type: 'number', description: 'Max results (default 10, max 25)' },
      },
      required: [],
    },
  },
  {
    name: 'search_transcripts',
    description: 'Search call transcripts by deal, buyer, keywords, or date range. Returns matching transcript excerpts with key quotes and insights.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'Filter by deal/listing UUID' },
        buyer_id: { type: 'string', description: 'Filter by buyer UUID' },
        keywords: { type: 'string', description: 'Search keywords across transcript text, key quotes, and insights' },
        ceo_detected: { type: 'boolean', description: 'Filter to transcripts where CEO was detected' },
        call_type: { type: 'string', description: 'Filter by call type' },
        limit: { type: 'number', description: 'Max results (default 10, max 25)' },
      },
      required: [],
    },
  },
  {
    name: 'search_fireflies',
    description: 'Search Fireflies-sourced deal transcripts. These are linked meeting recordings with extracted data, participants, and action items.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'Filter by deal/listing UUID' },
        search: { type: 'string', description: 'Search across title, transcript text, and attendee names' },
        has_extracted_data: { type: 'boolean', description: 'Only return transcripts with extracted data' },
        limit: { type: 'number', description: 'Max results (default 10, max 25)' },
      },
      required: [],
    },
  },
  {
    name: 'get_meeting_action_items',
    description: 'Extract action items and follow-ups from deal meeting transcripts. Consolidates extracted_data from recent transcripts into a task list.',
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
    case 'search_buyer_transcripts': return searchBuyerTranscripts(supabase, args);
    case 'search_transcripts': return searchTranscripts(supabase, args);
    case 'search_fireflies': return searchFireflies(supabase, args);
    case 'get_meeting_action_items': return getMeetingActionItems(supabase, args);
    default: return { error: `Unknown transcript tool: ${toolName}` };
  }
}

// ---------- Buyer Transcripts ----------

async function searchBuyerTranscripts(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 10, 25);

  let query = supabase
    .from('buyer_transcripts')
    .select('id, buyer_id, created_at, transcript_text, extracted_data, extracted_insights, extraction_status, fireflies_transcript_id, fireflies_url')
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

// ---------- Implementations ----------

async function searchTranscripts(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 10, 25);

  let query = supabase
    .from('call_transcripts')
    .select('id, created_at, call_type, ceo_detected, key_quotes, extracted_insights, transcript_text, listing_id, buyer_id')
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

async function searchFireflies(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 10, 25);

  let query = supabase
    .from('deal_transcripts')
    .select('id, title, listing_id, call_date, duration_minutes, source, meeting_attendees, external_participants, extracted_data, extraction_status, transcript_text, fireflies_meeting_id, created_at')
    .order('call_date', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (args.deal_id) query = query.eq('listing_id', args.deal_id as string);
  if (args.has_extracted_data === true) query = query.not('extracted_data', 'is', null);

  const { data, error } = await query;
  if (error) return { error: error.message };

  let results = data || [];

  // Client-side search
  if (args.search) {
    const term = (args.search as string).toLowerCase();
    results = results.filter((t: any) =>
      t.title?.toLowerCase().includes(term) ||
      t.transcript_text?.toLowerCase().includes(term) ||
      t.meeting_attendees?.some((a: string) => a.toLowerCase().includes(term))
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
