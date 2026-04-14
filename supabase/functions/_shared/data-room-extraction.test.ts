/**
 * Tests for data room document extraction pipeline.
 *
 * Covers the two bugs fixed in the April 2026 deep audit:
 *
 * BUG #1 — DEAL_TOOL_SCHEMA was website-only (18 fields, no financials).
 *   Fix: DEAL_DATA_ROOM_TOOL_SCHEMA + sanitizeDataRoomExtraction.
 *   Tests here replicate both pure functions and verify:
 *     - Schema has all 40+ expected fields
 *     - Required financial fields are present
 *     - Field names match VALID_LISTING_UPDATE_KEYS (preventing silent drops)
 *     - Sanitizer coerces "5.25M" → 5250000, "18%" → 0.18 for margins
 *     - Sanitizer clamps to plausible ranges
 *     - Sanitizer drops placeholders and empty strings
 *
 * BUG #2 — document-text-extractor sent DOCX/XLSX/PPTX to Gemini inline_data,
 *   which Gemini does not support. Fix: local jszip parsing.
 *   Tests here build DOCX/XLSX/PPTX fixtures in-memory using the real jszip
 *   npm package, then verify the extraction helpers produce the expected text.
 *
 * Pattern: All logic is re-implemented in the test file to avoid Deno-specific
 * imports, matching the convention in other edge function tests
 * (find-contacts/index.test.ts, etc.).
 */

import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';

// ============================================================================
// Re-implementations of the pure logic from deal-extraction.ts and
// document-text-extractor.ts — kept in lockstep with the production code.
// If production changes, update this file AND run the tests.
// ============================================================================

// ── sanitizeDataRoomExtraction ──────────────────────────────────────────────

const DATA_ROOM_NUMERIC_RANGES: Record<string, { min: number; max: number }> = {
  revenue: { min: 0, max: 10_000_000_000 },
  ebitda: { min: -1_000_000_000, max: 10_000_000_000 },
  ebitda_margin: { min: -1, max: 1 },
  asking_price: { min: 0, max: 100_000_000_000 },
  full_time_employees: { min: 0, max: 1_000_000 },
  part_time_employees: { min: 0, max: 1_000_000 },
  number_of_locations: { min: 0, max: 10_000 },
  founded_year: { min: 1800, max: new Date().getFullYear() },
  customer_concentration: { min: 0, max: 1 },
};

const DATA_ROOM_PLACEHOLDER_STRINGS = new Set([
  'unknown',
  'n/a',
  'na',
  'none',
  'null',
  'not found',
  'not specified',
  'not provided',
  'not available',
  'tbd',
  'undefined',
  'not disclosed',
  'not stated',
  'unclear',
  '—',
  '-',
]);

function coerceDataRoomNumeric(value: unknown, field: string): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;

  const s = value.trim().replace(/[$,\s]/g, '');
  if (s.length === 0) return null;
  if (DATA_ROOM_PLACEHOLDER_STRINGS.has(s.toLowerCase())) return null;

  if (s.endsWith('%')) {
    const n = parseFloat(s.slice(0, -1));
    if (!Number.isFinite(n)) return null;
    if (field === 'ebitda_margin' || field === 'customer_concentration') {
      return n / 100;
    }
    return n;
  }

  const match = s.match(/^(-?\d+(?:\.\d+)?)\s*([kmbtKMBT])?$/);
  if (match) {
    const base = parseFloat(match[1]);
    if (!Number.isFinite(base)) return null;
    const unit = (match[2] || '').toLowerCase();
    const multiplier: Record<string, number> = {
      k: 1_000,
      m: 1_000_000,
      b: 1_000_000_000,
      t: 1_000_000_000_000,
      '': 1,
    };
    return base * multiplier[unit];
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function sanitizeDataRoomExtraction(raw: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;

    if (key in DATA_ROOM_NUMERIC_RANGES) {
      const range = DATA_ROOM_NUMERIC_RANGES[key];
      const coerced = coerceDataRoomNumeric(value, key);
      if (coerced === null) continue;
      if (coerced < range.min || coerced > range.max) continue;
      clean[key] = coerced;
      continue;
    }

    if (key.endsWith('_is_inferred')) {
      if (typeof value === 'boolean') clean[key] = value;
      else if (value === 'true' || value === 1) clean[key] = true;
      else if (value === 'false' || value === 0) clean[key] = false;
      continue;
    }

    if (Array.isArray(value)) {
      const filtered = value
        .map((v) => (typeof v === 'string' ? v.trim() : v))
        .filter((v) => {
          if (typeof v !== 'string') return v !== null && v !== undefined;
          return v.length > 0 && !DATA_ROOM_PLACEHOLDER_STRINGS.has(v.toLowerCase());
        });
      if (filtered.length > 0) clean[key] = filtered;
      continue;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) continue;
      if (DATA_ROOM_PLACEHOLDER_STRINGS.has(trimmed.toLowerCase())) continue;
      if (
        /^<.+>$/.test(trimmed) &&
        DATA_ROOM_PLACEHOLDER_STRINGS.has(trimmed.slice(1, -1).toLowerCase())
      )
        continue;
      clean[key] = trimmed;
      continue;
    }

    clean[key] = value;
  }

  return clean;
}

// ── Schema definition (replicated for shape tests) ──────────────────────────

const DATA_ROOM_SCHEMA_FIELDS = [
  // Identity
  'internal_company_name',
  'industry',
  'website',
  'linkedin_url',
  'founded_year',
  // Summary & services
  'executive_summary',
  'services',
  'service_mix',
  // Location
  'street_address',
  'address_city',
  'address_state',
  'address_zip',
  'address_country',
  'geographic_states',
  'number_of_locations',
  // Financials
  'revenue',
  'revenue_is_inferred',
  'revenue_source_quote',
  'ebitda',
  'ebitda_margin',
  'ebitda_is_inferred',
  'ebitda_source_quote',
  'asking_price',
  'financial_notes',
  'financial_followup_questions',
  // Team & ownership
  'full_time_employees',
  'part_time_employees',
  'ownership_structure',
  'management_depth',
  'seller_motivation',
  'owner_goals',
  'transition_preferences',
  'timeline_notes',
  'special_requirements',
  // Customers
  'customer_types',
  'customer_geography',
  'customer_concentration',
  'end_market_description',
  // Operations / risk
  'growth_trajectory',
  'growth_drivers',
  'key_risks',
  'technology_systems',
  'real_estate_info',
  // Contact
  'main_contact_name',
  'main_contact_email',
  'main_contact_phone',
  // Evidence
  'key_quotes',
];

// ── XML text extraction helpers (replicated from document-text-extractor.ts) ─

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function extractDocxText(xml: string): string {
  if (!xml) return '';
  const paragraphs: string[] = [];
  const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = paragraphRegex.exec(xml)) !== null) {
    const inner = match[1];
    const textRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    const runs: string[] = [];
    let textMatch: RegExpExecArray | null;
    while ((textMatch = textRegex.exec(inner)) !== null) {
      runs.push(stripXmlTags(textMatch[1]));
    }
    const paragraph = runs.join('').trim();
    if (paragraph.length > 0) paragraphs.push(paragraph);
  }
  return paragraphs.join('\n');
}

function extractXlsxSharedStrings(xml: string): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = siRegex.exec(xml)) !== null) {
    const inner = match[1];
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    const parts: string[] = [];
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(inner)) !== null) {
      parts.push(stripXmlTags(tMatch[1]));
    }
    strings.push(parts.join(''));
  }
  return strings;
}

function extractXlsxSheetRows(xml: string, sharedStrings: string[]): string[][] {
  if (!xml) return [];
  const rows: string[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2];
      const typeMatch = attrs.match(/\bt="([^"]+)"/);
      const cellType = typeMatch ? typeMatch[1] : 'n';

      if (cellType === 's') {
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (vMatch) {
          const idx = parseInt(stripXmlTags(vMatch[1]), 10);
          if (!isNaN(idx) && sharedStrings[idx] !== undefined) {
            cells.push(sharedStrings[idx]);
          } else {
            cells.push('');
          }
        } else {
          cells.push('');
        }
      } else if (cellType === 'inlineStr') {
        const tMatch = inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
        cells.push(tMatch ? stripXmlTags(tMatch[1]) : '');
      } else {
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
        cells.push(vMatch ? stripXmlTags(vMatch[1]) : '');
      }
    }
    if (cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }
  return rows;
}

function extractPptxSlideText(xml: string): string {
  if (!xml) return '';
  const paragraphs: string[] = [];
  const paraRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  let match: RegExpExecArray | null;
  while ((match = paraRegex.exec(xml)) !== null) {
    const inner = match[1];
    const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
    const runs: string[] = [];
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(inner)) !== null) {
      runs.push(stripXmlTags(tMatch[1]));
    }
    const paragraph = runs.join('').trim();
    if (paragraph.length > 0) paragraphs.push(paragraph);
  }
  return paragraphs.join('\n');
}

// ============================================================================
// TESTS
// ============================================================================

describe('DEAL_DATA_ROOM_TOOL_SCHEMA shape', () => {
  it('has all 45+ expected fields covering the gap from website schema', () => {
    // This is the core BUG #1 fix — the website schema had 18 fields and
    // dropped everything financial. This schema must have 45+ to capture
    // CIM content.
    expect(DATA_ROOM_SCHEMA_FIELDS.length).toBeGreaterThanOrEqual(45);
  });

  it('includes revenue, ebitda, ebitda_margin, asking_price', () => {
    for (const f of ['revenue', 'ebitda', 'ebitda_margin', 'asking_price']) {
      expect(DATA_ROOM_SCHEMA_FIELDS).toContain(f);
    }
  });

  it('includes revenue_is_inferred + ebitda_is_inferred boolean flags', () => {
    expect(DATA_ROOM_SCHEMA_FIELDS).toContain('revenue_is_inferred');
    expect(DATA_ROOM_SCHEMA_FIELDS).toContain('ebitda_is_inferred');
  });

  it('includes source_quote fields for traceability', () => {
    expect(DATA_ROOM_SCHEMA_FIELDS).toContain('revenue_source_quote');
    expect(DATA_ROOM_SCHEMA_FIELDS).toContain('ebitda_source_quote');
  });

  it('includes ownership/management fields for deal structuring', () => {
    expect(DATA_ROOM_SCHEMA_FIELDS).toContain('ownership_structure');
    expect(DATA_ROOM_SCHEMA_FIELDS).toContain('management_depth');
    expect(DATA_ROOM_SCHEMA_FIELDS).toContain('seller_motivation');
  });

  it('includes founded_year for company age tracking', () => {
    expect(DATA_ROOM_SCHEMA_FIELDS).toContain('founded_year');
  });

  it('includes risk disclosure fields (key_risks, customer_concentration)', () => {
    expect(DATA_ROOM_SCHEMA_FIELDS).toContain('key_risks');
    expect(DATA_ROOM_SCHEMA_FIELDS).toContain('customer_concentration');
  });

  it('field names must match VALID_LISTING_UPDATE_KEYS exactly', () => {
    // These are the canonical listing columns the update path accepts.
    // Copied from deal-extraction.ts line 38-93 to lock behavior.
    const VALID_LISTING_UPDATE_KEYS = new Set([
      'internal_company_name',
      'title',
      'executive_summary',
      'services',
      'service_mix',
      'industry',
      'geographic_states',
      'number_of_locations',
      'street_address',
      'address_city',
      'address_state',
      'address_zip',
      'address_country',
      'address',
      'founded_year',
      'full_time_employees',
      'part_time_employees',
      'website',
      'customer_types',
      'end_market_description',
      'customer_concentration',
      'customer_geography',
      'owner_goals',
      'ownership_structure',
      'transition_preferences',
      'special_requirements',
      'timeline_notes',
      'key_risks',
      'technology_systems',
      'real_estate_info',
      'growth_trajectory',
      'key_quotes',
      'seller_motivation',
      'management_depth',
      'growth_drivers',
      'main_contact_name',
      'main_contact_email',
      'main_contact_phone',
      'linkedin_employee_count',
      'linkedin_employee_range',
      'linkedin_url',
      'revenue',
      'ebitda',
      'revenue_is_inferred',
      'revenue_source_quote',
      'ebitda_margin',
      'ebitda_is_inferred',
      'ebitda_source_quote',
      'financial_notes',
      'financial_followup_questions',
      'asking_price',
    ]);
    const unknownFields = DATA_ROOM_SCHEMA_FIELDS.filter((f) => !VALID_LISTING_UPDATE_KEYS.has(f));
    expect(unknownFields).toEqual([]);
  });
});

describe('coerceDataRoomNumeric', () => {
  it('returns pure numbers unchanged', () => {
    expect(coerceDataRoomNumeric(5250000, 'revenue')).toBe(5250000);
    expect(coerceDataRoomNumeric(0, 'revenue')).toBe(0);
    expect(coerceDataRoomNumeric(-1500, 'ebitda')).toBe(-1500);
  });

  it('returns null for NaN/Infinity', () => {
    expect(coerceDataRoomNumeric(NaN, 'revenue')).toBe(null);
    expect(coerceDataRoomNumeric(Infinity, 'revenue')).toBe(null);
    expect(coerceDataRoomNumeric(-Infinity, 'revenue')).toBe(null);
  });

  it('parses "M" suffix as millions', () => {
    expect(coerceDataRoomNumeric('5.25M', 'revenue')).toBe(5250000);
    expect(coerceDataRoomNumeric('2M', 'revenue')).toBe(2000000);
    expect(coerceDataRoomNumeric('12.5m', 'revenue')).toBe(12500000);
  });

  it('parses "K" suffix as thousands', () => {
    expect(coerceDataRoomNumeric('500K', 'revenue')).toBe(500000);
    expect(coerceDataRoomNumeric('750k', 'revenue')).toBe(750000);
  });

  it('parses "B" suffix as billions', () => {
    expect(coerceDataRoomNumeric('2.5B', 'revenue')).toBe(2500000000);
    expect(coerceDataRoomNumeric('1b', 'revenue')).toBe(1000000000);
  });

  it('strips currency symbols and commas', () => {
    expect(coerceDataRoomNumeric('$1,234,567', 'revenue')).toBe(1234567);
    expect(coerceDataRoomNumeric('$5.25M', 'revenue')).toBe(5250000);
    expect(coerceDataRoomNumeric('$2,500,000', 'revenue')).toBe(2500000);
  });

  it('converts percentage to decimal for margin fields', () => {
    expect(coerceDataRoomNumeric('18.3%', 'ebitda_margin')).toBeCloseTo(0.183);
    expect(coerceDataRoomNumeric('15%', 'ebitda_margin')).toBeCloseTo(0.15);
    expect(coerceDataRoomNumeric('25%', 'customer_concentration')).toBeCloseTo(0.25);
  });

  it('returns percentage as-is for non-margin fields', () => {
    expect(coerceDataRoomNumeric('50%', 'number_of_locations')).toBe(50);
  });

  it('returns null for placeholder strings', () => {
    expect(coerceDataRoomNumeric('unknown', 'revenue')).toBe(null);
    expect(coerceDataRoomNumeric('n/a', 'revenue')).toBe(null);
    expect(coerceDataRoomNumeric('TBD', 'revenue')).toBe(null);
    expect(coerceDataRoomNumeric('not disclosed', 'revenue')).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(coerceDataRoomNumeric('', 'revenue')).toBe(null);
    expect(coerceDataRoomNumeric('   ', 'revenue')).toBe(null);
  });

  it('handles negative numbers', () => {
    expect(coerceDataRoomNumeric('-500000', 'ebitda')).toBe(-500000);
    expect(coerceDataRoomNumeric('-$500K', 'ebitda')).toBe(-500000);
  });

  it('handles decimals without unit suffix', () => {
    expect(coerceDataRoomNumeric('1234.56', 'revenue')).toBe(1234.56);
  });

  it('returns null for garbage input', () => {
    expect(coerceDataRoomNumeric('hello world', 'revenue')).toBe(null);
    expect(coerceDataRoomNumeric('[]', 'revenue')).toBe(null);
    expect(coerceDataRoomNumeric({}, 'revenue')).toBe(null);
    expect(coerceDataRoomNumeric([], 'revenue')).toBe(null);
    expect(coerceDataRoomNumeric(null, 'revenue')).toBe(null);
    expect(coerceDataRoomNumeric(undefined, 'revenue')).toBe(null);
  });
});

describe('sanitizeDataRoomExtraction — basic cases', () => {
  it('returns empty object for empty input', () => {
    expect(sanitizeDataRoomExtraction({})).toEqual({});
  });

  it('drops null and undefined values', () => {
    expect(
      sanitizeDataRoomExtraction({ revenue: null, ebitda: undefined, industry: 'HVAC' }),
    ).toEqual({
      industry: 'HVAC',
    });
  });

  it('preserves valid string fields', () => {
    expect(
      sanitizeDataRoomExtraction({ industry: 'HVAC Services', executive_summary: 'A summary.' }),
    ).toEqual({ industry: 'HVAC Services', executive_summary: 'A summary.' });
  });

  it('trims string whitespace', () => {
    expect(sanitizeDataRoomExtraction({ industry: '  HVAC  ' })).toEqual({ industry: 'HVAC' });
  });

  it('drops empty strings after trim', () => {
    expect(sanitizeDataRoomExtraction({ industry: '   ' })).toEqual({});
    expect(sanitizeDataRoomExtraction({ industry: '' })).toEqual({});
  });

  it('drops placeholder strings (case-insensitive)', () => {
    expect(sanitizeDataRoomExtraction({ industry: 'Unknown' })).toEqual({});
    expect(sanitizeDataRoomExtraction({ industry: 'N/A' })).toEqual({});
    expect(sanitizeDataRoomExtraction({ industry: 'TBD' })).toEqual({});
    expect(sanitizeDataRoomExtraction({ industry: 'not disclosed' })).toEqual({});
  });

  it('drops wrapped placeholder like "<unknown>"', () => {
    expect(sanitizeDataRoomExtraction({ industry: '<unknown>' })).toEqual({});
  });
});

describe('sanitizeDataRoomExtraction — numeric coercion', () => {
  it('coerces revenue "5.25M" to 5250000', () => {
    expect(sanitizeDataRoomExtraction({ revenue: '5.25M' })).toEqual({ revenue: 5250000 });
  });

  it('coerces ebitda with $ and commas', () => {
    expect(sanitizeDataRoomExtraction({ ebitda: '$1,250,000' })).toEqual({ ebitda: 1250000 });
  });

  it('coerces ebitda_margin "18%" to 0.18', () => {
    const result = sanitizeDataRoomExtraction({ ebitda_margin: '18%' });
    expect(result.ebitda_margin).toBeCloseTo(0.18);
  });

  it('coerces founded_year integer', () => {
    expect(sanitizeDataRoomExtraction({ founded_year: 1987 })).toEqual({ founded_year: 1987 });
  });

  it('coerces full_time_employees from string', () => {
    expect(sanitizeDataRoomExtraction({ full_time_employees: '42' })).toEqual({
      full_time_employees: 42,
    });
  });

  it('drops revenue that exceeds plausible range (>$10B)', () => {
    expect(sanitizeDataRoomExtraction({ revenue: '50B' })).toEqual({});
  });

  it('drops founded_year below 1800', () => {
    expect(sanitizeDataRoomExtraction({ founded_year: 1700 })).toEqual({});
  });

  it('drops founded_year in the future', () => {
    const futureYear = new Date().getFullYear() + 5;
    expect(sanitizeDataRoomExtraction({ founded_year: futureYear })).toEqual({});
  });

  it('drops ebitda_margin above 1.0 (100%)', () => {
    expect(sanitizeDataRoomExtraction({ ebitda_margin: 1.5 })).toEqual({});
  });

  it('allows negative ebitda (loss-making businesses)', () => {
    expect(sanitizeDataRoomExtraction({ ebitda: -500000 })).toEqual({ ebitda: -500000 });
  });

  it('drops negative revenue', () => {
    expect(sanitizeDataRoomExtraction({ revenue: -100000 })).toEqual({});
  });

  it('drops customer_concentration above 1.0', () => {
    expect(sanitizeDataRoomExtraction({ customer_concentration: 1.5 })).toEqual({});
  });

  it('coerces customer_concentration "35%" to 0.35', () => {
    const result = sanitizeDataRoomExtraction({ customer_concentration: '35%' });
    expect(result.customer_concentration).toBeCloseTo(0.35);
  });

  it('drops revenue from placeholder string', () => {
    expect(sanitizeDataRoomExtraction({ revenue: 'Unknown' })).toEqual({});
  });

  it('drops number_of_locations above 10000', () => {
    expect(sanitizeDataRoomExtraction({ number_of_locations: 50000 })).toEqual({});
  });
});

describe('sanitizeDataRoomExtraction — boolean coercion', () => {
  it('accepts true boolean for _is_inferred fields', () => {
    expect(sanitizeDataRoomExtraction({ revenue_is_inferred: true })).toEqual({
      revenue_is_inferred: true,
    });
  });

  it('accepts false boolean', () => {
    expect(sanitizeDataRoomExtraction({ ebitda_is_inferred: false })).toEqual({
      ebitda_is_inferred: false,
    });
  });

  it('coerces "true" string to true', () => {
    expect(sanitizeDataRoomExtraction({ revenue_is_inferred: 'true' })).toEqual({
      revenue_is_inferred: true,
    });
  });

  it('coerces 1 to true', () => {
    expect(sanitizeDataRoomExtraction({ revenue_is_inferred: 1 })).toEqual({
      revenue_is_inferred: true,
    });
  });

  it('drops bogus values for _is_inferred', () => {
    expect(sanitizeDataRoomExtraction({ revenue_is_inferred: 'maybe' })).toEqual({});
  });
});

describe('sanitizeDataRoomExtraction — array handling', () => {
  it('filters empty strings from services array', () => {
    expect(sanitizeDataRoomExtraction({ services: ['HVAC', '', '  '] })).toEqual({
      services: ['HVAC'],
    });
  });

  it('trims strings inside arrays', () => {
    expect(sanitizeDataRoomExtraction({ services: ['  HVAC  ', ' Plumbing '] })).toEqual({
      services: ['HVAC', 'Plumbing'],
    });
  });

  it('drops entirely-empty arrays', () => {
    expect(sanitizeDataRoomExtraction({ services: [] })).toEqual({});
    expect(sanitizeDataRoomExtraction({ services: ['', '  '] })).toEqual({});
  });

  it('filters placeholder strings from arrays', () => {
    expect(
      sanitizeDataRoomExtraction({ geographic_states: ['CA', 'unknown', 'TX', 'n/a'] }),
    ).toEqual({ geographic_states: ['CA', 'TX'] });
  });

  it('preserves non-string array items', () => {
    expect(sanitizeDataRoomExtraction({ geographic_states: ['CA'] })).toEqual({
      geographic_states: ['CA'],
    });
  });
});

describe('sanitizeDataRoomExtraction — realistic CIM extraction', () => {
  it('processes a complete realistic CIM extraction', () => {
    const raw = {
      internal_company_name: '  Lake Jem Farms LLC  ',
      industry: 'Agricultural Services',
      founded_year: 1987,
      executive_summary: 'Family-owned Florida citrus operator with 800 acres.',
      revenue: '$5.25M',
      revenue_is_inferred: false,
      revenue_source_quote: 'Fiscal 2025 revenue of $5.25 million',
      ebitda: '$1.1M',
      ebitda_margin: '21%',
      ebitda_is_inferred: false,
      asking_price: '12.5M',
      services: ['citrus grove management', 'harvest logistics', 'fruit packing', ''],
      address_city: 'Clermont',
      address_state: 'FL',
      full_time_employees: 18,
      part_time_employees: 'Unknown',
      ownership_structure: 'Owner-operator, single principal',
      customer_concentration: '42%',
      key_risks: 'Weather-dependent yields; top customer = 42% of revenue',
    };

    const result = sanitizeDataRoomExtraction(raw);

    // Strings trimmed, placeholders dropped
    expect(result.internal_company_name).toBe('Lake Jem Farms LLC');
    expect(result.industry).toBe('Agricultural Services');
    expect(result.part_time_employees).toBeUndefined(); // 'Unknown' dropped

    // Financials coerced
    expect(result.revenue).toBe(5250000);
    expect(result.ebitda).toBe(1100000);
    expect(result.ebitda_margin).toBeCloseTo(0.21);
    expect(result.asking_price).toBe(12500000);

    // Booleans
    expect(result.revenue_is_inferred).toBe(false);
    expect(result.ebitda_is_inferred).toBe(false);

    // Arrays filtered
    expect(result.services).toEqual([
      'citrus grove management',
      'harvest logistics',
      'fruit packing',
    ]);

    // Concentration as decimal
    expect(result.customer_concentration).toBeCloseTo(0.42);

    // Location intact
    expect(result.address_city).toBe('Clermont');
    expect(result.address_state).toBe('FL');
  });

  it('produces empty object from all-placeholder input', () => {
    const raw = {
      revenue: 'unknown',
      ebitda: 'n/a',
      industry: 'TBD',
      services: ['unknown', ''],
      founded_year: null,
    };
    expect(sanitizeDataRoomExtraction(raw)).toEqual({});
  });
});

// ============================================================================
// XML PARSING TESTS (stripXmlTags + Office extractors)
// ============================================================================

describe('stripXmlTags', () => {
  it('removes simple tags', () => {
    expect(stripXmlTags('<p>hello</p>')).toBe('hello');
  });

  it('removes nested tags', () => {
    expect(stripXmlTags('<p><b>bold</b> text</p>')).toBe('bold text');
  });

  it('decodes common entities', () => {
    expect(stripXmlTags('A &amp; B')).toBe('A & B');
    expect(stripXmlTags('&lt;tag&gt;')).toBe('<tag>');
    expect(stripXmlTags('&quot;hi&quot;')).toBe('"hi"');
    expect(stripXmlTags('&apos;s')).toBe("'s");
  });

  it('decodes numeric entities', () => {
    expect(stripXmlTags('&#65;&#66;&#67;')).toBe('ABC');
  });

  it('handles empty input', () => {
    expect(stripXmlTags('')).toBe('');
  });

  it('handles self-closing tags', () => {
    expect(stripXmlTags('before<br/>after')).toBe('beforeafter');
  });
});

describe('extractDocxText', () => {
  it('extracts text from a simple paragraph', () => {
    const xml = '<w:p><w:r><w:t>Hello world</w:t></w:r></w:p>';
    expect(extractDocxText(xml)).toBe('Hello world');
  });

  it('joins multiple runs in one paragraph', () => {
    const xml = '<w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:t>world</w:t></w:r></w:p>';
    expect(extractDocxText(xml)).toBe('Hello world');
  });

  it('separates paragraphs with newlines', () => {
    const xml = '<w:p><w:r><w:t>First</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p>';
    expect(extractDocxText(xml)).toBe('First\nSecond');
  });

  it('handles xml:space="preserve" attribute', () => {
    const xml =
      '<w:p><w:r><w:t xml:space="preserve">spaced </w:t></w:r><w:r><w:t>text</w:t></w:r></w:p>';
    expect(extractDocxText(xml)).toBe('spaced text');
  });

  it('skips empty paragraphs', () => {
    const xml =
      '<w:p><w:r><w:t>real</w:t></w:r></w:p><w:p></w:p><w:p><w:r><w:t>content</w:t></w:r></w:p>';
    expect(extractDocxText(xml)).toBe('real\ncontent');
  });

  it('returns empty string for empty document', () => {
    expect(extractDocxText('')).toBe('');
  });

  it('decodes entities in extracted text', () => {
    const xml = '<w:p><w:r><w:t>A &amp; B</w:t></w:r></w:p>';
    expect(extractDocxText(xml)).toBe('A & B');
  });
});

describe('extractXlsxSharedStrings', () => {
  it('extracts simple strings', () => {
    const xml = '<sst><si><t>Hello</t></si><si><t>World</t></si></sst>';
    expect(extractXlsxSharedStrings(xml)).toEqual(['Hello', 'World']);
  });

  it('concatenates rich-text runs within a single <si>', () => {
    const xml = '<sst><si><r><t>Rich </t></r><r><t>text</t></r></si></sst>';
    expect(extractXlsxSharedStrings(xml)).toEqual(['Rich text']);
  });

  it('returns empty array for empty input', () => {
    expect(extractXlsxSharedStrings('')).toEqual([]);
  });
});

describe('extractXlsxSheetRows', () => {
  it('extracts shared string cells', () => {
    const xml = '<row><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>';
    const sharedStrings = ['Revenue', '5250000'];
    expect(extractXlsxSheetRows(xml, sharedStrings)).toEqual([['Revenue', '5250000']]);
  });

  it('extracts numeric cells', () => {
    const xml = '<row><c r="A1"><v>42</v></c></row>';
    expect(extractXlsxSheetRows(xml, [])).toEqual([['42']]);
  });

  it('extracts inlineStr cells', () => {
    const xml = '<row><c r="A1" t="inlineStr"><is><t>inline</t></is></c></row>';
    expect(extractXlsxSheetRows(xml, [])).toEqual([['inline']]);
  });

  it('handles multiple rows', () => {
    const xml = '<row><c r="A1"><v>1</v></c></row><row><c r="A2"><v>2</v></c></row>';
    expect(extractXlsxSheetRows(xml, [])).toEqual([['1'], ['2']]);
  });

  it('skips rows with all empty cells', () => {
    const xml =
      '<row><c r="A1" t="s"><v>99</v></c></row>' + // shared string index out of range
      '<row><c r="A2"><v>42</v></c></row>';
    expect(extractXlsxSheetRows(xml, [])).toEqual([['42']]);
  });

  it('handles out-of-range shared string indices', () => {
    const xml = '<row><c r="A1" t="s"><v>99</v></c></row>';
    expect(extractXlsxSheetRows(xml, ['only one'])).toEqual([]);
  });
});

describe('extractPptxSlideText', () => {
  it('extracts text from a simple slide paragraph', () => {
    const xml = '<a:p><a:r><a:t>Title</a:t></a:r></a:p>';
    expect(extractPptxSlideText(xml)).toBe('Title');
  });

  it('joins multiple runs in a paragraph', () => {
    const xml = '<a:p><a:r><a:t>Quarter </a:t></a:r><a:r><a:t>Results</a:t></a:r></a:p>';
    expect(extractPptxSlideText(xml)).toBe('Quarter Results');
  });

  it('separates paragraphs with newlines', () => {
    const xml = '<a:p><a:r><a:t>Line 1</a:t></a:r></a:p><a:p><a:r><a:t>Line 2</a:t></a:r></a:p>';
    expect(extractPptxSlideText(xml)).toBe('Line 1\nLine 2');
  });
});

// ============================================================================
// ROUND-TRIP TESTS — build a real DOCX/XLSX/PPTX in-memory with jszip,
// then run our extraction helpers and verify we get the expected text back.
// These are the tests that would have caught BUG #2.
// ============================================================================

describe('DOCX round-trip', () => {
  it('extracts text from a DOCX built in-memory', async () => {
    const zip = new JSZip();
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Lake Jem Farms LLC</w:t></w:r></w:p>
    <w:p><w:r><w:t>Confidential Information Memorandum</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Revenue: </w:t></w:r><w:r><w:t>$5.25M</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">EBITDA: </w:t></w:r><w:r><w:t>$1.1M</w:t></w:r></w:p>
  </w:body>
</w:document>`;
    zip.file('word/document.xml', documentXml);
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });

    // Re-open and extract the document.xml (simulates what the extractor does)
    const reopened = await JSZip.loadAsync(buffer);
    const xml = await reopened.file('word/document.xml')!.async('string');
    const text = extractDocxText(xml);

    expect(text).toContain('Lake Jem Farms LLC');
    expect(text).toContain('Confidential Information Memorandum');
    expect(text).toContain('Revenue: $5.25M');
    expect(text).toContain('EBITDA: $1.1M');
  });

  it('extracts an all-paragraphs document', async () => {
    const zip = new JSZip();
    const doc = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
      ${Array.from({ length: 20 }, (_, i) => `<w:p><w:r><w:t>Line ${i + 1}</w:t></w:r></w:p>`).join('')}
    </w:body></w:document>`;
    zip.file('word/document.xml', doc);
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const reopened = await JSZip.loadAsync(buffer);
    const text = extractDocxText(await reopened.file('word/document.xml')!.async('string'));

    for (let i = 1; i <= 20; i++) {
      expect(text).toContain(`Line ${i}`);
    }
  });
});

describe('XLSX round-trip', () => {
  it('extracts cells from an XLSX built in-memory', async () => {
    const zip = new JSZip();

    // Shared strings
    const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
  <si><t>Metric</t></si>
  <si><t>Value</t></si>
  <si><t>Revenue</t></si>
  <si><t>EBITDA</t></si>
</sst>`;
    zip.file('xl/sharedStrings.xml', sharedStringsXml);

    // Sheet 1
    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>2</v></c>
      <c r="B2"><v>5250000</v></c>
    </row>
    <row r="3">
      <c r="A3" t="s"><v>3</v></c>
      <c r="B3"><v>1100000</v></c>
    </row>
  </sheetData>
</worksheet>`;
    zip.file('xl/worksheets/sheet1.xml', sheetXml);

    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const reopened = await JSZip.loadAsync(buffer);

    const ssXml = await reopened.file('xl/sharedStrings.xml')!.async('string');
    const sharedStrings = extractXlsxSharedStrings(ssXml);
    expect(sharedStrings).toEqual(['Metric', 'Value', 'Revenue', 'EBITDA']);

    const sheetXmlText = await reopened.file('xl/worksheets/sheet1.xml')!.async('string');
    const rows = extractXlsxSheetRows(sheetXmlText, sharedStrings);
    expect(rows).toEqual([
      ['Metric', 'Value'],
      ['Revenue', '5250000'],
      ['EBITDA', '1100000'],
    ]);
  });

  it('extracts multi-sheet workbook', async () => {
    const zip = new JSZip();
    zip.file(
      'xl/sharedStrings.xml',
      '<sst><si><t>Sheet1Val</t></si><si><t>Sheet2Val</t></si></sst>',
    );
    zip.file(
      'xl/worksheets/sheet1.xml',
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>',
    );
    zip.file(
      'xl/worksheets/sheet2.xml',
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>1</v></c></row></sheetData></worksheet>',
    );
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const reopened = await JSZip.loadAsync(buffer);

    const sharedStrings = extractXlsxSharedStrings(
      await reopened.file('xl/sharedStrings.xml')!.async('string'),
    );
    const sheet1Rows = extractXlsxSheetRows(
      await reopened.file('xl/worksheets/sheet1.xml')!.async('string'),
      sharedStrings,
    );
    const sheet2Rows = extractXlsxSheetRows(
      await reopened.file('xl/worksheets/sheet2.xml')!.async('string'),
      sharedStrings,
    );
    expect(sheet1Rows).toEqual([['Sheet1Val']]);
    expect(sheet2Rows).toEqual([['Sheet2Val']]);
  });

  it('handles XLSX with no shared strings (inline only)', async () => {
    const zip = new JSZip();
    zip.file(
      'xl/worksheets/sheet1.xml',
      '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>InlineText</t></is></c></row></sheetData></worksheet>',
    );
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const reopened = await JSZip.loadAsync(buffer);
    const rows = extractXlsxSheetRows(
      await reopened.file('xl/worksheets/sheet1.xml')!.async('string'),
      [],
    );
    expect(rows).toEqual([['InlineText']]);
  });
});

describe('PPTX round-trip', () => {
  it('extracts text from a PPTX built in-memory', async () => {
    const zip = new JSZip();
    const slide1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>Investment Overview</a:t></a:r></a:p>
          <a:p><a:r><a:t>Q4 Revenue: $5.25M</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
    const slide2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody>
    <a:p><a:r><a:t>Growth Drivers</a:t></a:r></a:p>
    <a:p><a:r><a:t>New customer acquisition up 35%</a:t></a:r></a:p>
  </p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`;
    zip.file('ppt/slides/slide1.xml', slide1);
    zip.file('ppt/slides/slide2.xml', slide2);
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const reopened = await JSZip.loadAsync(buffer);

    const slide1Text = extractPptxSlideText(
      await reopened.file('ppt/slides/slide1.xml')!.async('string'),
    );
    const slide2Text = extractPptxSlideText(
      await reopened.file('ppt/slides/slide2.xml')!.async('string'),
    );

    expect(slide1Text).toContain('Investment Overview');
    expect(slide1Text).toContain('Q4 Revenue: $5.25M');
    expect(slide2Text).toContain('Growth Drivers');
    expect(slide2Text).toContain('New customer acquisition up 35%');
  });
});
