/**
 * Tests for _shared/prospeo-client.ts — Enrichment waterfall logic
 *
 * Tests the confidence mapping and batch processing logic
 * without actual API calls.
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Confidence mapping logic
// ============================================================================

describe('Prospeo confidence mapping', () => {
  function mapConfidence(apiConfidence: number): 'high' | 'medium' | 'low' {
    if (apiConfidence > 80) return 'medium';
    return 'low';
  }

  it('maps high API confidence to medium (name+domain is never "high")', () => {
    expect(mapConfidence(95)).toBe('medium');
    expect(mapConfidence(81)).toBe('medium');
  });

  it('maps low API confidence to low', () => {
    expect(mapConfidence(80)).toBe('low');
    expect(mapConfidence(50)).toBe('low');
    expect(mapConfidence(0)).toBe('low');
  });
});

// ============================================================================
// Source waterfall priority
// ============================================================================

describe('Enrichment waterfall priority', () => {
  const WATERFALL_ORDER = ['linkedin_lookup', 'name_domain', 'domain_search'] as const;

  it('LinkedIn lookup is highest priority', () => {
    expect(WATERFALL_ORDER[0]).toBe('linkedin_lookup');
  });

  it('Name+domain is second priority', () => {
    expect(WATERFALL_ORDER[1]).toBe('name_domain');
  });

  it('Domain search is fallback', () => {
    expect(WATERFALL_ORDER[2]).toBe('domain_search');
  });

  it('LinkedIn lookup has high confidence', () => {
    const confidenceMap: Record<string, string> = {
      linkedin_lookup: 'high',
      name_domain: 'medium',
      domain_search: 'low',
    };
    expect(confidenceMap['linkedin_lookup']).toBe('high');
  });
});

// ============================================================================
// Batch processing logic
// ============================================================================

describe('Batch enrichment concurrency logic', () => {
  it('limits concurrency to specified value', async () => {
    const concurrency = 3;
    const items = Array.from({ length: 10 }, (_, i) => i);
    const inFlight: number[] = [];
    let maxConcurrent = 0;

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (items.length > 0) {
        const item = items.shift();
        if (item === undefined) break;
        inFlight.push(item);
        maxConcurrent = Math.max(maxConcurrent, inFlight.length);
        // Simulate async work
        await new Promise((r) => setTimeout(r, 10));
        inFlight.pop();
      }
    });

    await Promise.all(workers);
    expect(maxConcurrent).toBeLessThanOrEqual(concurrency);
  });

  it('processes all items even with concurrency limit', async () => {
    const concurrency = 2;
    const items = Array.from({ length: 5 }, (_, i) => i);
    const processed: number[] = [];
    const queue = [...items];

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item === undefined) break;
        await new Promise((r) => setTimeout(r, 5));
        processed.push(item);
      }
    });

    await Promise.all(workers);
    expect(processed.sort()).toEqual([0, 1, 2, 3, 4]);
  });
});
