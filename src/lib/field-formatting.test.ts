import { describe, it, expect } from 'vitest';
import {
  formatFieldValue,
  formatFieldValueForExport,
  getFormattedUserFields,
} from './field-formatting';

describe('formatFieldValue', () => {
  it('returns em-dash for null, undefined, or empty string', () => {
    expect(formatFieldValue('any_field', null)).toBe('—');
    expect(formatFieldValue('any_field', undefined)).toBe('—');
    expect(formatFieldValue('any_field', '')).toBe('—');
  });

  it('formats boolean fields as Yes/No', () => {
    expect(formatFieldValue('permanent_capital', true)).toBe('Yes');
    expect(formatFieldValue('permanent_capital', 'true')).toBe('Yes');
    expect(formatFieldValue('permanent_capital', 'yes')).toBe('Yes');
    expect(formatFieldValue('permanent_capital', false)).toBe('No');
    expect(formatFieldValue('permanent_capital', 'false')).toBe('No');
    expect(formatFieldValue('is_admin', true)).toBe('Yes');
    expect(formatFieldValue('nda_signed', false)).toBe('No');
  });

  it('returns em-dash for empty arrays', () => {
    expect(formatFieldValue('equity_source', [])).toBe('—');
  });

  it('formats arrays with lookup for known multi-select fields', () => {
    // equity_source is a known lookup field
    const result = formatFieldValue('equity_source', ['named_lps', 'self_funded']);
    expect(result).toBe('Named LPs committed, Self-funded');
  });

  it('formats arrays without lookup by joining with comma', () => {
    const result = formatFieldValue('some_unknown_array', ['alpha', 'beta']);
    expect(result).toBe('alpha, beta');
  });

  it('formats single-value lookup fields (buyer_type)', () => {
    expect(formatFieldValue('buyer_type', 'privateEquity')).toBe('Private Equity');
    expect(formatFieldValue('buyer_type', 'corporate')).toBe('Corporate Development (Strategic)');
    expect(formatFieldValue('buyer_type', 'searchFund')).toBe('Search Fund');
  });

  it('returns raw value when lookup key is not found', () => {
    expect(formatFieldValue('buyer_type', 'unknownType')).toBe('unknownType');
  });

  it('formats currency-like fields with dollar sign', () => {
    expect(formatFieldValue('estimated_revenue', 1000000)).toBe('$1,000,000');
    expect(formatFieldValue('fund_size', '500000')).toBe('$500,000');
    expect(formatFieldValue('aum', 2500000)).toBe('$2,500,000');
  });

  it('returns string representation for non-special fields', () => {
    expect(formatFieldValue('company_name', 'Acme Corp')).toBe('Acme Corp');
    expect(formatFieldValue('some_field', 42)).toBe('42');
  });

  it('formats integration_plan array with lookup labels', () => {
    const result = formatFieldValue('integration_plan', ['brand_tuck_in', 'geographic_expansion']);
    expect(result).toBe('Brand tuck-in (same BU), Geographic expansion');
  });

  it('formats search_stage single value with lookup', () => {
    expect(formatFieldValue('search_stage', 'under_loi')).toBe('Under LOI');
    expect(formatFieldValue('search_stage', 'actively_searching')).toBe('Actively searching');
  });
});

describe('formatFieldValueForExport', () => {
  it('returns empty string for null, undefined, or empty string', () => {
    expect(formatFieldValueForExport('any_field', null)).toBe('');
    expect(formatFieldValueForExport('any_field', undefined)).toBe('');
    expect(formatFieldValueForExport('any_field', '')).toBe('');
  });

  it('formats boolean fields as Yes/No for export', () => {
    expect(formatFieldValueForExport('email_verified', true)).toBe('Yes');
    expect(formatFieldValueForExport('email_verified', false)).toBe('No');
    expect(formatFieldValueForExport('fee_agreement_signed', 'true')).toBe('Yes');
  });

  it('returns empty string for empty arrays', () => {
    expect(formatFieldValueForExport('equity_source', [])).toBe('');
  });

  it('uses semicolons for array export (avoids CSV comma conflicts)', () => {
    const result = formatFieldValueForExport('equity_source', ['named_lps', 'self_funded']);
    expect(result).toBe('Named LPs committed; Self-funded');
  });

  it('uses semicolons for non-lookup arrays too', () => {
    const result = formatFieldValueForExport('some_array', ['a', 'b', 'c']);
    expect(result).toBe('a; b; c');
  });

  it('formats single-value lookup fields for export', () => {
    expect(formatFieldValueForExport('discretion_type', 'discretionary')).toBe('Discretionary');
  });

  it('returns string representation for unknown fields', () => {
    expect(formatFieldValueForExport('company_name', 'Acme')).toBe('Acme');
    expect(formatFieldValueForExport('count', 123)).toBe('123');
  });
});

describe('getFormattedUserFields', () => {
  it('returns formatted fields for all non-null user properties', () => {
    const user = {
      buyer_type: 'privateEquity',
      email: 'test@example.com',
      permanent_capital: true,
      empty_field: null,
    };
    const result = getFormattedUserFields(user, 'privateEquity');
    expect(result.buyer_type).toBe('Private Equity');
    expect(result.email).toBe('test@example.com');
    expect(result.permanent_capital).toBe('Yes');
    expect(result.empty_field).toBeUndefined();
  });

  it('excludes null and undefined fields', () => {
    const user = {
      name: 'Alice',
      age: undefined,
      company: null,
    };
    const result = getFormattedUserFields(user, 'corporate');
    expect(Object.keys(result)).toEqual(['name']);
  });

  it('returns empty object for empty user', () => {
    const result = getFormattedUserFields({}, 'individual');
    expect(result).toEqual({});
  });
});
