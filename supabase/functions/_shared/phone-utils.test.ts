import { describe, it, expect } from 'vitest';
import { normalizePhone, isValidPhone, collectPhones, pickDialerPhones } from './phone-utils';

describe('normalizePhone', () => {
  it('strips non-digit formatting characters', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('5551234567');
    expect(normalizePhone('555.123.4567')).toBe('5551234567');
    expect(normalizePhone('+1 555 123 4567')).toBe('5551234567');
  });

  it('strips a leading 1 on 11-digit US numbers', () => {
    expect(normalizePhone('1-555-123-4567')).toBe('5551234567');
    expect(normalizePhone('15551234567')).toBe('5551234567');
  });

  it('keeps leading digits that are not a US country code', () => {
    // 12-digit international number — do not strip leading 1
    expect(normalizePhone('442071234567')).toBe('442071234567');
  });

  it('returns null for empty / whitespace / non-digit input', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
});

describe('isValidPhone', () => {
  it('accepts numbers between 7 and 15 digits after normalization', () => {
    expect(isValidPhone('555-1234')).toBe(true); // 7 digits
    expect(isValidPhone('5551234567')).toBe(true); // 10 digits
    expect(isValidPhone('1-555-123-4567')).toBe(true); // 11 digits → 10 after strip
    expect(isValidPhone('+44 20 7123 4567')).toBe(true); // 12 digits
  });

  it('rejects numbers shorter than 7 digits', () => {
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone(null)).toBe(false);
  });

  it('rejects numbers longer than 15 digits', () => {
    expect(isValidPhone('1234567890123456')).toBe(false);
  });
});

describe('collectPhones', () => {
  it('returns all populated phone fields as normalized digits', () => {
    const phones = collectPhones({
      mobile_phone_1: '(555) 111-1111',
      mobile_phone_2: '555-222-2222',
      mobile_phone_3: null,
      office_phone: '555.333.3333',
      phone: null,
    });
    expect(phones).toEqual(['5551111111', '5552222222', '5553333333']);
  });

  it('de-duplicates by normalized value', () => {
    const phones = collectPhones({
      mobile_phone_1: '(555) 111-1111',
      mobile_phone_2: '1-555-111-1111', // same number, different format
      mobile_phone_3: null,
      office_phone: null,
      phone: '5551111111',
    });
    expect(phones).toEqual(['5551111111']);
  });

  it('returns an empty array when no phones are set', () => {
    expect(collectPhones({})).toEqual([]);
    expect(
      collectPhones({
        mobile_phone_1: null,
        mobile_phone_2: '',
        mobile_phone_3: undefined,
        office_phone: null,
        phone: null,
      }),
    ).toEqual([]);
  });
});

describe('pickDialerPhones', () => {
  it('returns normalized phones in priority order (mobile → office → legacy)', () => {
    const [p1, p2, p3] = pickDialerPhones({
      mobile_phone_1: '(555) 111-1111',
      mobile_phone_2: '555-222-2222',
      mobile_phone_3: '555-333-3333',
      office_phone: '555.444.4444',
      phone: '555-555-5555',
    });
    // mobile_phone_1, mobile_phone_2, mobile_phone_3 fill the three slots;
    // office_phone and phone are not reached because dedup picks the first 3.
    expect(p1).toBe('5551111111');
    expect(p2).toBe('5552222222');
    expect(p3).toBe('5553333333');
  });

  it('falls back to office_phone and phone when mobiles are sparse', () => {
    const [p1, p2, p3] = pickDialerPhones({
      mobile_phone_1: '555-111-1111',
      mobile_phone_2: null,
      mobile_phone_3: null,
      office_phone: '555-222-2222',
      phone: '555-333-3333',
    });
    expect(p1).toBe('5551111111');
    expect(p2).toBe('5552222222');
    expect(p3).toBe('5553333333');
  });

  it('always returns normalized values so the PhoneBurner payload and local cache agree', () => {
    const [p1, p2, p3] = pickDialerPhones({
      mobile_phone_1: '+1 (555) 123-4567',
      mobile_phone_2: '(555) 987.6543',
      mobile_phone_3: null,
      office_phone: null,
      phone: null,
    });
    // Regression guard: the previous version leaked the raw formatted value
    // for phone2 / phone3, which drifted from the collectPhones() cache.
    expect(p1).toBe('5551234567');
    expect(p2).toBe('5559876543');
    expect(p3).toBeNull();
  });

  it('de-duplicates across structured fields', () => {
    const [p1, p2, p3] = pickDialerPhones({
      mobile_phone_1: '(555) 111-1111',
      mobile_phone_2: '1-555-111-1111', // duplicate of mobile_phone_1 after normalization
      mobile_phone_3: '555-222-2222',
      office_phone: null,
      phone: null,
    });
    expect(p1).toBe('5551111111');
    expect(p2).toBe('5552222222');
    expect(p3).toBeNull();
  });

  it('returns nulls when no phones are present', () => {
    expect(pickDialerPhones({})).toEqual([null, null, null]);
  });
});
