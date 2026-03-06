/**
 * Tests for process-buyer-enrichment-queue edge function logic
 *
 * Covers: configuration constants, circuit breaker behavior, parallel batch
 * processing semantics, result aggregation, and continuation guards.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Re-implement core configuration & logic extracted from the edge function
// so we can test the decision-making without Deno.serve.
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 3;
const PROCESSING_TIMEOUT_MS = 45000;
const RATE_LIMIT_BACKOFF_MS = 60000;
const STALE_PROCESSING_MINUTES = 2;
const MAX_FUNCTION_RUNTIME_MS = 110000;
const CONCURRENCY_LIMIT = 3;
const INTER_BATCH_DELAY_MS = 1000;
const MAX_CONTINUATIONS = 50;
const CIRCUIT_BREAKER_THRESHOLD = 3;

// Simulated result aggregation (mirrors the main loop logic)
interface BatchResult {
  outcome: 'success' | 'skipped' | 'failed' | 'rate_limited';
}

function aggregateBatchResults(results: BatchResult[]) {
  let totalSucceeded = 0;
  let totalFailed = 0;
  let totalRateLimited = 0;
  let consecutiveFailures = 0;

  for (const r of results) {
    if (r.outcome === 'success' || r.outcome === 'skipped') {
      totalSucceeded++;
      consecutiveFailures = 0;
    } else if (r.outcome === 'rate_limited') {
      totalRateLimited++;
    } else {
      totalFailed++;
      consecutiveFailures++;
    }
  }

  return { totalSucceeded, totalFailed, totalRateLimited, consecutiveFailures };
}

// Simulated continuation decision
function shouldContinue(
  remaining: number,
  continuationCount: number,
): { continue: boolean; reason?: string } {
  if (remaining === 0) return { continue: false, reason: 'queue_empty' };
  if (continuationCount >= MAX_CONTINUATIONS) {
    return { continue: false, reason: 'max_continuations' };
  }
  return { continue: true };
}

// Simulated circuit breaker check
function isCircuitBroken(consecutiveFailures: number): boolean {
  return consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD;
}

// Simulated time guard
function isTimeExpired(startTime: number, now: number): boolean {
  return now - startTime > MAX_FUNCTION_RUNTIME_MS;
}

// Simulated freshness check
function shouldSkipForFreshness(
  dataLastUpdated: string | null,
  extractionSources: Array<Record<string, unknown>> | null,
  force: boolean,
): boolean {
  if (force) return false;
  if (!dataLastUpdated) return false;

  const lastUpdatedMs = new Date(dataLastUpdated).getTime();
  const freshnessWindowMs = STALE_PROCESSING_MINUTES * 60 * 1000;
  const sources = Array.isArray(extractionSources) ? extractionSources : [];

  const hasRecentEnrichmentSource = sources.some((src) => {
    const srcType = (src.type as string) || (src.source_type as string);
    const isEnrichmentSource =
      srcType === 'platform_website' || srcType === 'pe_firm_website' || srcType === 'transcript';
    if (!isEnrichmentSource) return false;
    const srcTimestamp = (src.extracted_at as string) || (src.timestamp as string);
    if (!srcTimestamp) return false;
    return Date.now() - new Date(srcTimestamp).getTime() < freshnessWindowMs;
  });

  return Date.now() - lastUpdatedMs < freshnessWindowMs && hasRecentEnrichmentSource;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Process Buyer Enrichment Queue', () => {
  // =========================================================================
  // Configuration constants
  // =========================================================================
  describe('Configuration constants', () => {
    it('has correct concurrency limit', () => {
      expect(CONCURRENCY_LIMIT).toBe(3);
    });

    it('has correct circuit breaker threshold', () => {
      expect(CIRCUIT_BREAKER_THRESHOLD).toBe(3);
    });

    it('has extended runtime for parallel batches', () => {
      expect(MAX_FUNCTION_RUNTIME_MS).toBe(110000);
      expect(MAX_FUNCTION_RUNTIME_MS).toBeGreaterThan(100000);
    });

    it('has reasonable max attempts', () => {
      expect(MAX_ATTEMPTS).toBe(3);
    });

    it('has max continuations to prevent infinite loops', () => {
      expect(MAX_CONTINUATIONS).toBe(50);
    });

    it('has inter-batch delay for API breathing room', () => {
      expect(INTER_BATCH_DELAY_MS).toBe(1000);
    });

    it('has stale processing recovery timeout', () => {
      expect(STALE_PROCESSING_MINUTES).toBe(2);
    });

    it('has rate limit backoff', () => {
      expect(RATE_LIMIT_BACKOFF_MS).toBe(60000);
    });

    it('has per-buyer processing timeout', () => {
      expect(PROCESSING_TIMEOUT_MS).toBe(45000);
    });
  });

  // =========================================================================
  // Circuit breaker
  // =========================================================================
  describe('Circuit breaker', () => {
    it('does not trip below threshold', () => {
      expect(isCircuitBroken(0)).toBe(false);
      expect(isCircuitBroken(1)).toBe(false);
      expect(isCircuitBroken(2)).toBe(false);
    });

    it('trips at exactly the threshold', () => {
      expect(isCircuitBroken(3)).toBe(true);
    });

    it('stays tripped above threshold', () => {
      expect(isCircuitBroken(5)).toBe(true);
      expect(isCircuitBroken(100)).toBe(true);
    });
  });

  // =========================================================================
  // Batch result aggregation
  // =========================================================================
  describe('Batch result aggregation', () => {
    it('counts all successes correctly', () => {
      const results: BatchResult[] = [
        { outcome: 'success' },
        { outcome: 'success' },
        { outcome: 'success' },
      ];
      const agg = aggregateBatchResults(results);
      expect(agg.totalSucceeded).toBe(3);
      expect(agg.totalFailed).toBe(0);
      expect(agg.totalRateLimited).toBe(0);
      expect(agg.consecutiveFailures).toBe(0);
    });

    it('counts skipped as succeeded', () => {
      const results: BatchResult[] = [{ outcome: 'skipped' }, { outcome: 'success' }];
      const agg = aggregateBatchResults(results);
      expect(agg.totalSucceeded).toBe(2);
    });

    it('tracks consecutive failures correctly', () => {
      const results: BatchResult[] = [
        { outcome: 'success' },
        { outcome: 'failed' },
        { outcome: 'failed' },
        { outcome: 'failed' },
      ];
      const agg = aggregateBatchResults(results);
      expect(agg.consecutiveFailures).toBe(3);
      expect(agg.totalFailed).toBe(3);
    });

    it('resets consecutive failures on success', () => {
      const results: BatchResult[] = [
        { outcome: 'failed' },
        { outcome: 'failed' },
        { outcome: 'success' },
        { outcome: 'failed' },
      ];
      const agg = aggregateBatchResults(results);
      expect(agg.consecutiveFailures).toBe(1);
      expect(agg.totalFailed).toBe(3);
    });

    it('handles mixed results', () => {
      const results: BatchResult[] = [
        { outcome: 'success' },
        { outcome: 'failed' },
        { outcome: 'rate_limited' },
      ];
      const agg = aggregateBatchResults(results);
      expect(agg.totalSucceeded).toBe(1);
      expect(agg.totalFailed).toBe(1);
      expect(agg.totalRateLimited).toBe(1);
    });

    it('handles empty results', () => {
      const agg = aggregateBatchResults([]);
      expect(agg.totalSucceeded).toBe(0);
      expect(agg.totalFailed).toBe(0);
      expect(agg.totalRateLimited).toBe(0);
      expect(agg.consecutiveFailures).toBe(0);
    });

    it('trips circuit breaker after 3 consecutive failures', () => {
      const results: BatchResult[] = [
        { outcome: 'failed' },
        { outcome: 'failed' },
        { outcome: 'failed' },
      ];
      const agg = aggregateBatchResults(results);
      expect(isCircuitBroken(agg.consecutiveFailures)).toBe(true);
    });

    it('does not trip circuit breaker with interleaved success', () => {
      const results: BatchResult[] = [
        { outcome: 'failed' },
        { outcome: 'failed' },
        { outcome: 'success' },
        { outcome: 'failed' },
        { outcome: 'failed' },
      ];
      const agg = aggregateBatchResults(results);
      expect(isCircuitBroken(agg.consecutiveFailures)).toBe(false);
    });
  });

  // =========================================================================
  // Time guard
  // =========================================================================
  describe('Time guard', () => {
    it('returns false within runtime limit', () => {
      const start = 0;
      expect(isTimeExpired(start, 100000)).toBe(false);
    });

    it('returns true after runtime limit', () => {
      const start = 0;
      expect(isTimeExpired(start, 110001)).toBe(true);
    });

    it('returns false at exactly the limit', () => {
      const start = 0;
      expect(isTimeExpired(start, 110000)).toBe(false);
    });
  });

  // =========================================================================
  // Continuation guard
  // =========================================================================
  describe('Continuation guard', () => {
    it('continues when items remain and under limit', () => {
      const result = shouldContinue(10, 0);
      expect(result.continue).toBe(true);
    });

    it('stops when no items remain', () => {
      const result = shouldContinue(0, 5);
      expect(result.continue).toBe(false);
      expect(result.reason).toBe('queue_empty');
    });

    it('stops at max continuations', () => {
      const result = shouldContinue(10, 50);
      expect(result.continue).toBe(false);
      expect(result.reason).toBe('max_continuations');
    });

    it('continues at one below max', () => {
      const result = shouldContinue(10, 49);
      expect(result.continue).toBe(true);
    });
  });

  // =========================================================================
  // Freshness check (BUG-7 fix)
  // =========================================================================
  describe('Freshness check', () => {
    it('does not skip when force is true', () => {
      const result = shouldSkipForFreshness(
        new Date().toISOString(),
        [{ type: 'platform_website', extracted_at: new Date().toISOString() }],
        true,
      );
      expect(result).toBe(false);
    });

    it('does not skip when no data_last_updated', () => {
      const result = shouldSkipForFreshness(null, null, false);
      expect(result).toBe(false);
    });

    it('does not skip when data is old', () => {
      const oldDate = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
      const result = shouldSkipForFreshness(
        oldDate,
        [{ type: 'platform_website', extracted_at: oldDate }],
        false,
      );
      expect(result).toBe(false);
    });

    it('skips when data is fresh with enrichment source', () => {
      const now = new Date().toISOString();
      const result = shouldSkipForFreshness(
        now,
        [{ type: 'platform_website', extracted_at: now }],
        false,
      );
      expect(result).toBe(true);
    });

    it('does not skip when recent but non-enrichment source', () => {
      const now = new Date().toISOString();
      const result = shouldSkipForFreshness(
        now,
        [{ type: 'manual_edit', extracted_at: now }],
        false,
      );
      expect(result).toBe(false);
    });

    it('does not skip when recent enrichment source but old data_last_updated', () => {
      const oldDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      const result = shouldSkipForFreshness(
        oldDate,
        [{ type: 'platform_website', extracted_at: now }],
        false,
      );
      expect(result).toBe(false);
    });

    it('handles source_type alias', () => {
      const now = new Date().toISOString();
      const result = shouldSkipForFreshness(
        now,
        [{ source_type: 'pe_firm_website', timestamp: now }],
        false,
      );
      expect(result).toBe(true);
    });

    it('handles transcript source type', () => {
      const now = new Date().toISOString();
      const result = shouldSkipForFreshness(
        now,
        [{ type: 'transcript', extracted_at: now }],
        false,
      );
      expect(result).toBe(true);
    });

    it('handles empty extraction sources array', () => {
      const now = new Date().toISOString();
      const result = shouldSkipForFreshness(now, [], false);
      expect(result).toBe(false);
    });

    it('handles null extraction sources', () => {
      const now = new Date().toISOString();
      const result = shouldSkipForFreshness(now, null, false);
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // Parallel batch size
  // =========================================================================
  describe('Parallel batch processing', () => {
    it('processes CONCURRENCY_LIMIT items per batch', () => {
      // Simulate fetching a batch
      const allItems = Array.from({ length: 10 }, (_, i) => ({ id: `item-${i}` }));
      const batch = allItems.slice(0, CONCURRENCY_LIMIT);
      expect(batch).toHaveLength(3);
    });

    it('handles partial last batch', () => {
      const allItems = Array.from({ length: 5 }, (_, i) => ({ id: `item-${i}` }));
      // First batch: 3 items, second batch: 2 items
      const batch1 = allItems.slice(0, CONCURRENCY_LIMIT);
      const batch2 = allItems.slice(CONCURRENCY_LIMIT, CONCURRENCY_LIMIT * 2);
      expect(batch1).toHaveLength(3);
      expect(batch2).toHaveLength(2);
    });

    it('handles single item batch', () => {
      const allItems = [{ id: 'item-0' }];
      const batch = allItems.slice(0, CONCURRENCY_LIMIT);
      expect(batch).toHaveLength(1);
    });
  });
});
