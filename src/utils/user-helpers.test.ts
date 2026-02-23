import { describe, it, expect } from 'vitest';
import { createListingFromData } from './user-helpers';

describe('createListingFromData', () => {
  const validData = {
    id: 'listing-123',
    title: 'Test Business',
    description: 'A great business opportunity',
    revenue: 5000000,
    ebitda: 1000000,
    category: 'Technology & Software',
    location: 'Northeast US',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  };

  it('creates a listing from valid data', () => {
    const listing = createListingFromData(validData);
    expect(listing.id).toBe('listing-123');
    expect(listing.title).toBe('Test Business');
    expect(listing.description).toBe('A great business opportunity');
    expect(listing.revenue).toBe(5000000);
    expect(listing.ebitda).toBe(1000000);
    expect(listing.status).toBe('active');
  });

  it('throws error for null data', () => {
    expect(() => createListingFromData(null)).toThrow('Cannot create listing from null data');
  });

  it('provides defaults for missing fields', () => {
    const listing = createListingFromData({ id: 'min-listing' });
    expect(listing.title).toBe('Untitled Listing');
    expect(listing.description).toBe('');
    expect(listing.revenue).toBe(0);
    expect(listing.ebitda).toBe(0);
    expect(listing.location).toBe('Not specified');
    expect(listing.tags).toEqual([]);
    expect(listing.status).toBe('active');
  });

  it('computes revenueFormatted correctly', () => {
    const listing = createListingFromData(validData);
    expect(listing.revenueFormatted).toBe('$5,000,000');
  });

  it('computes ebitdaFormatted correctly', () => {
    const listing = createListingFromData(validData);
    expect(listing.ebitdaFormatted).toBe('$1,000,000');
  });

  it('computes multiples correctly', () => {
    const listing = createListingFromData(validData);
    const multiple = 5000000 / 1000000;
    expect(listing.multiples.revenue).toBe(multiple.toFixed(2));
    expect(listing.multiples.value).toBe(`${multiple.toFixed(2)}x`);
  });

  it('handles zero ebitda for multiples', () => {
    const listing = createListingFromData({ ...validData, ebitda: 0 });
    expect(listing.multiples.value).toBe('N/A');
  });

  it('handles categories array', () => {
    const listing = createListingFromData({
      ...validData,
      categories: ['Tech', 'SaaS'],
    });
    expect(listing.categories).toEqual(['Tech', 'SaaS']);
  });

  it('handles internal admin fields', () => {
    const listing = createListingFromData({
      ...validData,
      deal_identifier: 'DEAL-001',
      internal_company_name: 'Secret Corp',
    });
    expect(listing.deal_identifier).toBe('DEAL-001');
    expect(listing.internal_company_name).toBe('Secret Corp');
  });
});
