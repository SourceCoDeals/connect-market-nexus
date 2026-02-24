/**
 * Tests for _shared/apify-google-client.ts — Google search result processing
 *
 * Tests the result parsing and LinkedIn URL extraction logic.
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Google search result parsing
// ============================================================================

interface GoogleSearchItem {
  title: string;
  url: string;
  description: string;
  position: number;
}

function extractOrganicResults(apiResponse: any[]): GoogleSearchItem[] {
  const results: GoogleSearchItem[] = [];
  for (const item of apiResponse) {
    const organicResults = item.organicResults || [];
    for (const result of organicResults) {
      results.push({
        title: result.title || '',
        url: result.url || '',
        description: result.description || '',
        position: result.position || results.length + 1,
      });
    }
  }
  return results;
}

describe('extractOrganicResults', () => {
  it('extracts results from Apify response format', () => {
    const apiResponse = [
      {
        organicResults: [
          {
            title: 'Trivest Partners',
            url: 'https://trivest.com',
            description: 'PE firm',
            position: 1,
          },
          {
            title: 'LinkedIn',
            url: 'https://linkedin.com/company/trivest',
            description: 'Company page',
            position: 2,
          },
        ],
      },
    ];

    const results = extractOrganicResults(apiResponse);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Trivest Partners');
    expect(results[1].url).toContain('linkedin.com');
  });

  it('handles empty API response', () => {
    expect(extractOrganicResults([])).toHaveLength(0);
  });

  it('handles missing organicResults', () => {
    const apiResponse = [{ someOtherField: 'value' }];
    expect(extractOrganicResults(apiResponse)).toHaveLength(0);
  });

  it('handles results with missing fields', () => {
    const apiResponse = [
      {
        organicResults: [{ title: 'Test', url: '' }, { position: 3 }],
      },
    ];

    const results = extractOrganicResults(apiResponse);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Test');
    expect(results[0].url).toBe('');
    expect(results[1].title).toBe('');
  });

  it('handles multiple pages of results', () => {
    const apiResponse = [
      {
        organicResults: [
          { title: 'Page 1 Result', url: 'https://a.com', description: '', position: 1 },
        ],
      },
      {
        organicResults: [
          { title: 'Page 2 Result', url: 'https://b.com', description: '', position: 2 },
        ],
      },
    ];

    const results = extractOrganicResults(apiResponse);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Page 1 Result');
    expect(results[1].title).toBe('Page 2 Result');
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
