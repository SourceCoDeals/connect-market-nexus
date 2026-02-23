import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentUTMParams, getFirstTouchAttribution, getFullAttribution } from './use-utm-params';

describe('getCurrentUTMParams', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns empty object when no params stored', () => {
    const params = getCurrentUTMParams();
    expect(params).toEqual({});
  });

  it('returns stored params when not expired', () => {
    const utmData = {
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'summer2024',
    };
    const futureExpiry = Date.now() + 30 * 60 * 1000; // 30 minutes from now

    sessionStorage.setItem('utm_params', JSON.stringify(utmData));
    sessionStorage.setItem('utm_expiry', futureExpiry.toString());

    const params = getCurrentUTMParams();
    expect(params).toEqual(utmData);
  });

  it('returns empty object when params are expired', () => {
    const utmData = { utm_source: 'google' };
    const pastExpiry = Date.now() - 1000; // 1 second ago

    sessionStorage.setItem('utm_params', JSON.stringify(utmData));
    sessionStorage.setItem('utm_expiry', pastExpiry.toString());

    const params = getCurrentUTMParams();
    expect(params).toEqual({});
  });

  it('clears expired params from storage', () => {
    const utmData = { utm_source: 'google' };
    const pastExpiry = Date.now() - 1000;

    sessionStorage.setItem('utm_params', JSON.stringify(utmData));
    sessionStorage.setItem('utm_expiry', pastExpiry.toString());

    getCurrentUTMParams();

    expect(sessionStorage.getItem('utm_params')).toBeNull();
    expect(sessionStorage.getItem('utm_expiry')).toBeNull();
  });
});

describe('getFirstTouchAttribution', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty object when no first-touch data exists', () => {
    const result = getFirstTouchAttribution();
    expect(result).toEqual({});
  });

  it('returns stored first-touch data', () => {
    const firstTouchData = {
      first_touch_source: 'google',
      first_touch_medium: 'organic',
      landing_page: '/home',
    };
    localStorage.setItem('first_touch_utm', JSON.stringify(firstTouchData));

    const result = getFirstTouchAttribution();
    expect(result).toEqual(firstTouchData);
  });

  it('handles malformed JSON gracefully', () => {
    localStorage.setItem('first_touch_utm', 'not-json');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = getFirstTouchAttribution();
    expect(result).toEqual({});

    consoleSpy.mockRestore();
  });
});

describe('getFullAttribution', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('returns combined attribution data', () => {
    const firstTouchData = {
      first_touch_source: 'google',
      landing_page: '/home',
      landing_referrer: 'https://google.com',
    };
    localStorage.setItem('first_touch_utm', JSON.stringify(firstTouchData));

    const utmData = { utm_source: 'facebook', utm_medium: 'social' };
    const futureExpiry = Date.now() + 30 * 60 * 1000;
    sessionStorage.setItem('utm_params', JSON.stringify(utmData));
    sessionStorage.setItem('utm_expiry', futureExpiry.toString());

    const result = getFullAttribution();
    expect(result.firstTouch.first_touch_source).toBe('google');
    expect(result.lastTouch.utm_source).toBe('facebook');
    expect(result.landingPage).toBe('/home');
    expect(result.originalReferrer).toBe('https://google.com');
  });

  it('handles missing data gracefully', () => {
    const result = getFullAttribution();
    expect(result.firstTouch).toEqual({});
    expect(result.lastTouch).toEqual({});
    expect(result.landingPage).toBeNull();
    expect(result.originalReferrer).toBeNull();
  });
});
