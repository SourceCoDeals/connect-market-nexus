import { describe, it, expect } from 'vitest';
import {
  createUserObject,
  safeJsonParse,
  isUserAdmin,
  getUserDisplayName,
  getUserInitials,
  validateUserData,
} from './auth-helpers';

describe('safeJsonParse', () => {
  it('parses valid JSON strings', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
  });

  it('returns fallback for null/undefined', () => {
    expect(safeJsonParse(null, 'default')).toBe('default');
    expect(safeJsonParse(undefined, [])).toEqual([]);
  });

  it('returns value as-is when not a string', () => {
    expect(safeJsonParse(42, 0)).toBe(42);
    expect(safeJsonParse([1, 2], [])).toEqual([1, 2]);
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeJsonParse('{bad json', {})).toEqual({});
    expect(safeJsonParse('not json', 'fallback')).toBe('fallback');
  });
});

describe('createUserObject', () => {
  it('creates a valid user object from a full profile', () => {
    const profile = {
      id: 'user-1',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      company: 'Acme',
      buyer_type: 'corporate',
      approval_status: 'approved',
      is_admin: true,
      email_verified: true,
    };
    const user = createUserObject(profile);
    expect(user.id).toBe('user-1');
    expect(user.email).toBe('test@example.com');
    expect(user.first_name).toBe('John');
    expect(user.last_name).toBe('Doe');
    expect(user.buyer_type).toBe('corporate');
    expect(user.is_admin).toBe(true);
    expect(user.email_verified).toBe(true);
    expect(user._hasDataIssues).toBe(false);
  });

  it('handles null profile gracefully with data issues flag', () => {
    const user = createUserObject(null as unknown as Record<string, unknown>);
    expect(user.id).toContain('unknown-');
    expect(user._hasDataIssues).toBe(true);
    expect(user._dataIssues).toContain('Profile was null/undefined');
  });

  it('handles profile missing ID', () => {
    const user = createUserObject({ email: 'test@example.com' });
    expect(user.id).toContain('unknown-');
    expect(user._hasDataIssues).toBe(true);
    expect(user._dataIssues).toContain('Profile missing ID');
  });

  it('defaults to empty strings for missing string fields', () => {
    const user = createUserObject({ id: 'user-2' });
    expect(user.email).toBe('');
    expect(user.first_name).toBe('');
    expect(user.last_name).toBe('');
    expect(user.company).toBe('');
    expect(user.website).toBe('');
  });

  it('defaults buyer_type to corporate and approval_status to pending', () => {
    const user = createUserObject({ id: 'user-3' });
    expect(user.buyer_type).toBe('corporate');
    expect(user.approval_status).toBe('pending');
  });

  it('parses business_categories from JSON string', () => {
    const user = createUserObject({
      id: 'user-4',
      business_categories: '["tech","finance"]',
    });
    expect(user.business_categories).toEqual(['tech', 'finance']);
  });

  it('parses business_categories from array', () => {
    const user = createUserObject({
      id: 'user-5',
      business_categories: ['manufacturing'],
    });
    expect(user.business_categories).toEqual(['manufacturing']);
  });

  it('provides getter aliases that mirror snake_case fields', () => {
    const user = createUserObject({
      id: 'user-6',
      first_name: 'Alice',
      last_name: 'Smith',
      is_admin: true,
      buyer_type: 'familyOffice',
      email_verified: true,
      approval_status: 'approved',
    });
    expect(user.firstName).toBe('Alice');
    expect(user.lastName).toBe('Smith');
    expect(user.isAdmin).toBe(true);
    expect(user.buyerType).toBe('familyOffice');
    expect(user.emailVerified).toBe(true);
    expect(user.isApproved).toBe(true);
  });

  it('uses company_name as fallback for company and vice versa', () => {
    const user1 = createUserObject({ id: 'u1', company_name: 'FooCo' });
    expect(user1.company).toBe('FooCo');
    expect(user1.company_name).toBe('FooCo');

    const user2 = createUserObject({ id: 'u2', company: 'BarCo' });
    expect(user2.company).toBe('BarCo');
    expect(user2.company_name).toBe('BarCo');
  });
});

describe('isUserAdmin', () => {
  it('returns false for null user', () => {
    expect(isUserAdmin(null)).toBe(false);
  });

  it('returns true when is_admin is true', () => {
    const user = createUserObject({ id: 'admin-1', is_admin: true });
    expect(isUserAdmin(user)).toBe(true);
  });

  it('returns false when is_admin is false', () => {
    const user = createUserObject({ id: 'user-1', is_admin: false });
    expect(isUserAdmin(user)).toBe(false);
  });
});

describe('getUserDisplayName', () => {
  it('returns "Unknown User" for null', () => {
    expect(getUserDisplayName(null)).toBe('Unknown User');
  });

  it('returns full name when both first and last exist', () => {
    const user = createUserObject({ id: 'u1', first_name: 'Jane', last_name: 'Doe' });
    expect(getUserDisplayName(user)).toBe('Jane Doe');
  });

  it('returns first name only when last name missing', () => {
    const user = createUserObject({ id: 'u2', first_name: 'Jane' });
    expect(getUserDisplayName(user)).toBe('Jane');
  });

  it('falls back to email when both names missing', () => {
    const user = createUserObject({ id: 'u3', email: 'jane@co.com' });
    expect(getUserDisplayName(user)).toBe('jane@co.com');
  });
});

describe('getUserInitials', () => {
  it('returns "U" for null user', () => {
    expect(getUserInitials(null)).toBe('U');
  });

  it('returns initials from first and last name', () => {
    const user = createUserObject({ id: 'u1', first_name: 'Jane', last_name: 'Doe' });
    expect(getUserInitials(user)).toBe('JD');
  });

  it('falls back to email initial when names are missing', () => {
    const user = createUserObject({ id: 'u2', email: 'jane@co.com' });
    expect(getUserInitials(user)).toBe('J');
  });
});

describe('validateUserData', () => {
  it('validates a complete user as valid', () => {
    const user = createUserObject({
      id: 'u1',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      approval_status: 'approved',
      buyer_type: 'corporate',
    });
    const result = validateUserData(user);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports missing required fields', () => {
    // Build a user object directly (bypassing createUserObject which auto-generates IDs)
    const user = {
      id: '',
      email: '',
      first_name: '',
      last_name: '',
      company: '',
      website: '',
      phone_number: '',
      role: 'buyer' as const,
      email_verified: false,
      approval_status: 'pending' as const,
      is_admin: false,
      buyer_type: 'corporate' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      get firstName() {
        return this.first_name;
      },
      get lastName() {
        return this.last_name;
      },
      get phoneNumber() {
        return this.phone_number;
      },
      get isAdmin() {
        return this.is_admin;
      },
      get buyerType() {
        return this.buyer_type;
      },
      get emailVerified() {
        return this.email_verified;
      },
      get isApproved() {
        return this.approval_status === 'approved';
      },
      get createdAt() {
        return this.created_at;
      },
      get updatedAt() {
        return this.updated_at;
      },
    };
    const result = validateUserData(user);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('User ID is required');
    expect(result.errors).toContain('Email is required');
    expect(result.errors).toContain('First name is required');
    expect(result.errors).toContain('Last name is required');
  });

  it('reports invalid email format', () => {
    const user = createUserObject({
      id: 'u1',
      email: 'not-an-email',
      first_name: 'A',
      last_name: 'B',
    });
    const result = validateUserData(user);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid email format');
  });
});
