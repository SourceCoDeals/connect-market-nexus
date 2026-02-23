/**
 * Contact & Document Tools
 * PE firm contacts, platform contacts, data room documents, deal memos.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- Tool definitions ----------

export const contactTools: ClaudeTool[] = [
  {
    name: 'search_pe_contacts',
    description: 'Search contacts at PE firms and platform companies — partners, principals, deal team members, corp dev contacts. Includes email, phone, LinkedIn, role, and priority level. Use to find the right person to contact at a buyer organization.',
    input_schema: {
      type: 'object',
      properties: {
        buyer_id: { type: 'string', description: 'Filter to contacts for a specific buyer/PE firm/platform UUID' },
        search: { type: 'string', description: 'Search across name, title, email' },
        role_category: { type: 'string', description: 'Filter by role: partner, principal, director, vp, associate, analyst, operating_partner, ceo, cfo, coo, corp_dev, business_dev' },
        is_primary: { type: 'boolean', description: 'Filter to primary contacts only' },
        is_deal_team: { type: 'boolean', description: 'Filter to deal team members only' },
        has_email: { type: 'boolean', description: 'Filter to contacts with email addresses' },
        contact_type: { type: 'string', enum: ['pe_firm', 'platform', 'remarketing', 'all'], description: 'Which contact table to search (default "all" — searches pe_firm_contacts, platform_contacts, and remarketing_buyer_contacts)' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'get_deal_documents',
    description: 'Get documents associated with a deal — teasers, full memos, data room files. Includes file names, types, categories, and upload dates.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'Filter by deal/listing UUID' },
        category: { type: 'string', description: 'Filter by: anonymous_teaser, full_memo, data_room' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'get_firm_agreements',
    description: 'Get firm agreement status — which buyer firms/companies have signed NDAs and/or fee agreements. Each firm record consolidates all NDA and fee agreement activity for a company across all its members and connection requests.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search by company name or domain' },
        has_nda: { type: 'boolean', description: 'Filter to firms that have signed an NDA' },
        has_fee_agreement: { type: 'boolean', description: 'Filter to firms that have signed a fee agreement' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'get_nda_logs',
    description: 'Get NDA action logs — history of NDA emails sent, signed, revoked, and reminders sent. Each entry records the action type, recipient, admin who took the action, and timestamp. Use to audit NDA activity for a user or firm.',
    input_schema: {
      type: 'object',
      properties: {
        firm_id: { type: 'string', description: 'Filter by firm agreement UUID' },
        action_type: { type: 'string', description: 'Filter by action: sent, signed, revoked, reminder_sent' },
        days: { type: 'number', description: 'Lookback period in days (default 90)' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'get_deal_memos',
    description: 'Get AI-generated deal memos and teasers for a deal — anonymous teasers, full investment memos. Includes content, status, version, and publish dates.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'Filter by deal/listing UUID' },
        memo_type: { type: 'string', enum: ['anonymous_teaser', 'full_memo', 'all'], description: 'Filter by memo type (default "all")' },
        status: { type: 'string', description: 'Filter by status: draft, published, archived' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: [],
    },
  },
];

// ---------- Executor ----------

export async function executeContactTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'search_pe_contacts': return searchPeContacts(supabase, args);
    case 'get_firm_agreements': return getFirmAgreements(supabase, args);
    case 'get_nda_logs': return getNdaLogs(supabase, args);
    case 'get_deal_documents': return getDealDocuments(supabase, args);
    case 'get_deal_memos': return getDealMemos(supabase, args);
    default: return { error: `Unknown contact tool: ${toolName}` };
  }
}

// ---------- Implementations ----------

async function searchPeContacts(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 500);
  const contactType = (args.contact_type as string) || 'all';

  const commonFields = 'id, buyer_id, name, title, role_category, priority_level, is_primary_contact, linkedin_url, email, phone, email_confidence, source, is_deal_team, notes, created_at';
  const results: unknown[] = [];

  // PE firm contacts
  if (contactType === 'all' || contactType === 'pe_firm') {
    let query = supabase
      .from('pe_firm_contacts')
      .select(commonFields + ', pe_firm_id')
      .order('priority_level', { ascending: true })
      .limit(limit);

    if (args.buyer_id) query = query.eq('buyer_id', args.buyer_id as string);
    if (args.role_category) query = query.eq('role_category', args.role_category as string);
    if (args.is_primary === true) query = query.eq('is_primary_contact', true);
    if (args.is_deal_team === true) query = query.eq('is_deal_team', true);
    if (args.has_email === true) query = query.not('email', 'is', null);

    const { data } = await query;
    if (data) results.push(...data.map(c => ({ ...c, contact_source: 'pe_firm' })));
  }

  // Platform contacts
  if (contactType === 'all' || contactType === 'platform') {
    let query = supabase
      .from('platform_contacts')
      .select(commonFields + ', platform_id')
      .order('priority_level', { ascending: true })
      .limit(limit);

    if (args.buyer_id) query = query.eq('buyer_id', args.buyer_id as string);
    if (args.role_category) query = query.eq('role_category', args.role_category as string);
    if (args.is_primary === true) query = query.eq('is_primary_contact', true);
    if (args.is_deal_team === true) query = query.eq('is_deal_team', true);
    if (args.has_email === true) query = query.not('email', 'is', null);

    const { data } = await query;
    if (data) results.push(...data.map(c => ({ ...c, contact_source: 'platform' })));
  }

  // Remarketing buyer contacts (legacy/unified contact table)
  if (contactType === 'all' || contactType === 'remarketing') {
    const rmcFields = 'id, buyer_id, name, role, role_category, priority_level, is_primary_contact, linkedin_url, email, phone, email_confidence, source, is_deal_team, notes, company_type, created_at';
    let query = supabase
      .from('remarketing_buyer_contacts')
      .select(rmcFields)
      .order('priority_level', { ascending: true })
      .limit(limit);

    if (args.buyer_id) query = query.eq('buyer_id', args.buyer_id as string);
    if (args.role_category) query = query.eq('role_category', args.role_category as string);
    if (args.is_primary === true) query = query.eq('is_primary_contact', true);
    if (args.is_deal_team === true) query = query.eq('is_deal_team', true);
    if (args.has_email === true) query = query.not('email', 'is', null);

    const { data } = await query;
    if (data) results.push(...data.map(c => ({ ...c, contact_source: 'remarketing' })));
  }

  // Client-side search filter
  let filtered = results as Array<Record<string, unknown>>;
  if (args.search) {
    const term = (args.search as string).toLowerCase();
    filtered = filtered.filter(c =>
      (c.name as string)?.toLowerCase().includes(term) ||
      (c.title as string)?.toLowerCase().includes(term) ||
      (c.email as string)?.toLowerCase().includes(term)
    );
  }

  return {
    data: {
      contacts: filtered.slice(0, limit),
      total: filtered.length,
      with_email: filtered.filter(c => c.email).length,
    },
  };
}

async function getDealDocuments(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 200);

  let query = supabase
    .from('data_room_documents')
    .select('id, deal_id, folder_name, file_name, file_type, file_size_bytes, document_category, is_generated, version, allow_download, uploaded_by, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.deal_id) query = query.eq('deal_id', args.deal_id as string);
  if (args.category) query = query.eq('document_category', args.category as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  const docs = data || [];
  const byCategory: Record<string, number> = {};
  const byFolder: Record<string, number> = {};
  for (const d of docs) {
    byCategory[d.document_category] = (byCategory[d.document_category] || 0) + 1;
    byFolder[d.folder_name] = (byFolder[d.folder_name] || 0) + 1;
  }

  return {
    data: {
      documents: docs,
      total: docs.length,
      by_category: byCategory,
      by_folder: byFolder,
    },
  };
}

async function getDealMemos(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 10, 50);
  const memoType = (args.memo_type as string) || 'all';

  let query = supabase
    .from('lead_memos')
    .select('id, deal_id, memo_type, branding, status, version, pdf_storage_path, published_at, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (args.deal_id) query = query.eq('deal_id', args.deal_id as string);
  if (memoType !== 'all') query = query.eq('memo_type', memoType);
  if (args.status) query = query.eq('status', args.status as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    data: {
      memos: data || [],
      total: (data || []).length,
    },
  };
}

async function getFirmAgreements(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 500);

  let query = supabase
    .from('firm_agreements')
    .select('id, primary_company_name, normalized_company_name, website_domain, email_domain, fee_agreement_signed, fee_agreement_signed_at, nda_signed, nda_signed_at, nda_email_sent, nda_email_sent_at, fee_agreement_email_sent, fee_agreement_email_sent_at, member_count, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (args.has_nda === true) query = query.eq('nda_signed', true);
  if (args.has_fee_agreement === true) query = query.eq('fee_agreement_signed', true);

  const { data, error } = await query;
  if (error) return { error: error.message };

  let results = data || [];
  if (args.search) {
    const term = (args.search as string).toLowerCase();
    results = results.filter(f =>
      f.primary_company_name?.toLowerCase().includes(term) ||
      f.normalized_company_name?.toLowerCase().includes(term) ||
      f.website_domain?.toLowerCase().includes(term)
    );
  }

  return {
    data: {
      firms: results,
      total: results.length,
      nda_signed: results.filter(f => f.nda_signed).length,
      fee_agreement_signed: results.filter(f => f.fee_agreement_signed).length,
    },
  };
}

async function getNdaLogs(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 500);
  const days = Number(args.days) || 90;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  let query = supabase
    .from('nda_logs')
    .select('id, user_id, admin_id, admin_name, admin_email, action_type, email_sent_to, firm_id, notes, metadata, created_at')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.firm_id) query = query.eq('firm_id', args.firm_id as string);
  if (args.action_type) query = query.eq('action_type', args.action_type as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  const logs = data || [];
  const byAction: Record<string, number> = {};
  for (const l of logs) {
    byAction[l.action_type] = (byAction[l.action_type] || 0) + 1;
  }

  return {
    data: {
      logs,
      total: logs.length,
      by_action: byAction,
    },
  };
}
