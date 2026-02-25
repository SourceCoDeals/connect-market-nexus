/**
 * Integration Action Tools
 * Tools that integrate with external services: contact enrichment (Apify+Prospeo),
 * PhoneBurner dialer push, and DocuSeal document sending.
 *
 * These tools call external APIs directly using shared clients or API keys from env,
 * avoiding the need to call other edge functions (which require JWT auth).
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from '../../_shared/claude-client.ts';
import type { ToolResult } from './index.ts';
import {
  scrapeCompanyEmployees,
  resolveCompanyUrl,
  inferDomain,
} from '../../_shared/apify-client.ts';
import { batchEnrich, domainSearchEnrich, enrichContact } from '../../_shared/prospeo-client.ts';
import { findCompanyLinkedIn, googleSearch } from '../../_shared/apify-google-client.ts';

// ---------- Tool definitions ----------

export const integrationActionTools: ClaudeTool[] = [
  {
    name: 'google_search_companies',
    description:
      'Search Google for companies, people, or any business information via Apify. Returns Google search results with titles, URLs, and descriptions. Use this to discover companies, find LinkedIn pages, research firms, or verify company information. For example: "search Google for HVAC companies in Florida", "find the LinkedIn page for Trivest Partners", or "look up Acme Corp website".',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Google search query. For LinkedIn pages use "company name site:linkedin.com/company". For general company search just use the company name and criteria.',
        },
        max_results: {
          type: 'number',
          description: 'Maximum results to return (default 10, max 20)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'save_contacts_to_crm',
    description:
      'Save selected contacts to the CRM (unified contacts table) with buyer linkage. Use AFTER finding/enriching contacts when the user approves adding them. Takes contact data and links them to a remarketing buyer. REQUIRES CONFIRMATION. Use when the user says "add these contacts", "save the first 5", or "yes, add them to our system".',
    input_schema: {
      type: 'object',
      properties: {
        contacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              title: { type: 'string' },
              linkedin_url: { type: 'string' },
              company_name: { type: 'string' },
            },
          },
          description: 'Array of contacts to save',
        },
        remarketing_buyer_id: {
          type: 'string',
          description: 'Link contacts to this remarketing buyer (optional)',
        },
        listing_id: {
          type: 'string',
          description: 'Link contacts to this deal/listing (optional)',
        },
        contact_type: {
          type: 'string',
          enum: ['buyer', 'seller', 'advisor', 'other'],
          description: 'Contact type (default "buyer")',
        },
      },
      required: ['contacts'],
    },
  },
  {
    name: 'enrich_buyer_contacts',
    description:
      'Find and enrich contacts at a company using LinkedIn scraping (Apify) and email enrichment (Prospeo). Discovers employees at a company, filters by title/role, and enriches with email and phone. Results are saved to the enriched_contacts table. Use when the user asks "find me contacts at [company]" or "enrich contacts for [buyer firm]". This calls external APIs and may take 30-60 seconds.',
    input_schema: {
      type: 'object',
      properties: {
        company_name: {
          type: 'string',
          description: 'Company name to search for contacts',
        },
        title_filter: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Filter by title/role keywords. E.g. ["associate", "principal", "vp", "director", "partner"]. Supports aliases.',
        },
        target_count: {
          type: 'number',
          description: 'Number of contacts to find (default 10, max 25)',
        },
        company_linkedin_url: {
          type: 'string',
          description: 'LinkedIn company page URL if known (skips URL resolution)',
        },
        company_domain: {
          type: 'string',
          description: 'Company email domain if known (e.g. "trivest.com")',
        },
      },
      required: ['company_name'],
    },
  },
  {
    name: 'push_to_phoneburner',
    description:
      'Push contacts to PhoneBurner dialer for calling. Accepts buyer IDs or contact IDs — resolves to phone-number contacts, filters recently contacted, and pushes to the user\'s PhoneBurner account. Requires the user to have PhoneBurner connected. Use when the user says "push these to PhoneBurner" or "add to dialer".',
    input_schema: {
      type: 'object',
      properties: {
        entity_type: {
          type: 'string',
          enum: ['contacts', 'buyers'],
          description:
            'Type of entity: "contacts" for unified contact IDs, "buyers" for remarketing_buyer IDs',
        },
        entity_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of UUIDs to push',
        },
        session_name: {
          type: 'string',
          description: 'Optional name for the dialing session',
        },
        skip_recent_days: {
          type: 'number',
          description: 'Skip contacts called within this many days (default 7)',
        },
      },
      required: ['entity_type', 'entity_ids'],
    },
  },
  {
    name: 'send_document',
    description:
      'Send an NDA or Fee Agreement for signing via DocuSeal. Creates a signing submission and notifies the buyer. REQUIRES CONFIRMATION. Use when the user says "send the NDA to [name]" or "send the fee agreement to [firm]".',
    input_schema: {
      type: 'object',
      properties: {
        firm_id: {
          type: 'string',
          description: 'The firm_agreements UUID',
        },
        document_type: {
          type: 'string',
          enum: ['nda', 'fee_agreement'],
          description: 'Type of document to send',
        },
        signer_email: {
          type: 'string',
          description: 'Email address of the signer',
        },
        signer_name: {
          type: 'string',
          description: 'Full name of the signer',
        },
        delivery_mode: {
          type: 'string',
          enum: ['embedded', 'email'],
          description:
            'How to deliver: "embedded" for in-app iframe, "email" for email delivery (default "email")',
        },
      },
      required: ['firm_id', 'document_type', 'signer_email', 'signer_name'],
    },
  },
  {
    name: 'enrich_linkedin_contact',
    description:
      'Enrich a single contact from their LinkedIn profile URL. Calls Prospeo to find their email and phone. Use when a user pastes a LinkedIn URL like "linkedin.com/in/john-smith" into the chat, or says "look up this person" with a LinkedIn link. Returns email, phone, name, title, and company. Results are saved to enriched_contacts.',
    input_schema: {
      type: 'object',
      properties: {
        linkedin_url: {
          type: 'string',
          description: 'LinkedIn profile URL (e.g. "https://www.linkedin.com/in/john-smith")',
        },
        first_name: {
          type: 'string',
          description: 'First name if known (helps with name+domain fallback)',
        },
        last_name: {
          type: 'string',
          description: 'Last name if known (helps with name+domain fallback)',
        },
        company_domain: {
          type: 'string',
          description:
            'Company email domain if known (e.g. "trivest.com") — used as fallback for name+domain lookup',
        },
      },
      required: ['linkedin_url'],
    },
  },
];

// ---------- Executor ----------

export async function executeIntegrationActionTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  switch (toolName) {
    case 'google_search_companies':
      return googleSearchCompanies(args);
    case 'save_contacts_to_crm':
      return saveContactsToCrm(supabase, args, userId);
    case 'enrich_buyer_contacts':
      return enrichBuyerContacts(supabase, args, userId);
    case 'push_to_phoneburner':
      return pushToPhoneBurner(supabase, args, userId);
    case 'send_document':
      return sendDocument(supabase, args, userId);
    case 'enrich_linkedin_contact':
      return enrichLinkedInContact(supabase, args, userId);
    default:
      return { error: `Unknown integration action tool: ${toolName}` };
  }
}

// ---------- Title matching (shared with find-contacts) ----------

const TITLE_ALIASES: Record<string, string[]> = {
  associate: ['associate', 'sr associate', 'senior associate', 'investment associate'],
  principal: ['principal', 'sr principal', 'senior principal', 'investment principal'],
  vp: ['vp', 'vice president', 'vice-president', 'svp', 'senior vice president', 'evp'],
  director: [
    'director',
    'managing director',
    'sr director',
    'senior director',
    'associate director',
  ],
  partner: ['partner', 'managing partner', 'general partner', 'senior partner'],
  analyst: ['analyst', 'sr analyst', 'senior analyst', 'investment analyst'],
  ceo: ['ceo', 'chief executive officer', 'president', 'owner', 'founder', 'co-founder'],
  bd: [
    'business development',
    'corp dev',
    'corporate development',
    'head of acquisitions',
    'vp acquisitions',
    'vp m&a',
    'head of m&a',
  ],
};

function matchesTitle(title: string, filters: string[]): boolean {
  const normalized = title.toLowerCase().trim();
  for (const filter of filters) {
    const f = filter.toLowerCase().trim();
    if (normalized.includes(f)) return true;
    const aliases = TITLE_ALIASES[f];
    if (aliases) {
      for (const alias of aliases) {
        if (normalized.includes(alias)) return true;
      }
    }
  }
  return false;
}

// ---------- google_search_companies ----------

async function googleSearchCompanies(args: Record<string, unknown>): Promise<ToolResult> {
  const query = args.query as string;
  if (!query?.trim()) return { error: 'query is required' };

  const maxResults = Math.min((args.max_results as number) || 10, 20);

  try {
    const results = await googleSearch(query.trim(), maxResults);

    return {
      data: {
        results: results.map((r) => ({
          title: r.title,
          url: r.url,
          description: r.description,
          is_linkedin: r.url.includes('linkedin.com'),
        })),
        total: results.length,
        query,
        message: `Found ${results.length} Google results for "${query}"`,
      },
    };
  } catch (err) {
    return { error: `Google search failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ---------- save_contacts_to_crm ----------

async function saveContactsToCrm(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const contactsInput = args.contacts as Array<{
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    title?: string;
    linkedin_url?: string;
    company_name?: string;
  }>;

  if (!contactsInput?.length) return { error: 'contacts array is required and must not be empty' };

  const buyerId = args.remarketing_buyer_id as string | undefined;
  const listingId = args.listing_id as string | undefined;
  const contactType = (args.contact_type as string) || 'buyer';

  const saved: Array<{ id: string; name: string; email: string | null }> = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const errors: string[] = [];

  for (const contact of contactsInput) {
    const firstName = contact.first_name?.trim() || '';
    const lastName = contact.last_name?.trim() || '';
    const email = contact.email?.trim() || null;
    const phone = contact.phone?.trim() || null;

    if (!firstName && !lastName && !email) {
      skipped.push({ name: 'Unknown', reason: 'No name or email provided' });
      continue;
    }

    // Check for existing contact by email
    if (email) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .eq('email', email)
        .eq('archived', false)
        .limit(1)
        .maybeSingle();

      if (existing) {
        skipped.push({
          name: `${firstName} ${lastName}`.trim(),
          reason: `Duplicate — already exists as ${existing.first_name} ${existing.last_name} (${existing.id})`,
        });
        continue;
      }
    }

    // Insert
    const { data: inserted, error: insertError } = await supabase
      .from('contacts')
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        title: contact.title?.trim() || null,
        linkedin_url: contact.linkedin_url?.trim() || null,
        company_name: contact.company_name?.trim() || null,
        contact_type: contactType,
        remarketing_buyer_id: buyerId || null,
        listing_id: listingId || null,
        source: 'ai_command_center',
        created_by: userId,
        archived: false,
      })
      .select('id, first_name, last_name, email')
      .single();

    if (insertError) {
      errors.push(`Failed to save ${firstName} ${lastName}: ${insertError.message}`);
      continue;
    }

    saved.push({
      id: inserted.id,
      name: `${inserted.first_name} ${inserted.last_name}`.trim(),
      email: inserted.email,
    });
  }

  // Log activity — only if we can resolve a deal for this listing+buyer
  if (saved.length > 0 && listingId && buyerId) {
    const { data: linkedDeal } = await supabase
      .from('deals')
      .select('id')
      .eq('listing_id', listingId)
      .eq('remarketing_buyer_id', buyerId)
      .limit(1)
      .maybeSingle();

    if (linkedDeal) {
      await supabase.from('deal_activities').insert({
        deal_id: linkedDeal.id,
        activity_type: 'contacts_added',
        title: `${saved.length} contact(s) added via AI Command Center`,
        description: `Contacts: ${saved.map((s) => s.name).join(', ')}`,
        admin_id: userId,
        metadata: {
          source: 'ai_command_center',
          contact_ids: saved.map((s) => s.id),
          buyer_id: buyerId,
        },
      });
    }
  }

  return {
    data: {
      saved,
      saved_count: saved.length,
      skipped,
      skipped_count: skipped.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Saved ${saved.length} contact(s) to CRM${skipped.length > 0 ? ` (${skipped.length} skipped)` : ''}`,
    },
  };
}

// ---------- enrich_buyer_contacts ----------

async function enrichBuyerContacts(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const companyName = (args.company_name as string)?.trim();
  if (!companyName) return { error: 'company_name is required' };

  const titleFilter = (args.title_filter as string[]) || [];
  const targetCount = Math.min((args.target_count as number) || 10, 25);
  const errors: string[] = [];

  // 1. Check cache (7-day)
  const cacheKey = `${companyName}:${titleFilter.sort().join(',')}`.toLowerCase();
  const { data: cached } = await supabase
    .from('contact_search_cache')
    .select('results')
    .eq('cache_key', cacheKey)
    .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached?.results) {
    return {
      data: {
        contacts: cached.results,
        total_found: cached.results.length,
        total_enriched: cached.results.filter((c: { email?: string }) => c.email).length,
        from_cache: true,
        message: `Found ${cached.results.length} cached contacts for "${companyName}"`,
      },
    };
  }

  // 2. Resolve LinkedIn URL
  let linkedInUrl = args.company_linkedin_url as string | undefined;
  if (!linkedInUrl) {
    try {
      linkedInUrl =
        (await findCompanyLinkedIn(companyName)) ||
        resolveCompanyUrl(companyName, args.company_domain as string | undefined);
    } catch {
      linkedInUrl = resolveCompanyUrl(companyName, args.company_domain as string | undefined);
    }
  }

  // 3. Scrape employees via Apify
  // deno-lint-ignore no-explicit-any
  let employees: any[] = [];
  try {
    employees = await scrapeCompanyEmployees(linkedInUrl!, Math.max(targetCount * 3, 50));
  } catch (err) {
    errors.push(`LinkedIn scrape failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Filter by title
  let filtered = employees;
  if (titleFilter.length > 0 && employees.length > 0) {
    // deno-lint-ignore no-explicit-any
    filtered = employees.filter((e: any) => matchesTitle(e.title || '', titleFilter));
  }

  // 5. Dedup
  const seen = new Set<string>();
  // deno-lint-ignore no-explicit-any
  filtered = filtered.filter((c: any) => {
    const key = (c.profileUrl || c.fullName || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 5b. Pre-check CRM contacts table — skip people we already have email/phone for
  // deno-lint-ignore no-explicit-any
  const crmAlreadyKnown = new Set<string>();
  if (filtered.length > 0) {
    // Collect LinkedIn URLs from scraped employees
    const linkedInUrls = filtered
      // deno-lint-ignore no-explicit-any
      .map((e: any) => e.profileUrl?.toLowerCase())
      .filter(Boolean) as string[];

    if (linkedInUrls.length > 0) {
      // Query CRM for contacts matching these LinkedIn URLs that already have email or phone
      const { data: existingByLinkedIn } = await supabase
        .from('contacts')
        .select('linkedin_url')
        .eq('archived', false)
        .not('email', 'is', null)
        .in(
          'linkedin_url',
          linkedInUrls.map((u: string) => {
            // Normalize: strip protocol + www to match stored URLs
            return u.replace('https://www.', '').replace('https://', '').replace('http://', '');
          }),
        );

      if (existingByLinkedIn?.length) {
        for (const c of existingByLinkedIn) {
          if (c.linkedin_url) crmAlreadyKnown.add(c.linkedin_url.toLowerCase());
        }
      }
    }

    // Also check by name + company for contacts without LinkedIn URLs
    // deno-lint-ignore no-explicit-any
    const nameKeys = filtered
      // deno-lint-ignore no-explicit-any
      .filter((e: any) => !e.profileUrl)
      // deno-lint-ignore no-explicit-any
      .map((e: any) => {
        const first = (e.firstName || e.fullName?.split(' ')[0] || '').toLowerCase();
        const last = (e.lastName || e.fullName?.split(' ').slice(1).join(' ') || '').toLowerCase();
        return { first, last };
      })
      .filter((n: { first: string; last: string }) => n.first && n.last);

    if (nameKeys.length > 0) {
      const { data: existingByName } = await supabase
        .from('contacts')
        .select('first_name, last_name, company_name')
        .eq('archived', false)
        .not('email', 'is', null)
        .ilike('company_name', `%${companyName}%`);

      if (existingByName?.length) {
        for (const c of existingByName) {
          crmAlreadyKnown.add(
            `${(c.first_name || '').toLowerCase()}:${(c.last_name || '').toLowerCase()}`,
          );
        }
      }
    }
  }

  // Filter out contacts already in CRM with email
  // deno-lint-ignore no-explicit-any
  const needsEnrichment = filtered.filter((e: any) => {
    const profileUrl = (e.profileUrl || '').toLowerCase();
    const normalizedUrl = profileUrl
      .replace('https://www.', '')
      .replace('https://', '')
      .replace('http://', '');
    if (normalizedUrl && crmAlreadyKnown.has(normalizedUrl)) return false;

    if (!profileUrl) {
      const first = (e.firstName || e.fullName?.split(' ')[0] || '').toLowerCase();
      const last = (e.lastName || e.fullName?.split(' ').slice(1).join(' ') || '').toLowerCase();
      if (first && last && crmAlreadyKnown.has(`${first}:${last}`)) return false;
    }
    return true;
  });

  const skippedFromCrm = filtered.length - needsEnrichment.length;
  if (skippedFromCrm > 0) {
    console.log(
      `[enrich-buyer-contacts] Skipped ${skippedFromCrm} contacts already in CRM with email`,
    );
  }

  const toEnrich = needsEnrichment.slice(0, targetCount);

  // 6. Prospeo enrichment
  const domain = (args.company_domain as string) || inferDomain(companyName);
  // deno-lint-ignore no-explicit-any
  let enriched: any[] = [];
  try {
    enriched = await batchEnrich(
      // deno-lint-ignore no-explicit-any
      toEnrich.map((e: any) => ({
        firstName: e.firstName || e.fullName?.split(' ')[0] || '',
        lastName: e.lastName || e.fullName?.split(' ').slice(1).join(' ') || '',
        linkedinUrl: e.profileUrl,
        domain,
        title: e.title,
        company: companyName,
      })),
      3,
    );
  } catch (err) {
    errors.push(`Enrichment failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 7. Domain fallback
  if (enriched.length < targetCount / 2 && domain) {
    try {
      const domainResults = await domainSearchEnrich(domain, targetCount - enriched.length);
      const filteredDomain =
        titleFilter.length > 0
          ? domainResults.filter((r) => matchesTitle(r.title, titleFilter))
          : domainResults;
      enriched = [...enriched, ...filteredDomain];
    } catch {
      /* non-critical */
    }
  }

  // Build final contacts
  // deno-lint-ignore no-explicit-any
  const contacts = enriched.map((e: any) => ({
    company_name: companyName,
    full_name: `${e.first_name} ${e.last_name}`.trim(),
    first_name: e.first_name,
    last_name: e.last_name,
    title: e.title || '',
    email: e.email,
    phone: e.phone,
    linkedin_url: e.linkedin_url || '',
    confidence: e.confidence || 'low',
    source: e.source || 'unknown',
    enriched_at: new Date().toISOString(),
    search_query: cacheKey,
  }));

  // Include unenriched LinkedIn-only contacts
  // deno-lint-ignore no-explicit-any
  const enrichedLinkedIns = new Set(enriched.map((e: any) => e.linkedin_url?.toLowerCase()));
  // deno-lint-ignore no-explicit-any
  const unenriched = toEnrich
    .filter((e: { profileUrl?: string }) => !enrichedLinkedIns.has(e.profileUrl?.toLowerCase()))
    // deno-lint-ignore no-explicit-any
    .map((e: any) => ({
      company_name: companyName,
      full_name: e.fullName || `${e.firstName || ''} ${e.lastName || ''}`.trim(),
      first_name: e.firstName || e.fullName?.split(' ')[0] || '',
      last_name: e.lastName || e.fullName?.split(' ').slice(1).join(' ') || '',
      title: e.title || '',
      email: null,
      phone: null,
      linkedin_url: e.profileUrl || '',
      confidence: 'low',
      source: 'linkedin_only',
      enriched_at: new Date().toISOString(),
      search_query: cacheKey,
    }));

  const seenFinal = new Set<string>();
  const allContacts = [...contacts, ...unenriched]
    .filter((c) => {
      const key = (c.linkedin_url || c.email || c.full_name || '').toLowerCase();
      if (!key || seenFinal.has(key)) return false;
      seenFinal.add(key);
      return true;
    })
    .slice(0, targetCount);

  // 8. Save to enriched_contacts
  if (allContacts.length > 0) {
    await supabase.from('enriched_contacts').upsert(
      allContacts.map((c) => ({ ...c, workspace_id: userId })),
      { onConflict: 'workspace_id,linkedin_url', ignoreDuplicates: true },
    );
  }

  // 9. Cache
  await supabase.from('contact_search_cache').insert({
    cache_key: cacheKey,
    company_name: companyName,
    results: allContacts,
  });

  // 10. Log
  await supabase.from('contact_search_log').insert({
    user_id: userId,
    company_name: companyName,
    title_filter: titleFilter,
    results_count: allContacts.length,
    from_cache: false,
    duration_ms: 0,
  });

  return {
    data: {
      contacts: allContacts,
      total_found: filtered.length,
      total_enriched: contacts.length,
      skipped_already_in_crm: skippedFromCrm,
      from_cache: false,
      errors: errors.length > 0 ? errors : undefined,
      message: `Found ${allContacts.length} contacts for "${companyName}" (${contacts.length} with email)${skippedFromCrm > 0 ? ` — skipped ${skippedFromCrm} already in CRM` : ''}`,
    },
  };
}

// ---------- enrich_linkedin_contact ----------

async function enrichLinkedInContact(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const linkedinUrl = (args.linkedin_url as string)?.trim();
  if (!linkedinUrl) return { error: 'linkedin_url is required' };

  // Validate it looks like a LinkedIn URL
  if (!linkedinUrl.includes('linkedin.com/in/')) {
    return {
      error: 'Invalid LinkedIn URL — expected a profile URL like linkedin.com/in/john-smith',
    };
  }

  const firstName = (args.first_name as string)?.trim() || '';
  const lastName = (args.last_name as string)?.trim() || '';
  const domain = (args.company_domain as string)?.trim() || undefined;

  console.log(`[enrich-linkedin] Enriching: ${linkedinUrl}`);

  try {
    const result = await enrichContact({
      firstName,
      lastName,
      linkedinUrl,
      domain,
    });

    if (!result) {
      return {
        data: {
          linkedin_url: linkedinUrl,
          found: false,
          message: `Could not find email for this LinkedIn profile. Prospeo returned no results. Try providing the person's company domain (e.g. company_domain: "acme.com") for a name+domain fallback.`,
        },
      };
    }

    // Save to enriched_contacts for audit trail
    const contactData = {
      workspace_id: userId,
      company_name: result.company || 'Unknown',
      full_name: `${result.first_name} ${result.last_name}`.trim(),
      first_name: result.first_name,
      last_name: result.last_name,
      title: result.title || '',
      email: result.email,
      phone: result.phone,
      linkedin_url: result.linkedin_url || linkedinUrl,
      confidence: result.confidence,
      source: `linkedin_enrichment:${result.source}`,
      enriched_at: new Date().toISOString(),
      search_query: `linkedin:${linkedinUrl}`,
    };

    await supabase
      .from('enriched_contacts')
      .upsert(contactData, { onConflict: 'workspace_id,linkedin_url', ignoreDuplicates: false });

    // Also check if this person exists in our CRM contacts — update or create
    let crmContactId: string | null = null;
    let crmAction: 'created' | 'updated' | null = null;
    if (result.email) {
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('id, email, phone, linkedin_url')
        .or(
          `linkedin_url.ilike.%${linkedinUrl.replace('https://www.', '').replace('https://', '')}%`,
        )
        .eq('archived', false)
        .limit(1);

      if (existingContacts && existingContacts.length > 0) {
        const existing = existingContacts[0] as Record<string, unknown>;
        const updates: Record<string, unknown> = {};
        if (!existing.email && result.email) updates.email = result.email;
        if (!existing.phone && result.phone) updates.phone = result.phone;

        if (Object.keys(updates).length > 0) {
          await supabase.from('contacts').update(updates).eq('id', existing.id);
          console.log(`[enrich-linkedin] Updated CRM contact ${existing.id} with enriched data`);
        }
        crmContactId = existing.id as string;
        crmAction = 'updated';
      } else {
        // Create a new CRM contact record so enriched profiles are immediately usable
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            first_name: result.first_name,
            last_name: result.last_name,
            email: result.email,
            phone: result.phone || null,
            title: result.title || null,
            linkedin_url: result.linkedin_url || linkedinUrl,
            company_name: result.company || null,
            contact_type: 'buyer',
            source: 'ai_command_center',
            created_by: userId,
            archived: false,
          })
          .select('id')
          .single();

        if (newContact) {
          crmContactId = newContact.id;
          crmAction = 'created';
          console.log(`[enrich-linkedin] Created new CRM contact ${newContact.id}`);
        }
      }
    }

    return {
      data: {
        found: true,
        name: `${result.first_name} ${result.last_name}`.trim(),
        email: result.email,
        phone: result.phone,
        title: result.title,
        company: result.company,
        linkedin_url: result.linkedin_url || linkedinUrl,
        confidence: result.confidence,
        source: result.source,
        saved_to_enriched: true,
        crm_contact_id: crmContactId || undefined,
        crm_action: crmAction || undefined,
        message: result.email
          ? `Found email for ${result.first_name} ${result.last_name}: ${result.email} (confidence: ${result.confidence})${crmAction === 'created' ? ' — new CRM contact created' : crmAction === 'updated' ? ' — existing CRM contact updated' : ''}`
          : `Found contact info but no email. Phone: ${result.phone || 'none'}. Try providing company_domain for a name+domain fallback.`,
      },
    };
  } catch (err) {
    return {
      error: `LinkedIn enrichment failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------- push_to_phoneburner ----------

const PB_API_BASE = 'https://www.phoneburner.com/rest/1';

async function getPhoneBurnerToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('phoneburner_oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!tokenRow) return null;

  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return tokenRow.access_token;
  }

  // Refresh token
  const clientId = Deno.env.get('PHONEBURNER_CLIENT_ID');
  const clientSecret = Deno.env.get('PHONEBURNER_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch('https://www.phoneburner.com/oauth/accesstoken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenRow.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) return null;

    const tokens = await res.json();
    if (!tokens.access_token) return null;

    await supabase
      .from('phoneburner_oauth_tokens')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || tokenRow.refresh_token,
        expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return tokens.access_token;
  } catch {
    return null;
  }
}

async function pushToPhoneBurner(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const entityType = args.entity_type as string;
  const entityIds = args.entity_ids as string[];
  const skipRecentDays = (args.skip_recent_days as number) || 7;

  if (!entityIds?.length) return { error: 'entity_ids is required and must not be empty' };

  // Get PhoneBurner token
  const pbToken = await getPhoneBurnerToken(supabase, userId);
  if (!pbToken) {
    return {
      error:
        'PhoneBurner not connected. Please connect your PhoneBurner account in Settings first.',
    };
  }

  // Resolve contacts based on entity type
  interface PBContact {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    title: string | null;
    company: string | null;
  }

  let contacts: PBContact[] = [];

  if (entityType === 'contacts') {
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, title, remarketing_buyer_id')
      .in('id', entityIds)
      .eq('archived', false);

    if (data) {
      // Get buyer company names
      const buyerIds = [
        ...new Set(
          data
            .filter((c: { remarketing_buyer_id?: string }) => c.remarketing_buyer_id)
            .map((c: { remarketing_buyer_id: string }) => c.remarketing_buyer_id),
        ),
      ];
      const buyerMap = new Map<string, string>();
      if (buyerIds.length > 0) {
        const { data: buyers } = await supabase
          .from('remarketing_buyers')
          .select('id, company_name')
          .in('id', buyerIds);
        for (const b of buyers || []) buyerMap.set(b.id, b.company_name);
      }

      contacts = data.map(
        (c: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          title: string;
          remarketing_buyer_id?: string;
        }) => ({
          id: c.id,
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
          phone: c.phone,
          email: c.email,
          title: c.title,
          company: c.remarketing_buyer_id ? buyerMap.get(c.remarketing_buyer_id) || null : null,
        }),
      );
    }
  } else if (entityType === 'buyers') {
    // Resolve contacts from buyers
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, title, remarketing_buyer_id')
      .in('remarketing_buyer_id', entityIds)
      .eq('contact_type', 'buyer')
      .eq('archived', false);

    const { data: buyers } = await supabase
      .from('remarketing_buyers')
      .select('id, company_name')
      .in('id', entityIds);
    const buyerMap = new Map<string, string>();
    for (const b of buyers || []) buyerMap.set(b.id, b.company_name);

    contacts = (data || []).map(
      (c: {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
        title: string;
        remarketing_buyer_id: string;
      }) => ({
        id: c.id,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        phone: c.phone,
        email: c.email,
        title: c.title,
        company: buyerMap.get(c.remarketing_buyer_id) || null,
      }),
    );
  } else {
    return { error: `Invalid entity_type: ${entityType}. Use "contacts" or "buyers".` };
  }

  if (contacts.length === 0) {
    return { error: 'No contacts found for the given entity IDs' };
  }

  // Filter: must have phone, skip recently contacted
  const skipCutoff = new Date(Date.now() - skipRecentDays * 86400000).toISOString();
  const eligible: PBContact[] = [];
  const excluded: { name: string; reason: string }[] = [];

  // Check recent activity
  const contactIds = contacts.map((c) => c.id);
  const { data: recentActivity } = await supabase
    .from('contact_activities')
    .select('contact_id')
    .in('contact_id', contactIds)
    .gte('created_at', skipCutoff);
  const recentlyContacted = new Set(
    (recentActivity || []).map((a: { contact_id: string }) => a.contact_id),
  );

  for (const contact of contacts) {
    if (!contact.phone) {
      excluded.push({ name: contact.name, reason: 'No phone number' });
      continue;
    }
    if (recentlyContacted.has(contact.id)) {
      excluded.push({ name: contact.name, reason: `Contacted within ${skipRecentDays} days` });
      continue;
    }
    eligible.push(contact);
  }

  if (eligible.length === 0) {
    return {
      data: {
        success: false,
        contacts_added: 0,
        contacts_excluded: excluded.length,
        exclusions: excluded,
        message: 'All contacts were excluded (no phone number or recently contacted)',
      },
    };
  }

  // Push to PhoneBurner
  let added = 0;
  let failed = 0;
  const pushErrors: string[] = [];

  for (const contact of eligible) {
    const nameParts = contact.name.split(' ');
    try {
      const res = await fetch(`${PB_API_BASE}/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pbToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          phone: contact.phone,
          email: contact.email || '',
          company: contact.company || '',
          title: contact.title || '',
          custom_fields: {
            sourceco_id: contact.id,
            contact_source: 'SourceCo AI Command Center',
          },
        }),
      });
      if (res.ok) {
        added++;
      } else {
        failed++;
        pushErrors.push(`${contact.name}: Push failed`);
      }
    } catch {
      failed++;
      pushErrors.push(`${contact.name}: Network error`);
    }
  }

  // Log session
  await supabase.from('phoneburner_sessions').insert({
    session_name: (args.session_name as string) || `AI Push - ${new Date().toLocaleDateString()}`,
    session_type: 'buyer_outreach',
    total_contacts_added: added,
    session_status: 'active',
    created_by_user_id: userId,
    started_at: new Date().toISOString(),
  });

  return {
    data: {
      success: added > 0,
      contacts_added: added,
      contacts_failed: failed,
      contacts_excluded: excluded.length,
      exclusions: excluded.length > 0 ? excluded : undefined,
      errors: pushErrors.length > 0 ? pushErrors : undefined,
      message: `Pushed ${added} contacts to PhoneBurner${failed > 0 ? ` (${failed} failed)` : ''}${excluded.length > 0 ? ` (${excluded.length} excluded)` : ''}`,
    },
  };
}

// ---------- send_document ----------

async function sendDocument(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const firmId = args.firm_id as string;
  const documentType = args.document_type as 'nda' | 'fee_agreement';
  const signerEmail = args.signer_email as string;
  const signerName = args.signer_name as string;
  const deliveryMode = (args.delivery_mode as string) || 'email';

  // Validate
  if (!firmId || !documentType || !signerEmail || !signerName) {
    return { error: 'Missing required fields: firm_id, document_type, signer_email, signer_name' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(signerEmail)) {
    return { error: 'Invalid email format' };
  }

  if (!['nda', 'fee_agreement'].includes(documentType)) {
    return { error: "Invalid document_type. Must be 'nda' or 'fee_agreement'" };
  }

  // Get DocuSeal config
  const docusealApiKey = Deno.env.get('DOCUSEAL_API_KEY');
  if (!docusealApiKey) {
    return { error: 'DocuSeal is not configured. Contact your administrator.' };
  }

  const templateId =
    documentType === 'nda'
      ? Deno.env.get('DOCUSEAL_NDA_TEMPLATE_ID')
      : Deno.env.get('DOCUSEAL_FEE_TEMPLATE_ID');

  if (!templateId) {
    return { error: `Template not configured for ${documentType}` };
  }

  // Verify firm exists
  const { data: firm, error: firmError } = await supabase
    .from('firm_agreements')
    .select('id, primary_company_name')
    .eq('id', firmId)
    .single();

  if (firmError || !firm) {
    return { error: `Firm not found with ID: ${firmId}` };
  }

  // Call DocuSeal API
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let docusealResponse: Response;
  try {
    docusealResponse = await fetch('https://api.docuseal.com/submissions', {
      method: 'POST',
      headers: {
        'X-Auth-Token': docusealApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: parseInt(templateId),
        send_email: deliveryMode === 'email',
        submitters: [
          {
            role: 'First Party',
            email: signerEmail,
            name: signerName,
            external_id: firmId,
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    const fetchError = err as { name?: string };
    if (fetchError.name === 'AbortError') {
      return { error: 'DocuSeal API timeout. Please try again.' };
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!docusealResponse.ok) {
    console.error('DocuSeal API error:', await docusealResponse.text());
    return { error: 'Failed to create signing submission. Please try again.' };
  }

  const docusealResult = await docusealResponse.json();
  const submitter = Array.isArray(docusealResult) ? docusealResult[0] : docusealResult;
  const submissionId = String(submitter.submission_id || submitter.id);

  // Update firm_agreements
  const columnPrefix = documentType === 'nda' ? 'nda' : 'fee';
  const statusColumn = documentType === 'nda' ? 'nda_status' : 'fee_agreement_status';
  const sentAtColumn = documentType === 'nda' ? 'nda_sent_at' : 'fee_agreement_sent_at';
  const now = new Date().toISOString();

  await supabase
    .from('firm_agreements')
    .update({
      [`${columnPrefix}_docuseal_submission_id`]: submissionId,
      [`${columnPrefix}_docuseal_status`]: 'pending',
      [statusColumn]: 'sent',
      [sentAtColumn]: now,
      updated_at: now,
    })
    .eq('id', firmId);

  // Log the event
  await supabase.from('docuseal_webhook_log').insert({
    event_type: 'submission_created',
    submission_id: submissionId,
    document_type: documentType,
    external_id: firmId,
    raw_payload: { created_by: userId, source: 'ai_command_center' },
  });

  // Create buyer notification
  const { data: buyerProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', signerEmail)
    .maybeSingle();

  if (buyerProfile?.id) {
    const docLabel = documentType === 'nda' ? 'NDA' : 'Fee Agreement';
    const notificationMessage =
      documentType === 'nda'
        ? 'This is our standard NDA so we can freely exchange confidential information about the companies on our platform. Sign it to unlock full deal access.'
        : 'Here is our fee agreement -- you only pay a fee if you close a deal you meet on our platform. Sign to continue the process.';

    await supabase.from('user_notifications').insert({
      user_id: buyerProfile.id,
      notification_type: 'agreement_pending',
      title: `${docLabel} Ready to Sign`,
      message: notificationMessage,
      metadata: {
        document_type: documentType,
        firm_id: firmId,
        submission_id: submissionId,
        delivery_mode: deliveryMode,
        source: 'ai_command_center',
      },
    });
  }

  const docLabel = documentType === 'nda' ? 'NDA' : 'Fee Agreement';
  return {
    data: {
      success: true,
      submission_id: submissionId,
      document_type: documentType,
      delivery_mode: deliveryMode,
      firm_name: firm.primary_company_name,
      signer: signerName,
      message: `${docLabel} sent to ${signerName} (${signerEmail}) for ${firm.primary_company_name} via ${deliveryMode}. Submission ID: ${submissionId}`,
    },
  };
}
