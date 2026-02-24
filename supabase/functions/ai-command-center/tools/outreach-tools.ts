/**
 * Outreach Tracking Tools
 * Track data room access and buyer outreach status.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- Tool definitions ----------

export const outreachTools: ClaudeTool[] = [
  {
    name: 'get_outreach_status',
    description: 'Get outreach and data room access status for a deal — who has been contacted, who has data room access, pending outreach, and engagement timeline.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        buyer_id: { type: 'string', description: 'Optional: filter to a specific buyer' },
      },
      required: ['deal_id'],
    },
  },
];

// ---------- Executor ----------

export async function executeOutreachTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_outreach_status': return getOutreachStatus(supabase, args);
    default: return { error: `Unknown outreach tool: ${toolName}` };
  }
}

// ---------- Implementations ----------

async function getOutreachStatus(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;

  // Parallel fetch: data_room_access + deal_data_room_access + scores with status
  const queries: Promise<unknown>[] = [
    supabase
      .from('data_room_access')
      .select('id, deal_id, remarketing_buyer_id, contact_id, can_view_teaser, can_view_full_memo, can_view_data_room, granted_at, granted_by, last_access_at, link_sent_at, link_sent_to_email, revoked_at')
      .eq('deal_id', dealId),
    supabase
      .from('deal_data_room_access')
      .select('id, deal_id, buyer_id, buyer_name, buyer_email, buyer_firm, is_active, granted_at, last_accessed_at, nda_signed_at, fee_agreement_signed_at, revoked_at')
      .eq('deal_id', dealId),
    supabase
      .from('remarketing_scores')
      .select('buyer_id, status, composite_score, tier')
      .eq('listing_id', dealId),
  ];

  const [accessResult, dealAccessResult, scoresResult] = await Promise.all(queries) as [
    { data: unknown[] | null; error: { message: string } | null },
    { data: unknown[] | null; error: { message: string } | null },
    { data: Array<{ buyer_id: string; status: string; composite_score: number; tier: string | null }> | null; error: { message: string } | null },
  ];

  if (accessResult.error) return { error: accessResult.error.message };

  const access = accessResult.data || [];
  const dealAccess = dealAccessResult.data || [];
  const scores = scoresResult.data || [];

  // Filter to specific buyer if requested
  let filteredAccess = access;
  let filteredDealAccess = dealAccess;
  if (args.buyer_id) {
    const bid = args.buyer_id as string;
    filteredAccess = access.filter((a: Record<string, unknown>) => a.remarketing_buyer_id === bid);
    filteredDealAccess = dealAccess.filter((a: Record<string, unknown>) => a.buyer_id === bid);
  }

  // Compute status summary from scores
  const statusCounts: Record<string, number> = {};
  for (const s of scores) {
    const st = s.status?.toUpperCase() || 'PENDING';
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  }

  return {
    data: {
      data_room_access: filteredAccess,
      deal_data_room_access: filteredDealAccess,
      buyer_status_summary: statusCounts,
      total_scored_buyers: scores.length,
      deal_id: dealId,
    },
  };
}
