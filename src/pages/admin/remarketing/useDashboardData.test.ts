import { describe, it, expect } from 'vitest';
import {
  getFromDate,
  formatCurrency,
  scorePillClass,
  initials,
  sourceHref,
} from './useDashboardData';

describe('getFromDate', () => {
  it('returns null for "all"', () => {
    expect(getFromDate('all')).toBeNull();
  });

  it('returns an ISO string for every other timeframe', () => {
    for (const tf of ['today', '7d', '14d', '30d', '90d'] as const) {
      const iso = getFromDate(tf);
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      // Must be in the past
      expect(new Date(iso!).getTime()).toBeLessThan(Date.now() + 1);
    }
  });

  it('returns a more-recent cutoff for shorter windows', () => {
    const t7 = new Date(getFromDate('7d')!).getTime();
    const t30 = new Date(getFromDate('30d')!).getTime();
    const t90 = new Date(getFromDate('90d')!).getTime();
    expect(t7).toBeGreaterThan(t30);
    expect(t30).toBeGreaterThan(t90);
  });
});

describe('formatCurrency', () => {
  it('returns em-dash for null/undefined/NaN', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency(NaN)).toBe('—');
  });

  it('formats millions with M suffix', () => {
    expect(formatCurrency(1_500_000)).toBe('$1.5M');
    expect(formatCurrency(12_000_000)).toBe('$12.0M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatCurrency(5_000)).toBe('$5K');
    expect(formatCurrency(12_345)).toBe('$12K');
  });

  it('formats small values verbatim', () => {
    expect(formatCurrency(999)).toBe('$999');
    expect(formatCurrency(0)).toBe('$0');
  });
});

describe('scorePillClass', () => {
  it('buckets by score tiers', () => {
    expect(scorePillClass(null)).toBe('bg-gray-100 text-gray-600');
    expect(scorePillClass(0)).toBe('bg-gray-100 text-gray-600');
    expect(scorePillClass(20)).toBe('bg-orange-100 text-orange-800');
    expect(scorePillClass(40)).toBe('bg-amber-100 text-amber-800');
    expect(scorePillClass(60)).toBe('bg-blue-100 text-blue-800');
    expect(scorePillClass(80)).toBe('bg-emerald-100 text-emerald-800');
    expect(scorePillClass(100)).toBe('bg-emerald-100 text-emerald-800');
  });
});

describe('initials', () => {
  it('uses first letter of each name, uppercased', () => {
    expect(initials('alice', 'smith')).toBe('AS');
    expect(initials('Bob', null)).toBe('B');
  });

  it('falls back to ? for missing first name', () => {
    expect(initials(null, null)).toBe('?');
    expect(initials(null, 'X')).toBe('?X');
  });
});

describe('sourceHref', () => {
  // Each route here must correspond to a <Route path="..."> declared in
  // src/App.tsx — otherwise dashboard clicks land on 404. Keep these literal;
  // if the routes move, these tests should fail loudly.
  it('resolves captarget sources to /admin/remarketing/leads/captarget', () => {
    expect(sourceHref('captarget')).toBe('/admin/remarketing/leads/captarget');
  });

  it('resolves gp_partners to the underscore-to-hyphen slug', () => {
    expect(sourceHref('gp_partners')).toBe('/admin/remarketing/leads/gp-partners');
  });

  it('resolves sourceco', () => {
    expect(sourceHref('sourceco')).toBe('/admin/remarketing/leads/sourceco');
  });

  it('resolves valuation_calculator to /valuation', () => {
    expect(sourceHref('valuation_calculator')).toBe('/admin/remarketing/leads/valuation');
  });

  it('resolves referral', () => {
    expect(sourceHref('referral')).toBe('/admin/remarketing/leads/referrals');
  });

  it('returns null for sources without a dedicated page', () => {
    expect(sourceHref('marketplace')).toBeNull();
    expect(sourceHref('manual')).toBeNull();
  });

  it('returns null for unknown sources (safe default)', () => {
    expect(sourceHref('unknown_source')).toBeNull();
    expect(sourceHref('')).toBeNull();
  });
});
