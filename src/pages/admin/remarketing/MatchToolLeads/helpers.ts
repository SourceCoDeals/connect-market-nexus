import type { MatchToolLead } from './types';

// ── Buckets ──────────────────────────────────────────────────────
export const REVENUE_LABELS: Record<string, string> = {
  under_500k: '<$500K',
  under_1m: '<$1M',
  '500k_1m': '$500K–1M',
  '1m_5m': '$1M–5M',
  '5m_10m': '$5M–10M',
  '10m_25m': '$10M–25M',
  '25m_50m': '$25M–50M',
  over_25m: '$25M+',
  '50m_plus': '$50M+',
};

export const PROFIT_LABELS: Record<string, string> = {
  under_100k: '<$100K',
  under_500k: '<$500K',
  '100k_500k': '$100K–500K',
  '500k_1m': '$500K–1M',
  '1m_2.5m': '$1M–2.5M',
  '1m_3m': '$1M–3M',
  '2.5m_5m': '$2.5M–5M',
  '3m_5m': '$3M–5M',
  '5m_plus': '$5M+',
  over_10m: '$10M+',
};

export const TIMELINE_LABELS: Record<string, string> = {
  less_than_6_months: '<6 months',
  '6_to_12_months': '6–12 months',
  '1_to_2_years': '1–2 years',
  '2_plus_years': '2+ years',
  not_sure: 'Not sure',
};

export const QUALITY_ORDER: Record<string, number> = {
  'Very Strong': 5,
  Strong: 4,
  Solid: 3,
  Average: 2,
  'Needs Work': 1,
};

// ── Domain helpers ───────────────────────────────────────────────
export function cleanWebsiteToDomain(raw: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const v = raw.trim();
  if (v.includes('@')) return null;
  const noProto = v.replace(/^[a-z]{2,8}:\/\//i, '').replace(/^[a-z]{2,8}:/i, '');
  const noWww = noProto.replace(/^www\./i, '');
  const domain = noWww.split('/')[0].split('?')[0].split('#')[0];
  if (!domain || !domain.includes('.')) return null;
  if (/[,\s]/.test(domain)) return null;
  if (/^(test|no|example)\./i.test(domain)) return null;
  return domain.toLowerCase();
}

export function inferWebsite(lead: MatchToolLead): string | null {
  return cleanWebsiteToDomain(lead.website);
}

// ── Company name normalization ───────────────────────────────────
const LEGAL_SUFFIXES = new Set([
  'ltd',
  'ltd.',
  'limited',
  'llc',
  'l.l.c.',
  'inc',
  'inc.',
  'incorporated',
  'corp',
  'corp.',
  'corporation',
  'co',
  'co.',
  'company',
  'gmbh',
  'sa',
  's.a.',
  'srl',
  's.r.l.',
  'pty',
  'pvt',
  'plc',
  'ag',
  'bv',
  'sarl',
]);

const NOISE_TAIL_WORDS = new Set([
  'group',
  'holdings',
  'international',
  'global',
  'online',
  'official',
  'website',
  'site',
  'home',
  'homepage',
  'welcome',
]);

function lightTitleCase(token: string): string {
  // Preserve all-caps acronyms (2-4 letters)
  if (/^[A-ZÀ-ÖØ-Þ]{2,4}$/.test(token)) return token;
  // Already mixed-case (e.g. "iPhone", "SAİ") — leave alone
  if (/[A-Z]/.test(token) && /[a-z]/.test(token)) return token;
  // Lowercased word → capitalize first letter
  if (token.length === 0) return token;
  return token[0].toUpperCase() + token.slice(1).toLowerCase();
}

export function prettifyCompanyName(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = raw.trim();
  if (!s) return '';

  // 1. Cut at first separator
  const sepMatch = s.split(/\s*[–—\-|:·•]\s*/);
  if (sepMatch.length > 1) s = sepMatch[0].trim();

  // 2. Strip "X from Y" / "X by Y" prefix → keep Y
  const fromBy = s.match(/^.+?\s+(?:from|by)\s+(.+)$/i);
  if (fromBy) s = fromBy[1].trim();

  // Tokenize
  let tokens = s.split(/\s+/).filter(Boolean);

  // 3. Drop trailing legal suffixes
  while (
    tokens.length > 1 &&
    LEGAL_SUFFIXES.has(tokens[tokens.length - 1].toLowerCase().replace(/[,]/g, ''))
  ) {
    tokens.pop();
  }

  // 4. Drop trailing noise words
  while (tokens.length > 1 && NOISE_TAIL_WORDS.has(tokens[tokens.length - 1].toLowerCase())) {
    tokens.pop();
  }

  // 5. Truncate to 3 words; 2 if still > 28 chars
  if (tokens.length > 3) tokens = tokens.slice(0, 3);
  if (tokens.join(' ').length > 28 && tokens.length > 2) tokens = tokens.slice(0, 2);

  // 6. Light title case
  tokens = tokens.map(lightTitleCase);

  return tokens.join(' ').trim();
}

export function extractBusinessName(lead: MatchToolLead): string {
  const explicit = lead.business_name?.trim();
  if (explicit) {
    const pretty = prettifyCompanyName(explicit);
    if (pretty) return pretty;
  }
  const enrichment = lead.enrichment_data as Record<string, unknown> | null;
  const enrichedName = enrichment?.company_name as string | undefined;
  if (enrichedName) {
    const pretty = prettifyCompanyName(enrichedName);
    if (pretty) return pretty;
  }
  const domain = cleanWebsiteToDomain(lead.website);
  if (domain) {
    const fromDomain = domain
      .replace(/\.(com|net|org|io|co|ai|us|uk|ca|au)(\.[a-z]{2})?$/i, '')
      .replace(/[-_.]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return prettifyCompanyName(fromDomain) || fromDomain;
  }
  if (lead.full_name) return lead.full_name;
  return lead.website || '—';
}

/** Returns the original (raw) business name candidate, untouched, for tooltips. */
export function extractBusinessNameRaw(lead: MatchToolLead): string {
  const explicit = lead.business_name?.trim();
  if (explicit) return explicit;
  const enrichment = lead.enrichment_data as Record<string, unknown> | null;
  const enrichedName = (enrichment?.company_name as string | undefined)?.trim();
  if (enrichedName) return enrichedName;
  return '';
}

// Strip "noise" location values that AI/forms emit but mean nothing
const NOISE_LOCATIONS = new Set([
  '',
  'not specified',
  'not sure',
  'global',
  'unknown',
  'international',
  'n/a',
  'na',
  'none',
  'null',
  'worldwide',
]);

export function resolveLocation(lead: MatchToolLead): string | null {
  // Visitor-submission location preferred; fall back to free-text + enriched
  // geography. A length cap prevents long service-area lists from overflowing
  // the column.
  const raw = lead.raw_inputs as Record<string, unknown> | null;
  const city = (raw?.city as string | undefined)?.trim();
  const region = (raw?.region as string | undefined)?.trim();
  const country = (raw?.country as string | undefined)?.trim();

  const enrichment = lead.enrichment_data as Record<string, unknown> | null;
  const enrichedGeo = (enrichment?.geography as string | undefined)?.trim();

  const candidates = [
    city && region ? `${city}, ${region}` : null,
    city,
    region,
    country,
    lead.location?.trim() || null,
    enrichedGeo || null,
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (NOISE_LOCATIONS.has(c.toLowerCase())) continue;
    return capLocation(c);
  }
  return null;
}

function capLocation(value: string): string {
  const MAX = 30;
  if (value.length <= MAX) return value;
  if (value.includes(',')) {
    const first = value.split(',')[0].trim();
    if (first.length <= MAX) return first;
    return `${first.slice(0, 28)}…`;
  }
  return `${value.slice(0, 28)}…`;
}

export function formatAge(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30.44);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears}y ago`;
}

export function formatFinancials(revenue: string | null, profit: string | null): string | null {
  const parts: string[] = [];
  if (revenue) parts.push(`${REVENUE_LABELS[revenue] || revenue} rev`);
  if (profit) parts.push(`${PROFIT_LABELS[profit] || profit} profit`);
  return parts.length ? parts.join(' · ') : null;
}

export function getStageLabel(stage: string): {
  label: string;
  tone: 'emerald' | 'blue' | 'muted';
} {
  if (stage === 'full_form') return { label: 'Wants Buyers', tone: 'emerald' };
  if (stage === 'financials') return { label: 'Has Financials', tone: 'blue' };
  return { label: 'Browse', tone: 'muted' };
}

// ── Listing build (for "push to Active Deals") ───────────────────
const REVENUE_MIDPOINTS: Record<string, number> = {
  under_500k: 250_000,
  under_1m: 500_000,
  '500k_1m': 750_000,
  '1m_5m': 3_000_000,
  '5m_10m': 7_500_000,
  '10m_25m': 17_500_000,
  '25m_50m': 37_500_000,
  over_25m: 35_000_000,
  '50m_plus': 75_000_000,
};

const PROFIT_MIDPOINTS: Record<string, number> = {
  under_100k: 50_000,
  under_500k: 250_000,
  '100k_500k': 300_000,
  '500k_1m': 750_000,
  '1m_2.5m': 1_750_000,
  '1m_3m': 2_000_000,
  '2.5m_5m': 3_750_000,
  '3m_5m': 4_000_000,
  '5m_plus': 7_500_000,
  over_10m: 12_500_000,
};

export function buildListingFromMatchToolLead(lead: MatchToolLead, forPush = true) {
  const businessName = extractBusinessName(lead);
  const cleanDomain = inferWebsite(lead);
  const revenueNum = lead.revenue ? (REVENUE_MIDPOINTS[lead.revenue] ?? null) : null;
  const profitNum = lead.profit ? (PROFIT_MIDPOINTS[lead.profit] ?? null) : null;

  const noteLines: string[] = [
    `--- Match Tool Lead Intelligence ---`,
    `Source: Buyer/Seller Match Tool`,
    `Stage: ${lead.submission_stage}`,
    `Submitted: ${new Date(lead.created_at).toLocaleDateString()}`,
  ];
  if (lead.full_name) noteLines.push(`Name: ${lead.full_name}`);
  if (lead.email) noteLines.push(`Email: ${lead.email}`);
  if (lead.phone) noteLines.push(`Phone: ${lead.phone}`);
  if (lead.linkedin_url) noteLines.push(`LinkedIn: ${lead.linkedin_url}`);
  if (lead.business_name) noteLines.push(`Business Name: ${lead.business_name}`);
  if (lead.website) noteLines.push(`Website: ${lead.website}`);
  if (lead.industry) noteLines.push(`Industry: ${lead.industry}`);
  if (lead.location) noteLines.push(`Location: ${lead.location}`);
  if (lead.revenue)
    noteLines.push(`Revenue Bucket: ${REVENUE_LABELS[lead.revenue] || lead.revenue}`);
  if (lead.profit) noteLines.push(`Profit Bucket: ${PROFIT_LABELS[lead.profit] || lead.profit}`);
  if (lead.timeline) noteLines.push(`Timeline: ${TIMELINE_LABELS[lead.timeline] || lead.timeline}`);

  return {
    deal_identifier: `mtlead_${lead.id.slice(0, 8)}`,
    title: businessName !== '—' ? businessName : lead.full_name || 'Match Tool Lead',
    deal_name: businessName,
    company_website: cleanDomain ? `https://${cleanDomain}` : null,
    industry: lead.industry || null,
    state: lead.location || null,
    revenue: revenueNum,
    ebitda: profitNum,
    deal_source: 'match_tool',
    remarketing_status: forPush ? 'active' : 'queue',
    is_internal_deal: !forPush,
    pushed_to_all_deals: forPush,
    pushed_to_all_deals_at: forPush ? new Date().toISOString() : null,
    notes: noteLines.join('\n'),
  };
}

// ── CSV export ───────────────────────────────────────────────────
export function exportMatchToolLeadsToCSV(leads: MatchToolLead[]) {
  const headers = [
    'Website',
    'Business Name',
    'Contact Name',
    'Email',
    'Phone',
    'LinkedIn',
    'Revenue',
    'Profit',
    'Timeline',
    'Stage',
    'Industry',
    'Location',
    'Status',
    'Quality',
    'Score',
    'Pushed',
    'Created At',
  ];
  const escape = (v: unknown) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = leads.map((l) =>
    [
      l.website,
      l.business_name,
      l.full_name,
      l.email,
      l.phone,
      l.linkedin_url,
      l.revenue ? REVENUE_LABELS[l.revenue] || l.revenue : '',
      l.profit ? PROFIT_LABELS[l.profit] || l.profit : '',
      l.timeline ? TIMELINE_LABELS[l.timeline] || l.timeline : '',
      l.submission_stage,
      l.industry,
      l.location,
      l.status,
      l.quality_label,
      l.lead_score,
      l.pushed_to_all_deals ? 'Yes' : 'No',
      l.created_at,
    ]
      .map(escape)
      .join(','),
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `match-tool-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
