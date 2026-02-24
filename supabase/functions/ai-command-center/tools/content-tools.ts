/**
 * Content Generation Tools
 * Meeting prep briefs, outreach email drafts, pipeline reports.
 * These tools gather data and return structured content for Claude to synthesize.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- Tool definitions ----------

export const contentTools: ClaudeTool[] = [
  {
    name: 'generate_meeting_prep',
    description: 'Gather all data needed for a meeting prep brief — deal details, buyer/counterparty profile, past meeting transcripts, open tasks, and scoring. Returns structured data that Claude synthesizes into a briefing.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        buyer_id: { type: 'string', description: 'The buyer UUID (if meeting is with a specific buyer)' },
        meeting_context: { type: 'string', description: 'Brief context about the meeting (e.g. "First call with CEO", "NDA follow-up")' },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'draft_outreach_email',
    description: 'Gather buyer and deal context needed to draft a personalized outreach email. Returns structured data that Claude uses to compose the email.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        buyer_id: { type: 'string', description: 'The target buyer UUID' },
        email_type: {
          type: 'string',
          enum: ['initial_outreach', 'follow_up', 'teaser_intro', 'data_room_invite', 'meeting_request'],
          description: 'Type of email to draft',
        },
        tone: { type: 'string', enum: ['formal', 'warm', 'brief'], description: 'Email tone (default "warm")' },
      },
      required: ['deal_id', 'buyer_id'],
    },
  },
  {
    name: 'generate_pipeline_report',
    description: 'Gather comprehensive pipeline data for a weekly/monthly report. Returns aggregated metrics, deal status changes, and highlights.',
    input_schema: {
      type: 'object',
      properties: {
        period_days: { type: 'number', description: 'Report period in days (default 7 for weekly)' },
        include_details: { type: 'boolean', description: 'Include per-deal details (default false for summary)' },
      },
      required: [],
    },
  },
];

// ---------- Executor ----------

export async function executeContentTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'generate_meeting_prep': return generateMeetingPrep(supabase, args);
    case 'draft_outreach_email': return draftOutreachEmail(supabase, args);
    case 'generate_pipeline_report': return generatePipelineReport(supabase, args);
    default: return { error: `Unknown content tool: ${toolName}` };
  }
}

// ---------- Implementations ----------

async function generateMeetingPrep(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const buyerId = args.buyer_id as string | undefined;

  // Parallel fetch: deal + tasks + transcripts + (optional) buyer + score
  const queries: Promise<unknown>[] = [
    supabase.from('listings').select('*').eq('id', dealId).single(),
    supabase.from('deal_tasks').select('id, title, status, priority, due_date, assigned_to')
      .eq('deal_id', dealId).in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false }).limit(10),
    supabase.from('deal_transcripts').select('id, title, call_date, extracted_data, meeting_attendees, duration_minutes')
      .eq('listing_id', dealId).order('call_date', { ascending: false, nullsFirst: false }).limit(5),
    supabase.from('call_transcripts').select('id, created_at, call_type, ceo_detected, key_quotes, extracted_insights')
      .eq('listing_id', dealId).order('created_at', { ascending: false }).limit(5),
    supabase.from('deal_activities').select('id, title, activity_type, description, created_at')
      .eq('deal_id', dealId).order('created_at', { ascending: false }).limit(10),
  ];

  // Add buyer-specific queries if buyer is specified
  if (buyerId) {
    queries.push(
      supabase.from('remarketing_buyers').select('*').eq('id', buyerId).single(),
      supabase.from('remarketing_scores').select('*').eq('buyer_id', buyerId).eq('listing_id', dealId).single(),
      supabase.from('buyer_contacts').select('*').eq('buyer_id', buyerId).order('is_primary_contact', { ascending: false }),
    );
  }

  const results = await Promise.all(queries) as Array<{ data: unknown; error: { message: string } | null }>;

  const [dealResult, tasksResult, transcriptsResult, callTranscriptsResult, activitiesResult] = results;
  const buyerResult = buyerId ? results[5] : null;
  const scoreResult = buyerId ? results[6] : null;
  const contactsResult = buyerId ? results[7] : null;

  if (dealResult.error) return { error: dealResult.error.message };

  return {
    data: {
      deal: dealResult.data,
      open_tasks: (tasksResult as { data: unknown[] }).data || [],
      recent_meetings: (transcriptsResult as { data: unknown[] }).data || [],
      call_transcripts: (callTranscriptsResult as { data: unknown[] }).data || [],
      recent_activities: (activitiesResult as { data: unknown[] }).data || [],
      buyer: buyerResult?.data || null,
      buyer_score: scoreResult?.data || null,
      buyer_contacts: (contactsResult as { data: unknown[] } | null)?.data || [],
      meeting_context: args.meeting_context || null,
    },
  };
}

async function draftOutreachEmail(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const buyerId = args.buyer_id as string;

  // Parallel fetch: deal + buyer + score + contacts + past outreach
  const [dealResult, buyerResult, scoreResult, contactsResult, accessResult] = await Promise.all([
    supabase.from('listings').select(
      'id, title, industry, services, revenue, ebitda, location, address_state, geographic_states, executive_summary, investment_thesis, business_model, number_of_locations, full_time_employees'
    ).eq('id', dealId).single(),
    supabase.from('remarketing_buyers').select(
      'id, company_name, pe_firm_name, buyer_type, target_services, target_geographies, target_revenue_min, target_revenue_max, thesis_summary, acquisition_appetite, business_summary'
    ).eq('id', buyerId).single(),
    supabase.from('remarketing_scores').select('composite_score, geography_score, service_score, size_score, fit_reasoning')
      .eq('buyer_id', buyerId).eq('listing_id', dealId).single(),
    supabase.from('buyer_contacts').select('*').eq('buyer_id', buyerId).order('is_primary_contact', { ascending: false }).limit(3),
    supabase.from('deal_data_room_access').select('buyer_name, buyer_email, granted_at, is_active')
      .eq('deal_id', dealId).eq('buyer_id', buyerId),
  ]);

  if (dealResult.error) return { error: dealResult.error.message };
  if (buyerResult.error) return { error: buyerResult.error.message };

  return {
    data: {
      deal: dealResult.data,
      buyer: buyerResult.data,
      score: scoreResult.data || null,
      contacts: contactsResult.data || [],
      existing_access: accessResult.data || [],
      email_type: args.email_type || 'initial_outreach',
      tone: args.tone || 'warm',
    },
  };
}

async function generatePipelineReport(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const periodDays = Number(args.period_days) || 7;
  const includeDetails = args.include_details === true;
  const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  // Parallel fetch: current pipeline + recent activities + recent scoring + data room grants
  const [dealsResult, activitiesResult, scoresResult, accessResult, tasksResult] = await Promise.all([
    supabase.from('listings').select(
      'id, title, status, deal_source, industry, revenue, ebitda, deal_total_score, is_priority_target, remarketing_status, updated_at'
    ).is('deleted_at', null),
    supabase.from('deal_activities').select('deal_id, activity_type, title, created_at')
      .gte('created_at', cutoffDate).order('created_at', { ascending: false }),
    supabase.from('remarketing_scores').select('buyer_id, listing_id, status, composite_score, updated_at')
      .gte('updated_at', cutoffDate),
    supabase.from('deal_data_room_access').select('deal_id, buyer_name, granted_at, is_active')
      .gte('granted_at', cutoffDate),
    supabase.from('deal_tasks').select('deal_id, title, status, completed_at')
      .gte('created_at', cutoffDate),
  ]);

  const deals = dealsResult.data || [];
  const activities = activitiesResult.data || [];
  const scores = scoresResult.data || [];
  const accessGrants = accessResult.data || [];
  const tasks = tasksResult.data || [];

  // Aggregate metrics
  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalRevenue = 0;

  for (const d of deals) {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    bySource[d.deal_source || 'unknown'] = (bySource[d.deal_source || 'unknown'] || 0) + 1;
    totalRevenue += d.revenue || 0;
  }

  const activityByType: Record<string, number> = {};
  for (const a of activities) {
    activityByType[a.activity_type] = (activityByType[a.activity_type] || 0) + 1;
  }

  const scoreStatusChanges: Record<string, number> = {};
  for (const s of scores) {
    scoreStatusChanges[s.status] = (scoreStatusChanges[s.status] || 0) + 1;
  }

  return {
    data: {
      period_days: periodDays,
      period_start: cutoffDate,
      pipeline_snapshot: {
        total_deals: deals.length,
        by_status: byStatus,
        by_source: bySource,
        total_pipeline_revenue: totalRevenue,
        priority_count: deals.filter(d => d.is_priority_target).length,
      },
      period_activity: {
        total_activities: activities.length,
        by_type: activityByType,
        unique_deals_active: new Set(activities.map(a => a.deal_id)).size,
      },
      scoring_activity: {
        scores_updated: scores.length,
        by_status: scoreStatusChanges,
      },
      data_room: {
        new_grants: accessGrants.length,
        unique_deals: new Set(accessGrants.map(a => a.deal_id)).size,
      },
      tasks: {
        created: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
      },
      deal_details: includeDetails ? deals.slice(0, 50) : undefined,
    },
  };
}
