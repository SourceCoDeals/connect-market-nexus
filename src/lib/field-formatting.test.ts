import { describe, it, expect } from 'vitest';
import { formatFieldValue, formatFieldValueForExport, getFormattedUserFields } from './field-formatting';

describe('formatFieldValue', () => {
  it('returns em dash for null/undefined/empty values', () => {
    expect(formatFieldValue('any_field', null)).toBe('\u2014');
    expect(formatFieldValue('any_field', undefined)).toBe('\u2014');
    expect(formatFieldValue('any_field', '')).toBe('\u2014');
  });

  it('formats boolean fields correctly', () => {
    expect(formatFieldValue('permanent_capital', true)).toBe('Yes');
    expect(formatFieldValue('permanent_capital', false)).toBe('No');
    expect(formatFieldValue('permanent_capital', 'true')).toBe('Yes');
    expect(formatFieldValue('permanent_capital', 'yes')).toBe('Yes');
    expect(formatFieldValue('is_admin', false)).toBe('No');
    expect(formatFieldValue('email_verified', true)).toBe('Yes');
  });

  it('formats empty arrays as em dash', () => {
    expect(formatFieldValue('some_array', [])).toBe('\u2014');
  });

  it('formats arrays by joining with commas', () => {
    expect(formatFieldValue('random_array', ['a', 'b', 'c'])).toBe('a, b, c');
  });

  it('formats revenue-like fields with dollar sign', () => {
    expect(formatFieldValue('revenue', 1000000)).toBe('$1,000,000');
    expect(formatFieldValue('deal_size', 5000)).toBe('$5,000');
  });

  it('returns string values as-is for non-special fields', () => {
    expect(formatFieldValue('first_name', 'John')).toBe('John');
    expect(formatFieldValue('email', 'test@example.com')).toBe('test@example.com');
  });

  it('converts non-string values to strings', () => {
    expect(formatFieldValue('some_number', 42)).toBe('42');
  });
});

describe('formatFieldValueForExport', () => {
  it('returns empty string for null/undefined/empty values', () => {
    expect(formatFieldValueForExport('any_field', null)).toBe('');
    expect(formatFieldValueForExport('any_field', undefined)).toBe('');
    expect(formatFieldValueForExport('any_field', '')).toBe('');
  });

  it('formats boolean fields correctly for export', () => {
    expect(formatFieldValueForExport('permanent_capital', true)).toBe('Yes');
    expect(formatFieldValueForExport('permanent_capital', false)).toBe('No');
  });

  it('uses semicolons for arrays in CSV export', () => {
    expect(formatFieldValueForExport('random_array', ['a', 'b', 'c'])).toBe('a; b; c');
  });

  it('returns empty string for empty arrays', () => {
    expect(formatFieldValueForExport('some_array', [])).toBe('');
  });
});

describe('getFormattedUserFields', () => {
  it('returns formatted fields for a user object', () => {
    const user = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      is_admin: true,
    };
    const result = getFormattedUserFields(user, 'privateEquity');
    expect(result.first_name).toBe('John');
    expect(result.last_name).toBe('Doe');
    expect(result.email).toBe('john@example.com');
    expect(result.is_admin).toBe('Yes');
  });

  it('skips null/undefined values', () => {
    const user = {
      first_name: 'Jane',
      last_name: null,
    };
    const result = getFormattedUserFields(user, 'corporate');
    expect(result.first_name).toBe('Jane');
    expect(result.last_name).toBeUndefined();
  });
});
