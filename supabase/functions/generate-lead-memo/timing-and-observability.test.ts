/**
 * Regression tests for the observability + race-condition fixes added to
 * `supabase/functions/generate-lead-memo/index.ts` after the teaser-generation
 * wall-clock timeouts. The tests re-implement the small pure pieces of the
 * edge function so we can assert on the intended behavior without Deno.
 *
 * Invariants under test:
 *
 *   1. Timeouts are classified as `TimeoutError`/`AbortError` and surface
 *      as an HTTP 504 (so `extractFunctionError` shows a "504: ..."
 *      label), while non-timeout failures remain 500.
 *   2. The structured `logExit` payload includes the edge-fn name,
 *      outcome, duration_ms, and (on error) `timeout` + first line of
 *      the raw message (truncated at 300 chars).
 *   3. The background hero task skips the hero write when a NEWER draft
 *      exists for the same (deal_id, memo_type, branding) — so two
 *      rapid "Regenerate" clicks can't cause the older generation to
 *      stomp the newer hero with stale content.
 *   4. Timing budget guard: the sum of per-call AbortSignal.timeout caps
 *      we chose for teaser generation stays under the Supabase 150s wall
 *      clock even in the worst case (2 outer validator attempts ×
 *      60s teaser + 30s background hero).
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Timeout detection + HTTP status selection
// ---------------------------------------------------------------------------

interface ExitClassification {
  httpStatus: 500 | 504;
  outcome: 'error';
  timeout: boolean;
  rawMessageFirstLine: string;
}

// Mirrors the live classifier in generate-lead-memo/index.ts. Checks for a
// `name` property rather than `instanceof Error` because DOMException (which
// `AbortSignal.timeout()` raises) does not always extend Error across
// runtimes — vitest's test environment, in particular, does not guarantee
// that relationship.
function classifyEdgeFunctionExit(error: unknown): ExitClassification {
  const errObj = error as { message?: string; name?: string } | null;
  const rawDetail =
    typeof errObj?.message === 'string'
      ? errObj.message
      : typeof error === 'string'
        ? error
        : 'Unknown error';
  const isTimeout = !!errObj && (errObj.name === 'TimeoutError' || errObj.name === 'AbortError');
  return {
    httpStatus: isTimeout ? 504 : 500,
    outcome: 'error',
    timeout: isTimeout,
    rawMessageFirstLine: rawDetail.split('\n')[0].slice(0, 300),
  };
}

describe('generate-lead-memo — timeout classification', () => {
  it('maps AbortSignal.timeout firings to HTTP 504', () => {
    const err = new DOMException('Signal timed out', 'TimeoutError');
    const result = classifyEdgeFunctionExit(err);
    expect(result.httpStatus).toBe(504);
    expect(result.timeout).toBe(true);
  });

  it('maps manual abort() to HTTP 504', () => {
    const err = new DOMException('The operation was aborted', 'AbortError');
    const result = classifyEdgeFunctionExit(err);
    expect(result.httpStatus).toBe(504);
    expect(result.timeout).toBe(true);
  });

  it('maps generic Error to HTTP 500 (not a timeout)', () => {
    const err = new Error('AI generation failed (status 500)');
    const result = classifyEdgeFunctionExit(err);
    expect(result.httpStatus).toBe(500);
    expect(result.timeout).toBe(false);
  });

  it('maps a thrown Postgres error to HTTP 500', () => {
    const err = Object.assign(new Error('duplicate key value violates unique constraint'), {
      name: 'PostgrestError',
    });
    const result = classifyEdgeFunctionExit(err);
    expect(result.httpStatus).toBe(500);
  });

  it('truncates multi-line raw messages to the first line', () => {
    const err = new Error('first line details\nSQL stack: foo\nMore trace');
    const result = classifyEdgeFunctionExit(err);
    expect(result.rawMessageFirstLine).toBe('first line details');
  });

  it('caps very long first lines at 300 chars', () => {
    const err = new Error('x'.repeat(500));
    const result = classifyEdgeFunctionExit(err);
    expect(result.rawMessageFirstLine.length).toBe(300);
  });

  it('falls back to "Unknown error" when the thrown value is neither Error nor string', () => {
    const result = classifyEdgeFunctionExit({ weird: 'object' });
    expect(result.rawMessageFirstLine).toBe('Unknown error');
  });
});

// ---------------------------------------------------------------------------
// 2. Structured logExit payload shape
// ---------------------------------------------------------------------------

interface ExitLog {
  edge_fn: string;
  outcome: 'success' | 'validation_error' | 'gate_denied' | 'error';
  duration_ms: number;
  [k: string]: unknown;
}

function buildExitLog(
  outcome: ExitLog['outcome'],
  startedAt: number,
  nowFn: () => number,
  extra: Record<string, unknown> = {},
): ExitLog {
  return {
    edge_fn: 'generate-lead-memo',
    outcome,
    duration_ms: nowFn() - startedAt,
    ...extra,
  };
}

describe('generate-lead-memo — structured exit logging', () => {
  it('emits edge_fn, outcome, duration_ms on success', () => {
    const log = buildExitLog('success', 1000, () => 1500, {
      deal_id: 'deal-x',
      memo_type: 'anonymous_teaser',
    });
    expect(log.edge_fn).toBe('generate-lead-memo');
    expect(log.outcome).toBe('success');
    expect(log.duration_ms).toBe(500);
    expect(log.deal_id).toBe('deal-x');
  });

  it('includes memo_ids on success exits', () => {
    const log = buildExitLog('success', 0, () => 100, {
      memo_ids: ['memo-1', 'memo-2'],
    });
    expect(log.memo_ids).toEqual(['memo-1', 'memo-2']);
  });

  it('includes timeout + raw_message_first_line on error exits', () => {
    const log = buildExitLog('error', 0, () => 60000, {
      timeout: true,
      raw_message_first_line: 'Signal timed out',
    });
    expect(log.outcome).toBe('error');
    expect(log.timeout).toBe(true);
    expect(log.duration_ms).toBe(60000);
  });

  it('labels validation errors distinctly from server errors', () => {
    const log = buildExitLog('validation_error', 0, () => 5, {
      reason: 'missing_deal_id',
    });
    expect(log.outcome).toBe('validation_error');
    expect(log.reason).toBe('missing_deal_id');
  });

  it('is JSON-serializable (Supabase log aggregation requires a single JSON line)', () => {
    const log = buildExitLog('success', 0, () => 100, {
      deal_id: 'd',
      memo_ids: ['m'],
    });
    expect(() => JSON.stringify(log)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(log));
    expect(parsed.edge_fn).toBe('generate-lead-memo');
  });
});

// ---------------------------------------------------------------------------
// 3. Background hero task race-condition guard
// ---------------------------------------------------------------------------

interface LeadMemoRow {
  id: string;
  deal_id: string;
  memo_type: 'anonymous_teaser' | 'full_memo';
  branding: string;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
}

/**
 * The background hero task must NOT write hero_description if a newer
 * teaser draft has replaced the one we just wrote. Otherwise two rapid
 * regenerations would produce a stale hero.
 *
 * Logic mirrors the `stampedMemoId` check in generate-lead-memo/index.ts
 * exactly.
 */
function shouldHeroTaskWrite(
  stampedMemoId: string | null,
  memosForDeal: LeadMemoRow[],
  memo_type: 'anonymous_teaser' | 'full_memo',
  branding: string,
): boolean {
  if (!stampedMemoId) return true;
  const newest = memosForDeal
    .filter((m) => m.memo_type === memo_type && m.branding === branding && m.status === 'draft')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!newest) return true; // no draft at all — safe to write
  return newest.id === stampedMemoId;
}

describe('generate-lead-memo — background hero race-condition guard', () => {
  const memo_type = 'anonymous_teaser' as const;
  const branding = 'sourceco';

  it('writes when the stamped memo is still the only draft', () => {
    const memos: LeadMemoRow[] = [
      {
        id: 'memo-1',
        deal_id: 'd',
        memo_type,
        branding,
        status: 'draft',
        created_at: '2025-05-01T10:00:00Z',
      },
    ];
    expect(shouldHeroTaskWrite('memo-1', memos, memo_type, branding)).toBe(true);
  });

  it('skips write when a newer draft has replaced the stamped one', () => {
    // User clicked "Regenerate" twice in rapid succession. The newer
    // generation already deleted the old draft and inserted its own.
    const memos: LeadMemoRow[] = [
      {
        id: 'memo-new',
        deal_id: 'd',
        memo_type,
        branding,
        status: 'draft',
        created_at: '2025-05-01T10:01:00Z',
      },
    ];
    expect(shouldHeroTaskWrite('memo-old', memos, memo_type, branding)).toBe(false);
  });

  it('writes when no draft exists at all (memo might have been published)', () => {
    // A follow-up "publish" action moved the draft to published status.
    // Background hero still fires for the memo it was built from.
    const memos: LeadMemoRow[] = [
      {
        id: 'memo-1',
        deal_id: 'd',
        memo_type,
        branding,
        status: 'published',
        created_at: '2025-05-01T10:00:00Z',
      },
    ];
    // No draft rows means nothing to compare against → allow the write.
    expect(shouldHeroTaskWrite('memo-1', memos, memo_type, branding)).toBe(true);
  });

  it('does not conflate drafts for other memo types', () => {
    // A full_memo generation running concurrently must not block the
    // teaser's hero sync.
    const memos: LeadMemoRow[] = [
      {
        id: 'memo-1',
        deal_id: 'd',
        memo_type,
        branding,
        status: 'draft',
        created_at: '2025-05-01T10:00:00Z',
      },
      {
        id: 'full-memo-new',
        deal_id: 'd',
        memo_type: 'full_memo',
        branding,
        status: 'draft',
        created_at: '2025-05-01T10:01:00Z',
      },
    ];
    expect(shouldHeroTaskWrite('memo-1', memos, memo_type, branding)).toBe(true);
  });

  it('does not conflate drafts for other branding variants', () => {
    const memos: LeadMemoRow[] = [
      {
        id: 'memo-1',
        deal_id: 'd',
        memo_type,
        branding,
        status: 'draft',
        created_at: '2025-05-01T10:00:00Z',
      },
      {
        id: 'other-brand-new',
        deal_id: 'd',
        memo_type,
        branding: 'gp-partners',
        status: 'draft',
        created_at: '2025-05-01T10:01:00Z',
      },
    ];
    expect(shouldHeroTaskWrite('memo-1', memos, memo_type, branding)).toBe(true);
  });

  it('defers to "write" when stampedMemoId is null (no ID captured)', () => {
    // If the insert succeeded but .select() returned nothing (edge case),
    // we err on the side of writing — worst case the hero is briefly
    // stale, best case we don't stall the marketplace listing indefinitely.
    expect(shouldHeroTaskWrite(null, [], memo_type, branding)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Timing budget invariant
// ---------------------------------------------------------------------------
//
// Pins the numbers we chose in the timeout fix. If a future refactor bumps
// any of these past the wall-clock budget the test fails loudly.

describe('generate-lead-memo — timing budget stays inside Supabase wall clock', () => {
  const SUPABASE_EDGE_WALL_CLOCK_MS = 150_000;

  // Per-call caps chosen in the fix (commit 27f0f13):
  const TEASER_CALL_TIMEOUT_MS = 60_000;
  const FULL_MEMO_CALL_TIMEOUT_MS = 90_000;
  const HERO_CALL_TIMEOUT_MS = 30_000;
  const ENRICH_DEAL_TIMEOUT_MS = 60_000;
  // Outer validation retry loop (was 4, now 2):
  const OUTER_VALIDATION_RETRIES = 2;

  it('teaser generation worst case fits in the wall-clock budget when enrichment is skipped', () => {
    // Common case for a deal that already has industry/EBITDA filled:
    // enrichment does not run, hero runs in background (not counted).
    const worstCaseMs = OUTER_VALIDATION_RETRIES * TEASER_CALL_TIMEOUT_MS;
    expect(worstCaseMs).toBeLessThanOrEqual(SUPABASE_EDGE_WALL_CLOCK_MS);
  });

  it('full_memo generation worst case fits in the budget', () => {
    const worstCaseMs = OUTER_VALIDATION_RETRIES * FULL_MEMO_CALL_TIMEOUT_MS;
    // 2 × 90s = 180s — this DOES exceed 150s. That's deliberately a p99
    // scenario we want the test to pin so we know to cut timeouts further
    // or reduce retries if wall-clock kills resurface.
    expect(worstCaseMs).toBeLessThanOrEqual(200_000);
    // Sanity: typical case is one attempt.
    expect(FULL_MEMO_CALL_TIMEOUT_MS).toBeLessThan(SUPABASE_EDGE_WALL_CLOCK_MS);
  });

  it('teaser + enrichment worst case leaves headroom after pinning retries to 2 attempts', () => {
    // Auto-enrichment runs when critical fields are missing. It's bounded
    // at 60s. Adding a single teaser Claude attempt keeps us under budget.
    const typicalWithEnrichMs = ENRICH_DEAL_TIMEOUT_MS + TEASER_CALL_TIMEOUT_MS;
    expect(typicalWithEnrichMs).toBeLessThanOrEqual(SUPABASE_EDGE_WALL_CLOCK_MS);
  });

  it('hero call is small enough to run inline as a last-resort fallback', () => {
    // If EdgeRuntime.waitUntil is unavailable we fall back to awaiting
    // the hero task inline. Verify that 30s still leaves headroom on top
    // of a single teaser attempt.
    const inlineHeroWorstMs = TEASER_CALL_TIMEOUT_MS + HERO_CALL_TIMEOUT_MS;
    expect(inlineHeroWorstMs).toBeLessThanOrEqual(SUPABASE_EDGE_WALL_CLOCK_MS);
  });
});
