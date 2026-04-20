/**
 * Geo-tier classification for lead quality gating.
 *
 * TIER_1 — auto-keep (high-value M&A geographies)
 * TIER_2 — keep, lower base score (mid-tier; uncertain → default here)
 * TIER_3 — risky; run legitimacy gate before keeping
 */

export type GeoTier = 'TIER_1' | 'TIER_2' | 'TIER_3';

const TIER_1_COUNTRIES = new Set([
  'us',
  'usa',
  'united states',
  'united states of america',
  'ca',
  'can',
  'canada',
  'uk',
  'gb',
  'united kingdom',
  'great britain',
  'england',
  'scotland',
  'wales',
  'ie',
  'ireland',
  'au',
  'australia',
  'nz',
  'new zealand',
  'de',
  'germany',
  'deutschland',
  'fr',
  'france',
  'nl',
  'netherlands',
  'holland',
  'se',
  'sweden',
  'no',
  'norway',
  'dk',
  'denmark',
  'fi',
  'finland',
  'ch',
  'switzerland',
  'at',
  'austria',
  'be',
  'belgium',
  'lu',
  'luxembourg',
  'sg',
  'singapore',
  'jp',
  'japan',
  'kr',
  'south korea',
  'korea',
  'il',
  'israel',
  'ae',
  'uae',
  'united arab emirates',
]);

const TIER_2_COUNTRIES = new Set([
  'it',
  'italy',
  'italia',
  'es',
  'spain',
  'españa',
  'pt',
  'portugal',
  'pl',
  'poland',
  'cz',
  'czech republic',
  'czechia',
  'hu',
  'hungary',
  'gr',
  'greece',
  'mx',
  'mexico',
  'cl',
  'chile',
  'ar',
  'argentina',
  'za',
  'south africa',
  'my',
  'malaysia',
  'th',
  'thailand',
  'tw',
  'taiwan',
  'hk',
  'hong kong',
]);

const TIER_3_COUNTRIES = new Set([
  'br',
  'brazil',
  'brasil',
  'in',
  'india',
  'pk',
  'pakistan',
  'bd',
  'bangladesh',
  'id',
  'indonesia',
  'ng',
  'nigeria',
  'ph',
  'philippines',
  'vn',
  'vietnam',
  'eg',
  'egypt',
  'ke',
  'kenya',
  'zm',
  'zambia',
  'gh',
  'ghana',
  'ma',
  'morocco',
  'dz',
  'algeria',
  'tr',
  'turkey',
  'ru',
  'russia',
  'ua',
  'ukraine',
  'lk',
  'sri lanka',
  'np',
  'nepal',
  'mm',
  'myanmar',
  'burma',
  'kh',
  'cambodia',
  'la',
  'laos',
  'iq',
  'iraq',
  'ir',
  'iran',
  'sy',
  'syria',
  'af',
  'afghanistan',
  'ye',
  'yemen',
]);

const TLD_TIER_MAP: Record<string, GeoTier> = {
  // TIER_1
  '.com': 'TIER_2', // ambiguous → default mid; but US/CA usually backed by GPT geo
  '.us': 'TIER_1',
  '.ca': 'TIER_1',
  '.uk': 'TIER_1',
  '.co.uk': 'TIER_1',
  '.ie': 'TIER_1',
  '.au': 'TIER_1',
  '.com.au': 'TIER_1',
  '.nz': 'TIER_1',
  '.co.nz': 'TIER_1',
  '.de': 'TIER_1',
  '.fr': 'TIER_1',
  '.nl': 'TIER_1',
  '.se': 'TIER_1',
  '.no': 'TIER_1',
  '.dk': 'TIER_1',
  '.fi': 'TIER_1',
  '.ch': 'TIER_1',
  '.at': 'TIER_1',
  '.be': 'TIER_1',
  '.lu': 'TIER_1',
  '.sg': 'TIER_1',
  '.jp': 'TIER_1',
  '.co.jp': 'TIER_1',
  '.kr': 'TIER_1',
  '.co.kr': 'TIER_1',
  '.il': 'TIER_1',
  '.co.il': 'TIER_1',
  '.ae': 'TIER_1',
  // TIER_2
  '.it': 'TIER_2',
  '.es': 'TIER_2',
  '.pt': 'TIER_2',
  '.pl': 'TIER_2',
  '.cz': 'TIER_2',
  '.hu': 'TIER_2',
  '.gr': 'TIER_2',
  '.mx': 'TIER_2',
  '.com.mx': 'TIER_2',
  '.cl': 'TIER_2',
  '.ar': 'TIER_2',
  '.com.ar': 'TIER_2',
  '.za': 'TIER_2',
  '.co.za': 'TIER_2',
  '.my': 'TIER_2',
  '.com.my': 'TIER_2',
  '.th': 'TIER_2',
  '.co.th': 'TIER_2',
  '.tw': 'TIER_2',
  '.com.tw': 'TIER_2',
  '.hk': 'TIER_2',
  '.com.hk': 'TIER_2',
  // TIER_3
  '.br': 'TIER_3',
  '.com.br': 'TIER_3',
  '.fom.br': 'TIER_3',
  '.in': 'TIER_3',
  '.co.in': 'TIER_3',
  '.pk': 'TIER_3',
  '.com.pk': 'TIER_3',
  '.bd': 'TIER_3',
  '.com.bd': 'TIER_3',
  '.id': 'TIER_3',
  '.co.id': 'TIER_3',
  '.ng': 'TIER_3',
  '.com.ng': 'TIER_3',
  '.ph': 'TIER_3',
  '.com.ph': 'TIER_3',
  '.vn': 'TIER_3',
  '.com.vn': 'TIER_3',
  '.eg': 'TIER_3',
  '.com.eg': 'TIER_3',
  '.ke': 'TIER_3',
  '.co.ke': 'TIER_3',
  '.gh': 'TIER_3',
  '.com.gh': 'TIER_3',
  '.ma': 'TIER_3',
  '.dz': 'TIER_3',
  '.tr': 'TIER_3',
  '.com.tr': 'TIER_3',
  '.ru': 'TIER_3',
  '.ua': 'TIER_3',
  '.lk': 'TIER_3',
  '.np': 'TIER_3',
  '.mm': 'TIER_3',
  '.kh': 'TIER_3',
};

function classifyByTld(url: string): GeoTier | null {
  const lower = url.toLowerCase();
  // longest match first
  const tlds = Object.keys(TLD_TIER_MAP).sort((a, b) => b.length - a.length);
  for (const tld of tlds) {
    if (lower.endsWith(tld) || lower.includes(`${tld}/`)) {
      const tier = TLD_TIER_MAP[tld];
      // .com is intentionally ambiguous — return null so geography text wins
      if (tld === '.com') return null;
      return tier;
    }
  }
  return null;
}

function classifyByCountryText(text: string | null | undefined): GeoTier | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();
  // Match any tier set against words in the geography string
  // (geography may be "Sao Paulo, Brazil" → match "brazil")
  for (const country of TIER_3_COUNTRIES) {
    if (lower.includes(country)) return 'TIER_3';
  }
  for (const country of TIER_2_COUNTRIES) {
    if (lower.includes(country)) return 'TIER_2';
  }
  for (const country of TIER_1_COUNTRIES) {
    if (lower.includes(country)) return 'TIER_1';
  }
  return null;
}

export function classifyGeoTier(
  websiteUrl: string,
  geographyText?: string | null,
): { tier: GeoTier; source: 'tld' | 'geography' | 'default'; signal: string | null } {
  // 1. TLD wins for clearly tier-3 (cheap, very high signal)
  const tldTier = classifyByTld(websiteUrl);
  if (tldTier === 'TIER_3') {
    return { tier: 'TIER_3', source: 'tld', signal: extractTld(websiteUrl) };
  }

  // 2. Geography text (from GPT extraction)
  const geoTier = classifyByCountryText(geographyText);
  if (geoTier) {
    return { tier: geoTier, source: 'geography', signal: geographyText || null };
  }

  // 3. Tier-1 / tier-2 TLD
  if (tldTier) {
    return { tier: tldTier, source: 'tld', signal: extractTld(websiteUrl) };
  }

  // 4. Unknown → TIER_2 (don't quarantine on uncertainty)
  return { tier: 'TIER_2', source: 'default', signal: null };
}

function extractTld(url: string): string {
  const lower = url.toLowerCase();
  const match = lower.match(/\.[a-z]{2,4}(?:\.[a-z]{2,3})?(?:\/|$)/);
  return match ? match[0].replace(/\/$/, '') : '';
}
