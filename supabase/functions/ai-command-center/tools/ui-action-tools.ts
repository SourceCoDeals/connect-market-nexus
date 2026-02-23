/**
 * UI Action Tools
 * Return structured commands that the frontend executes —
 * selecting rows, applying filters, sorting columns, navigating to pages.
 *
 * These tools don't query the database directly. They return
 * UI action payloads that the frontend chat panel intercepts
 * and dispatches to the appropriate UI components.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- UI Action payload types ----------

export interface UIAction {
  type: 'select_rows' | 'apply_filter' | 'sort_column' | 'navigate' | 'highlight_rows' | 'clear_selection';
  target: string;  // Which UI component to target (e.g. 'buyers_table', 'deals_table')
  payload: Record<string, unknown>;
}

// ---------- Tool definitions ----------

export const uiActionTools: ClaudeTool[] = [
  {
    name: 'select_table_rows',
    description: 'Select specific rows in a frontend data table by their IDs. Use this when the user asks to select, check, or pick specific deals, buyers, or leads. The frontend will programmatically check/select the matching rows.',
    input_schema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          enum: ['buyers', 'deals', 'leads', 'scores', 'transcripts'],
          description: 'Which table to select rows in',
        },
        row_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of row UUIDs to select',
        },
        select_mode: {
          type: 'string',
          enum: ['replace', 'add', 'toggle'],
          description: 'How to apply selection: replace (clear existing), add (keep existing), toggle. Default: replace',
        },
      },
      required: ['table', 'row_ids'],
    },
  },
  {
    name: 'apply_table_filter',
    description: 'Apply filters to a frontend data table. Use when the user asks to show, filter, or narrow down to specific criteria like "show all buyers in Texas" or "filter to deals over $5M revenue".',
    input_schema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          enum: ['buyers', 'deals', 'leads', 'scores'],
          description: 'Which table to filter',
        },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string', description: 'Column/field name to filter on' },
              operator: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in'], description: 'Filter operator' },
              value: { description: 'Filter value (string, number, or array for "in" operator)' },
            },
            required: ['field', 'operator', 'value'],
          },
          description: 'Array of filter conditions to apply',
        },
        clear_existing: {
          type: 'boolean',
          description: 'Clear existing filters before applying new ones (default true)',
        },
      },
      required: ['table', 'filters'],
    },
  },
  {
    name: 'sort_table_column',
    description: 'Sort a frontend data table by a specific column. Use when the user asks to sort, order, or arrange results by a field like "sort by revenue" or "order by state".',
    input_schema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          enum: ['buyers', 'deals', 'leads', 'scores'],
          description: 'Which table to sort',
        },
        field: {
          type: 'string',
          description: 'Column/field name to sort by (e.g. revenue, ebitda, deal_name, score, added, location, industry, priority, googleRating, googleReviews, linkedinCount)',
        },
        direction: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort direction: asc (smallest first) or desc (largest first). Default: desc',
        },
      },
      required: ['table', 'field'],
    },
  },
  {
    name: 'navigate_to_page',
    description: 'Navigate the user to a specific page or view in the application. Use when the user asks to go to a deal, buyer profile, or specific section.',
    input_schema: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          enum: ['deal_detail', 'buyer_profile', 'pipeline', 'buyers_list', 'remarketing', 'data_room', 'transcripts', 'analytics', 'all_deals', 'captarget', 'gp_partners', 'valuation_leads', 'owner_leads', 'referral_partners'],
          description: 'Target page/view',
        },
        entity_id: { type: 'string', description: 'ID of the entity to navigate to (deal_id or buyer_id)' },
        tab: { type: 'string', description: 'Optional tab within the page to open' },
      },
      required: ['page'],
    },
  },
];

// ---------- Executor ----------

export async function executeUIActionTool(
  _supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'select_table_rows': return selectTableRows(args);
    case 'apply_table_filter': return applyTableFilter(args);
    case 'sort_table_column': return sortTableColumn(args);
    case 'navigate_to_page': return navigateToPage(args);
    default: return { error: `Unknown UI action tool: ${toolName}` };
  }
}

// ---------- Implementations ----------
// These return UIAction payloads that the frontend processes.

function selectTableRows(args: Record<string, unknown>): ToolResult {
  const rowIds = args.row_ids as string[];
  const table = args.table as string;
  const selectMode = (args.select_mode as string) || 'replace';

  if (!rowIds || rowIds.length === 0) {
    return { error: 'No row IDs provided to select' };
  }

  const action: UIAction = {
    type: 'select_rows',
    target: `${table}_table`,
    payload: {
      row_ids: rowIds,
      select_mode: selectMode,
      count: rowIds.length,
    },
  };

  return {
    data: {
      ui_action: action,
      message: `Selected ${rowIds.length} row${rowIds.length === 1 ? '' : 's'} in the ${table} table`,
    },
  };
}

function applyTableFilter(args: Record<string, unknown>): ToolResult {
  const table = args.table as string;
  const filters = args.filters as Array<{ field: string; operator: string; value: unknown }>;
  const clearExisting = args.clear_existing !== false;

  if (!filters || filters.length === 0) {
    return { error: 'No filters provided' };
  }

  const action: UIAction = {
    type: 'apply_filter',
    target: `${table}_table`,
    payload: {
      filters,
      clear_existing: clearExisting,
    },
  };

  const filterDesc = filters.map(f => `${f.field} ${f.operator} ${JSON.stringify(f.value)}`).join(', ');

  return {
    data: {
      ui_action: action,
      message: `Applied filter${filters.length > 1 ? 's' : ''} to ${table} table: ${filterDesc}`,
    },
  };
}

function sortTableColumn(args: Record<string, unknown>): ToolResult {
  const table = args.table as string;
  const field = args.field as string;
  const direction = (args.direction as string) || 'desc';

  if (!field) {
    return { error: 'No field provided for sorting' };
  }

  const action: UIAction = {
    type: 'sort_column',
    target: `${table}_table`,
    payload: {
      field,
      direction,
    },
  };

  return {
    data: {
      ui_action: action,
      message: `Sorted ${table} table by ${field} (${direction})`,
    },
  };
}

function navigateToPage(args: Record<string, unknown>): ToolResult {
  const page = args.page as string;
  const entityId = args.entity_id as string;
  const tab = args.tab as string;

  // Build the route path
  const routeMap: Record<string, string> = {
    deal_detail: entityId ? `/deals/${entityId}` : '/deals',
    buyer_profile: entityId ? `/buyers/${entityId}` : '/buyers',
    pipeline: '/pipeline',
    buyers_list: '/buyers',
    remarketing: '/remarketing',
    all_deals: '/admin/remarketing/deals',
    captarget: '/admin/remarketing/captarget',
    gp_partners: '/admin/remarketing/gp-partners',
    valuation_leads: '/admin/remarketing/valuation-leads',
    owner_leads: '/admin/remarketing/owner-leads',
    referral_partners: '/admin/remarketing/referral-partners',
    data_room: entityId ? `/deals/${entityId}/data-room` : '/data-room',
    transcripts: entityId ? `/deals/${entityId}/transcripts` : '/transcripts',
    analytics: '/analytics',
  };

  const route = routeMap[page] || '/';

  const action: UIAction = {
    type: 'navigate',
    target: 'router',
    payload: {
      route,
      tab: tab || null,
      entity_id: entityId || null,
    },
  };

  return {
    data: {
      ui_action: action,
      message: `Navigating to ${page}${entityId ? ` (${entityId})` : ''}`,
    },
  };
}
