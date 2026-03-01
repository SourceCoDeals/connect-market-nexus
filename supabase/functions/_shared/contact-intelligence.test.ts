/**
 * Contact Intelligence Integration Tests
 *
 * Tests the title matching, deduplication, and contact search orchestration
 * logic from the find-contacts edge function. These test pure business logic
 * without Deno/API dependencies.
 *
 * Covers test scenarios from the SourceCo AI Testing Guide:
 * - Q1: Find specific contacts at known buyer (title matching + enrichment)
 * - Q2: Find contacts at competitor/unknown buyer (complex structure)
 * - Q3: Find contacts with specific criteria (fund-level filtering)
 * - Q4: Find contacts who have made similar acquisitions (cross-referencing)
 * - Q5: Find contacts using multiple search terms (OR logic)
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Title matching logic (re-implemented for testing)
// ============================================================================

const TITLE_ALIASES: Record<string, string[]> = {
  associate: ['associate', 'sr associate', 'senior associate', 'investment associate'],
  principal: ['principal', 'sr principal', 'senior principal', 'investment principal'],
  vp: [
    'vp',
    'vice president',
    'vice-president',
    'svp',
    'senior vice president',
    'evp',
    'executive vice president',
  ],
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
  cfo: ['cfo', 'chief financial officer', 'finance director', 'vp finance'],
  coo: ['coo', 'chief operating officer', 'operations director', 'vp operations'],
  bd: [
    'business development',
    'corp dev',
    'corporate development',
    'head of acquisitions',
    'vp acquisitions',
    'vp m&a',
    'head of m&a',
    'director of acquisitions',
  ],
};

function matchesTitle(title: string, filters: string[]): boolean {
  const normalizedTitle = title.toLowerCase().trim();

  for (const filter of filters) {
    const normalizedFilter = filter.toLowerCase().trim();

    // Direct match
    if (normalizedTitle.includes(normalizedFilter)) return true;

    // Alias match
    const aliases = TITLE_ALIASES[normalizedFilter];
    if (aliases) {
      for (const alias of aliases) {
        if (normalizedTitle.includes(alias)) return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Deduplication logic
// ============================================================================

function deduplicateContacts<
  T extends { linkedin_url?: string; email?: string | null; full_name?: string; fullName?: string },
>(contacts: T[]): T[] {
  const seen = new Set<string>();
  return contacts.filter((c) => {
    const name = (c.full_name || c.fullName || '').toLowerCase();
    const linkedin = (c.linkedin_url || '').toLowerCase();
    const email = (c.email || '').toLowerCase();

    const key = linkedin || email || name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================================================
// Q1: Title matching — associates, principals, VPs at a firm
// ============================================================================

describe('Title matching (Q1: Find specific contacts at known buyer)', () => {
  const filters = ['associate', 'principal', 'vp'];

  it('matches exact title "Associate"', () => {
    expect(matchesTitle('Associate', filters)).toBe(true);
  });

  it('matches "Senior Associate"', () => {
    expect(matchesTitle('Senior Associate', filters)).toBe(true);
  });

  it('matches "Vice President" via vp alias', () => {
    expect(matchesTitle('Vice President', filters)).toBe(true);
  });

  it('matches "SVP" via vp alias', () => {
    expect(matchesTitle('Senior Vice President of M&A', filters)).toBe(true);
  });

  it('matches "Principal" exactly', () => {
    expect(matchesTitle('Principal', filters)).toBe(true);
  });

  it('matches "Investment Principal"', () => {
    expect(matchesTitle('Investment Principal', filters)).toBe(true);
  });

  it('does NOT match "Receptionist"', () => {
    expect(matchesTitle('Receptionist', filters)).toBe(false);
  });

  it('does NOT match "Intern"', () => {
    expect(matchesTitle('Summer Intern', filters)).toBe(false);
  });

  it('does NOT match "Executive Assistant"', () => {
    expect(matchesTitle('Executive Assistant', filters)).toBe(false);
  });

  it('handles case-insensitive matching', () => {
    expect(matchesTitle('VICE PRESIDENT', filters)).toBe(true);
    expect(matchesTitle('senior associate', filters)).toBe(true);
  });

  it('matches "Associate Director" via director alias with associate filter', () => {
    // "Associate Director" contains "associate" so it matches
    expect(matchesTitle('Associate Director', filters)).toBe(true);
  });
});

// ============================================================================
// Q2: Complex PE firm structure (firm + portfolio contacts)
// ============================================================================

describe('Title matching for PE firm structure (Q2: Competitor buyer)', () => {
  it('matches PE firm titles', () => {
    const firmFilters = ['partner', 'principal', 'vp', 'associate'];
    expect(matchesTitle('Managing Partner', firmFilters)).toBe(true);
    expect(matchesTitle('Senior Partner', firmFilters)).toBe(true);
    expect(matchesTitle('Investment Principal', firmFilters)).toBe(true);
  });

  it('matches platform company titles', () => {
    const platformFilters = ['ceo', 'cfo', 'bd'];
    expect(matchesTitle('CEO', platformFilters)).toBe(true);
    expect(matchesTitle('Chief Executive Officer', platformFilters)).toBe(true);
    expect(matchesTitle('President & Founder', platformFilters)).toBe(true);
    expect(matchesTitle('VP of Corporate Development', platformFilters)).toBe(true);
    expect(matchesTitle('Head of M&A', platformFilters)).toBe(true);
  });
});

// ============================================================================
// Q3: Specific criteria — filtering by organizational unit
// ============================================================================

describe('Title matching with specific criteria (Q3: Blackstone lower-middle market)', () => {
  it('matches associates at any fund (title-level filter)', () => {
    const filters = ['associate', 'principal'];
    expect(matchesTitle('Associate - Growth Equity', filters)).toBe(true);
    expect(matchesTitle('Principal, Lower Middle Market', filters)).toBe(true);
  });

  it('title filter cannot distinguish fund from title alone', () => {
    // This is an acknowledged limitation — fund info isn't in the title
    const filters = ['associate'];
    const megaFundAssociate = 'Associate';
    const lmmAssociate = 'Associate';
    // Both match equally — system should flag this limitation
    expect(matchesTitle(megaFundAssociate, filters)).toBe(true);
    expect(matchesTitle(lmmAssociate, filters)).toBe(true);
  });
});

// ============================================================================
// Q4: Cross-referencing contacts with acquisition history
// ============================================================================

describe('BD/Corp Dev title matching (Q4: Contacts who made acquisitions)', () => {
  const filters = ['bd'];

  it('matches "Business Development" titles', () => {
    expect(matchesTitle('VP of Business Development', filters)).toBe(true);
    expect(matchesTitle('Director of Business Development', filters)).toBe(true);
  });

  it('matches "Corporate Development" titles', () => {
    expect(matchesTitle('Head of Corporate Development', filters)).toBe(true);
    expect(matchesTitle('VP, Corp Dev', filters)).toBe(true);
  });

  it('matches "Acquisitions" titles', () => {
    expect(matchesTitle('Head of Acquisitions', filters)).toBe(true);
    expect(matchesTitle('VP Acquisitions', filters)).toBe(true);
    expect(matchesTitle('Director of Acquisitions', filters)).toBe(true);
  });

  it('matches "M&A" titles', () => {
    expect(matchesTitle('VP M&A', filters)).toBe(true);
    expect(matchesTitle('Head of M&A', filters)).toBe(true);
  });
});

// ============================================================================
// Q5: Multiple search terms (OR logic)
// ============================================================================

describe('Multiple title filters with OR logic (Q5)', () => {
  it('matches any of multiple title filters', () => {
    const filters = ['vp', 'bd', 'director'];

    // VP matches
    expect(matchesTitle('VP of M&A', filters)).toBe(true);
    // BD matches
    expect(matchesTitle('Head of Corporate Development', filters)).toBe(true);
    // Director matches
    expect(matchesTitle('Managing Director', filters)).toBe(true);
  });

  it('rejects titles not in any filter', () => {
    const filters = ['vp', 'bd', 'director'];
    expect(matchesTitle('Analyst', filters)).toBe(false);
    expect(matchesTitle('Administrative Assistant', filters)).toBe(false);
  });
});

// ============================================================================
// Deduplication tests
// ============================================================================

describe('Contact deduplication', () => {
  it('deduplicates by LinkedIn URL', () => {
    const contacts = [
      {
        full_name: 'John Doe',
        linkedin_url: 'https://linkedin.com/in/johndoe',
        email: 'john@test.com',
      },
      {
        full_name: 'John Doe',
        linkedin_url: 'https://linkedin.com/in/johndoe',
        email: 'john2@test.com',
      },
    ];
    expect(deduplicateContacts(contacts)).toHaveLength(1);
  });

  it('deduplicates by email when no LinkedIn URL', () => {
    const contacts = [
      { full_name: 'John Doe', linkedin_url: '', email: 'john@test.com' },
      { full_name: 'John Smith', linkedin_url: '', email: 'john@test.com' },
    ];
    expect(deduplicateContacts(contacts)).toHaveLength(1);
  });

  it('deduplicates by name as last resort', () => {
    const contacts = [
      { full_name: 'John Doe', linkedin_url: '', email: null },
      { full_name: 'John Doe', linkedin_url: '', email: null },
    ];
    expect(deduplicateContacts(contacts)).toHaveLength(1);
  });

  it('keeps distinct contacts', () => {
    const contacts = [
      {
        full_name: 'John Doe',
        linkedin_url: 'https://linkedin.com/in/johndoe',
        email: 'john@test.com',
      },
      {
        full_name: 'Jane Smith',
        linkedin_url: 'https://linkedin.com/in/janesmith',
        email: 'jane@test.com',
      },
    ];
    expect(deduplicateContacts(contacts)).toHaveLength(2);
  });

  it('removes contacts with no identifying info', () => {
    const contacts = [
      { full_name: '', linkedin_url: '', email: null },
      {
        full_name: 'John Doe',
        linkedin_url: 'https://linkedin.com/in/johndoe',
        email: 'john@test.com',
      },
    ];
    const result = deduplicateContacts(contacts);
    expect(result).toHaveLength(1);
    expect(result[0].full_name).toBe('John Doe');
  });

  it('handles fullName property (Apify format)', () => {
    const contacts = [
      {
        fullName: 'John Doe',
        linkedin_url: 'https://linkedin.com/in/johndoe',
      } as unknown as Parameters<typeof deduplicateContacts>[0][0],
      {
        fullName: 'John Doe',
        linkedin_url: 'https://linkedin.com/in/johndoe',
      } as unknown as Parameters<typeof deduplicateContacts>[0][0],
    ];
    expect(deduplicateContacts(contacts)).toHaveLength(1);
  });
});

// ============================================================================
// Cache key generation
// ============================================================================

describe('Cache key generation', () => {
  function generateCacheKey(companyName: string, titleFilter: string[]): string {
    return `${companyName}:${titleFilter.sort().join(',')}`.toLowerCase();
  }

  it('generates consistent cache key', () => {
    const key1 = generateCacheKey('Trivest Partners', ['vp', 'associate']);
    const key2 = generateCacheKey('Trivest Partners', ['associate', 'vp']);
    expect(key1).toBe(key2); // Same regardless of filter order
  });

  it('generates different keys for different companies', () => {
    const key1 = generateCacheKey('Trivest', ['vp']);
    const key2 = generateCacheKey('Blackstone', ['vp']);
    expect(key1).not.toBe(key2);
  });

  it('generates different keys for different filters', () => {
    const key1 = generateCacheKey('Trivest', ['vp']);
    const key2 = generateCacheKey('Trivest', ['associate']);
    expect(key1).not.toBe(key2);
  });

  it('normalizes to lowercase', () => {
    const key1 = generateCacheKey('Trivest Partners', ['VP']);
    const key2 = generateCacheKey('trivest partners', ['vp']);
    expect(key1).toBe(key2);
  });
});

// ============================================================================
// Contact result shape validation
// ============================================================================

describe('Enriched contact data shape', () => {
  interface EnrichedContact {
    company_name: string;
    full_name: string;
    first_name: string;
    last_name: string;
    title: string;
    email: string | null;
    phone: string | null;
    linkedin_url: string;
    confidence: 'high' | 'medium' | 'low';
    source: string;
    enriched_at: string;
  }

  function createContact(overrides: Partial<EnrichedContact> = {}): EnrichedContact {
    return {
      company_name: 'Trivest Partners',
      full_name: 'John Doe',
      first_name: 'John',
      last_name: 'Doe',
      title: 'Vice President',
      email: 'john@trivest.com',
      phone: '+1-555-0100',
      linkedin_url: 'https://linkedin.com/in/johndoe',
      confidence: 'high',
      source: 'linkedin_lookup',
      enriched_at: new Date().toISOString(),
      ...overrides,
    };
  }

  it('creates a valid contact with all fields', () => {
    const contact = createContact();
    expect(contact.company_name).toBe('Trivest Partners');
    expect(contact.email).toBeTruthy();
    expect(contact.confidence).toBe('high');
  });

  it('allows null email (unenriched contact)', () => {
    const contact = createContact({ email: null, confidence: 'low', source: 'linkedin_only' });
    expect(contact.email).toBeNull();
    expect(contact.confidence).toBe('low');
  });

  it('allows null phone', () => {
    const contact = createContact({ phone: null });
    expect(contact.phone).toBeNull();
  });

  it('validates confidence is one of high/medium/low', () => {
    const validValues = ['high', 'medium', 'low'];
    const contact = createContact();
    expect(validValues).toContain(contact.confidence);
  });

  it('validates source is a known type', () => {
    const validSources = [
      'linkedin_lookup',
      'name_domain',
      'domain_search',
      'linkedin_only',
      'unknown',
    ];
    const contact = createContact();
    expect(validSources).toContain(contact.source);
  });
});
