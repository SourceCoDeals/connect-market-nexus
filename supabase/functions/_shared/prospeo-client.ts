/**
 * Prospeo Email Enrichment Client
 *
 * 3-step waterfall enrichment strategy:
 *   1. LinkedIn profile lookup (highest confidence)
 *   2. Name + domain lookup (medium confidence)
 *   3. Domain search fallback (lower confidence)
 *
 * Includes batch processing with concurrency control.
 */

const PROSPEO_API_BASE = 'https://api.prospeo.io/v1';

interface ProspeoLinkedInResult {
  email: string | null;
  first_name: string;
  last_name: string;
  company: string;
  title: string;
  phone: string | null;
}

interface ProspeoNameResult {
  email: string | null;
  confidence: number;
}

interface ProspeoSearchResult {
  email: string;
  first_name: string;
  last_name: string;
  title: string;
  linkedin_url: string;
  phone: string | null;
}

export interface EnrichmentResult {
  email: string | null;
  phone: string | null;
  first_name: string;
  last_name: string;
  company: string;
  title: string;
  linkedin_url: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'linkedin_lookup' | 'name_domain' | 'domain_search';
}

function getApiKey(): string {
  const key = Deno.env.get('PROSPEO_API_KEY');
  if (!key) throw new Error('PROSPEO_API_KEY not configured');
  return key;
}

/**
 * Step 1: LinkedIn profile lookup — highest confidence.
 */
async function lookupByLinkedIn(linkedinUrl: string): Promise<EnrichmentResult | null> {
  try {
    const res = await fetch(`${PROSPEO_API_BASE}/linkedin-email-finder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KEY': getApiKey(),
      },
      body: JSON.stringify({ url: linkedinUrl }),
    });

    if (!res.ok) return null;

    const data: { response: ProspeoLinkedInResult } = await res.json();
    const r = data.response;

    if (!r?.email) return null;

    return {
      email: r.email,
      phone: r.phone || null,
      first_name: r.first_name || '',
      last_name: r.last_name || '',
      company: r.company || '',
      title: r.title || '',
      linkedin_url: linkedinUrl,
      confidence: 'high',
      source: 'linkedin_lookup',
    };
  } catch {
    return null;
  }
}

/**
 * Step 2: Name + domain lookup — medium confidence.
 */
async function lookupByNameDomain(
  firstName: string,
  lastName: string,
  domain: string,
): Promise<EnrichmentResult | null> {
  try {
    const res = await fetch(`${PROSPEO_API_BASE}/email-finder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KEY': getApiKey(),
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        company: domain,
      }),
    });

    if (!res.ok) return null;

    const data: { response: ProspeoNameResult } = await res.json();
    const r = data.response;

    if (!r?.email) return null;

    return {
      email: r.email,
      phone: null,
      first_name: firstName,
      last_name: lastName,
      company: domain,
      title: '',
      linkedin_url: '',
      confidence: r.confidence > 80 ? 'medium' : 'low',
      source: 'name_domain',
    };
  } catch {
    return null;
  }
}

/**
 * Step 3: Domain search fallback — lower confidence, discovers contacts.
 */
async function searchByDomain(domain: string, limit: number = 10): Promise<EnrichmentResult[]> {
  try {
    const res = await fetch(`${PROSPEO_API_BASE}/domain-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KEY': getApiKey(),
      },
      body: JSON.stringify({ company: domain, limit }),
    });

    if (!res.ok) return [];

    const data: { response: ProspeoSearchResult[] } = await res.json();

    return (data.response || []).map((r) => ({
      email: r.email,
      phone: r.phone || null,
      first_name: r.first_name || '',
      last_name: r.last_name || '',
      company: domain,
      title: r.title || '',
      linkedin_url: r.linkedin_url || '',
      confidence: 'low' as const,
      source: 'domain_search' as const,
    }));
  } catch {
    return [];
  }
}

/**
 * Enrich a single contact through the 3-step waterfall.
 */
export async function enrichContact(contact: {
  firstName: string;
  lastName: string;
  linkedinUrl?: string;
  domain?: string;
  title?: string;
  company?: string;
}): Promise<EnrichmentResult | null> {
  // Step 1: Try LinkedIn lookup
  if (contact.linkedinUrl) {
    const result = await lookupByLinkedIn(contact.linkedinUrl);
    if (result) {
      result.title = result.title || contact.title || '';
      return result;
    }
  }

  // Step 2: Try name + domain
  if (contact.domain && contact.firstName && contact.lastName) {
    const result = await lookupByNameDomain(contact.firstName, contact.lastName, contact.domain);
    if (result) {
      result.title = contact.title || '';
      result.linkedin_url = contact.linkedinUrl || '';
      return result;
    }
  }

  // No email found through individual lookups
  return null;
}

/**
 * Batch-enrich contacts with concurrency control.
 * @param contacts  Array of contacts to enrich
 * @param concurrency  Max concurrent API calls (default 3)
 */
export async function batchEnrich(
  contacts: Array<{
    firstName: string;
    lastName: string;
    linkedinUrl?: string;
    domain?: string;
    title?: string;
    company?: string;
  }>,
  concurrency: number = 3,
): Promise<EnrichmentResult[]> {
  const results: EnrichmentResult[] = [];
  const queue = [...contacts];

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const contact = queue.shift();
      if (!contact) break;

      const result = await enrichContact(contact);
      if (result) {
        results.push(result);
      }

      // Rate limit: 200ms between calls
      await new Promise((r) => setTimeout(r, 200));
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Domain search enrichment — finds contacts at a domain.
 */
export async function domainSearchEnrich(
  domain: string,
  limit: number = 10,
): Promise<EnrichmentResult[]> {
  return searchByDomain(domain, limit);
}
