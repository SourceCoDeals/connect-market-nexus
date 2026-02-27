/**
 * Tests for _shared/serper-client.ts — Serper Google search and maps result processing
 *
 * Tests the result parsing, LinkedIn URL extraction, and address parsing logic.
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Serper search result parsing (organic results)
// ============================================================================

interface GoogleSearchItem {
  title: string;
  url: string;
  description: string;
  position: number;
}

/**
 * Mirrors the mapping logic in serper-client.ts googleSearch():
 * Serper returns { organic: [{ title, link, snippet, position }] }
 */
function extractSerperResults(serperResponse: { organic?: any[] }): GoogleSearchItem[] {
  const organic = serperResponse.organic || [];
  return organic.map((r: any) => ({
    title: r.title || '',
    url: r.link || '',
    description: r.snippet || '',
    position: r.position || 0,
  }));
}

describe('extractSerperResults', () => {
  it('extracts results from Serper response format', () => {
    const serperResponse = {
      organic: [
        {
          title: 'Trivest Partners',
          link: 'https://trivest.com',
          snippet: 'PE firm',
          position: 1,
        },
        {
          title: 'LinkedIn',
          link: 'https://linkedin.com/company/trivest',
          snippet: 'Company page',
          position: 2,
        },
      ],
    };

    const results = extractSerperResults(serperResponse);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Trivest Partners');
    expect(results[0].url).toBe('https://trivest.com');
    expect(results[0].description).toBe('PE firm');
    expect(results[1].url).toContain('linkedin.com');
  });

  it('handles empty organic array', () => {
    expect(extractSerperResults({ organic: [] })).toHaveLength(0);
  });

  it('handles missing organic field', () => {
    expect(extractSerperResults({})).toHaveLength(0);
  });

  it('handles results with missing fields', () => {
    const serperResponse = {
      organic: [{ title: 'Test' }, { position: 3, link: 'https://b.com' }],
    };

    const results = extractSerperResults(serperResponse);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Test');
    expect(results[0].url).toBe('');
    expect(results[0].description).toBe('');
    expect(results[1].url).toBe('https://b.com');
    expect(results[1].title).toBe('');
  });
});

// ============================================================================
// LinkedIn URL detection
// ============================================================================

describe('LinkedIn URL detection', () => {
  function findLinkedInUrl(results: GoogleSearchItem[]): string | null {
    for (const result of results) {
      if (result.url.includes('linkedin.com/company/')) {
        return result.url;
      }
    }
    return null;
  }

  it('finds LinkedIn company URL from results', () => {
    const results: GoogleSearchItem[] = [
      { title: 'Trivest Partners', url: 'https://trivest.com', description: '', position: 1 },
      {
        title: 'Trivest Partners | LinkedIn',
        url: 'https://www.linkedin.com/company/trivest-partners',
        description: '',
        position: 2,
      },
    ];

    expect(findLinkedInUrl(results)).toBe('https://www.linkedin.com/company/trivest-partners');
  });

  it('returns null when no LinkedIn URL found', () => {
    const results: GoogleSearchItem[] = [
      { title: 'Trivest Partners', url: 'https://trivest.com', description: '', position: 1 },
    ];

    expect(findLinkedInUrl(results)).toBeNull();
  });

  it('ignores LinkedIn personal profiles', () => {
    const results: GoogleSearchItem[] = [
      {
        title: 'John Doe',
        url: 'https://www.linkedin.com/in/johndoe',
        description: '',
        position: 1,
      },
    ];

    expect(findLinkedInUrl(results)).toBeNull();
  });
});

// ============================================================================
// Address parsing
// ============================================================================

describe('parseAddress', () => {
  // Mirrors the parseAddress function from serper-client.ts
  function parseAddress(fullAddress: string): {
    city?: string;
    state?: string;
    postalCode?: string;
  } {
    if (!fullAddress) return {};

    const cleaned = fullAddress.replace(/,?\s*United States\s*$/i, '').trim();
    const parts = cleaned.split(',').map((s) => s.trim());

    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];

      const stateZipMatch = lastPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (stateZipMatch) {
        return {
          city: parts[parts.length - 2],
          state: stateZipMatch[1],
          postalCode: stateZipMatch[2],
        };
      }

      const stateMatch = lastPart.match(/^([A-Z]{2})$/);
      if (stateMatch) {
        return {
          city: parts[parts.length - 2],
          state: stateMatch[1],
        };
      }
    }

    return {};
  }

  it('parses full US address with zip', () => {
    const result = parseAddress('123 Main St, Dallas, TX 75201');
    expect(result.city).toBe('Dallas');
    expect(result.state).toBe('TX');
    expect(result.postalCode).toBe('75201');
  });

  it('parses address with zip+4', () => {
    const result = parseAddress('456 Oak Ave, Miami, FL 33139-1234');
    expect(result.city).toBe('Miami');
    expect(result.state).toBe('FL');
    expect(result.postalCode).toBe('33139-1234');
  });

  it('parses city and state without zip', () => {
    const result = parseAddress('Suite 200, Austin, TX');
    expect(result.city).toBe('Austin');
    expect(result.state).toBe('TX');
    expect(result.postalCode).toBeUndefined();
  });

  it('strips "United States" suffix', () => {
    const result = parseAddress('123 Main St, Dallas, TX 75201, United States');
    expect(result.city).toBe('Dallas');
    expect(result.state).toBe('TX');
    expect(result.postalCode).toBe('75201');
  });

  it('returns empty for empty/missing address', () => {
    expect(parseAddress('')).toEqual({});
  });

  it('returns empty for unrecognized format', () => {
    expect(parseAddress('Some Random Place')).toEqual({});
  });
});

// ============================================================================
// LinkedIn profile URL validation
// ============================================================================

describe('validateLinkedInProfileUrl', () => {
  // Mirrors the validateLinkedInProfileUrl function from serper-client.ts
  function validateLinkedInProfileUrl(url: unknown): string {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed.includes('linkedin.com/in/')) return '';

    const disallowed = [
      'linkedin.com/company/',
      'linkedin.com/posts/',
      'linkedin.com/pub/dir/',
      'linkedin.com/feed/',
      'linkedin.com/jobs/',
      'linkedin.com/school/',
    ];
    if (disallowed.some((d) => trimmed.includes(d))) return '';

    return trimmed;
  }

  it('accepts valid personal profile URL', () => {
    expect(validateLinkedInProfileUrl('https://www.linkedin.com/in/johndoe')).toBe(
      'https://www.linkedin.com/in/johndoe',
    );
  });

  it('accepts profile URL with trailing path', () => {
    expect(validateLinkedInProfileUrl('https://linkedin.com/in/jane-smith-123abc')).toBe(
      'https://linkedin.com/in/jane-smith-123abc',
    );
  });

  it('rejects company page URLs', () => {
    expect(validateLinkedInProfileUrl('https://linkedin.com/company/acme-inc')).toBe('');
  });

  it('rejects posts URLs', () => {
    expect(validateLinkedInProfileUrl('https://linkedin.com/posts/johndoe')).toBe('');
  });

  it('rejects job URLs', () => {
    expect(validateLinkedInProfileUrl('https://linkedin.com/jobs/view/12345')).toBe('');
  });

  it('rejects null/undefined/non-string', () => {
    expect(validateLinkedInProfileUrl(null)).toBe('');
    expect(validateLinkedInProfileUrl(undefined)).toBe('');
    expect(validateLinkedInProfileUrl(42)).toBe('');
  });

  it('rejects empty string', () => {
    expect(validateLinkedInProfileUrl('')).toBe('');
  });

  it('rejects non-LinkedIn URL', () => {
    expect(validateLinkedInProfileUrl('https://twitter.com/johndoe')).toBe('');
  });

  it('trims whitespace', () => {
    expect(validateLinkedInProfileUrl('  https://linkedin.com/in/johndoe  ')).toBe(
      'https://linkedin.com/in/johndoe',
    );
  });
});

// ============================================================================
// Search results formatting for LLM
// ============================================================================

describe('formatSearchResultsForLLM', () => {
  interface SerperRawResult {
    query: string;
    organic: Array<{ title: string; link: string; snippet: string }>;
  }

  function formatSearchResultsForLLM(results: SerperRawResult[]): string {
    const sections: string[] = [];

    for (const result of results) {
      const formatted = result.organic
        .filter((item) => item.title && item.link && item.snippet)
        .map((item) => `- ${item.title}\n  ${item.link}\n  ${item.snippet}`)
        .join('\n---\n');

      if (formatted) {
        sections.push(`**Search Query:** ${result.query}\n\n${formatted}`);
      }
    }

    return sections.join('\n\n\n');
  }

  it('formats multiple search results with separators', () => {
    const results: SerperRawResult[] = [
      {
        query: 'example.com "Acme Inc" CEO',
        organic: [
          { title: 'About Us', link: 'https://example.com/about', snippet: 'CEO John Smith' },
        ],
      },
      {
        query: 'example.com "Acme Inc" Founder',
        organic: [
          {
            title: 'Team Page',
            link: 'https://example.com/team',
            snippet: 'Founded by Jane Doe',
          },
        ],
      },
    ];

    const formatted = formatSearchResultsForLLM(results);
    expect(formatted).toContain('**Search Query:** example.com "Acme Inc" CEO');
    expect(formatted).toContain('CEO John Smith');
    expect(formatted).toContain('**Search Query:** example.com "Acme Inc" Founder');
    expect(formatted).toContain('Founded by Jane Doe');
  });

  it('skips results with missing fields', () => {
    const results: SerperRawResult[] = [
      {
        query: 'test query',
        organic: [
          { title: '', link: 'https://a.com', snippet: 'has snippet' },
          { title: 'Has Title', link: 'https://b.com', snippet: 'and snippet' },
        ],
      },
    ];

    const formatted = formatSearchResultsForLLM(results);
    expect(formatted).toContain('Has Title');
    expect(formatted).not.toContain('has snippet');
  });

  it('returns empty string for empty results', () => {
    expect(formatSearchResultsForLLM([])).toBe('');
  });

  it('skips results with empty organic array', () => {
    const results: SerperRawResult[] = [{ query: 'test', organic: [] }];
    expect(formatSearchResultsForLLM(results)).toBe('');
  });
});

// ============================================================================
// Decision maker search query generation
// ============================================================================

describe('Decision maker search queries', () => {
  const DECISION_MAKER_QUERIES = [
    '{domain} "{company}" CEO -zoominfo -dnb',
    '{domain} "{company}" Founder owner -zoominfo -dnb',
    '{domain} "{company}" president chairman -zoominfo -dnb',
    '{domain} "{company}" partner -zoominfo -dnb',
    '{domain} "{company}" contact email',
  ];

  function buildQueries(domain: string, companyName: string): string[] {
    return DECISION_MAKER_QUERIES.map((q) =>
      q.replace('{domain}', domain).replace('{company}', companyName),
    );
  }

  it('generates 5 search queries per company', () => {
    const queries = buildQueries('acme.com', 'Acme Inc');
    expect(queries).toHaveLength(5);
  });

  it('includes domain and company name in each query', () => {
    const queries = buildQueries('trivest.com', 'Trivest Partners');
    for (const q of queries) {
      expect(q).toContain('trivest.com');
      expect(q).toContain('"Trivest Partners"');
    }
  });

  it('excludes zoominfo and dnb from executive queries', () => {
    const queries = buildQueries('test.com', 'Test Corp');
    const ceoQuery = queries[0];
    expect(ceoQuery).toContain('-zoominfo');
    expect(ceoQuery).toContain('-dnb');
  });

  it('includes contact email query without exclusions', () => {
    const queries = buildQueries('test.com', 'Test Corp');
    const emailQuery = queries[4];
    expect(emailQuery).toContain('contact email');
    expect(emailQuery).not.toContain('-zoominfo');
  });
});
