import { describe, it, expect, vi } from 'vitest';

// Mock supabase before importing the module under test
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { parseArray, buildProfileFromMetadata } from './profile-self-heal';

describe('parseArray', () => {
  it('returns the array as-is when input is already an array', () => {
    expect(parseArray(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('returns empty array for empty array input', () => {
    expect(parseArray([])).toEqual([]);
  });

  it('parses valid JSON array string', () => {
    expect(parseArray('["x","y","z"]')).toEqual(['x', 'y', 'z']);
  });

  it('returns empty array for malformed JSON string starting with [', () => {
    expect(parseArray('[invalid json')).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(parseArray(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(parseArray(undefined)).toEqual([]);
  });

  it('returns empty array for a number', () => {
    expect(parseArray(42)).toEqual([]);
  });

  it('returns empty array for a plain string (not starting with [)', () => {
    expect(parseArray('hello world')).toEqual([]);
  });

  it('returns empty array for an empty string', () => {
    expect(parseArray('')).toEqual([]);
  });

  it('returns empty array for boolean values', () => {
    expect(parseArray(true)).toEqual([]);
    expect(parseArray(false)).toEqual([]);
  });

  it('returns empty array for an object (not array)', () => {
    expect(parseArray({ key: 'value' })).toEqual([]);
  });

  it('parses nested JSON array', () => {
    expect(parseArray('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('handles JSON string with escaped characters', () => {
    expect(parseArray('["a\\"b","c"]')).toEqual(['a"b', 'c']);
  });
});

describe('buildProfileFromMetadata', () => {
  function makeAuthUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'auth-user-1',
      email: 'user@example.com',
      email_confirmed_at: '2024-01-01T00:00:00Z',
      user_metadata: {},
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2024-01-01T00:00:00Z',
      ...overrides,
    } as unknown as Parameters<typeof buildProfileFromMetadata>[0];
  }

  it('builds profile with default values when metadata is empty', () => {
    const profile = buildProfileFromMetadata(makeAuthUser());
    expect(profile.id).toBe('auth-user-1');
    expect(profile.email).toBe('user@example.com');
    expect(profile.first_name).toBe('Unknown');
    expect(profile.last_name).toBe('User');
    expect(profile.approval_status).toBe('pending');
    expect(profile.email_verified).toBe(true);
  });

  it('reads snake_case metadata fields', () => {
    const authUser = makeAuthUser({
      user_metadata: {
        first_name: 'Alice',
        last_name: 'Smith',
        company: 'AliceCo',
        buyer_type: 'familyOffice',
      },
    });
    const profile = buildProfileFromMetadata(authUser);
    expect(profile.first_name).toBe('Alice');
    expect(profile.last_name).toBe('Smith');
    expect(profile.company).toBe('AliceCo');
    expect(profile.buyer_type).toBe('familyOffice');
  });

  it('falls back to camelCase metadata fields', () => {
    const authUser = makeAuthUser({
      user_metadata: {
        firstName: 'Bob',
        lastName: 'Jones',
        buyerType: 'searchFund',
      },
    });
    const profile = buildProfileFromMetadata(authUser);
    expect(profile.first_name).toBe('Bob');
    expect(profile.last_name).toBe('Jones');
    expect(profile.buyer_type).toBe('searchFund');
  });

  it('parses array fields from metadata', () => {
    const authUser = makeAuthUser({
      user_metadata: {
        business_categories: ['tech', 'saas'],
        target_locations: '["NYC","SF"]',
      },
    });
    const profile = buildProfileFromMetadata(authUser);
    expect(profile.business_categories).toEqual(['tech', 'saas']);
    expect(profile.target_locations).toEqual(['NYC', 'SF']);
  });

  it('sets email_verified to false when email not confirmed', () => {
    const authUser = makeAuthUser({ email_confirmed_at: null });
    const profile = buildProfileFromMetadata(authUser);
    expect(profile.email_verified).toBe(false);
  });

  it('handles missing user_metadata gracefully', () => {
    const authUser = makeAuthUser({ user_metadata: undefined });
    const profile = buildProfileFromMetadata(authUser);
    expect(profile.first_name).toBe('Unknown');
    expect(profile.last_name).toBe('User');
    expect(profile.business_categories).toEqual([]);
  });
});
