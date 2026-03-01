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
function extractSerperResults(serperResponse: { organic?: unknown[] }): GoogleSearchItem[] {
  const organic = serperResponse.organic || [];
  return organic.map(
    (r: { title?: string; link?: string; snippet?: string; position?: number }) => ({
      title: r.title || '',
      url: r.link || '',
      description: r.snippet || '',
      position: r.position || 0,
    }),
  );
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
