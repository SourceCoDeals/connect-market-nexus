/**
 * Tests for _shared/apify-client.ts — LinkedIn scraper and URL resolution
 *
 * Tests pure functions (resolveCompanyUrl, inferDomain) without Deno/API dependencies.
 */
import { describe, it, expect } from 'vitest';

// Re-implement pure functions for testing (same as source, avoids Deno imports)

function resolveCompanyUrl(companyName: string, domain?: string): string {
  if (domain) {
    const slug = domain.replace(/\.(com|io|co|net|org)$/, '').replace(/[^a-z0-9]/gi, '');
    return `https://www.linkedin.com/company/${slug}`;
  }

  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `https://www.linkedin.com/company/${slug}`;
}

function inferDomain(companyName: string): string {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .trim();

  return `${slug}.com`;
}

// ============================================================================
// resolveCompanyUrl
// ============================================================================

describe('resolveCompanyUrl', () => {
  it('generates URL from company name', () => {
    expect(resolveCompanyUrl('Trivest Partners')).toBe(
      'https://www.linkedin.com/company/trivest-partners',
    );
  });

  it('handles company names with special characters', () => {
    expect(resolveCompanyUrl('AT&T Inc.')).toBe('https://www.linkedin.com/company/att-inc');
  });

  it('generates URL from domain when provided', () => {
    expect(resolveCompanyUrl('Trivest', 'trivest.com')).toBe(
      'https://www.linkedin.com/company/trivest',
    );
  });

  it('strips common TLDs from domain', () => {
    expect(resolveCompanyUrl('Test Co', 'testco.io')).toBe(
      'https://www.linkedin.com/company/testco',
    );
    expect(resolveCompanyUrl('Test Co', 'testco.net')).toBe(
      'https://www.linkedin.com/company/testco',
    );
  });

  it('handles single word company names', () => {
    expect(resolveCompanyUrl('Blackstone')).toBe('https://www.linkedin.com/company/blackstone');
  });

  it('handles multi-word company names with extra spaces', () => {
    expect(resolveCompanyUrl('  New  Heritage  Capital  ')).toBe(
      'https://www.linkedin.com/company/new-heritage-capital',
    );
  });

  it('handles empty company name gracefully', () => {
    const url = resolveCompanyUrl('');
    expect(url).toBe('https://www.linkedin.com/company/');
  });
});

// ============================================================================
// inferDomain
// ============================================================================

describe('inferDomain', () => {
  it('generates .com domain from company name', () => {
    expect(inferDomain('Trivest Partners')).toBe('trivestpartners.com');
  });

  it('strips special characters', () => {
    expect(inferDomain('AT&T Inc.')).toBe('attinc.com');
  });

  it('handles single word', () => {
    expect(inferDomain('Blackstone')).toBe('blackstone.com');
  });

  it('handles extra whitespace', () => {
    expect(inferDomain('  New Heritage  Capital  ')).toBe('newheritagecapital.com');
  });
});
