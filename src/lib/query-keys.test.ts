import { describe, it, expect } from 'vitest';
import { QUERY_KEYS, INVALIDATION_PATTERNS, createQueryKey } from './query-keys';

describe('QUERY_KEYS', () => {
  describe('static keys', () => {
    it('returns a readonly auth key', () => {
      expect(QUERY_KEYS.auth).toEqual(['auth']);
    });

    it('returns a readonly listings key', () => {
      expect(QUERY_KEYS.listings).toEqual(['listings']);
    });

    it('returns a readonly connectionRequests key', () => {
      expect(QUERY_KEYS.connectionRequests).toEqual(['connection-requests']);
    });

    it('returns a readonly userConnectionRequests key', () => {
      expect(QUERY_KEYS.userConnectionRequests).toEqual(['user-connection-requests']);
    });

    it('returns a readonly firmAgreements key', () => {
      expect(QUERY_KEYS.firmAgreements).toEqual(['firm-agreements']);
    });

    it('returns a readonly deals key', () => {
      expect(QUERY_KEYS.deals).toEqual(['deals']);
    });
  });

  describe('parameterized keys', () => {
    it('user() includes the userId', () => {
      expect(QUERY_KEYS.user('abc-123')).toEqual(['user', 'abc-123']);
    });

    it('user() includes undefined when no userId is provided', () => {
      expect(QUERY_KEYS.user()).toEqual(['user', undefined]);
    });

    it('userProfile() includes the userId', () => {
      expect(QUERY_KEYS.userProfile('u1')).toEqual(['user-profile', 'u1']);
    });

    it('listing() includes the listingId', () => {
      expect(QUERY_KEYS.listing('listing-42')).toEqual(['listing', 'listing-42']);
    });

    it('savedListings() includes filter object', () => {
      const filters = { status: 'active', page: 1 };
      expect(QUERY_KEYS.savedListings(filters)).toEqual(['saved-listings', filters]);
    });

    it('savedListings() works without filters', () => {
      expect(QUERY_KEYS.savedListings()).toEqual(['saved-listings', undefined]);
    });

    it('savedStatus() includes the listingId', () => {
      expect(QUERY_KEYS.savedStatus('lst-1')).toEqual(['saved-status', 'lst-1']);
    });

    it('connectionStatus() includes the listingId', () => {
      expect(QUERY_KEYS.connectionStatus('lst-5')).toEqual(['connection-status', 'lst-5']);
    });

    it('deal() includes the dealId', () => {
      expect(QUERY_KEYS.deal('deal-99')).toEqual(['deal', 'deal-99']);
    });

    it('firmMembers() includes the firmId', () => {
      expect(QUERY_KEYS.firmMembers('firm-7')).toEqual(['firm-members', 'firm-7']);
    });
  });

  describe('admin keys', () => {
    it('admin.connectionRequests is correct', () => {
      expect(QUERY_KEYS.admin.connectionRequests).toEqual(['admin', 'connection-requests']);
    });

    it('admin.users is correct', () => {
      expect(QUERY_KEYS.admin.users).toEqual(['admin', 'users']);
    });

    it('admin.listings is correct', () => {
      expect(QUERY_KEYS.admin.listings).toEqual(['admin', 'listings']);
    });

    it('admin.userSavedListings() includes userId', () => {
      expect(QUERY_KEYS.admin.userSavedListings('u1')).toEqual(['admin', 'user-saved-listings', 'u1']);
    });

    it('admin.userConnectionRequests() includes userId', () => {
      expect(QUERY_KEYS.admin.userConnectionRequests('u2')).toEqual(['admin', 'user-connection-requests', 'u2']);
    });

    it('admin.listingSavedBy() includes listingId', () => {
      expect(QUERY_KEYS.admin.listingSavedBy('lst-3')).toEqual(['admin', 'listing-saved-by', 'lst-3']);
    });

    it('admin.userNotes() includes userId', () => {
      expect(QUERY_KEYS.admin.userNotes('u5')).toEqual(['admin', 'user-notes', 'u5']);
    });
  });

  describe('analytics keys', () => {
    it('analytics.health is correct', () => {
      expect(QUERY_KEYS.analytics.health).toEqual(['analytics', 'health']);
    });

    it('analytics.marketplace() includes days', () => {
      expect(QUERY_KEYS.analytics.marketplace(30)).toEqual(['analytics', 'marketplace', 30]);
    });

    it('analytics.feedback() includes days', () => {
      expect(QUERY_KEYS.analytics.feedback(7)).toEqual(['analytics', 'feedback', 7]);
    });
  });
});

describe('INVALIDATION_PATTERNS', () => {
  it('savedListings() returns an array of query key objects', () => {
    const patterns = INVALIDATION_PATTERNS.savedListings();
    expect(patterns.length).toBeGreaterThanOrEqual(2);
    expect(patterns[0]).toHaveProperty('queryKey');
  });

  it('connectionRequests() returns an array with legacy support keys', () => {
    const patterns = INVALIDATION_PATTERNS.connectionRequests();
    expect(patterns.length).toBeGreaterThanOrEqual(3);
    const allKeys = patterns.map(p => p.queryKey);
    expect(allKeys).toContainEqual(['connection-status']);
    expect(allKeys).toContainEqual(['user-connection-requests']);
  });

  it('userProfile() includes admin users key for revalidation', () => {
    const patterns = INVALIDATION_PATTERNS.userProfile('u1');
    const allKeys = patterns.map(p => p.queryKey);
    expect(allKeys).toContainEqual(QUERY_KEYS.admin.users);
  });

  it('userNotes() includes the user-specific key', () => {
    const patterns = INVALIDATION_PATTERNS.userNotes('u1');
    const allKeys = patterns.map(p => p.queryKey);
    expect(allKeys).toContainEqual(QUERY_KEYS.admin.userNotes('u1'));
  });

  it('firmAgreements() includes legacy key', () => {
    const patterns = INVALIDATION_PATTERNS.firmAgreements();
    const allKeys = patterns.map(p => p.queryKey);
    expect(allKeys).toContainEqual(['firm-agreements']);
  });

  it('deals() returns patterns for deals invalidation', () => {
    const patterns = INVALIDATION_PATTERNS.deals();
    expect(patterns.length).toBeGreaterThanOrEqual(1);
    const allKeys = patterns.map(p => p.queryKey);
    expect(allKeys).toContainEqual(QUERY_KEYS.deals);
  });
});

describe('createQueryKey', () => {
  it('savedListings() delegates to QUERY_KEYS', () => {
    const filters = { type: 'all' };
    expect(createQueryKey.savedListings(filters)).toEqual(QUERY_KEYS.savedListings(filters));
  });

  it('savedStatus() delegates to QUERY_KEYS', () => {
    expect(createQueryKey.savedStatus('lst-9')).toEqual(QUERY_KEYS.savedStatus('lst-9'));
  });

  it('connectionStatus() delegates to QUERY_KEYS', () => {
    expect(createQueryKey.connectionStatus('lst-10')).toEqual(QUERY_KEYS.connectionStatus('lst-10'));
  });

  it('userConnectionRequests() filters out falsy values', () => {
    const result = createQueryKey.userConnectionRequests('u1');
    expect(result).toEqual(['user-connection-requests', 'u1']);
  });

  it('userConnectionRequests() without userId filters out undefined', () => {
    const result = createQueryKey.userConnectionRequests();
    expect(result).toEqual(['user-connection-requests']);
  });

  it('userActivity() filters out falsy values', () => {
    const result = createQueryKey.userActivity('u2');
    expect(result).toEqual(['user-activity', 'u2']);
  });

  it('userActivity() without userId filters out undefined', () => {
    const result = createQueryKey.userActivity();
    expect(result).toEqual(['user-activity']);
  });

  it('adminConnectionRequests() delegates to QUERY_KEYS.admin', () => {
    expect(createQueryKey.adminConnectionRequests()).toEqual(QUERY_KEYS.admin.connectionRequests);
  });
});
