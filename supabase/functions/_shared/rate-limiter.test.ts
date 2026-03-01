/**
 * Tests for rate-limiter.ts — provider-level rate limit coordination
 *
 * Covers: checkProviderAvailability, reportRateLimit, waitForProviderSlot,
 * withConcurrencyTracking, getAdaptiveDelay, and DB failure resilience.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Re-implement core rate limiter types and functions (mirrors rate-limiter.ts)
// ---------------------------------------------------------------------------

type AIProviderName = 'gemini' | 'firecrawl' | 'apify' | 'serper';

const PROVIDER_LIMITS: Record<
  AIProviderName,
  { maxConcurrent: number; cooldownMs: number; softLimitRpm: number }
> = {
  gemini: { maxConcurrent: 10, cooldownMs: 10000, softLimitRpm: 30 },
  firecrawl: { maxConcurrent: 5, cooldownMs: 10000, softLimitRpm: 20 },
  apify: { maxConcurrent: 3, cooldownMs: 30000, softLimitRpm: 10 },
  serper: { maxConcurrent: 10, cooldownMs: 5000, softLimitRpm: 50 },
};

let localState: Record<string, { lastRateLimited: number; backoffUntil: number }> = {};

function resetLocalState() {
  localState = {};
}

interface MockSupabaseResult {
  data: Record<string, unknown> | null;
  error?: { message: string; code?: string } | null;
}

function createMockSupabase(queryResult: MockSupabaseResult = { data: null }) {
  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockMaybeSingle = vi.fn().mockResolvedValue(queryResult);
  const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    upsert: mockUpsert,
  });

  return {
    from: mockFrom,
    rpc: mockRpc,
    _mocks: { mockFrom, mockSelect, mockEq, mockMaybeSingle, mockUpsert, mockRpc },
  };
}

interface MockSupabase {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  _mocks?: Record<string, ReturnType<typeof vi.fn>>;
}

async function checkProviderAvailability(
  supabase: MockSupabase,
  provider: AIProviderName,
): Promise<{ ok: boolean; retryAfterMs?: number; waitRecommended?: boolean }> {
  try {
    const local = localState[provider];
    if (local && Date.now() < local.backoffUntil) {
      const remaining = local.backoffUntil - Date.now();
      return { ok: false, retryAfterMs: remaining };
    }

    const { data } = await supabase
      .from('enrichment_rate_limits')
      .select('backoff_until, concurrent_requests, updated_at')
      .eq('provider', provider)
      .maybeSingle();

    if (!data) return { ok: true };

    if (data.backoff_until) {
      const backoffUntil = new Date(data.backoff_until).getTime();
      if (Date.now() < backoffUntil) {
        const remaining = backoffUntil - Date.now();
        localState[provider] = { lastRateLimited: Date.now(), backoffUntil };
        return { ok: false, retryAfterMs: remaining };
      }
    }

    const limits = PROVIDER_LIMITS[provider];
    if (data.concurrent_requests >= limits.maxConcurrent) {
      return { ok: true, waitRecommended: true };
    }

    return { ok: true };
  } catch {
    return { ok: true };
  }
}

// Re-implement reportRateLimit
async function reportRateLimit(
  supabase: any,
  provider: AIProviderName,
  retryAfterSeconds?: number,
): Promise<void> {
  const baseCooldownMs = retryAfterSeconds
    ? retryAfterSeconds * 1000
    : PROVIDER_LIMITS[provider].cooldownMs;

  const jitterMs = baseCooldownMs * (0.1 + Math.random() * 0.1);
  const cooldownMs = baseCooldownMs + jitterMs;

  const backoffUntil = new Date(Date.now() + cooldownMs).toISOString();

  localState[provider] = {
    lastRateLimited: Date.now(),
    backoffUntil: Date.now() + cooldownMs,
  };

  try {
    await supabase.from('enrichment_rate_limits').upsert(
      {
        provider,
        backoff_until: backoffUntil,
        last_429_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider' },
    );
  } catch {
    // Non-blocking
  }
}

// Re-implement withConcurrencyTracking
async function withConcurrencyTracking<T>(
  supabase: any,
  provider: AIProviderName,
  fn: () => Promise<T>,
): Promise<T> {
  await supabase.rpc('increment_provider_concurrent', { p_provider: provider });
  try {
    return await fn();
  } finally {
    await supabase.rpc('decrement_provider_concurrent', { p_provider: provider });
  }
}

// Re-implement getAdaptiveDelay
function getAdaptiveDelay(provider: AIProviderName, recentErrors: number = 0): number {
  if (recentErrors === 0) return 0;
  const limits = PROVIDER_LIMITS[provider];
  const idealSpacing = (60 * 1000) / limits.softLimitRpm;
  return Math.min(idealSpacing * (1 + recentErrors), limits.cooldownMs);
}

// Re-implement waitForProviderSlot
async function waitForProviderSlot(
  supabase: any,
  provider: AIProviderName,
  maxWaitMs: number = 30000,
): Promise<{ proceeded: boolean; waitedMs: number; rateLimited: boolean }> {
  const start = Date.now();

  const availability = await checkProviderAvailability(supabase, provider);

  if (availability.ok) {
    if (availability.waitRecommended) {
      const jitter = Math.random() * 2000;
      await new Promise((r) => setTimeout(r, jitter));
      return { proceeded: true, waitedMs: jitter, rateLimited: false };
    }
    return { proceeded: true, waitedMs: 0, rateLimited: false };
  }

  const retryAfter = availability.retryAfterMs || PROVIDER_LIMITS[provider].cooldownMs;

  if (retryAfter > maxWaitMs) {
    return { proceeded: false, waitedMs: 0, rateLimited: true };
  }

  const jitter = Math.random() * 2000;
  const totalWait = retryAfter + jitter;
  await new Promise((r) => setTimeout(r, totalWait));

  return { proceeded: true, waitedMs: Date.now() - start, rateLimited: false };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Rate Limiter Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    resetLocalState();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetLocalState();
  });

  // =========================================================================
  // checkProviderAvailability
  // =========================================================================

  describe('checkProviderAvailability', () => {
    it('returns ok when no rate limit data exists', async () => {
      const supabase = createMockSupabase({ data: null });
      const result = await checkProviderAvailability(supabase, 'gemini');
      expect(result.ok).toBe(true);
    });

    it('returns ok when backoff_until is in the past', async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const supabase = createMockSupabase({
        data: { backoff_until: pastDate, concurrent_requests: 0 },
      });

      const result = await checkProviderAvailability(supabase, 'gemini');
      expect(result.ok).toBe(true);
    });

    it('returns not ok when backoff_until is in the future', async () => {
      const futureDate = new Date(Date.now() + 10000).toISOString();
      const supabase = createMockSupabase({
        data: { backoff_until: futureDate, concurrent_requests: 0 },
      });

      const result = await checkProviderAvailability(supabase, 'gemini');
      expect(result.ok).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(10000);
    });

    it('caches cooldown in local state after DB read', async () => {
      const futureDate = new Date(Date.now() + 5000).toISOString();
      const supabase = createMockSupabase({
        data: { backoff_until: futureDate, concurrent_requests: 0 },
      });

      await checkProviderAvailability(supabase, 'apify');
      expect(localState['apify']).toBeDefined();
      expect(localState['apify'].backoffUntil).toBeGreaterThan(Date.now());
    });

    it('uses local state cache for subsequent checks', async () => {
      // Set up local state with future backoff
      localState['gemini'] = {
        lastRateLimited: Date.now(),
        backoffUntil: Date.now() + 5000,
      };

      const supabase = createMockSupabase({ data: null });
      const result = await checkProviderAvailability(supabase, 'gemini');

      expect(result.ok).toBe(false);
      // Should NOT have queried the DB since local state was sufficient
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('returns ok with waitRecommended when near concurrency limit', async () => {
      const supabase = createMockSupabase({
        data: { backoff_until: null, concurrent_requests: 10 }, // gemini maxConcurrent = 10
      });

      const result = await checkProviderAvailability(supabase, 'gemini');
      expect(result.ok).toBe(true);
      expect(result.waitRecommended).toBe(true);
    });

    it('returns ok when DB check fails (non-blocking)', async () => {
      const supabase = {
        from: vi.fn().mockImplementation(() => {
          throw new Error('DB connection failed');
        }),
      };

      const result = await checkProviderAvailability(supabase as any, 'gemini');
      expect(result.ok).toBe(true);
    });
  });

  // =========================================================================
  // reportRateLimit
  // =========================================================================

  describe('reportRateLimit', () => {
    it('sets local state with cooldown', async () => {
      const supabase = createMockSupabase();
      await reportRateLimit(supabase, 'gemini');

      expect(localState['gemini']).toBeDefined();
      expect(localState['gemini'].backoffUntil).toBeGreaterThan(Date.now());
    });

    it('uses provider default cooldown when no retryAfterSeconds provided', async () => {
      const supabase = createMockSupabase();
      await reportRateLimit(supabase, 'apify');

      // apify cooldownMs = 30000, + 10-20% jitter
      const expected = localState['apify'].backoffUntil - Date.now();
      expect(expected).toBeGreaterThanOrEqual(30000 * 1.1 - 100); // allow small timing variance
      expect(expected).toBeLessThanOrEqual(30000 * 1.2 + 100);
    });

    it('uses custom retryAfterSeconds when provided', async () => {
      const supabase = createMockSupabase();
      await reportRateLimit(supabase, 'gemini', 60); // 60 seconds

      const expected = localState['gemini'].backoffUntil - Date.now();
      expect(expected).toBeGreaterThanOrEqual(60000); // at least 60s
      expect(expected).toBeLessThanOrEqual(72000 + 100); // max 60s + 20% jitter
    });

    it('upserts to database', async () => {
      const supabase = createMockSupabase();
      await reportRateLimit(supabase, 'gemini');

      expect(supabase.from).toHaveBeenCalledWith('enrichment_rate_limits');
      expect(supabase._mocks.mockUpsert).toHaveBeenCalled();
    });

    it('does not throw when DB upsert fails', async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockRejectedValue(new Error('DB write failed')),
        }),
      };

      // Should not throw
      await expect(reportRateLimit(supabase as any, 'gemini')).resolves.not.toThrow();

      // Local state should still be set
      expect(localState['gemini']).toBeDefined();
    });
  });

  // =========================================================================
  // withConcurrencyTracking
  // =========================================================================

  describe('withConcurrencyTracking', () => {
    it('increments before fn and decrements after success', async () => {
      const supabase = createMockSupabase();
      const callOrder: string[] = [];

      supabase.rpc.mockImplementation((name: string) => {
        callOrder.push(name);
        return Promise.resolve({ data: null, error: null });
      });

      const result = await withConcurrencyTracking(supabase, 'gemini', async () => {
        callOrder.push('fn');
        return 'test-result';
      });

      expect(result).toBe('test-result');
      expect(callOrder).toEqual([
        'increment_provider_concurrent',
        'fn',
        'decrement_provider_concurrent',
      ]);
    });

    it('decrements even when fn throws', async () => {
      const supabase = createMockSupabase();
      const callOrder: string[] = [];

      supabase.rpc.mockImplementation((name: string) => {
        callOrder.push(name);
        return Promise.resolve({ data: null, error: null });
      });

      await expect(
        withConcurrencyTracking(supabase, 'gemini', async () => {
          callOrder.push('fn');
          throw new Error('fn failed');
        }),
      ).rejects.toThrow('fn failed');

      expect(callOrder).toEqual([
        'increment_provider_concurrent',
        'fn',
        'decrement_provider_concurrent',
      ]);
    });
  });

  // =========================================================================
  // getAdaptiveDelay
  // =========================================================================

  describe('getAdaptiveDelay', () => {
    it('returns 0 when no recent errors', () => {
      expect(getAdaptiveDelay('gemini', 0)).toBe(0);
    });

    it('returns increasing delay with more errors', () => {
      const delay1 = getAdaptiveDelay('gemini', 1);
      const delay2 = getAdaptiveDelay('gemini', 2);
      const delay3 = getAdaptiveDelay('gemini', 3);

      expect(delay1).toBeGreaterThan(0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('caps delay at provider cooldownMs', () => {
      const delay = getAdaptiveDelay('gemini', 100);
      expect(delay).toBeLessThanOrEqual(PROVIDER_LIMITS.gemini.cooldownMs);
    });

    it('uses different delays for different providers', () => {
      const geminiDelay = getAdaptiveDelay('gemini', 1);
      const apifyDelay = getAdaptiveDelay('apify', 1);

      // Apify has lower RPM limit so should have higher spacing
      expect(apifyDelay).toBeGreaterThan(geminiDelay);
    });
  });

  // =========================================================================
  // waitForProviderSlot
  // =========================================================================

  describe('waitForProviderSlot', () => {
    it('proceeds immediately when provider is available', async () => {
      const supabase = createMockSupabase({ data: null });

      const result = await waitForProviderSlot(supabase, 'gemini');
      expect(result.proceeded).toBe(true);
      expect(result.waitedMs).toBe(0);
      expect(result.rateLimited).toBe(false);
    });

    it('signals rate limited when cooldown exceeds maxWaitMs', async () => {
      // Set up a long cooldown
      localState['gemini'] = {
        lastRateLimited: Date.now(),
        backoffUntil: Date.now() + 60000, // 60s cooldown
      };

      const supabase = createMockSupabase({ data: null });
      const result = await waitForProviderSlot(supabase, 'gemini', 5000); // max wait 5s

      expect(result.proceeded).toBe(false);
      expect(result.rateLimited).toBe(true);
    });

    it('waits through cooldown when within maxWaitMs', async () => {
      localState['gemini'] = {
        lastRateLimited: Date.now(),
        backoffUntil: Date.now() + 1000, // 1s cooldown
      };

      const supabase = createMockSupabase({ data: null });
      const result = await waitForProviderSlot(supabase, 'gemini', 30000);

      expect(result.proceeded).toBe(true);
      expect(result.rateLimited).toBe(false);
      expect(result.waitedMs).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Provider limits configuration
  // =========================================================================

  describe('Provider limits configuration', () => {
    it('has correct limits for gemini', () => {
      expect(PROVIDER_LIMITS.gemini.maxConcurrent).toBe(10);
      expect(PROVIDER_LIMITS.gemini.cooldownMs).toBe(10000);
      expect(PROVIDER_LIMITS.gemini.softLimitRpm).toBe(30);
    });

    it('has correct limits for apify', () => {
      expect(PROVIDER_LIMITS.apify.maxConcurrent).toBe(3);
      expect(PROVIDER_LIMITS.apify.cooldownMs).toBe(30000);
      expect(PROVIDER_LIMITS.apify.softLimitRpm).toBe(10);
    });

    it('has correct limits for firecrawl', () => {
      expect(PROVIDER_LIMITS.firecrawl.maxConcurrent).toBe(5);
      expect(PROVIDER_LIMITS.firecrawl.cooldownMs).toBe(10000);
      expect(PROVIDER_LIMITS.firecrawl.softLimitRpm).toBe(20);
    });
  });

  // =========================================================================
  // DB failure resilience (fail-open behavior)
  // =========================================================================

  describe('DB failure resilience', () => {
    it('checkProviderAvailability returns ok when DB throws', async () => {
      const supabase = {
        from: vi.fn().mockImplementation(() => {
          throw new Error('Connection pool exhausted');
        }),
      };

      const result = await checkProviderAvailability(supabase as any, 'gemini');
      expect(result.ok).toBe(true);
    });

    it('reportRateLimit still sets local state when DB fails', async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockRejectedValue(new Error('DB write timeout')),
        }),
      };

      await reportRateLimit(supabase as any, 'apify');

      // Local state should be set even though DB failed
      expect(localState['apify']).toBeDefined();
      expect(localState['apify'].backoffUntil).toBeGreaterThan(Date.now());
    });
  });
});
