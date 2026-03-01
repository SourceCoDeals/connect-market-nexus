/**
 * Integration Action Tools
 * Tools that integrate with external services: contact enrichment (Serper+Prospeo),
 * PhoneBurner dialer push, and DocuSeal document sending.
 *
 * These tools call external APIs directly using shared clients or API keys from env,
 * avoiding the need to call other edge functions (which require JWT auth).
 *
 * Contact discovery uses Serper (Google search) to find decision makers at companies,
 * replacing the previous Apify LinkedIn scraping approach. This is faster (~2s vs ~60-120s),
 * more reliable (no actor polling/timeouts), and cheaper (Serper vs Apify credits).
 *
 * MERGED Feb 2026: Contact enrichment tools consolidated:
 *   enrich_buyer_contacts + enrich_linkedin_contact → enrich_contact (with mode param)
 *   find_contact_linkedin + find_and_enrich_person → find_contact (with mode param)
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from '../../_shared/claude-client.ts';
import type { ToolResult } from './index.ts';
import {
  resolveCompanyUrl,
  inferDomain,
  inferDomainCandidates,
} from '../../_shared/apify-client.ts';
import { batchEnrich, domainSearchEnrich, enrichContact } from '../../_shared/prospeo-client.ts';
import { findCompanyLinkedIn, googleSearch } from '../../_shared/serper-client.ts';
import { DOCUSEAL_SUBMISSIONS_URL } from '../../_shared/api-urls.ts';

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
    name: 'enrich_contact',
    description:
      'Enrich contacts via external APIs (Google search + Prospeo email enrichment). Two modes: "company" mode discovers decision makers and key contacts at a company via Google search, filters by title/role, and enriches with email/phone. "linkedin" mode enriches a single contact from their LinkedIn profile URL. Results are saved to the enriched_contacts table.',
    input_schema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['company', 'linkedin'],
          description:
            '"company" to discover contacts at a company (requires company_name), "linkedin" to enrich from a LinkedIn profile URL (requires linkedin_url). Default: auto-detected based on provided params.',
        },
        company_name: {
          type: 'string',
          description: 'Company name to search for contacts (company mode)',
        },
        title_filter: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Filter by title/role keywords. E.g. ["associate", "principal", "vp", "director", "partner"]. Supports aliases. (company mode)',
        },
        target_count: {
          type: 'number',
          description: 'Number of contacts to find (default 10, max 25) (company mode)',
        },
        company_linkedin_url: {
          type: 'string',
          description: 'LinkedIn company page URL if known (skips URL resolution) (company mode)',
        },
        company_domain: {
          type: 'string',
          description: 'Company email domain if known (e.g. "trivest.com")',
        },
        linkedin_url: {
          type: 'string',
          description:
            'LinkedIn profile URL to enrich (linkedin mode, e.g. "https://www.linkedin.com/in/john-smith")',
        },
        first_name: {
          type: 'string',
          description: 'First name if known (helps with name+domain fallback, linkedin mode)',
        },
        last_name: {
          type: 'string',
          description: 'Last name if known (helps with name+domain fallback, linkedin mode)',
        },
      },
      required: [],
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
    name: 'find_contact',
    description:
      'Find and enrich contact information. Three modes: "person" mode chains CRM lookup + company resolution + LinkedIn discovery + email enrichment + CRM update in one command. "decision_makers" mode discovers ALL key contacts at a company (CEO, founders, VPs, etc.) via Google search and enriches their emails. "linkedin_search" mode finds LinkedIn profile URLs for existing CRM contacts who are missing them. Use "person" when asked "find the email for [name]". Use "decision_makers" when asked "find contacts at [company]" or "who runs [company]". Use "linkedin_search" for bulk LinkedIn URL discovery.',
    input_schema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['person', 'decision_makers', 'linkedin_search'],
          description:
            '"person" to find a specific person\'s email (default), "decision_makers" to discover all key contacts at a company, "linkedin_search" to find LinkedIn URLs for existing CRM contacts.',
        },
        person_name: {
          type: 'string',
          description: 'Full name of the person to find (person mode, e.g. "Larry Phillips")',
        },
        company_name: {
          type: 'string',
          description:
            'Company name. Required for decision_makers mode. Optional for person mode (resolves from linked listings/deals if omitted).',
        },
        company_domain: {
          type: 'string',
          description:
            'Company email domain if known (e.g. "trivest.com"). Improves search accuracy for decision_makers and person modes.',
        },
        title_filter: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Filter by title/role keywords (decision_makers mode). E.g. ["CEO", "founder", "partner"]. Supports aliases.',
        },
        target_count: {
          type: 'number',
          description: 'Number of contacts to find in decision_makers mode (default 10, max 25)',
        },
        auto_enrich: {
          type: 'boolean',
          description:
            'If true, automatically enrich discovered contacts with email/phone via Prospeo (decision_makers mode). Default true.',
        },
        contact_type: {
          type: 'string',
          enum: ['buyer', 'seller', 'advisor', 'all'],
          description:
            'Filter by contact type (default "all" for person mode, "seller" for linkedin_search mode)',
        },
        contact_ids: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Specific contact UUIDs to find LinkedIn URLs for (linkedin_search mode). If omitted, auto-discovers contacts missing LinkedIn.',
        },
        limit: {
          type: 'number',
          description: 'Max contacts to search for in linkedin_search mode (default 5, max 10)',
        },
        auto_update: {
          type: 'boolean',
          description:
            'If true, automatically update high-confidence matches in the contacts table (linkedin_search mode). Default false.',
        },
      },
      required: [],
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
    // Merged: enrich_contact routes to company or linkedin mode
    case 'enrich_contact': {
      const mode = (args.mode as string) || (args.linkedin_url ? 'linkedin' : 'company');
      if (mode === 'linkedin') return enrichLinkedInContact(supabase, args, userId);
      return enrichBuyerContacts(supabase, args, userId);
    }
    // Merged: find_contact routes to person or linkedin_search mode
    case 'find_contact': {
      const mode = (args.mode as string) || (args.contact_ids ? 'linkedin_search' : 'person');
      if (mode === 'linkedin_search') return findContactLinkedIn(supabase, args, userId);
      if (mode === 'decision_makers') return findDecisionMakers(supabase, args, userId);
      return findAndEnrichPerson(supabase, args, userId);
    }
    case 'push_to_phoneburner':
      return pushToPhoneBurner(supabase, args, userId);
    case 'send_document':
      return sendDocument(supabase, args, userId);
    // Backward compatibility aliases for old tool names
    case 'enrich_buyer_contacts':
      return enrichBuyerContacts(supabase, args, userId);
    case 'enrich_linkedin_contact':
      return enrichLinkedInContact(supabase, args, userId);
    case 'find_and_enrich_person':
      return findAndEnrichPerson(supabase, args, userId);
    case 'find_contact_linkedin':
      return findContactLinkedIn(supabase, args, userId);
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

// ---------- LinkedIn verification helpers ----------

/**
 * Score a Google search result for LinkedIn profile matching.
 * Higher score = more likely to be the correct person.
 */
function scoreLinkedInResult(
  result: { title: string; url: string; description: string },
  firstName: string,
  lastName: string,
  companyName: string,
  title: string,
): number {
  let score = 0;
  const rTitle = result.title.toLowerCase();
  const rDesc = result.description.toLowerCase();
  const combined = `${rTitle} ${rDesc}`;
  const fName = firstName.toLowerCase();
  const lName = lastName.toLowerCase();

  // Name match in title (highest signal)
  if (rTitle.includes(fName) && rTitle.includes(lName)) score += 40;
  else if (combined.includes(fName) && combined.includes(lName)) score += 20;

  // Company match
  if (companyName) {
    const compWords = companyName
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const matched = compWords.filter((w) => combined.includes(w));
    score += Math.min(matched.length * 10, 30);
    // Bonus for near-exact company match
    if (combined.includes(companyName.toLowerCase())) score += 10;
  }

  // Title/role match
  if (title) {
    const titleWords = title
      .toLowerCase()
      .split(/[\s,/]+/)
      .filter((w) => w.length > 2);
    const matched = titleWords.filter((w) => combined.includes(w));
    score += Math.min(matched.length * 5, 15);
  }

  // LinkedIn slug contains name parts (bonus)
  const slug = result.url.split('/in/')[1]?.split(/[/?#]/)[0] || '';
  if (slug && slug.includes(fName) && slug.includes(lName.replace(/\s/g, ''))) score += 10;

  return score;
}

/**
 * Validate that a Prospeo enrichment result matches the expected person.
 * Used to detect stale/wrong LinkedIn URLs stored in CRM records.
 */
function validateProspeoResult(
  result: { first_name: string; last_name: string; company: string },
  expectedFirstName: string,
  expectedLastName: string,
  expectedCompany: string,
): { valid: boolean; nameMatch: boolean; companyMatch: boolean; details: string } {
  const fNameMatch =
    result.first_name.toLowerCase() === expectedFirstName.toLowerCase() ||
    (expectedFirstName.length >= 3 &&
      result.first_name
        .toLowerCase()
        .startsWith(expectedFirstName.toLowerCase().substring(0, 3)));
  const lNameMatch = result.last_name.toLowerCase() === expectedLastName.toLowerCase();
  const nameMatch = fNameMatch && lNameMatch;

  let companyMatch = false;
  if (expectedCompany && result.company) {
    const pCompany = result.company.toLowerCase();
    const eCompany = expectedCompany.toLowerCase();
    if (pCompany.includes(eCompany) || eCompany.includes(pCompany)) {
      companyMatch = true;
    } else {
      const eWords = eCompany.split(/\s+/).filter((w) => w.length > 3);
      if (eWords.length > 0) {
        const matched = eWords.filter((w) => pCompany.includes(w));
        companyMatch = matched.length >= Math.ceil(eWords.length * 0.4);
      }
    }
  }

  // Valid if name matches OR company matches (person may have changed companies)
  const valid = nameMatch || companyMatch;
  const details = `name: ${nameMatch ? 'match' : 'mismatch'} (got "${result.first_name} ${result.last_name}"), company: ${companyMatch ? 'match' : 'mismatch'} (got "${result.company}")`;

  return { valid, nameMatch, companyMatch, details };
}

/**
 * Validate a LinkedIn URL is a real personal profile (not company, posts, etc.)
 * Mirrors the validation logic from the decision_makers_finder tool.
 */
function isValidLinkedInProfileUrl(url: string): boolean {
  if (!url || !url.includes('linkedin.com/in/')) return false;
  const disallowed = [
    'linkedin.com/company/',
    'linkedin.com/posts/',
    'linkedin.com/pub/dir/',
    'linkedin.com/feed/',
    'linkedin.com/jobs/',
    'linkedin.com/school/',
    'linkedin.com/in/ACo',
  ];
  return !disallowed.some((d) => url.includes(d));
}

/**
 * Discover a LinkedIn profile URL via Google search with intelligent scoring.
 * Inspired by the decision_makers_finder tool patterns:
 * - Uses domain in queries for precision (like "{domain} {company} CEO")
 * - Excludes noisy aggregator sites (-zoominfo -dnb)
 * - Tries multiple search strategies from most specific to broadest
 * - Role-specific queries when title is available
 * Returns null if no confident match is found.
 */
async function discoverLinkedInUrl(
  firstName: string,
  lastName: string,
  companyName: string,
  title: string,
  domain?: string,
): Promise<{ url: string; score: number; verification: string[] } | null> {
  const fullName = `${firstName} ${lastName}`.trim();
  if (!fullName) return null;

  // Noise exclusion: filter out aggregator sites that return stale/wrong data
  const excludeNoise = '-zoominfo -dnb -rocketreach -signalhire -apollo.io';

  // Infer domain from company name if not provided
  const companyDomain = domain || (companyName ? inferDomain(companyName) : '');

  // Build multiple search queries from most specific to broadest
  const queries: string[] = [];

  if (companyName) {
    // Strategy 1: domain + quoted name + site restriction (most precise, like decision_makers_finder)
    if (companyDomain) {
      queries.push(
        `${companyDomain} "${fullName}" site:linkedin.com/in ${excludeNoise}`,
      );
    }

    // Strategy 2: quoted name + quoted company + site restriction
    queries.push(`"${fullName}" "${companyName}" site:linkedin.com/in ${excludeNoise}`);

    // Strategy 3: role-specific if we have a title (like CEO/Founder/President queries in decision_makers_finder)
    if (title) {
      const roleKeywords = title
        .split(/[\s,/&]+/)
        .filter((w) => w.length > 2)
        .slice(0, 2)
        .join(' ');
      if (roleKeywords) {
        queries.push(
          `"${fullName}" "${companyName}" ${roleKeywords} site:linkedin.com/in ${excludeNoise}`,
        );
      }
    }

    // Strategy 4: partial company match (core words) + site restriction
    const coreWords = companyName
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 2)
      .join(' ');
    if (coreWords && coreWords.toLowerCase() !== companyName.toLowerCase()) {
      queries.push(`"${fullName}" ${coreWords} site:linkedin.com/in ${excludeNoise}`);
    }

    // Strategy 5: without site restriction (catches non-standard LinkedIn URLs)
    queries.push(`"${fullName}" "${companyName}" linkedin ${excludeNoise}`);
  }

  if (title && !companyName) {
    queries.push(`"${fullName}" ${title} site:linkedin.com/in ${excludeNoise}`);
  }

  // Broadest: just the name
  if (queries.length === 0) {
    queries.push(`"${fullName}" site:linkedin.com/in ${excludeNoise}`);
  }

  let bestMatch: { url: string; score: number; verification: string[] } | null = null;

  for (const query of queries) {
    try {
      const results = await googleSearch(query, 5);
      const linkedInResults = results.filter((r) => isValidLinkedInProfileUrl(r.url));

      for (const result of linkedInResults) {
        const score = scoreLinkedInResult(result, firstName, lastName, companyName, title);
        if (score > (bestMatch?.score || 0)) {
          const verification: string[] = [];
          const rLower = `${result.title} ${result.description}`.toLowerCase();

          if (
            result.title.toLowerCase().includes(firstName.toLowerCase()) &&
            result.title.toLowerCase().includes(lastName.toLowerCase())
          ) {
            verification.push('Name confirmed in title');
          }
          if (companyName) {
            const compWords = companyName
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length > 2);
            const matched = compWords.filter((w) => rLower.includes(w));
            if (matched.length > 0) {
              verification.push(`Company keywords matched (${matched.join(', ')})`);
            }
          }
          if (title) {
            const titleWords = title
              .toLowerCase()
              .split(/[\s,/]+/)
              .filter((w) => w.length > 2);
            if (titleWords.some((w) => rLower.includes(w))) {
              verification.push('Title keywords matched');
            }
          }

          let cleanUrl = result.url.split('?')[0];
          if (!cleanUrl.startsWith('https://')) {
            cleanUrl = cleanUrl.replace('http://', 'https://');
          }
          bestMatch = { url: cleanUrl, score, verification };
        }
      }

      // Strong match found — no need for more queries
      if (bestMatch && bestMatch.score >= 50) break;
    } catch {
      // Continue to next query
    }
  }

  // Minimum score threshold
  return bestMatch && bestMatch.score >= 20 ? bestMatch : null;
}

// ---------- Serper-based decision maker discovery ----------

interface DiscoveredContact {
  first_name: string;
  last_name: string;
  title: string;
  linkedin_url: string;
  source_url: string;
  confidence: number;
}

/**
 * Parse a LinkedIn search result title into structured contact data.
 * LinkedIn titles follow patterns like:
 *   "Ryan Brown - President at Essential Benefit Administrators | LinkedIn"
 *   "John Smith - CEO & Founder at Acme Corp | LinkedIn"
 *   "Jane Doe | LinkedIn"
 */
function parseLinkedInTitle(resultTitle: string): {
  firstName: string;
  lastName: string;
  role: string;
  company: string;
} | null {
  // Strip LinkedIn suffix
  const cleaned = resultTitle
    .replace(/\s*[|·–—-]\s*LinkedIn\s*$/i, '')
    .trim();
  if (!cleaned) return null;

  // Split on dash: "Name - Role at Company" or "Name - Company"
  const dashParts = cleaned.split(/\s+[-–—]\s+/);
  const namePart = dashParts[0]?.trim() || '';
  const names = namePart.split(/\s+/).filter(Boolean);
  if (names.length < 2) return null;

  const firstName = names[0];
  const lastName = names[names.length - 1];

  let role = '';
  let company = '';
  if (dashParts.length >= 2) {
    const rest = dashParts.slice(1).join(' - ').trim();
    const atMatch = rest.match(/^(.+?)\s+at\s+(.+)$/i);
    if (atMatch) {
      role = atMatch[1].trim();
      company = atMatch[2].trim();
    } else {
      // Could be just a company name or just a role
      const looksLikeRole = /\b(CEO|CFO|COO|CTO|VP|President|Founder|Owner|Partner|Director|Manager|Chairman|Principal)\b/i;
      if (looksLikeRole.test(rest)) {
        role = rest;
      } else {
        company = rest;
      }
    }
  }

  return { firstName, lastName, role, company };
}

/**
 * Discover decision makers and key contacts at a company via Google search.
 * Replaces Apify LinkedIn employee scraping with faster, more reliable Serper-based discovery.
 *
 * Uses the same strategy as the decision_makers_finder tool:
 * - Multiple role-specific search queries
 * - Domain-based searches for precision
 * - Parse LinkedIn profile titles for structured data
 * - Score and deduplicate results
 */
async function discoverDecisionMakers(
  companyName: string,
  domain?: string,
  titleFilter?: string[],
  maxResults: number = 25,
): Promise<DiscoveredContact[]> {
  const companyDomain = domain || inferDomain(companyName);
  const excludeNoise = '-zoominfo -dnb -rocketreach -signalhire -apollo.io';

  // Role-specific search queries (like decision_makers_finder)
  const roleQueries = [
    `${companyDomain} "${companyName}" CEO owner founder site:linkedin.com/in ${excludeNoise}`,
    `${companyDomain} "${companyName}" president chairman site:linkedin.com/in ${excludeNoise}`,
    `${companyDomain} "${companyName}" partner principal site:linkedin.com/in ${excludeNoise}`,
    `${companyDomain} "${companyName}" VP director site:linkedin.com/in ${excludeNoise}`,
    `"${companyName}" contact email ${excludeNoise}`,
  ];

  // Add targeted queries for specific title filters
  if (titleFilter?.length) {
    for (const tf of titleFilter) {
      roleQueries.push(
        `${companyDomain} "${companyName}" ${tf} site:linkedin.com/in ${excludeNoise}`,
      );
    }
  }

  // Also try without site restriction for broader coverage
  roleQueries.push(`${companyDomain} "${companyName}" leadership team ${excludeNoise}`);

  console.log(
    `[discover-decision-makers] Running ${roleQueries.length} Serper queries for "${companyName}"`,
  );

  // Run all queries and collect results
  const allResults: Array<{ title: string; url: string; description: string; query: string }> = [];

  for (const query of roleQueries) {
    try {
      const results = await googleSearch(query, 10);
      for (const r of results) {
        allResults.push({ ...r, query });
      }
    } catch (err) {
      console.warn(
        `[discover-decision-makers] Query failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    `[discover-decision-makers] Collected ${allResults.length} total search results`,
  );

  // Extract contacts from LinkedIn results
  const contactMap = new Map<string, DiscoveredContact>();

  for (const result of allResults) {
    // Only process valid LinkedIn profile URLs
    if (!isValidLinkedInProfileUrl(result.url)) continue;

    const parsed = parseLinkedInTitle(result.title);
    if (!parsed) continue;

    // Verify this person is actually associated with the target company
    const combined = `${result.title} ${result.description}`.toLowerCase();
    const compWords = companyName
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const companyWordMatches = compWords.filter((w) => combined.includes(w));

    // Require at least one company word match, or the domain appears in results
    if (companyWordMatches.length === 0 && !combined.includes(companyDomain.toLowerCase())) {
      continue;
    }

    // Clean the LinkedIn URL
    let cleanUrl = result.url.split('?')[0];
    if (!cleanUrl.startsWith('https://')) {
      cleanUrl = cleanUrl.replace('http://', 'https://');
    }

    // Dedup key: lowercase name
    const dedupKey = `${parsed.firstName.toLowerCase()}:${parsed.lastName.toLowerCase()}`;

    // Score this contact
    let confidence = 0;
    // Name found
    confidence += 20;
    // Company match strength
    confidence += Math.min(companyWordMatches.length * 15, 30);
    // Has a role/title
    if (parsed.role) confidence += 20;
    // Role is a decision-maker title
    if (/\b(CEO|CFO|COO|CTO|President|Founder|Owner|Chairman|Partner|Principal)\b/i.test(parsed.role)) {
      confidence += 20;
    } else if (/\b(VP|Director|Manager|General\s*Manager)\b/i.test(parsed.role)) {
      confidence += 10;
    }

    const existing = contactMap.get(dedupKey);
    if (!existing || confidence > existing.confidence) {
      // Keep the more specific title if same person appears multiple times
      const title = parsed.role || existing?.title || '';
      contactMap.set(dedupKey, {
        first_name: parsed.firstName,
        last_name: parsed.lastName,
        title: title.length > (existing?.title?.length || 0) ? title : existing?.title || title,
        linkedin_url: cleanUrl,
        source_url: result.url,
        confidence,
      });
    }
  }

  // Sort by confidence (highest first) and limit
  let results = Array.from(contactMap.values()).sort((a, b) => b.confidence - a.confidence);

  // Apply title filter if specified
  if (titleFilter?.length) {
    const filtered = results.filter((c) => matchesTitle(c.title, titleFilter));
    // If filter produced results, use them; otherwise keep all (filter might be too narrow)
    if (filtered.length > 0) results = filtered;
  }

  console.log(
    `[discover-decision-makers] Found ${results.length} unique contacts for "${companyName}"`,
  );

  return results.slice(0, maxResults);
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
    const errMsg = err instanceof Error ? err.message : String(err);
    const is404 = errMsg.includes('404');
    const isAuth =
      errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Unauthorized');
    const isRateLimit = errMsg.includes('429');

    let diagnosis = '';
    if (is404) {
      diagnosis =
        'The Apify Google search actor may have been renamed or removed. The APIFY_API_TOKEN or actor ID may need updating in Supabase Edge Function secrets.';
    } else if (isAuth) {
      diagnosis =
        'The APIFY_API_TOKEN appears to be invalid or expired. It needs to be updated in Supabase Edge Function secrets.';
    } else if (isRateLimit) {
      diagnosis = 'Apify rate limit hit. Try again in a few minutes.';
    } else {
      diagnosis = 'This may be a temporary network issue. Try again shortly.';
    }

    return {
      error: `Google search failed: ${errMsg}`,
      data: {
        diagnosis,
        alternatives: [
          'Search the internal database using search_contacts, search_pe_contacts, or query_deals instead',
          'The user can search Google manually and paste a LinkedIn URL for enrichment via enrich_contact(mode: "linkedin")',
          'Check APIFY_API_TOKEN in Supabase Edge Function secrets if this persists',
        ],
      },
    };
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

  // 2. Discover contacts via Serper-based Google search (replaces Apify LinkedIn scraping)
  const companyDomain = (args.company_domain as string)?.trim() || undefined;
  let discovered: DiscoveredContact[] = [];
  try {
    discovered = await discoverDecisionMakers(
      companyName,
      companyDomain,
      titleFilter,
      Math.max(targetCount * 2, 30),
    );
  } catch (err) {
    errors.push(`Google-based contact discovery failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Pre-check CRM — skip people we already have email for
  const crmAlreadyKnown = new Set<string>();
  if (discovered.length > 0) {
    // Check by LinkedIn URL
    const linkedInUrls = discovered
      .map((d) => d.linkedin_url?.toLowerCase())
      .filter(Boolean);

    if (linkedInUrls.length > 0) {
      const { data: existingByLinkedIn } = await supabase
        .from('contacts')
        .select('linkedin_url')
        .eq('archived', false)
        .not('email', 'is', null);

      if (existingByLinkedIn?.length) {
        for (const c of existingByLinkedIn) {
          if (c.linkedin_url) {
            const norm = c.linkedin_url.toLowerCase()
              .replace('https://www.', '').replace('https://', '').replace('http://', '');
            if (linkedInUrls.some((u: string) => u.includes(norm) || norm.includes(u.replace('https://www.', '').replace('https://', '')))) {
              crmAlreadyKnown.add(c.linkedin_url.toLowerCase());
            }
          }
        }
      }
    }

    // Check by name + company
    const { data: existingByName } = await supabase
      .from('contacts')
      .select('first_name, last_name')
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

  // Filter out contacts already in CRM with email
  const needsEnrichment = discovered.filter((d) => {
    const normUrl = d.linkedin_url.toLowerCase()
      .replace('https://www.', '').replace('https://', '').replace('http://', '');
    if (normUrl && Array.from(crmAlreadyKnown).some((k) => k.includes(normUrl) || normUrl.includes(k))) {
      return false;
    }
    const nameKey = `${d.first_name.toLowerCase()}:${d.last_name.toLowerCase()}`;
    if (crmAlreadyKnown.has(nameKey)) return false;
    return true;
  });

  const skippedFromCrm = discovered.length - needsEnrichment.length;
  if (skippedFromCrm > 0) {
    console.log(
      `[enrich-buyer-contacts] Skipped ${skippedFromCrm} contacts already in CRM with email`,
    );
  }

  const toEnrich = needsEnrichment.slice(0, targetCount);

  // 4. Prospeo enrichment — try multiple domain candidates for better coverage
  const domainCandidates = companyDomain
    ? [companyDomain, ...inferDomainCandidates(companyName).filter((d) => d !== companyDomain)]
    : inferDomainCandidates(companyName);
  const primaryDomain = domainCandidates[0] || inferDomain(companyName);

  // deno-lint-ignore no-explicit-any
  let enriched: any[] = [];
  try {
    enriched = await batchEnrich(
      toEnrich.map((d) => ({
        firstName: d.first_name,
        lastName: d.last_name,
        linkedinUrl: d.linkedin_url,
        domain: primaryDomain,
        title: d.title,
        company: companyName,
      })),
      3,
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('404')) {
      errors.push(`Email enrichment failed (404): Prospeo API endpoint may have changed. Check PROSPEO_API_KEY.`);
    } else if (errMsg.includes('401') || errMsg.includes('403')) {
      errors.push(`Email enrichment failed (auth): PROSPEO_API_KEY may be invalid or expired.`);
    } else {
      errors.push(`Email enrichment failed: ${errMsg}`);
    }
  }

  // 5. Domain search fallback — try multiple domain candidates
  if (enriched.length < targetCount / 2) {
    for (const domainCandidate of domainCandidates.slice(0, 3)) {
      if (enriched.length >= targetCount) break;
      try {
        const domainResults = await domainSearchEnrich(domainCandidate, targetCount - enriched.length);
        const filteredDomain =
          titleFilter.length > 0
            ? domainResults.filter((r) => matchesTitle(r.title, titleFilter))
            : domainResults;
        enriched = [...enriched, ...filteredDomain];
      } catch {
        /* non-critical — try next domain candidate */
      }
    }
  }

  // Build final contacts — merge enriched results with discovered-only contacts
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

  // Include unenriched LinkedIn-only contacts (discovered but no email from Prospeo)
  // deno-lint-ignore no-explicit-any
  const enrichedLinkedIns = new Set(enriched.map((e: any) => e.linkedin_url?.toLowerCase()));
  const unenriched = toEnrich
    .filter((d) => !enrichedLinkedIns.has(d.linkedin_url?.toLowerCase()))
    .map((d) => ({
      company_name: companyName,
      full_name: `${d.first_name} ${d.last_name}`.trim(),
      first_name: d.first_name,
      last_name: d.last_name,
      title: d.title || '',
      email: null,
      phone: null,
      linkedin_url: d.linkedin_url || '',
      confidence: 'low' as const,
      source: 'google_discovery',
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

  // If all external APIs failed and we got nothing, provide actionable guidance
  if (allContacts.length === 0 && errors.length > 0) {
    return {
      data: {
        contacts: [],
        total_found: 0,
        total_enriched: 0,
        from_cache: false,
        errors,
        message: `Could not find contacts for "${companyName}" — enrichment APIs failed.`,
        alternatives: [
          'Search internal contacts using search_contacts or search_pe_contacts',
          'If the user has a LinkedIn URL for someone at this company, use enrich_contact(mode: "linkedin") instead',
          'Try searching with a different company name or providing the company_domain directly',
          'Check SERPER_API_KEY and PROSPEO_API_KEY in Supabase Edge Function secrets',
        ],
      },
    };
  }

  return {
    data: {
      contacts: allContacts,
      total_found: allContacts.length,
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
      // --- FALLBACK: Prospeo returned nothing — try Google discovery to verify/find correct profile ---
      console.log(`[enrich-linkedin] Prospeo returned no results for ${linkedinUrl} — trying Google fallback`);

      // Try to find CRM context for this LinkedIn URL (person name + company)
      let fallbackFirstName = firstName;
      let fallbackLastName = lastName;
      let fallbackCompany = '';
      let fallbackCrmContactId: string | null = null;

      const normalizedUrl = linkedinUrl.replace('https://www.', '').replace('https://', '').replace('http://', '');
      const { data: crmMatch } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, title, company_name, listing_id, remarketing_buyer_id')
        .or(`linkedin_url.ilike.%${normalizedUrl}%`)
        .eq('archived', false)
        .limit(1);

      if (crmMatch?.length) {
        const c = crmMatch[0] as Record<string, unknown>;
        fallbackFirstName = (c.first_name as string) || fallbackFirstName;
        fallbackLastName = (c.last_name as string) || fallbackLastName;
        fallbackCrmContactId = c.id as string;
        fallbackCompany = (c.company_name as string) || '';

        // Resolve company from linked records if not on contact directly
        if (!fallbackCompany && c.listing_id) {
          const { data: listing } = await supabase
            .from('listings')
            .select('title')
            .eq('id', c.listing_id as string)
            .single();
          if (listing?.title) fallbackCompany = listing.title as string;
        }
        if (!fallbackCompany && c.remarketing_buyer_id) {
          const { data: buyer } = await supabase
            .from('remarketing_buyers')
            .select('company_name, pe_firm_name')
            .eq('id', c.remarketing_buyer_id as string)
            .single();
          if (buyer) fallbackCompany = ((buyer.company_name || buyer.pe_firm_name) as string) || '';
        }
      }

      // If we have a name, try Google search to find the correct LinkedIn profile
      if (fallbackFirstName && fallbackLastName) {
        try {
          const googleResult = await discoverLinkedInUrl(
            fallbackFirstName,
            fallbackLastName,
            fallbackCompany,
            '',
            domain,
          );

          if (googleResult && googleResult.url !== linkedinUrl) {
            // Google found a DIFFERENT LinkedIn URL — stored URL was likely wrong
            console.log(
              `[enrich-linkedin] Google found different profile: ${googleResult.url} (score: ${googleResult.score}) — retrying enrichment`,
            );

            const retryResult = await enrichContact({
              firstName: fallbackFirstName,
              lastName: fallbackLastName,
              linkedinUrl: googleResult.url,
              domain,
            });

            if (retryResult?.email) {
              // Update CRM with corrected URL + email
              if (fallbackCrmContactId) {
                await supabase
                  .from('contacts')
                  .update({
                    linkedin_url: googleResult.url,
                    email: retryResult.email,
                    ...(retryResult.phone ? { phone: retryResult.phone } : {}),
                  })
                  .eq('id', fallbackCrmContactId);
                console.log(
                  `[enrich-linkedin] Corrected LinkedIn URL and updated CRM contact ${fallbackCrmContactId}`,
                );
              }

              // Save to enriched_contacts
              await supabase.from('enriched_contacts').upsert(
                {
                  workspace_id: userId,
                  company_name: retryResult.company || fallbackCompany || 'Unknown',
                  full_name: `${retryResult.first_name} ${retryResult.last_name}`.trim(),
                  first_name: retryResult.first_name,
                  last_name: retryResult.last_name,
                  title: retryResult.title || '',
                  email: retryResult.email,
                  phone: retryResult.phone,
                  linkedin_url: retryResult.linkedin_url || googleResult.url,
                  confidence: retryResult.confidence,
                  source: `linkedin_enrichment:google_corrected:${retryResult.source}`,
                  enriched_at: new Date().toISOString(),
                  search_query: `linkedin:${linkedinUrl}`,
                },
                { onConflict: 'workspace_id,linkedin_url', ignoreDuplicates: false },
              );

              return {
                data: {
                  found: true,
                  name: `${retryResult.first_name} ${retryResult.last_name}`.trim(),
                  email: retryResult.email,
                  phone: retryResult.phone,
                  title: retryResult.title,
                  company: retryResult.company,
                  linkedin_url: retryResult.linkedin_url || googleResult.url,
                  confidence: retryResult.confidence,
                  source: retryResult.source,
                  saved_to_enriched: true,
                  crm_contact_id: fallbackCrmContactId || undefined,
                  crm_action: fallbackCrmContactId ? 'updated' : undefined,
                  original_linkedin_url: linkedinUrl,
                  corrected_linkedin_url: googleResult.url,
                  google_verification: googleResult.verification,
                  message: `Original LinkedIn URL returned no results. Google found correct profile: ${googleResult.url}. Email: ${retryResult.email} (confidence: ${retryResult.confidence})`,
                },
              };
            }
          }
        } catch (googleErr) {
          console.warn(
            `[enrich-linkedin] Google fallback failed: ${googleErr instanceof Error ? googleErr.message : String(googleErr)}`,
          );
        }
      }

      return {
        data: {
          linkedin_url: linkedinUrl,
          found: false,
          message: `Could not find email for this LinkedIn profile. Prospeo returned no results.${fallbackCompany ? ` Google search for ${fallbackFirstName} ${fallbackLastName} at ${fallbackCompany} also did not find a match.` : ''} Try providing the person's company domain (e.g. company_domain: "acme.com") for a name+domain fallback.`,
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

    // Check if this person exists in our CRM contacts — update or create
    let crmContactId: string | null = null;
    let crmAction: 'created' | 'updated' | null = null;
    if (result.email) {
      const normalizedUrl = linkedinUrl.replace('https://www.', '').replace('https://', '').replace('http://', '');

      // First: try matching by LinkedIn URL
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('id, email, phone, linkedin_url, first_name, last_name')
        .or(`linkedin_url.ilike.%${normalizedUrl}%`)
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
      } else if (result.first_name && result.last_name) {
        // Second: try matching by name — catches CRM contacts with stale/different LinkedIn URL
        const { data: nameMatches } = await supabase
          .from('contacts')
          .select('id, email, phone, linkedin_url, first_name, last_name')
          .eq('archived', false)
          .ilike('first_name', result.first_name)
          .ilike('last_name', result.last_name)
          .is('email', null)
          .limit(5);

        if (nameMatches?.length === 1) {
          // Exactly one match without email — safe to update with enriched data + correct LinkedIn URL
          const existing = nameMatches[0] as Record<string, unknown>;
          const updates: Record<string, unknown> = {
            email: result.email,
            linkedin_url: result.linkedin_url || linkedinUrl,
          };
          if (result.phone && !existing.phone) updates.phone = result.phone;

          await supabase.from('contacts').update(updates).eq('id', existing.id);
          crmContactId = existing.id as string;
          crmAction = 'updated';
          console.log(
            `[enrich-linkedin] Updated CRM contact ${existing.id} by name match — corrected LinkedIn URL: ${(existing.linkedin_url as string) || 'none'} → ${linkedinUrl}`,
          );
        } else {
          // No name match or ambiguous — create new contact
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
      } else {
        // No name info — create new contact
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

// ---------- find_and_enrich_person ----------

async function findAndEnrichPerson(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const personName = (args.person_name as string)?.trim();
  if (!personName) return { error: 'person_name is required' };

  const providedCompany = (args.company_name as string)?.trim() || '';
  const contactType = (args.contact_type as string) || 'all';
  const steps: string[] = [];

  // --- Step 1: Search CRM for existing contact ---
  const words = personName.split(/\s+/).filter((w) => w.length > 0);
  const orConditions: string[] = [];
  for (const word of words) {
    const escaped = word.replace(/[%_]/g, '\\$&');
    orConditions.push(`first_name.ilike.%${escaped}%`);
    orConditions.push(`last_name.ilike.%${escaped}%`);
  }

  let crmQuery = supabase
    .from('contacts')
    .select(
      'id, first_name, last_name, email, phone, title, contact_type, listing_id, remarketing_buyer_id, linkedin_url',
    )
    .eq('archived', false)
    .or(orConditions.join(','))
    .limit(10);

  if (contactType !== 'all') crmQuery = crmQuery.eq('contact_type', contactType);

  const { data: crmContacts } = await crmQuery;

  // Client-side refine: all words must match name
  const matched = (crmContacts || []).filter((c: Record<string, unknown>) => {
    const fullName =
      `${(c.first_name as string) || ''} ${(c.last_name as string) || ''}`.toLowerCase();
    return words.every((w) => fullName.includes(w.toLowerCase()));
  }) as Array<Record<string, unknown>>;

  steps.push(
    `1. CRM search for "${personName}": ${matched.length > 0 ? `found ${matched.length} match(es)` : 'no match'}`,
  );

  // If found with email — return immediately
  const withEmail = matched.find((c) => c.email);
  if (withEmail) {
    steps.push('2. Contact already has email — returning immediately');
    return {
      data: {
        found: true,
        source: 'crm_existing',
        contact_id: withEmail.id,
        name: `${withEmail.first_name} ${withEmail.last_name}`.trim(),
        email: withEmail.email,
        phone: withEmail.phone || null,
        title: withEmail.title || null,
        linkedin_url: withEmail.linkedin_url || null,
        contact_type: withEmail.contact_type,
        steps,
        message: `${withEmail.first_name} ${withEmail.last_name} already has email: ${withEmail.email}`,
      },
    };
  }

  // --- Step 2: Resolve company context ---
  const contact = matched[0]; // Best CRM match (if any)
  let companyName = providedCompany;

  if (!companyName && contact) {
    // Try to resolve from linked listing or buyer record
    if (contact.listing_id) {
      const { data: listing } = await supabase
        .from('listings')
        .select('title, category')
        .eq('id', contact.listing_id as string)
        .single();
      if (listing?.title) companyName = listing.title as string;
    }
    if (!companyName && contact.remarketing_buyer_id) {
      const { data: buyer } = await supabase
        .from('remarketing_buyers')
        .select('company_name, pe_firm_name')
        .eq('id', contact.remarketing_buyer_id as string)
        .single();
      if (buyer) companyName = ((buyer.company_name || buyer.pe_firm_name) as string) || '';
    }
  }

  steps.push(
    `2. Company resolution: ${companyName ? `"${companyName}"` : 'unknown (will use name-only search)'}`,
  );

  // --- Step 3: If we already have a LinkedIn URL, verify it and try Prospeo ---
  const storedLinkedinUrl = contact?.linkedin_url as string | undefined;
  if (storedLinkedinUrl?.includes('linkedin.com/in/')) {
    steps.push(`3. LinkedIn URL on record: ${storedLinkedinUrl} — verifying via Google before enriching`);

    // VERIFICATION: Cross-check stored LinkedIn URL against Google discovery
    // This catches stale/wrong URLs (e.g. profile slug changed, wrong person stored)
    const firstName = (contact?.first_name as string) || words[0] || '';
    const lastName = (contact?.last_name as string) || words.slice(1).join(' ') || '';
    const title = (contact?.title as string) || '';

    let verifiedLinkedInUrl = storedLinkedinUrl;
    let linkedinVerified = false;

    try {
      const verifyDomain = companyName ? inferDomain(companyName) : undefined;
      const googleResult = await discoverLinkedInUrl(firstName, lastName, companyName, title, verifyDomain);
      if (googleResult) {
        const storedSlug = storedLinkedinUrl.split('/in/')[1]?.split(/[/?#]/)[0]?.toLowerCase() || '';
        const googleSlug = googleResult.url.split('/in/')[1]?.split(/[/?#]/)[0]?.toLowerCase() || '';

        if (storedSlug === googleSlug) {
          steps.push(`3b. Google confirms stored LinkedIn URL (${googleResult.verification.join(', ')})`);
          linkedinVerified = true;
        } else {
          // Google found a DIFFERENT LinkedIn profile — stored URL is likely wrong
          console.warn(
            `[find-person] Stored LinkedIn URL mismatch: stored=${storedLinkedinUrl}, google=${googleResult.url} (score: ${googleResult.score})`,
          );
          steps.push(
            `3b. Stored LinkedIn URL does NOT match Google discovery — stored: ${storedSlug}, Google found: ${googleSlug} (score: ${googleResult.score}, ${googleResult.verification.join(', ')})`,
          );

          if (googleResult.score >= 40) {
            verifiedLinkedInUrl = googleResult.url;
            steps.push(`3c. Using Google-discovered URL instead: ${googleResult.url}`);
            // Update CRM with corrected LinkedIn URL
            if (contact?.id) {
              await supabase
                .from('contacts')
                .update({ linkedin_url: googleResult.url })
                .eq('id', contact.id);
            }
          } else {
            steps.push(`3c. Google result score too low (${googleResult.score}) — will try stored URL first, then rediscover`);
          }
        }
      } else {
        steps.push(`3b. Google search returned no LinkedIn results — proceeding with stored URL`);
      }
    } catch (err) {
      steps.push(
        `3b. Google verification failed: ${err instanceof Error ? err.message : String(err)} — proceeding with stored URL`,
      );
    }

    // Now enrich with the verified (or best available) LinkedIn URL
    try {
      const domain = companyName ? inferDomain(companyName) : undefined;
      const result = await enrichContact({
        firstName,
        lastName,
        linkedinUrl: verifiedLinkedInUrl,
        domain,
      });

      if (result?.email) {
        // Cross-validate: check that Prospeo result matches expected person
        if (companyName && result.company) {
          const validation = validateProspeoResult(
            result,
            firstName,
            lastName,
            companyName,
          );
          if (!validation.valid && !linkedinVerified) {
            // Prospeo returned data for a different person AND we didn't verify via Google
            console.warn(`[find-person] Prospeo result mismatch: ${validation.details}`);
            steps.push(
              `4. Prospeo returned email but profile mismatch: ${validation.details} — discarding, will rediscover`,
            );
            // Fall through to Google discovery below
          } else {
            if (!validation.valid) {
              steps.push(
                `4. Note: Prospeo company doesn't match CRM (${validation.details}) but LinkedIn URL was Google-verified`,
              );
            }

            // Update CRM contact
            if (contact?.id) {
              const updates: Record<string, unknown> = { email: result.email };
              if (result.phone && !contact.phone) updates.phone = result.phone;
              if (verifiedLinkedInUrl !== storedLinkedinUrl) updates.linkedin_url = verifiedLinkedInUrl;
              await supabase.from('contacts').update(updates).eq('id', contact.id);
              steps.push(`4. Updated CRM contact ${contact.id} with email: ${result.email}`);
            }

            // Save to enriched_contacts for audit trail
            await supabase.from('enriched_contacts').upsert(
              {
                workspace_id: userId,
                company_name: companyName || result.company || 'Unknown',
                full_name: `${result.first_name} ${result.last_name}`.trim(),
                first_name: result.first_name,
                last_name: result.last_name,
                title: result.title || '',
                email: result.email,
                phone: result.phone,
                linkedin_url: result.linkedin_url || verifiedLinkedInUrl,
                confidence: result.confidence,
                source: `auto_enrich:${result.source}`,
                enriched_at: new Date().toISOString(),
                search_query: `person:${personName}`,
              },
              { onConflict: 'workspace_id,linkedin_url', ignoreDuplicates: false },
            );

            return {
              data: {
                found: true,
                source: 'prospeo_linkedin',
                contact_id: contact?.id || null,
                name: `${result.first_name} ${result.last_name}`.trim(),
                email: result.email,
                phone: result.phone,
                title: result.title,
                company: result.company || companyName,
                linkedin_url: result.linkedin_url || verifiedLinkedInUrl,
                confidence: result.confidence,
                linkedin_verified: linkedinVerified,
                linkedin_corrected: verifiedLinkedInUrl !== storedLinkedinUrl ? storedLinkedinUrl : undefined,
                crm_updated: !!contact?.id,
                steps,
                message: `Found email for ${result.first_name} ${result.last_name}: ${result.email} (confidence: ${result.confidence})${verifiedLinkedInUrl !== storedLinkedinUrl ? ' — LinkedIn URL was corrected via Google verification' : ''}`,
              },
            };
          }
        } else {
          // No company to validate against — trust the result
          if (contact?.id) {
            const updates: Record<string, unknown> = { email: result.email };
            if (result.phone && !contact.phone) updates.phone = result.phone;
            await supabase.from('contacts').update(updates).eq('id', contact.id);
            steps.push(`4. Updated CRM contact ${contact.id} with email: ${result.email}`);
          }

          await supabase.from('enriched_contacts').upsert(
            {
              workspace_id: userId,
              company_name: result.company || 'Unknown',
              full_name: `${result.first_name} ${result.last_name}`.trim(),
              first_name: result.first_name,
              last_name: result.last_name,
              title: result.title || '',
              email: result.email,
              phone: result.phone,
              linkedin_url: result.linkedin_url || verifiedLinkedInUrl,
              confidence: result.confidence,
              source: `auto_enrich:${result.source}`,
              enriched_at: new Date().toISOString(),
              search_query: `person:${personName}`,
            },
            { onConflict: 'workspace_id,linkedin_url', ignoreDuplicates: false },
          );

          return {
            data: {
              found: true,
              source: 'prospeo_linkedin',
              contact_id: contact?.id || null,
              name: `${result.first_name} ${result.last_name}`.trim(),
              email: result.email,
              phone: result.phone,
              title: result.title,
              company: result.company || companyName,
              linkedin_url: result.linkedin_url || verifiedLinkedInUrl,
              confidence: result.confidence,
              crm_updated: !!contact?.id,
              steps,
              message: `Found email for ${result.first_name} ${result.last_name}: ${result.email} (confidence: ${result.confidence})`,
            },
          };
        }
      }
      steps.push('4. Prospeo LinkedIn lookup returned no email — trying fallback methods');
    } catch (err) {
      steps.push(
        `4. Prospeo LinkedIn enrichment failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // --- Step 4: Discover LinkedIn URL via scored Google search ---
  // This runs when: no stored URL, OR stored URL failed Prospeo, OR stored URL was invalidated
  const firstName = contact ? (contact.first_name as string) || '' : words[0] || '';
  const lastName = contact ? (contact.last_name as string) || '' : words.slice(1).join(' ') || '';
  const title = (contact?.title as string) || '';

  steps.push(`${steps.length + 1}. Discovering LinkedIn profile via scored Google search`);

  let discoveredLinkedIn: string | null = null;
  try {
    const discoverDomain = companyName ? inferDomain(companyName) : undefined;
    const googleResult = await discoverLinkedInUrl(firstName, lastName, companyName, title, discoverDomain);

    if (googleResult) {
      discoveredLinkedIn = googleResult.url;
      steps.push(
        `${steps.length + 1}. LinkedIn found: ${discoveredLinkedIn} (score: ${googleResult.score}, ${googleResult.verification.join(', ') || 'basic match'})`,
      );

      // Update CRM with LinkedIn URL
      if (contact?.id) {
        await supabase
          .from('contacts')
          .update({ linkedin_url: discoveredLinkedIn })
          .eq('id', contact.id);
      }
    } else {
      steps.push(`${steps.length + 1}. No LinkedIn profile found via Google search`);
    }
  } catch (err) {
    steps.push(
      `${steps.length + 1}. Google search failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // --- Step 5: Enrich email from discovered LinkedIn ---
  if (discoveredLinkedIn) {
    try {
      const domain = companyName ? inferDomain(companyName) : undefined;
      const result = await enrichContact({
        firstName,
        lastName,
        linkedinUrl: discoveredLinkedIn,
        domain,
      });

      if (result?.email) {
        // Update CRM contact
        if (contact?.id) {
          const updates: Record<string, unknown> = { email: result.email };
          if (result.phone && !contact.phone) updates.phone = result.phone;
          await supabase.from('contacts').update(updates).eq('id', contact.id);
          steps.push(
            `${steps.length + 1}. Updated CRM contact ${contact.id} with email: ${result.email}`,
          );
        }

        // Save to enriched_contacts
        await supabase.from('enriched_contacts').upsert(
          {
            workspace_id: userId,
            company_name: companyName || result.company || 'Unknown',
            full_name: `${result.first_name} ${result.last_name}`.trim(),
            first_name: result.first_name,
            last_name: result.last_name,
            title: result.title || '',
            email: result.email,
            phone: result.phone,
            linkedin_url: result.linkedin_url || discoveredLinkedIn,
            confidence: result.confidence,
            source: `auto_enrich:${result.source}`,
            enriched_at: new Date().toISOString(),
            search_query: `person:${personName}`,
          },
          { onConflict: 'workspace_id,linkedin_url', ignoreDuplicates: false },
        );

        return {
          data: {
            found: true,
            source: 'auto_pipeline',
            contact_id: contact?.id || null,
            name: `${result.first_name} ${result.last_name}`.trim(),
            email: result.email,
            phone: result.phone,
            title: result.title,
            company: result.company || companyName,
            linkedin_url: result.linkedin_url || discoveredLinkedIn,
            confidence: result.confidence,
            crm_updated: !!contact?.id,
            steps,
            message: `Found email for ${result.first_name} ${result.last_name}: ${result.email} (confidence: ${result.confidence}, via LinkedIn discovery + Prospeo)`,
          },
        };
      }

      steps.push(`${steps.length + 1}. Prospeo returned no email for this LinkedIn profile`);
    } catch (err) {
      steps.push(
        `${steps.length + 1}. Prospeo enrichment failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // --- Step 6: Domain fallback — try multiple domain candidates ---
  if (companyName) {
    const domainCandidates = inferDomainCandidates(companyName);
    steps.push(
      `${steps.length + 1}. Trying name+domain fallback with ${domainCandidates.length} domain candidate(s): ${domainCandidates.join(', ')}`,
    );

    for (const domainCandidate of domainCandidates) {
      try {
        const result = await enrichContact({
          firstName,
          lastName,
          domain: domainCandidate,
        });

        if (result?.email) {
          if (contact?.id) {
            const updates: Record<string, unknown> = { email: result.email };
            if (result.phone && !contact.phone) updates.phone = result.phone;
            if (discoveredLinkedIn && !contact.linkedin_url)
              updates.linkedin_url = discoveredLinkedIn;
            await supabase.from('contacts').update(updates).eq('id', contact.id);
            steps.push(`${steps.length + 1}. Updated CRM contact with email: ${result.email}`);
          }

          return {
            data: {
              found: true,
              source: 'name_domain_fallback',
              contact_id: contact?.id || null,
              name: `${result.first_name} ${result.last_name}`.trim(),
              email: result.email,
              phone: result.phone,
              title: result.title,
              company: result.company || companyName,
              linkedin_url: discoveredLinkedIn || null,
              confidence: result.confidence,
              domain_used: domainCandidate,
              crm_updated: !!contact?.id,
              steps,
              message: `Found email via name+domain (${domainCandidate}): ${result.email} (confidence: ${result.confidence})`,
            },
          };
        }
      } catch {
        /* try next domain candidate */
      }
    }
    steps.push(`${steps.length + 1}. Name+domain fallback returned no email across all domain candidates`);
  }

  // --- No email found through any method ---
  return {
    data: {
      found: false,
      contact_id: contact?.id || null,
      name: personName,
      company: companyName || null,
      linkedin_url: discoveredLinkedIn,
      steps,
      message:
        `Could not find email for ${personName}. ${discoveredLinkedIn ? `LinkedIn profile found: ${discoveredLinkedIn}` : 'No LinkedIn profile found.'} ${!companyName ? 'Providing a company_name might improve results.' : ''}`.trim(),
    },
  };
}

// ---------- find_decision_makers ----------

async function findDecisionMakers(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const companyName = (args.company_name as string)?.trim();
  if (!companyName) return { error: 'company_name is required for decision_makers mode' };

  const companyDomain = (args.company_domain as string)?.trim() || undefined;
  const titleFilter = (args.title_filter as string[]) || [];
  const targetCount = Math.min((args.target_count as number) || 10, 25);
  const autoEnrich = args.auto_enrich !== false; // default true

  console.log(
    `[find-decision-makers] Discovering contacts at "${companyName}"${companyDomain ? ` (${companyDomain})` : ''}`,
  );

  // 1. Discover decision makers via Google search
  let discovered: DiscoveredContact[] = [];
  try {
    discovered = await discoverDecisionMakers(
      companyName,
      companyDomain,
      titleFilter.length > 0 ? titleFilter : undefined,
      Math.max(targetCount * 2, 30),
    );
  } catch (err) {
    return {
      error: `Google search for decision makers failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (discovered.length === 0) {
    return {
      data: {
        contacts: [],
        total_found: 0,
        total_enriched: 0,
        message: `No decision makers found for "${companyName}" via Google search. Try providing the company_domain or a more specific company name.`,
      },
    };
  }

  // 2. Check CRM for existing contacts — skip those already enriched
  const crmAlreadyKnown = new Set<string>();
  const { data: existingByName } = await supabase
    .from('contacts')
    .select('first_name, last_name, email')
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

  const needsEnrichment = discovered.filter((d) => {
    const nameKey = `${d.first_name.toLowerCase()}:${d.last_name.toLowerCase()}`;
    return !crmAlreadyKnown.has(nameKey);
  });

  const skippedFromCrm = discovered.length - needsEnrichment.length;
  const toProcess = needsEnrichment.slice(0, targetCount);

  // 3. Optionally enrich with Prospeo
  // deno-lint-ignore no-explicit-any
  let enrichedContacts: any[] = [];

  if (autoEnrich && toProcess.length > 0) {
    const domainCandidates = companyDomain
      ? [companyDomain, ...inferDomainCandidates(companyName).filter((d) => d !== companyDomain)]
      : inferDomainCandidates(companyName);
    const primaryDomain = domainCandidates[0] || inferDomain(companyName);

    try {
      enrichedContacts = await batchEnrich(
        toProcess.map((d) => ({
          firstName: d.first_name,
          lastName: d.last_name,
          linkedinUrl: d.linkedin_url,
          domain: primaryDomain,
          title: d.title,
          company: companyName,
        })),
        3,
      );
    } catch (err) {
      console.warn(
        `[find-decision-makers] Prospeo enrichment failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Domain search fallback if Prospeo didn't find enough
    if (enrichedContacts.length < toProcess.length / 2) {
      for (const domainCandidate of domainCandidates.slice(0, 3)) {
        if (enrichedContacts.length >= toProcess.length) break;
        try {
          const domainResults = await domainSearchEnrich(
            domainCandidate,
            toProcess.length - enrichedContacts.length,
          );
          enrichedContacts = [...enrichedContacts, ...domainResults];
        } catch {
          /* non-critical */
        }
      }
    }
  }

  // 4. Build final results — merge enriched data with discovered contacts
  // deno-lint-ignore no-explicit-any
  const enrichedByLinkedIn = new Map<string, any>();
  // deno-lint-ignore no-explicit-any
  for (const e of enrichedContacts) {
    if (e.linkedin_url) {
      enrichedByLinkedIn.set(e.linkedin_url.toLowerCase(), e);
    }
  }

  const finalContacts = toProcess.map((d) => {
    const enriched = enrichedByLinkedIn.get(d.linkedin_url?.toLowerCase());
    return {
      first_name: enriched?.first_name || d.first_name,
      last_name: enriched?.last_name || d.last_name,
      title: d.title || enriched?.title || '',
      email: enriched?.email || null,
      phone: enriched?.phone || null,
      linkedin_url: d.linkedin_url,
      company_name: companyName,
      confidence: enriched?.confidence || (d.confidence >= 60 ? 'medium' : 'low'),
      source: enriched?.source || 'google_discovery',
      discovery_confidence: d.confidence,
    };
  });

  // 5. Save to enriched_contacts
  if (finalContacts.length > 0) {
    const toSave = finalContacts
      .filter((c) => c.linkedin_url)
      .map((c) => ({
        workspace_id: userId,
        company_name: companyName,
        full_name: `${c.first_name} ${c.last_name}`.trim(),
        first_name: c.first_name,
        last_name: c.last_name,
        title: c.title,
        email: c.email,
        phone: c.phone,
        linkedin_url: c.linkedin_url,
        confidence: c.confidence,
        source: `decision_makers:${c.source}`,
        enriched_at: new Date().toISOString(),
        search_query: `decision_makers:${companyName}`,
      }));

    if (toSave.length > 0) {
      await supabase.from('enriched_contacts').upsert(toSave, {
        onConflict: 'workspace_id,linkedin_url',
        ignoreDuplicates: true,
      });
    }
  }

  const withEmail = finalContacts.filter((c) => c.email);
  return {
    data: {
      contacts: finalContacts,
      total_discovered: discovered.length,
      total_found: finalContacts.length,
      total_enriched: withEmail.length,
      skipped_already_in_crm: skippedFromCrm,
      message: `Found ${finalContacts.length} decision makers at "${companyName}" (${withEmail.length} with email)${skippedFromCrm > 0 ? ` — skipped ${skippedFromCrm} already in CRM` : ''}`,
    },
  };
}

// ---------- find_contact_linkedin ----------

interface LinkedInMatch {
  contact_id: string;
  contact_name: string;
  contact_title: string;
  company_name: string;
  linkedin_url: string | null;
  confidence: 'high' | 'medium' | 'low';
  verification: string[];
  search_query: string;
  updated: boolean;
}

async function findContactLinkedIn(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  _userId: string,
): Promise<ToolResult> {
  const contactIds = args.contact_ids as string[] | undefined;
  const contactType = (args.contact_type as string) || 'seller';
  const limit = Math.min((args.limit as number) || 5, 10);
  const autoUpdate = (args.auto_update as boolean) || false;

  // 1. Fetch contacts that need LinkedIn URLs
  let contactQuery = supabase
    .from('contacts')
    .select('id, first_name, last_name, title, listing_id, remarketing_buyer_id, contact_type')
    .eq('archived', false)
    .is('linkedin_url', null)
    .limit(limit);

  if (contactIds?.length) {
    contactQuery = contactQuery.in('id', contactIds);
  } else {
    if (contactType !== 'all') contactQuery = contactQuery.eq('contact_type', contactType);
  }

  const { data: contacts, error: contactError } = await contactQuery;
  if (contactError) return { error: `Failed to fetch contacts: ${contactError.message}` };
  if (!contacts?.length) {
    return {
      data: {
        matches: [],
        total_searched: 0,
        message: 'No contacts found missing LinkedIn URLs matching the criteria.',
      },
    };
  }

  // 2. Resolve company names from linked listings or buyer records
  const listingIds = [
    ...new Set(
      contacts.map((c: Record<string, unknown>) => c.listing_id as string).filter(Boolean),
    ),
  ];
  const buyerIds = [
    ...new Set(
      contacts
        .map((c: Record<string, unknown>) => c.remarketing_buyer_id as string)
        .filter(Boolean),
    ),
  ];

  const listingMap: Record<string, { title: string; category: string }> = {};
  const buyerMap: Record<string, { company_name: string }> = {};

  if (listingIds.length > 0) {
    const { data: listings } = await supabase
      .from('listings')
      .select('id, title, category')
      .in('id', listingIds);
    if (listings) {
      for (const l of listings) {
        listingMap[l.id] = { title: l.title || '', category: l.category || '' };
      }
    }
  }

  if (buyerIds.length > 0) {
    const { data: buyers } = await supabase
      .from('remarketing_buyers')
      .select('id, company_name, pe_firm_name')
      .in('id', buyerIds);
    if (buyers) {
      for (const b of buyers) {
        buyerMap[b.id] = { company_name: b.company_name || b.pe_firm_name || '' };
      }
    }
  }

  // 3. Search Google for each contact's LinkedIn profile
  const matches: LinkedInMatch[] = [];
  const errors: string[] = [];

  for (const contact of contacts as Array<Record<string, unknown>>) {
    const firstName = (contact.first_name as string) || '';
    const lastName = (contact.last_name as string) || '';
    const title = (contact.title as string) || '';
    const fullName = `${firstName} ${lastName}`.trim();

    if (!fullName) {
      errors.push(`Contact ${contact.id}: skipped — no name`);
      continue;
    }

    // Resolve company context
    let companyName = '';
    if (contact.listing_id && listingMap[contact.listing_id as string]) {
      companyName = listingMap[contact.listing_id as string].title;
    } else if (contact.remarketing_buyer_id && buyerMap[contact.remarketing_buyer_id as string]) {
      companyName = buyerMap[contact.remarketing_buyer_id as string].company_name;
    }

    // Use discoverLinkedInUrl for scored, multi-strategy search
    const searchDomain = companyName ? inferDomain(companyName) : undefined;

    try {
      const googleResult = await discoverLinkedInUrl(firstName, lastName, companyName, title, searchDomain);

      if (!googleResult) {
        matches.push({
          contact_id: contact.id as string,
          contact_name: fullName,
          contact_title: title,
          company_name: companyName,
          linkedin_url: null,
          confidence: 'low',
          verification: ['No LinkedIn profile found via scored Google search'],
          search_query: `"${fullName}" "${companyName}" site:linkedin.com/in`,
          updated: false,
        });
        // Rate limit between searches
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      // Map score to confidence levels
      const confidence: 'high' | 'medium' | 'low' =
        googleResult.score >= 50 ? 'high' : googleResult.score >= 30 ? 'medium' : 'low';

      const match: LinkedInMatch = {
        contact_id: contact.id as string,
        contact_name: fullName,
        contact_title: title,
        company_name: companyName,
        linkedin_url: googleResult.url,
        confidence,
        verification: googleResult.verification,
        search_query: `"${fullName}" "${companyName}" site:linkedin.com/in`,
        updated: false,
      };

      // Auto-update if requested and confidence is high
      if (autoUpdate && confidence === 'high') {
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ linkedin_url: googleResult.url })
          .eq('id', contact.id);

        if (!updateError) {
          match.updated = true;
          console.log(
            `[find-contact-linkedin] Updated contact ${contact.id} with LinkedIn URL: ${googleResult.url}`,
          );
        } else {
          errors.push(`Failed to update contact ${contact.id}: ${updateError.message}`);
        }
      }

      matches.push(match);

      // Rate limit: 500ms between Google searches to avoid 429s
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      errors.push(
        `Contact ${contact.id} (${fullName}): search failed — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const highConfidence = matches.filter((m) => m.confidence === 'high' && m.linkedin_url);
  const mediumConfidence = matches.filter((m) => m.confidence === 'medium' && m.linkedin_url);
  const notFound = matches.filter((m) => !m.linkedin_url);
  const updated = matches.filter((m) => m.updated);

  return {
    data: {
      matches,
      total_searched: contacts.length,
      found: matches.filter((m) => m.linkedin_url).length,
      high_confidence: highConfidence.length,
      medium_confidence: mediumConfidence.length,
      not_found: notFound.length,
      auto_updated: updated.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Searched ${contacts.length} contacts: found ${matches.filter((m) => m.linkedin_url).length} LinkedIn profiles (${highConfidence.length} high confidence, ${mediumConfidence.length} medium)${updated.length > 0 ? ` — ${updated.length} auto-updated in CRM` : ''}`,
      next_steps: autoUpdate
        ? 'High-confidence matches have been saved. Review medium/low confidence matches and use enrich_contact(mode: "linkedin") to get their emails.'
        : 'Review the matches above. To save them, call find_contact(mode: "linkedin_search") again with auto_update=true, or manually update individual contacts. Then use enrich_contact(mode: "linkedin") on each LinkedIn URL to find their emails.',
    },
  };
}

// ---------- push_to_phoneburner ----------

const PB_API_BASE = 'https://www.phoneburner.com/rest/1';

async function getPhoneBurnerToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('phoneburner_oauth_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  return tokenRow?.access_token || null;
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
    docusealResponse = await fetch(DOCUSEAL_SUBMISSIONS_URL, {
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
