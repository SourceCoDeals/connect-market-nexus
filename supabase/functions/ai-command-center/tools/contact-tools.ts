/**
 * Contact & Document Tools
 * Unified contacts table (buyer + seller), data room documents, deal memos.
 * Updated Feb 2026: All contact queries now use the unified `contacts` table.
 * Legacy tables (pe_firm_contacts, platform_contacts) have been dropped.
 * remarketing_buyer_contacts is frozen (read-only pre-Feb 2026 data).
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- Tool definitions ----------

export const contactTools: ClaudeTool[] = [
  {
    name: 'search_pe_contacts',
    description: 'Search buyer contacts at PE firms and platform companies — partners, principals, deal team members, corp dev contacts. Queries the unified contacts table (contact_type=buyer). Includes email, phone, LinkedIn, role, and priority level. Use to find the right person to contact at a buyer organization.',
    input_schema: {
      type: 'object',
      properties: {
        buyer_id: { type: 'string', description: 'Filter to contacts for a specific remarketing_buyer UUID (via remarketing_buyer_id)' },
        firm_id: { type: 'string', description: 'Filter to contacts at a specific firm (via firm_id → firm_agreements)' },
        search: { type: 'string', description: 'Search across first_name, last_name, title, email' },
        role_category: { type: 'string', description: 'Filter by role: partner, principal, director, vp, associate, analyst, operating_partner, ceo, cfo, coo, corp_dev, business_dev' },
        is_primary: { type: 'boolean', description: 'Filter to primary contacts at their firm only' },
        has_email: { type: 'boolean', description: 'Filter to contacts with email addresses' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'search_contacts',
    description: 'Search the unified contacts table — the source of truth for ALL buyer and seller contacts since Feb 2026. Use contact_type to filter: "buyer" for PE/platform/independent buyers, "seller" for deal owners/principals. Seller contacts are linked to deals via listing_id. Buyer contacts link to remarketing_buyers via remarketing_buyer_id.',
    input_schema: {
      type: 'object',
      properties: {
        contact_type: { type: 'string', enum: ['buyer', 'seller', 'advisor', 'internal', 'all'], description: 'Filter by contact type (default "all")' },
        listing_id: { type: 'string', description: 'Filter seller contacts by deal/listing UUID' },
        remarketing_buyer_id: { type: 'string', description: 'Filter buyer contacts by remarketing buyer UUID' },
        firm_id: { type: 'string', description: 'Filter buyer contacts by firm agreement UUID' },
        search: { type: 'string', description: 'Search across first_name, last_name, title, email' },
        is_primary: { type: 'boolean', description: 'Filter to primary contacts at their firm' },
        has_email: { type: 'boolean', description: 'Filter to contacts with email addresses' },
        nda_signed: { type: 'boolean', description: 'Filter by NDA signed status' },
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
    case 'search_contacts': return searchContacts(supabase, args);
    case 'get_firm_agreements': return getFirmAgreements(supabase, args);
    case 'get_nda_logs': return getNdaLogs(supabase, args);
    case 'get_deal_documents': return getDealDocuments(supabase, args);
    case 'get_deal_memos': return getDealMemos(supabase, args);
    default: return { error: `Unknown contact tool: ${toolName}` };
  }
}

// ---------- Implementations ----------

/**
 * Search buyer contacts via the unified contacts table.
 * Replaces legacy queries to pe_firm_contacts, platform_contacts (both dropped),
 * and remarketing_buyer_contacts (frozen pre-Feb 2026).
 */
async function searchPeContacts(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 500);

  const contactFields = 'id, first_name, last_name, email, phone, title, contact_type, firm_id, remarketing_buyer_id, profile_id, is_primary_at_firm, nda_signed, fee_agreement_signed, linkedin_url, source, archived, created_at';

  let query = supabase
    .from('contacts')
    .select(contactFields)
    .eq('contact_type', 'buyer')
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.buyer_id) query = query.eq('remarketing_buyer_id', args.buyer_id as string);
  if (args.firm_id) query = query.eq('firm_id', args.firm_id as string);
  if (args.role_category) query = query.eq('title', args.role_category as string);
  if (args.is_primary === true) query = query.eq('is_primary_at_firm', true);
  if (args.has_email === true) query = query.not('email', 'is', null);

  const { data, error } = await query;
  if (error) return { error: error.message };

  let results = (data || []) as Array<Record<string, unknown>>;

  // Client-side search filter
  if (args.search) {
    const term = (args.search as string).toLowerCase();
    results = results.filter(c =>
      (c.first_name as string)?.toLowerCase().includes(term) ||
      (c.last_name as string)?.toLowerCase().includes(term) ||
      (c.title as string)?.toLowerCase().includes(term) ||
      (c.email as string)?.toLowerCase().includes(term) ||
      `${(c.first_name as string) || ''} ${(c.last_name as string) || ''}`.toLowerCase().includes(term)
    );
  }

  return {
    data: {
      contacts: results.slice(0, limit),
      total: results.length,
      with_email: results.filter(c => c.email).length,
      source: 'unified_contacts_table',
    },
  };
}

/**
 * Search the unified contacts table — source of truth for ALL contacts (buyer + seller + advisor + internal).
 * Added Feb 2026 as part of the unified contacts migration.
 */
async function searchContacts(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 500);
  const contactType = (args.contact_type as string) || 'all';

  const contactFields = 'id, first_name, last_name, email, phone, title, contact_type, firm_id, remarketing_buyer_id, profile_id, listing_id, is_primary_at_firm, nda_signed, fee_agreement_signed, linkedin_url, source, archived, created_at';

  let query = supabase
    .from('contacts')
    .select(contactFields)
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (contactType !== 'all') query = query.eq('contact_type', contactType);
  if (args.listing_id) query = query.eq('listing_id', args.listing_id as string);
  if (args.remarketing_buyer_id) query = query.eq('remarketing_buyer_id', args.remarketing_buyer_id as string);
  if (args.firm_id) query = query.eq('firm_id', args.firm_id as string);
  if (args.is_primary === true) query = query.eq('is_primary_at_firm', true);
  if (args.has_email === true) query = query.not('email', 'is', null);
  if (args.nda_signed === true) query = query.eq('nda_signed', true);
  if (args.nda_signed === false) query = query.eq('nda_signed', false);

  const { data, error } = await query;
  if (error) return { error: error.message };

  let results = (data || []) as Array<Record<string, unknown>>;

  // Client-side search filter
  if (args.search) {
    const term = (args.search as string).toLowerCase();
    results = results.filter(c =>
      (c.first_name as string)?.toLowerCase().includes(term) ||
      (c.last_name as string)?.toLowerCase().includes(term) ||
      (c.title as string)?.toLowerCase().includes(term) ||
      (c.email as string)?.toLowerCase().includes(term) ||
      `${(c.first_name as string) || ''} ${(c.last_name as string) || ''}`.toLowerCase().includes(term)
    );
  }

  return {
    data: {
      contacts: results.slice(0, limit),
      total: results.length,
      with_email: results.filter(c => c.email).length,
      by_type: {
        buyer: results.filter(c => c.contact_type === 'buyer').length,
        seller: results.filter(c => c.contact_type === 'seller').length,
        advisor: results.filter(c => c.contact_type === 'advisor').length,
        internal: results.filter(c => c.contact_type === 'internal').length,
      },
      source: 'unified_contacts_table',
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
