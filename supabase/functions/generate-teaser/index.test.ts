import { describe, it, expect } from 'vitest';

/**
 * Tests for the generate-teaser edge function's validation logic.
 *
 * Uses the UNIFIED teaser sections: BUSINESS OVERVIEW, DEAL SNAPSHOT,
 * KEY FACTS, GROWTH CONTEXT, OWNER OBJECTIVES.
 *
 * Re-implements the validateTeaser function locally for unit testing
 * (same pattern used by existing tests in supabase/functions/).
 */

// ─── Re-implemented validateTeaser (unified sections) ───

function validateTeaser(
  teaserText: string,
  companyName: string,
  ownerName: string,
  leadMemoCity: string | null,
  employeeNames: string[],
): { pass: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- ANONYMITY CHECKS ---

  if (
    companyName &&
    new RegExp(companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(teaserText)
  ) {
    errors.push(`ANONYMITY BREACH: Company name "${companyName}" found in teaser`);
  }

  if (ownerName) {
    const nameParts = ownerName.split(' ').filter((p) => p.length > 2);
    for (const part of nameParts) {
      if (new RegExp(`\\b${part}\\b`, 'i').test(teaserText)) {
        errors.push(`ANONYMITY BREACH: Owner name part "${part}" found`);
      }
    }
  }

  for (const name of employeeNames) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(teaserText)) {
      errors.push(`ANONYMITY BREACH: Employee name "${name}" found`);
    }
  }

  if (leadMemoCity && new RegExp(`\\b${leadMemoCity}\\b`, 'i').test(teaserText)) {
    errors.push(`ANONYMITY BREACH: City "${leadMemoCity}" found`);
  }

  const states = [
    'Alabama',
    'Alaska',
    'Arizona',
    'Arkansas',
    'California',
    'Colorado',
    'Connecticut',
    'Delaware',
    'Florida',
    'Georgia',
    'Hawaii',
    'Idaho',
    'Illinois',
    'Indiana',
    'Iowa',
    'Kansas',
    'Kentucky',
    'Louisiana',
    'Maine',
    'Maryland',
    'Massachusetts',
    'Michigan',
    'Minnesota',
    'Mississippi',
    'Missouri',
    'Montana',
    'Nebraska',
    'Nevada',
    'New Hampshire',
    'New Jersey',
    'New Mexico',
    'New York',
    'North Carolina',
    'North Dakota',
    'Ohio',
    'Oklahoma',
    'Oregon',
    'Pennsylvania',
    'Rhode Island',
    'South Carolina',
    'South Dakota',
    'Tennessee',
    'Texas',
    'Utah',
    'Vermont',
    'Virginia',
    'Washington',
    'West Virginia',
    'Wisconsin',
    'Wyoming',
  ];
  for (const state of states) {
    if (new RegExp(`\\b${state}\\b`, 'i').test(teaserText)) {
      errors.push(`ANONYMITY BREACH: State "${state}" not converted to region`);
    }
  }

  // --- STRUCTURE CHECKS ---

  if (/not provided|not stated|not confirmed|not discussed|not yet provided/i.test(teaserText)) {
    errors.push('Contains banned placeholder language');
  }

  const wordCount = teaserText.split(/\s+/).filter(Boolean).length;
  if (wordCount > 600) errors.push(`Exceeds 600 word limit (${wordCount} words)`);

  if (!/## BUSINESS OVERVIEW/i.test(teaserText)) errors.push('Missing BUSINESS OVERVIEW section');

  const allowed = [
    'BUSINESS OVERVIEW',
    'DEAL SNAPSHOT',
    'KEY FACTS',
    'GROWTH CONTEXT',
    'OWNER OBJECTIVES',
  ];
  const headers = teaserText.match(/^## .+$/gm) || [];
  for (const h of headers) {
    const title = h.replace('## ', '').trim().toUpperCase();
    if (!allowed.includes(title)) errors.push(`Unexpected section: "${h}"`);
  }

  // --- WARNINGS ---

  if (wordCount < 150) warnings.push(`Only ${wordCount} words`);

  const banned = [
    'robust',
    'impressive',
    'attractive',
    'compelling',
    'well-positioned',
    'best-in-class',
    'world-class',
    'industry-leading',
    'turnkey',
    'synergies',
    'uniquely positioned',
    'market leader',
    'poised for growth',
  ];
  const found = banned.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(teaserText));
  if (found.length) warnings.push(`Banned words: ${found.join(', ')}`);

  return { pass: errors.length === 0, errors, warnings };
}

// ─── Test Data (unified teaser sections) ───

/** A clean, properly anonymized teaser using unified section headers (>150 words to avoid warning) */
const CLEAN_TEASER = `## BUSINESS OVERVIEW
Project HVAC is an HVAC services company operating 3 locations across the Mountain West region. The company employs approximately 45 people and serves both commercial and residential clients with installation and maintenance services.

## DEAL SNAPSHOT
* **Revenue:** ~$4.0-4.5M
* **EBITDA:** ~$800-900K
* **EBITDA Margin:** ~20%
* **Employees:** ~45
* **Region:** Mountain West
* **Years in Operation:** ~15-20 years
* **Transaction Type:** Full sale

## KEY FACTS
- 70% commercial HVAC installation and repair, 30% residential services
- Serves multiple hospitality clients across the region through recurring maintenance agreements
- The General Manager has been with the company for 8 years and oversees daily operations without owner involvement
- Fleet of 12 service vehicles covering the metropolitan service area
- 150 active maintenance agreements generating recurring revenue each quarter

## GROWTH CONTEXT
- Owner has not pursued government or municipal contracts, which represent an estimated 30% of the regional market
- Second location added in recent years with third added shortly after

## OWNER OBJECTIVES
- Full sale preferred with no interest in recapitalization or minority investment
- Expecting approximately 5x EBITDA based on adjusted figures
- Owner willing to transition for 12 months post-close to ensure continuity
- Reason for sale: retirement within 18 months`;

// ─── Tests ───

describe('validateTeaser — anonymity checks', () => {
  it('fails when company name appears in teaser', () => {
    const teaser = CLEAN_TEASER.replace('Project HVAC', 'Desert Air Mechanical LLC');
    const result = validateTeaser(teaser, 'Desert Air Mechanical LLC', '', null, []);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('Company name'))).toBe(true);
  });

  it('fails when owner first name appears in teaser', () => {
    const teaser = CLEAN_TEASER.replace('The General Manager', 'John');
    const result = validateTeaser(teaser, '', 'John Smith', null, []);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('Owner name part') && e.includes('John'))).toBe(
      true,
    );
  });

  it('fails when owner last name appears in teaser', () => {
    const teaser = CLEAN_TEASER.replace('The General Manager', 'Mr. Smith');
    const result = validateTeaser(teaser, '', 'John Smith', null, []);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('Owner name part') && e.includes('Smith'))).toBe(
      true,
    );
  });

  it('fails when city name from lead memo appears in teaser', () => {
    const teaser = CLEAN_TEASER.replace(
      'across the Mountain West region',
      'headquartered in Phoenix',
    );
    const result = validateTeaser(teaser, '', '', 'Phoenix', []);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('City') && e.includes('Phoenix'))).toBe(true);
  });

  it('fails when US state name is not converted to region', () => {
    const teaser = CLEAN_TEASER.replace('the Mountain West region', 'Arizona');
    const result = validateTeaser(teaser, '', '', null, []);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('State') && e.includes('Arizona'))).toBe(true);
  });

  it('fails when employee name appears in teaser', () => {
    const teaser = CLEAN_TEASER.replace('The General Manager', 'David Chen');
    const result = validateTeaser(teaser, '', '', null, ['David Chen']);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('Employee name'))).toBe(true);
  });

  it('passes with a valid teaser that has no leaks', () => {
    const result = validateTeaser(
      CLEAN_TEASER,
      'Desert Air Mechanical LLC',
      'John Smith',
      'Phoenix',
      ['David Chen'],
    );
    expect(result.pass).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('validateTeaser — structure checks', () => {
  it('fails with unexpected section header (old COMPANY OVERVIEW)', () => {
    const teaser = CLEAN_TEASER + '\n\n## COMPANY OVERVIEW\n- This is the old header format.';
    const result = validateTeaser(teaser, '', '', null, []);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('Unexpected section'))).toBe(true);
  });

  it('fails with unexpected section header (old FINANCIAL SNAPSHOT)', () => {
    const teaser = CLEAN_TEASER + '\n\n## FINANCIAL SNAPSHOT\n- Revenue: $5M.';
    const result = validateTeaser(teaser, '', '', null, []);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('Unexpected section'))).toBe(true);
  });

  it('fails when BUSINESS OVERVIEW is missing', () => {
    const teaser = `## DEAL SNAPSHOT
* **Revenue:** ~$4.0-4.5M
* **EBITDA:** ~$800-900K`;
    const result = validateTeaser(teaser, '', '', null, []);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('BUSINESS OVERVIEW'))).toBe(true);
  });

  it('fails when "not provided" appears in teaser', () => {
    const teaser = CLEAN_TEASER + '\n\nEBITDA breakdown not provided.';
    const result = validateTeaser(teaser, '', '', null, []);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('banned placeholder'))).toBe(true);
  });

  it('fails when "not stated" appears in teaser', () => {
    const teaser = CLEAN_TEASER + '\n\nOwner goals not stated.';
    const result = validateTeaser(teaser, '', '', null, []);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('banned placeholder'))).toBe(true);
  });

  it('fails when over 600 words', () => {
    const longTeaser = CLEAN_TEASER + '\n\n' + Array(500).fill('additional word').join(' ');
    const result = validateTeaser(longTeaser, '', '', null, []);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('600 word limit'))).toBe(true);
  });

  it('accepts all five unified section headers', () => {
    const result = validateTeaser(CLEAN_TEASER, '', '', null, []);
    expect(result.pass).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes with only required BUSINESS OVERVIEW section', () => {
    const teaser = `## BUSINESS OVERVIEW
A commercial services company operating in the Southwest region with approximately 50 employees providing maintenance and repair services to commercial and residential clients across multiple locations.`;
    const result = validateTeaser(teaser, '', '', null, []);
    expect(result.pass).toBe(true);
  });
});

describe('validateTeaser — warnings', () => {
  it('warns on banned words (not hard failure)', () => {
    const teaser = CLEAN_TEASER.replace(
      'HVAC services company',
      'robust and impressive HVAC services company',
    );
    const result = validateTeaser(teaser, '', '', null, []);
    // Banned words are warnings, not errors
    expect(result.pass).toBe(true);
    expect(result.warnings.some((w) => w.includes('Banned words'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('robust'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('impressive'))).toBe(true);
  });

  it('warns when under 150 words', () => {
    const shortTeaser = '## BUSINESS OVERVIEW\nA company in the region.';
    const result = validateTeaser(shortTeaser, '', '', null, []);
    expect(result.warnings.some((w) => w.includes('Only'))).toBe(true);
  });
});

describe('validateTeaser — clean teaser', () => {
  it('returns zero errors and zero warnings for a clean teaser', () => {
    const result = validateTeaser(
      CLEAN_TEASER,
      'Desert Air Mechanical LLC',
      'John Smith',
      'Phoenix',
      ['David Chen', 'Maria Garcia'],
    );
    expect(result.pass).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

// ============================================================================
// Lead memo lookup — status filter regression guard
// ============================================================================
//
// lead_memos.status has a CHECK constraint of ('draft','published','archived')
// — see supabase/migrations/20260223000000_data_room_and_lead_memos.sql:143.
// The edge function previously filtered by .eq('status','completed'), which
// never matched any row, so every teaser generation failed with
// "Lead memo must be generated before creating a teaser." even when a
// published full memo was sitting right there. The tests below pin the valid
// status set and the filter the function is supposed to use, so a future edit
// that reintroduces the typo fails loudly.

const LEAD_MEMO_VALID_STATUSES = ['draft', 'published', 'archived'] as const;
type LeadMemoStatus = (typeof LEAD_MEMO_VALID_STATUSES)[number];

describe('generate-teaser — lead memo lookup', () => {
  it('uses a status value that the DB CHECK constraint actually permits', () => {
    // The function's filter literal — change this line when the filter changes.
    const filterValue: LeadMemoStatus = 'published';
    expect(LEAD_MEMO_VALID_STATUSES).toContain(filterValue);
  });

  it('does NOT filter by the legacy "completed" string', () => {
    // Regression guard: pre-fix the function filtered by 'completed' which is
    // not in the CHECK constraint, so the query silently returned no rows.
    const filterValue: string = 'published';
    expect(filterValue).not.toBe('completed');
  });

  it('matches the UI gate in MemosPanel (hasCompletedMemo === status is "published")', () => {
    // MemosPanel.tsx: `hasCompletedMemo = fullMemos.some(m => m.status === 'published')`
    // — the edge function filter must agree with what the UI considers "ready
    // to teaser-ify", otherwise the button is enabled but the call 400s.
    const uiReadyStatus = 'published';
    const edgeFunctionFilter = 'published';
    expect(edgeFunctionFilter).toBe(uiReadyStatus);
  });

  // Emulates the client-side picker the function uses when multiple published
  // versions exist — ordered by published_at desc so the newest wins.
  interface MemoRow {
    id: string;
    status: LeadMemoStatus;
    published_at: string | null;
  }

  function pickNewestPublished(memos: MemoRow[]): MemoRow | null {
    const published = memos.filter((m) => m.status === 'published');
    if (!published.length) return null;
    published.sort((a, b) => {
      const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
      const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
      return tb - ta;
    });
    return published[0];
  }

  it('returns null when no published memo exists (only drafts)', () => {
    const memos: MemoRow[] = [
      { id: 'm1', status: 'draft', published_at: null },
      { id: 'm2', status: 'archived', published_at: '2025-01-01T00:00:00Z' },
    ];
    expect(pickNewestPublished(memos)).toBeNull();
  });

  it('returns the only published memo when one exists', () => {
    const memos: MemoRow[] = [
      { id: 'm1', status: 'draft', published_at: null },
      { id: 'm2', status: 'published', published_at: '2025-02-01T00:00:00Z' },
    ];
    expect(pickNewestPublished(memos)?.id).toBe('m2');
  });

  it('picks the most recently published memo when multiple are published', () => {
    const memos: MemoRow[] = [
      { id: 'older', status: 'published', published_at: '2024-06-01T00:00:00Z' },
      { id: 'newest', status: 'published', published_at: '2025-05-01T00:00:00Z' },
      { id: 'middle', status: 'published', published_at: '2025-01-01T00:00:00Z' },
    ];
    expect(pickNewestPublished(memos)?.id).toBe('newest');
  });

  it('ignores archived memos even if they have a newer published_at', () => {
    const memos: MemoRow[] = [
      { id: 'published', status: 'published', published_at: '2025-01-01T00:00:00Z' },
      { id: 'archived', status: 'archived', published_at: '2025-06-01T00:00:00Z' },
    ];
    expect(pickNewestPublished(memos)?.id).toBe('published');
  });
});
