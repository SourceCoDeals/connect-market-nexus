/**
 * Utility for transforming deal data into anonymized marketplace listing data.
 * Strips company names, contact info, website domains, and other identifying
 * information from text fields while mapping deal fields to listing fields.
 */

interface DealData {
  id: string;
  title: string | null;
  internal_company_name: string | null;
  executive_summary: string | null;
  description: string | null;
  revenue: number | null;
  ebitda: number | null;
  location: string | null;
  address_state: string | null;
  address_city: string | null;
  category: string | null;
  industry: string | null;
  service_mix: string[] | null;
  website: string | null;
  full_time_employees: number | null;
  linkedin_employee_count: number | null;
  main_contact_name: string | null;
  main_contact_email: string | null;
  main_contact_phone: string | null;
  main_contact_title: string | null;
  geographic_states: string[] | null;
  internal_deal_memo_link: string | null;
}

export interface AnonymizedListingData {
  title: string;
  description: string;
  hero_description: string;
  categories: string[];
  location: string;
  revenue: number;
  ebitda: number;
  full_time_employees: number;
  internal_company_name: string;
  internal_notes: string;
  company_website: string;
}

/**
 * Build a list of identifying strings to strip from text content.
 * Includes company name, contact names, email addresses, phone numbers,
 * website domains, and common variations.
 */
function buildIdentifyingTerms(deal: DealData): string[] {
  const terms: string[] = [];

  // Company name and variations
  if (deal.internal_company_name) {
    const name = deal.internal_company_name.trim();
    terms.push(name);

    // Common suffixes to strip independently
    const suffixes = [
      ' Inc',
      ' Inc.',
      ' LLC',
      ' Corp',
      ' Corp.',
      ' Ltd',
      ' Ltd.',
      ' Co',
      ' Co.',
      ' LP',
      ' LLP',
    ];
    for (const suffix of suffixes) {
      if (name.endsWith(suffix)) {
        terms.push(name.slice(0, -suffix.length).trim());
      }
    }
  }

  if (deal.title && deal.title !== deal.internal_company_name) {
    terms.push(deal.title.trim());
  }

  // Contact names
  if (deal.main_contact_name) {
    terms.push(deal.main_contact_name.trim());
    // Also add first/last name parts
    const nameParts = deal.main_contact_name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      // Only add name parts that are 3+ characters to avoid false positives
      nameParts.forEach((part) => {
        if (part.length >= 3) terms.push(part);
      });
    }
  }

  // Email addresses
  if (deal.main_contact_email) {
    terms.push(deal.main_contact_email.trim());
  }

  // Phone numbers
  if (deal.main_contact_phone) {
    terms.push(deal.main_contact_phone.trim());
    // Also add without formatting
    terms.push(deal.main_contact_phone.replace(/[\s\-().]/g, ''));
  }

  // Website domain
  if (deal.website) {
    const url = deal.website.trim();
    terms.push(url);
    // Extract domain without protocol and www
    const domain = url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '');
    terms.push(domain);
    // Also the domain without TLD (e.g. "abcheating" from "abcheating.com")
    const domainBase = domain.split('.')[0];
    if (domainBase && domainBase.length >= 4) {
      terms.push(domainBase);
    }
  }

  // Internal deal memo link
  if (deal.internal_deal_memo_link) {
    terms.push(deal.internal_deal_memo_link.trim());
  }

  // Deduplicate and sort by length (longest first for replacement priority)
  const unique = [...new Set(terms.filter((t) => t.length > 0))];
  unique.sort((a, b) => b.length - a.length);
  return unique;
}

/**
 * Strip all identifying terms from a text string, replacing them
 * with "the Company" or "[redacted]" as appropriate.
 */
export function stripIdentifyingInfo(text: string, deal: DealData): string {
  if (!text) return text;

  const terms = buildIdentifyingTerms(deal);
  let result = text;

  for (const term of terms) {
    // Case-insensitive replacement
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    result = result.replace(regex, 'the Company');
  }

  // Also strip any remaining email addresses
  result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[redacted]');

  // Strip any remaining phone numbers (US format)
  result = result.replace(/(\+?1?\s*[-.]?\s*)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, '[redacted]');

  return result;
}

/**
 * Generate an anonymous title for the listing based on deal data.
 * Creates something like "Leading HVAC Services Provider in the Southeast"
 */
function generateAnonymousTitle(deal: DealData): string {
  const parts: string[] = [];

  // Use industry/category
  const industry = deal.industry || deal.category || deal.service_mix?.[0];

  if (industry) {
    parts.push(`Established ${industry} Business`);
  } else {
    parts.push('Established Services Business');
  }

  // Add location context
  const state = deal.address_state || deal.location;
  if (state) {
    parts[0] += ` in ${state}`;
  }

  return parts[0];
}

/**
 * Generate an anonymous description from executive summary or description.
 */
function generateAnonymousDescription(deal: DealData): string {
  const source = deal.executive_summary || deal.description || '';

  if (!source) {
    const parts: string[] = [];
    const industry = deal.industry || deal.category || 'services';
    parts.push(`An established ${industry.toLowerCase()} business`);

    if (deal.address_state) {
      parts[0] += ` based in ${deal.address_state}`;
    }

    if (deal.revenue && deal.revenue > 0) {
      parts.push(`The company generates ${formatRevenue(deal.revenue)} in annual revenue`);
    }

    if (deal.full_time_employees || deal.linkedin_employee_count) {
      const count = deal.full_time_employees || deal.linkedin_employee_count;
      parts.push(`with a team of approximately ${count} employees`);
    }

    return parts.join('. ') + '.';
  }

  return stripIdentifyingInfo(source, deal);
}

/**
 * Generate a short hero description for the listing card.
 */
function generateHeroDescription(deal: DealData): string {
  const parts: string[] = [];
  const industry = deal.industry || deal.category || 'services';

  parts.push(`Established ${industry.toLowerCase()} business`);

  if (deal.address_state) {
    parts[0] += ` in ${deal.address_state}`;
  }

  if (deal.revenue && deal.revenue > 0) {
    parts[0] += ` with ${formatRevenue(deal.revenue)} in revenue`;
  }

  if (deal.ebitda && deal.ebitda > 0) {
    parts[0] += ` and ${formatRevenue(deal.ebitda)} EBITDA`;
  }

  return parts[0] + '.';
}

function formatRevenue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

/**
 * Main function: transforms deal data into anonymized listing form data.
 * Returns pre-filled values for the listing editor form.
 */
export function anonymizeDealToListing(deal: DealData): AnonymizedListingData {
  const categories: string[] = [];
  if (deal.category) categories.push(deal.category);
  if (deal.industry && deal.industry !== deal.category) categories.push(deal.industry);
  if (deal.service_mix) {
    deal.service_mix.forEach((s) => {
      if (!categories.includes(s)) categories.push(s);
    });
  }

  const location = deal.address_state || deal.location || '';

  return {
    title: generateAnonymousTitle(deal),
    description: generateAnonymousDescription(deal),
    hero_description: generateHeroDescription(deal),
    categories: categories.length > 0 ? categories : [],
    location,
    revenue: deal.revenue || 0,
    ebitda: deal.ebitda || 0,
    full_time_employees: deal.full_time_employees || deal.linkedin_employee_count || 0,
    internal_company_name: deal.internal_company_name || '',
    internal_notes: `Created from deal: ${deal.internal_company_name || deal.id}`,
    company_website: deal.website || '',
  };
}
