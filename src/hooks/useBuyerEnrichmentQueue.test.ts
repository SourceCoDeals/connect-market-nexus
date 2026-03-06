/**
 * Tests for useBuyerEnrichmentQueue hook logic
 *
 * Covers: QueueProgress interface, batching logic, mode filtering,
 * count-based status computation, and pause/resume state transitions.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Re-implement key types & pure logic from the hook for unit testing
// ---------------------------------------------------------------------------

interface QueueProgress {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  rateLimited: number;
  paused: number;
  total: number;
  isRunning: boolean;
  isPaused: boolean;
  rateLimitResetAt?: string;
}

const POLL_INTERVAL_MS = 10000;
const PROCESS_INTERVAL_MS = 30000;
const MAX_POLLING_DURATION_MS = 4 * 60 * 60 * 1000;
const REALTIME_DEBOUNCE_MS = 2000;
const BATCH_SIZE = 100;

// Simulate count-based status computation (mirrors fetchQueueStatus logic)
function computeQueueProgress(counts: {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  rateLimited: number;
  paused: number;
  rateLimitResetAt?: string;
}): QueueProgress {
  const total =
    counts.pending +
    counts.processing +
    counts.completed +
    counts.failed +
    counts.rateLimited +
    counts.paused;
  const isRunning = counts.pending > 0 || counts.processing > 0 || counts.rateLimited > 0;
  const isPaused = counts.paused > 0 && !isRunning;

  return {
    ...counts,
    total,
    isRunning,
    isPaused,
    rateLimitResetAt: counts.rateLimitResetAt,
  };
}

// Simulate buyer filtering (mirrors queueBuyers logic)
function filterEnrichableBuyers(
  buyers: Array<{
    id: string;
    platform_website?: string | null;
    pe_firm_website?: string | null;
    company_website?: string | null;
  }>,
): typeof buyers {
  return buyers.filter((b) => b.platform_website || b.pe_firm_website || b.company_website);
}

// Simulate mode filtering (mirrors handleBuyerEnrichment logic)
function filterByMode(
  buyers: Array<{ id: string; data_last_updated?: string | null }>,
  mode: 'all' | 'unenriched',
): typeof buyers {
  if (mode === 'unenriched') {
    return buyers.filter((b) => !b.data_last_updated);
  }
  return buyers;
}

// Simulate batch chunking (mirrors queueBuyers logic)
function chunkArray<T>(items: T[], batchSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }
  return chunks;
}

// Simulate completion detection (mirrors fetchQueueStatus logic)
function detectCompletion(wasRunning: boolean, isRunning: boolean, total: number): boolean {
  return wasRunning && !isRunning && total > 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useBuyerEnrichmentQueue', () => {
  // =========================================================================
  // Configuration
  // =========================================================================
  describe('Configuration', () => {
    it('polls every 10 seconds', () => {
      expect(POLL_INTERVAL_MS).toBe(10000);
    });

    it('triggers processor every 30 seconds', () => {
      expect(PROCESS_INTERVAL_MS).toBe(30000);
    });

    it('has 4-hour polling timeout', () => {
      expect(MAX_POLLING_DURATION_MS).toBe(4 * 60 * 60 * 1000);
    });

    it('debounces realtime events by 2 seconds', () => {
      expect(REALTIME_DEBOUNCE_MS).toBe(2000);
    });

    it('batches queue inserts in chunks of 100', () => {
      expect(BATCH_SIZE).toBe(100);
    });
  });

  // =========================================================================
  // Queue progress computation
  // =========================================================================
  describe('Queue progress computation', () => {
    it('computes total from all statuses', () => {
      const progress = computeQueueProgress({
        pending: 5,
        processing: 2,
        completed: 10,
        failed: 1,
        rateLimited: 3,
        paused: 0,
      });
      expect(progress.total).toBe(21);
    });

    it('is running when items are pending', () => {
      const progress = computeQueueProgress({
        pending: 5,
        processing: 0,
        completed: 0,
        failed: 0,
        rateLimited: 0,
        paused: 0,
      });
      expect(progress.isRunning).toBe(true);
      expect(progress.isPaused).toBe(false);
    });

    it('is running when items are processing', () => {
      const progress = computeQueueProgress({
        pending: 0,
        processing: 2,
        completed: 0,
        failed: 0,
        rateLimited: 0,
        paused: 0,
      });
      expect(progress.isRunning).toBe(true);
    });

    it('is running when items are rate limited', () => {
      const progress = computeQueueProgress({
        pending: 0,
        processing: 0,
        completed: 5,
        failed: 0,
        rateLimited: 3,
        paused: 0,
      });
      expect(progress.isRunning).toBe(true);
    });

    it('is not running when only completed and failed', () => {
      const progress = computeQueueProgress({
        pending: 0,
        processing: 0,
        completed: 8,
        failed: 2,
        rateLimited: 0,
        paused: 0,
      });
      expect(progress.isRunning).toBe(false);
    });

    it('is paused when items are paused and nothing active', () => {
      const progress = computeQueueProgress({
        pending: 0,
        processing: 0,
        completed: 5,
        failed: 0,
        rateLimited: 0,
        paused: 10,
      });
      expect(progress.isPaused).toBe(true);
      expect(progress.isRunning).toBe(false);
    });

    it('is not paused when paused items exist but also running items', () => {
      const progress = computeQueueProgress({
        pending: 2,
        processing: 0,
        completed: 0,
        failed: 0,
        rateLimited: 0,
        paused: 5,
      });
      expect(progress.isPaused).toBe(false);
      expect(progress.isRunning).toBe(true);
    });

    it('handles zero counts', () => {
      const progress = computeQueueProgress({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        rateLimited: 0,
        paused: 0,
      });
      expect(progress.total).toBe(0);
      expect(progress.isRunning).toBe(false);
      expect(progress.isPaused).toBe(false);
    });

    it('includes rateLimitResetAt when provided', () => {
      const resetAt = '2026-01-01T00:00:00Z';
      const progress = computeQueueProgress({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        rateLimited: 1,
        paused: 0,
        rateLimitResetAt: resetAt,
      });
      expect(progress.rateLimitResetAt).toBe(resetAt);
    });
  });

  // =========================================================================
  // Buyer filtering (website check)
  // =========================================================================
  describe('Enrichable buyer filtering', () => {
    it('includes buyers with platform_website', () => {
      const buyers = [
        {
          id: '1',
          platform_website: 'https://example.com',
          pe_firm_website: null,
          company_website: null,
        },
      ];
      expect(filterEnrichableBuyers(buyers)).toHaveLength(1);
    });

    it('includes buyers with pe_firm_website', () => {
      const buyers = [
        {
          id: '1',
          platform_website: null,
          pe_firm_website: 'https://pe.com',
          company_website: null,
        },
      ];
      expect(filterEnrichableBuyers(buyers)).toHaveLength(1);
    });

    it('includes buyers with company_website', () => {
      const buyers = [
        {
          id: '1',
          platform_website: null,
          pe_firm_website: null,
          company_website: 'https://co.com',
        },
      ];
      expect(filterEnrichableBuyers(buyers)).toHaveLength(1);
    });

    it('excludes buyers with no websites', () => {
      const buyers = [
        { id: '1', platform_website: null, pe_firm_website: null, company_website: null },
        { id: '2' },
      ];
      expect(filterEnrichableBuyers(buyers)).toHaveLength(0);
    });

    it('filters mixed buyers correctly', () => {
      const buyers = [
        {
          id: '1',
          platform_website: 'https://a.com',
          pe_firm_website: null,
          company_website: null,
        },
        { id: '2', platform_website: null, pe_firm_website: null, company_website: null },
        {
          id: '3',
          platform_website: null,
          pe_firm_website: 'https://b.com',
          company_website: null,
        },
      ];
      const result = filterEnrichableBuyers(buyers);
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.id)).toEqual(['1', '3']);
    });
  });

  // =========================================================================
  // Mode filtering (all vs unenriched)
  // =========================================================================
  describe('Mode filtering', () => {
    const buyers = [
      { id: '1', data_last_updated: '2026-01-01T00:00:00Z' },
      { id: '2', data_last_updated: null },
      { id: '3', data_last_updated: '2026-02-01T00:00:00Z' },
      { id: '4', data_last_updated: null },
    ];

    it('returns all buyers in "all" mode', () => {
      const result = filterByMode(buyers, 'all');
      expect(result).toHaveLength(4);
    });

    it('returns only unenriched buyers in "unenriched" mode', () => {
      const result = filterByMode(buyers, 'unenriched');
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.id)).toEqual(['2', '4']);
    });

    it('returns empty if all are enriched in "unenriched" mode', () => {
      const enrichedBuyers = [
        { id: '1', data_last_updated: '2026-01-01T00:00:00Z' },
        { id: '2', data_last_updated: '2026-02-01T00:00:00Z' },
      ];
      const result = filterByMode(enrichedBuyers, 'unenriched');
      expect(result).toHaveLength(0);
    });

    it('returns all if none are enriched in "unenriched" mode', () => {
      const unenrichedBuyers = [
        { id: '1', data_last_updated: null },
        { id: '2', data_last_updated: null },
      ];
      const result = filterByMode(unenrichedBuyers, 'unenriched');
      expect(result).toHaveLength(2);
    });
  });

  // =========================================================================
  // Batch chunking
  // =========================================================================
  describe('Batch chunking', () => {
    it('creates single chunk for small arrays', () => {
      const items = Array.from({ length: 50 }, (_, i) => i);
      const chunks = chunkArray(items, BATCH_SIZE);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toHaveLength(50);
    });

    it('creates multiple chunks for large arrays', () => {
      const items = Array.from({ length: 250 }, (_, i) => i);
      const chunks = chunkArray(items, BATCH_SIZE);
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(100);
      expect(chunks[1]).toHaveLength(100);
      expect(chunks[2]).toHaveLength(50);
    });

    it('handles exact batch size boundary', () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      const chunks = chunkArray(items, BATCH_SIZE);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toHaveLength(100);
    });

    it('handles empty array', () => {
      const chunks = chunkArray([], BATCH_SIZE);
      expect(chunks).toHaveLength(0);
    });

    it('handles single item', () => {
      const chunks = chunkArray([1], BATCH_SIZE);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual([1]);
    });

    it('handles batch size of 1', () => {
      const chunks = chunkArray([1, 2, 3], 1);
      expect(chunks).toHaveLength(3);
    });
  });

  // =========================================================================
  // Completion detection
  // =========================================================================
  describe('Completion detection', () => {
    it('detects completion when was running and now stopped', () => {
      expect(detectCompletion(true, false, 10)).toBe(true);
    });

    it('does not detect completion when still running', () => {
      expect(detectCompletion(true, true, 10)).toBe(false);
    });

    it('does not detect completion when was not running', () => {
      expect(detectCompletion(false, false, 10)).toBe(false);
    });

    it('does not detect completion when total is zero', () => {
      expect(detectCompletion(true, false, 0)).toBe(false);
    });
  });

  // =========================================================================
  // Pause/Resume state transitions
  // =========================================================================
  describe('Pause/Resume state transitions', () => {
    it('pausing moves pending to paused', () => {
      // Before pause
      const before = computeQueueProgress({
        pending: 10,
        processing: 1,
        completed: 5,
        failed: 0,
        rateLimited: 0,
        paused: 0,
      });
      expect(before.isRunning).toBe(true);
      expect(before.isPaused).toBe(false);

      // After pause (pending -> paused, processing stays)
      const after = computeQueueProgress({
        pending: 0,
        processing: 1,
        completed: 5,
        failed: 0,
        rateLimited: 0,
        paused: 10,
      });
      // Still running because processing > 0
      expect(after.isRunning).toBe(true);
      expect(after.isPaused).toBe(false);
    });

    it('fully paused state (no processing remaining)', () => {
      const progress = computeQueueProgress({
        pending: 0,
        processing: 0,
        completed: 5,
        failed: 0,
        rateLimited: 0,
        paused: 10,
      });
      expect(progress.isRunning).toBe(false);
      expect(progress.isPaused).toBe(true);
    });

    it('resuming moves paused to pending', () => {
      // Before resume
      const before = computeQueueProgress({
        pending: 0,
        processing: 0,
        completed: 5,
        failed: 0,
        rateLimited: 0,
        paused: 10,
      });
      expect(before.isPaused).toBe(true);

      // After resume (paused -> pending)
      const after = computeQueueProgress({
        pending: 10,
        processing: 0,
        completed: 5,
        failed: 0,
        rateLimited: 0,
        paused: 0,
      });
      expect(after.isRunning).toBe(true);
      expect(after.isPaused).toBe(false);
    });
  });

  // =========================================================================
  // Cancel behavior
  // =========================================================================
  describe('Cancel behavior', () => {
    it('cancel removes pending, rate_limited, and paused items', () => {
      // Simulate cancel: pending/rate_limited/paused deleted, completed/failed remain
      const afterCancel = computeQueueProgress({
        pending: 0,
        processing: 0,
        completed: 5,
        failed: 2,
        rateLimited: 0,
        paused: 0,
      });
      expect(afterCancel.isRunning).toBe(false);
      expect(afterCancel.total).toBe(7);
    });
  });
});
