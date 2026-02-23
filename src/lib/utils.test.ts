import { describe, it, expect } from 'vitest';
import { cn, formatCompactCurrency } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('handles conditional class names', () => {
    // eslint-disable-next-line no-constant-binary-expression
    const result = cn('base', false && 'hidden', 'visible');
    expect(result).toBe('base visible');
  });

  it('merges tailwind classes correctly', () => {
    const result = cn('p-4', 'p-2');
    expect(result).toBe('p-2');
  });

  it('handles undefined and null inputs', () => {
    const result = cn('base', undefined, null);
    expect(result).toBe('base');
  });

  it('handles empty input', () => {
    const result = cn();
    expect(result).toBe('');
  });
});

describe('formatCompactCurrency', () => {
  it('formats millions correctly', () => {
    expect(formatCompactCurrency(1000000)).toBe('$1.0M');
    expect(formatCompactCurrency(5500000)).toBe('$5.5M');
    expect(formatCompactCurrency(10000000)).toBe('$10.0M');
  });

  it('formats thousands correctly', () => {
    expect(formatCompactCurrency(1000)).toBe('$1K');
    expect(formatCompactCurrency(50000)).toBe('$50K');
    expect(formatCompactCurrency(999000)).toBe('$999K');
  });

  it('formats values under 1000', () => {
    expect(formatCompactCurrency(0)).toBe('$0');
    expect(formatCompactCurrency(500)).toBe('$500');
    expect(formatCompactCurrency(999)).toBe('$999');
  });

  it('handles exact boundary values', () => {
    expect(formatCompactCurrency(999)).toBe('$999');
    expect(formatCompactCurrency(1000)).toBe('$1K');
    expect(formatCompactCurrency(999999)).toBe('$1000K');
    expect(formatCompactCurrency(1000000)).toBe('$1.0M');
  });
});
