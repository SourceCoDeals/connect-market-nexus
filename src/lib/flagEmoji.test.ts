import { describe, it, expect } from 'vitest';
import { countryCodeToFlag, getCountryCode, getFlagFromCountryName } from './flagEmoji';

describe('countryCodeToFlag', () => {
  it('converts US country code to flag emoji', () => {
    const result = countryCodeToFlag('US');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('converts lowercase country codes', () => {
    const result = countryCodeToFlag('us');
    expect(result).toBeTruthy();
  });

  it('returns globe emoji for null', () => {
    expect(countryCodeToFlag(null)).toBe('\u{1F30D}');
  });

  it('returns globe emoji for invalid codes', () => {
    expect(countryCodeToFlag('INVALID')).toBe('\u{1F30D}');
    expect(countryCodeToFlag('X')).toBe('\u{1F30D}');
    expect(countryCodeToFlag('')).toBe('\u{1F30D}');
  });

  it('handles two-character codes correctly', () => {
    const usFlag = countryCodeToFlag('US');
    const gbFlag = countryCodeToFlag('GB');
    expect(usFlag).not.toBe(gbFlag);
  });
});

describe('getCountryCode', () => {
  it('returns country code for known country names', () => {
    expect(getCountryCode('United States')).toBe('US');
    expect(getCountryCode('United Kingdom')).toBe('GB');
    expect(getCountryCode('Germany')).toBe('DE');
    expect(getCountryCode('France')).toBe('FR');
    expect(getCountryCode('Canada')).toBe('CA');
  });

  it('returns null for unknown countries', () => {
    expect(getCountryCode('Atlantis')).toBeNull();
    expect(getCountryCode('Unknown')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getCountryCode(null)).toBeNull();
  });
});

describe('getFlagFromCountryName', () => {
  it('returns flag for known country names', () => {
    const usFlag = getFlagFromCountryName('United States');
    expect(usFlag).toBeTruthy();
    expect(typeof usFlag).toBe('string');
  });

  it('returns globe emoji for unknown countries', () => {
    expect(getFlagFromCountryName('Atlantis')).toBe('\u{1F30D}');
  });

  it('returns globe emoji for null', () => {
    expect(getFlagFromCountryName(null)).toBe('\u{1F30D}');
  });
});
