import { describe, it, expect } from 'vitest';
import {
  processUrl,
  isValidUrlFormat,
  isValidLinkedInFormat,
  processLinkedInUrl,
  getUrlDisplayText,
  extractDomainFromEmail,
  mapRoleToBuyerType,
  getLeadTierInfo
} from './url-utils';

describe('processUrl', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(processUrl(null)).toBe('');
    expect(processUrl(undefined)).toBe('');
    expect(processUrl('')).toBe('');
    expect(processUrl('   ')).toBe('');
  });

  it('returns URL as-is when it already has a protocol', () => {
    expect(processUrl('https://example.com')).toBe('https://example.com');
    expect(processUrl('http://example.com')).toBe('http://example.com');
  });

  it('adds https:// prefix for URLs without protocol', () => {
    expect(processUrl('example.com')).toBe('https://example.com');
    expect(processUrl('www.example.com')).toBe('https://www.example.com');
  });

  it('trims whitespace', () => {
    expect(processUrl('  example.com  ')).toBe('https://example.com');
  });
});

describe('isValidUrlFormat', () => {
  it('returns true for empty/null values (optional field)', () => {
    expect(isValidUrlFormat(null)).toBe(true);
    expect(isValidUrlFormat(undefined)).toBe(true);
    expect(isValidUrlFormat('')).toBe(true);
  });

  it('validates correct URLs', () => {
    expect(isValidUrlFormat('example.com')).toBe(true);
    expect(isValidUrlFormat('www.example.com')).toBe(true);
    expect(isValidUrlFormat('https://example.com')).toBe(true);
    expect(isValidUrlFormat('sub.example.co.uk')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isValidUrlFormat('not a url')).toBe(false);
    expect(isValidUrlFormat('just-text')).toBe(false);
  });
});

describe('isValidLinkedInFormat', () => {
  it('returns true for empty/null values', () => {
    expect(isValidLinkedInFormat(null)).toBe(true);
    expect(isValidLinkedInFormat(undefined)).toBe(true);
    expect(isValidLinkedInFormat('')).toBe(true);
  });

  it('validates correct LinkedIn URLs', () => {
    expect(isValidLinkedInFormat('https://linkedin.com/in/john-doe')).toBe(true);
    expect(isValidLinkedInFormat('linkedin.com/in/john-doe')).toBe(true);
    expect(isValidLinkedInFormat('www.linkedin.com/company/acme-corp')).toBe(true);
    expect(isValidLinkedInFormat('https://www.linkedin.com/in/jane')).toBe(true);
  });

  it('rejects invalid LinkedIn URLs', () => {
    expect(isValidLinkedInFormat('https://example.com')).toBe(false);
    expect(isValidLinkedInFormat('linkedin.com')).toBe(false);
    expect(isValidLinkedInFormat('not a url')).toBe(false);
  });
});

describe('processLinkedInUrl', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(processLinkedInUrl(null)).toBe('');
    expect(processLinkedInUrl(undefined)).toBe('');
    expect(processLinkedInUrl('')).toBe('');
  });

  it('adds https:// prefix when missing', () => {
    expect(processLinkedInUrl('linkedin.com/in/john')).toBe('https://linkedin.com/in/john');
  });

  it('returns URL as-is when it already has protocol', () => {
    expect(processLinkedInUrl('https://linkedin.com/in/john')).toBe('https://linkedin.com/in/john');
  });
});

describe('getUrlDisplayText', () => {
  it('returns empty string for empty input', () => {
    expect(getUrlDisplayText(null)).toBe('');
    expect(getUrlDisplayText('')).toBe('');
  });

  it('returns processed URL', () => {
    expect(getUrlDisplayText('example.com')).toBe('https://example.com');
  });
});

describe('extractDomainFromEmail', () => {
  it('returns empty string for invalid input', () => {
    expect(extractDomainFromEmail(null)).toBe('');
    expect(extractDomainFromEmail('')).toBe('');
    expect(extractDomainFromEmail('invalid')).toBe('');
  });

  it('extracts domain from email and creates URL', () => {
    expect(extractDomainFromEmail('john@example.com')).toBe('https://example.com');
    expect(extractDomainFromEmail('user@company.co.uk')).toBe('https://company.co.uk');
  });

  it('lowercases the domain', () => {
    expect(extractDomainFromEmail('user@EXAMPLE.COM')).toBe('https://example.com');
  });
});

describe('mapRoleToBuyerType', () => {
  it('returns "Buyer" for empty/null input', () => {
    expect(mapRoleToBuyerType(null)).toBe('Buyer');
    expect(mapRoleToBuyerType(undefined)).toBe('Buyer');
    expect(mapRoleToBuyerType('')).toBe('Buyer');
  });

  it('maps camelCase database roles', () => {
    expect(mapRoleToBuyerType('privateEquity')).toBe('PE');
    expect(mapRoleToBuyerType('familyOffice')).toBe('FO');
    expect(mapRoleToBuyerType('searchFund')).toBe('SF');
    expect(mapRoleToBuyerType('independentSponsor')).toBe('IS');
    expect(mapRoleToBuyerType('corporate')).toBe('Corp');
    expect(mapRoleToBuyerType('individual')).toBe('Individual');
  });

  it('maps display name roles', () => {
    expect(mapRoleToBuyerType('Private Equity')).toBe('PE');
    expect(mapRoleToBuyerType('Family Office')).toBe('FO');
    expect(mapRoleToBuyerType('Search Fund')).toBe('SF');
    expect(mapRoleToBuyerType('Independent Sponsor')).toBe('IS');
  });

  it('maps independent sponsor before PE to avoid false matches', () => {
    expect(mapRoleToBuyerType('Independent Sponsor')).toBe('IS');
  });
});

describe('getLeadTierInfo', () => {
  it('returns tier 5 for empty/null input', () => {
    const result = getLeadTierInfo(null);
    expect(result.tier).toBe(5);
    expect(result.description).toBe('No type specified');
  });

  it('returns correct tier for PE', () => {
    const result = getLeadTierInfo('privateEquity');
    expect(result.tier).toBe(1);
    expect(result.description).toBe('Private Equity');
  });

  it('returns correct tier for Family Office', () => {
    const result = getLeadTierInfo('familyOffice');
    expect(result.tier).toBe(2);
    expect(result.description).toBe('Family Office');
  });

  it('returns correct tier for Search Fund', () => {
    const result = getLeadTierInfo('searchFund');
    expect(result.tier).toBe(4);
    expect(result.description).toBe('Search Fund');
  });

  it('returns correct tier for unknown roles', () => {
    const result = getLeadTierInfo('unknown');
    expect(result.tier).toBe(5);
    expect(result.description).toBe('Other');
  });
});
