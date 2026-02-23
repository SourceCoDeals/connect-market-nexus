import { describe, it, expect } from 'vitest';
import { QUERY_KEYS, INVALIDATION_PATTERNS, createQueryKey } from './query-keys';

describe('QUERY_KEYS', () => {
  it('provides static auth key', () => {
    expect(QUERY_KEYS.auth).toEqual(['auth']);
  });

  it('provides static listings key', () => {
    expect(QUERY_KEYS.listings).toEqual(['listings']);
  });

  it('provides user key with id', () => {
    expect(QUERY_KEYS.user('user-123')).toEqual(['user', 'user-123']);
  });

  it('provides user key without id', () => {
    expect(QUERY_KEYS.user()).toEqual(['user', undefined]);
  });

  it('provides listing key with id', () => {
    expect(QUERY_KEYS.listing('listing-456')).toEqual(['listing', 'listing-456']);
  });

  it('provides savedListings key', () => {
    const key = QUERY_KEYS.savedListings({ category: 'tech' });
    expect(key).toEqual(['saved-listings', { category: 'tech' }]);
  });

  it('provides admin nested keys', () => {
    expect(QUERY_KEYS.admin.connectionRequests).toEqual(['admin', 'connection-requests']);
    expect(QUERY_KEYS.admin.users).toEqual(['admin', 'users']);
    expect(QUERY_KEYS.admin.listings).toEqual(['admin', 'listings']);
  });

  it('provides admin user-specific keys', () => {
    expect(QUERY_KEYS.admin.userSavedListings('u1')).toEqual(['admin', 'user-saved-listings', 'u1']);
    expect(QUERY_KEYS.admin.userNotes('u2')).toEqual(['admin', 'user-notes', 'u2']);
  });

  it('provides analytics keys', () => {
    expect(QUERY_KEYS.analytics.health).toEqual(['analytics', 'health']);
    expect(QUERY_KEYS.analytics.marketplace(30)).toEqual(['analytics', 'marketplace', 30]);
  });
});

describe('INVALIDATION_PATTERNS', () => {
  it('provides saved listings invalidation pattern', () => {
    const patterns = INVALIDATION_PATTERNS.savedListings();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0]).toHaveProperty('queryKey');
  });

  it('provides connection requests invalidation pattern', () => {
    const patterns = INVALIDATION_PATTERNS.connectionRequests();
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('provides user profile invalidation pattern', () => {
    const patterns = INVALIDATION_PATTERNS.userProfile('user-123');
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('provides deals invalidation pattern', () => {
    const patterns = INVALIDATION_PATTERNS.deals();
    expect(patterns.length).toBeGreaterThan(0);
  });
});

describe('createQueryKey', () => {
  it('creates savedListings key', () => {
    const key = createQueryKey.savedListings({ search: 'test' });
    expect(key).toEqual(['saved-listings', { search: 'test' }]);
  });

  it('creates savedStatus key', () => {
    const key = createQueryKey.savedStatus('listing-1');
    expect(key).toEqual(['saved-status', 'listing-1']);
  });

  it('creates connectionStatus key', () => {
    const key = createQueryKey.connectionStatus('listing-2');
    expect(key).toEqual(['connection-status', 'listing-2']);
  });

  it('creates adminConnectionRequests key', () => {
    const key = createQueryKey.adminConnectionRequests();
    expect(key).toEqual(['admin', 'connection-requests']);
  });
});
