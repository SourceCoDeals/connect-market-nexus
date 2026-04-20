/**
 * Regression tests for `_shared/contact-confidence.ts`, which normalizes
 * provider-supplied confidence labels to the canonical set accepted by the
 * `public.contacts.confidence` CHECK constraint.
 *
 * Background: Clay / Blitz / Serper / find-contacts callers pass 'high' /
 * 'medium' / 'low' into `p_enrichment.confidence`. `contacts.confidence` is
 * CHECK-constrained to ('verified','likely','guessed','unverified') so those
 * raw values tripped the CHECK and every enrichment upsert silently failed.
 */

import { describe, it, expect } from 'vitest';
import { normalizeConfidence, normalizeEnrichmentConfidence } from './contact-confidence.ts';

describe('normalizeConfidence', () => {
  it('maps Clay / Blitz "high" to canonical "verified"', () => {
    expect(normalizeConfidence('high')).toBe('verified');
  });

  it('maps Clay / Blitz "medium" to canonical "likely"', () => {
    expect(normalizeConfidence('medium')).toBe('likely');
  });

  it('maps Clay / Blitz "low" to canonical "guessed"', () => {
    expect(normalizeConfidence('low')).toBe('guessed');
  });

  it('passes canonical values through unchanged', () => {
    expect(normalizeConfidence('verified')).toBe('verified');
    expect(normalizeConfidence('likely')).toBe('likely');
    expect(normalizeConfidence('guessed')).toBe('guessed');
    expect(normalizeConfidence('unverified')).toBe('unverified');
  });

  it('is case-insensitive', () => {
    expect(normalizeConfidence('HIGH')).toBe('verified');
    expect(normalizeConfidence('Medium')).toBe('likely');
  });

  it('trims whitespace', () => {
    expect(normalizeConfidence('  high  ')).toBe('verified');
  });

  it('maps provider synonyms', () => {
    expect(normalizeConfidence('confirmed')).toBe('verified');
    expect(normalizeConfidence('strong')).toBe('verified');
    expect(normalizeConfidence('moderate')).toBe('likely');
    expect(normalizeConfidence('probable')).toBe('likely');
    expect(normalizeConfidence('weak')).toBe('guessed');
    expect(normalizeConfidence('suspect')).toBe('guessed');
  });

  it('falls back to "unverified" for null / undefined / empty / unknown', () => {
    expect(normalizeConfidence(null)).toBe('unverified');
    expect(normalizeConfidence(undefined)).toBe('unverified');
    expect(normalizeConfidence('')).toBe('unverified');
    expect(normalizeConfidence('🤷')).toBe('unverified');
    expect(normalizeConfidence(42)).toBe('unverified');
    expect(normalizeConfidence({ unexpected: 'object' })).toBe('unverified');
  });

  it('produces a value that is always in the canonical CHECK set', () => {
    const CANONICAL = new Set(['verified', 'likely', 'guessed', 'unverified']);
    const probes = [
      null,
      undefined,
      '',
      'high',
      'medium',
      'low',
      'verified',
      'likely',
      'guessed',
      'unverified',
      'wat',
      0,
      {},
      [],
    ];
    for (const p of probes) {
      expect(CANONICAL.has(normalizeConfidence(p))).toBe(true);
    }
  });
});

describe('normalizeEnrichmentConfidence', () => {
  it('returns the object with confidence normalized, preserving other keys', () => {
    const input = {
      provider: 'clay_linkedin',
      confidence: 'high',
      source_query: 'clay:abc',
    };
    const out = normalizeEnrichmentConfidence(input);
    expect(out).toEqual({
      provider: 'clay_linkedin',
      confidence: 'verified',
      source_query: 'clay:abc',
    });
  });

  it('passes through null / undefined unchanged', () => {
    expect(normalizeEnrichmentConfidence(null)).toBe(null);
    expect(normalizeEnrichmentConfidence(undefined)).toBe(undefined);
  });

  it('defaults to "unverified" when confidence key is absent', () => {
    const out = normalizeEnrichmentConfidence({ provider: 'x' });
    expect(out).toEqual({ provider: 'x', confidence: 'unverified' });
  });
});
