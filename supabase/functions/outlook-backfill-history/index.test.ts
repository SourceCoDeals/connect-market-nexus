/**
 * Regression test for the Outlook backfill "Failed to send a request to the
 * Edge Function" bug.
 *
 * The edge function itself runs in Deno and can't be imported into vitest, so
 * this test statically verifies the invariant that actually prevents the bug:
 *
 *   1. The Deno.serve handler body is wrapped in a top-level try/catch.
 *   2. The catch block returns via `errorResponse(..., corsHeaders)` so the
 *      browser always receives a CORS-safe response.
 *   3. Every non-OPTIONS return inside the handler passes `corsHeaders` so the
 *      browser never sees a cross-origin failure.
 *
 * Without (1) an unhandled throw (from `requireAuth`, `createClient`, a DB
 * hiccup, etc.) crashes the Deno isolate, the platform serves a 500 with no
 * CORS headers, and `supabase.functions.invoke` surfaces that as
 * `FunctionsFetchError: "Failed to send a request to the Edge Function"` —
 * the exact error shown on the Outlook settings page screenshot.
 *
 * The test mirrors the pattern used by the other edge-function unit tests
 * in this repo (see `_shared/auth.test.ts`): read the TypeScript source as
 * text and run structural assertions against it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BACKFILL_HISTORY = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
const BULK_BACKFILL_ALL = readFileSync(
  join(__dirname, '..', 'outlook-bulk-backfill-all', 'index.ts'),
  'utf-8',
);

interface HandlerShape {
  name: string;
  source: string;
}

const HANDLERS: HandlerShape[] = [
  { name: 'outlook-backfill-history', source: BACKFILL_HISTORY },
  { name: 'outlook-bulk-backfill-all', source: BULK_BACKFILL_ALL },
];

/**
 * Walk forward from `startIdx` (a `{`) counting braces and return the body
 * between that opening brace and its matching closing brace.
 */
function sliceBalancedBraces(source: string, openBraceIdx: number): string {
  if (source[openBraceIdx] !== '{') {
    throw new Error(`Expected '{' at index ${openBraceIdx}`);
  }
  let depth = 1;
  let i = openBraceIdx + 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) break;
    i++;
  }
  return source.slice(openBraceIdx + 1, i);
}

/** Extract the `Deno.serve(async (req) => { ... })` body from an edge fn. */
function extractHandlerBody(source: string): string {
  const marker = 'Deno.serve(async (req) => {';
  const start = source.indexOf(marker);
  if (start === -1) throw new Error('Deno.serve handler not found');
  // sliceBalancedBraces wants the index of the opening brace itself.
  return sliceBalancedBraces(source, start + marker.length - 1);
}

/**
 * Find the outer `try { ... } catch (err) { ... }` in a handler body and
 * return the catch block body (the code between the catch's braces).
 * This is the code that runs when an unhandled exception escapes the main
 * handler logic — if it doesn't return a CORS-safe response, the fix is
 * broken.
 */
function extractOuterCatchBody(handlerBody: string): string {
  // Locate the first top-level `try {`.
  const tryIdx = handlerBody.indexOf('try {');
  if (tryIdx === -1) throw new Error('no top-level try { found');
  const tryBraceIdx = handlerBody.indexOf('{', tryIdx);
  // Walk past the matching closing brace of the try.
  let depth = 1;
  let i = tryBraceIdx + 1;
  while (i < handlerBody.length && depth > 0) {
    const ch = handlerBody[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) break;
    i++;
  }
  // Now find the following `catch (err...) {`.
  const rest = handlerBody.slice(i + 1);
  const catchMatch = rest.match(/^\s*catch\s*\(\s*err[^)]*\)\s*\{/);
  if (!catchMatch) throw new Error('no matching catch block after try');
  const catchBraceIdx = i + 1 + catchMatch[0].length - 1;
  return sliceBalancedBraces(handlerBody, catchBraceIdx);
}

describe.each(HANDLERS)('$name handler CORS-safety invariants', ({ name, source }) => {
  const body = extractHandlerBody(source);

  it('handles OPTIONS preflight BEFORE the try/catch', () => {
    // OPTIONS must be handled first because corsPreflightResponse itself is
    // the CORS-safe response — wrapping it in try/catch is harmless but the
    // preflight-first pattern is what browsers expect.
    const optionsIdx = body.indexOf("req.method === 'OPTIONS'");
    const tryIdx = body.indexOf('try {');
    expect(optionsIdx).toBeGreaterThan(-1);
    expect(tryIdx).toBeGreaterThan(-1);
    expect(optionsIdx).toBeLessThan(tryIdx);
  });

  it('wraps the handler body in an outer try/catch', () => {
    // The canonical shape is: top-level `try { ... } catch (err) { ... }`
    // that wraps everything after the OPTIONS short-circuit.
    expect(body).toMatch(/\btry\s*\{/);
    expect(body).toMatch(/\}\s*catch\s*\(\s*err\b/);
  });

  it('catch block returns via errorResponse with corsHeaders', () => {
    // Pull out the catch block body by brace-balancing and assert it returns
    // an errorResponse that includes corsHeaders. Without this, a crash inside
    // the handler leaves the browser with a CORS-less 500 → FunctionsFetchError.
    const catchBody = extractOuterCatchBody(body);
    expect(catchBody).toMatch(/return\s+errorResponse\(/);
    expect(catchBody).toMatch(/corsHeaders/);
    // It also must log the underlying error so operators can debug it from
    // the edge-function logs (the user-visible message is intentionally terse).
    expect(catchBody).toMatch(/console\.error/);
  });

  it('every non-OPTIONS return passes corsHeaders', () => {
    // Scan every `return errorResponse(...)` / `return successResponse(...)`
    // inside the handler body and make sure corsHeaders appears in the call.
    // Regex captures from the identifier up to the matching close paren
    // using a conservative multiline match.
    const returnRegex = /return\s+(errorResponse|successResponse)\s*\(([\s\S]*?)\)\s*;/g;
    const matches = [...body.matchAll(returnRegex)];

    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      const [fullCall, fn, args] = m;
      expect(
        args.includes('corsHeaders'),
        `${name}: ${fn} call is missing corsHeaders → ${fullCall.slice(0, 80)}...`,
      ).toBe(true);
    }
  });

  it('returns a 202 from the happy-path successResponse (background task pattern)', () => {
    // Both backfill functions MUST return 202 Accepted on the happy path —
    // that's the signal to the frontend that the work has been dispatched to
    // an `EdgeRuntime.waitUntil` background task and the real counts will
    // arrive later. Returning 200 here would break the background-task
    // contract and put us back in the 150-second timeout failure mode.
    expect(body).toMatch(/202\s*,?\s*\)?\s*;?\s*\}/);
    expect(body).toContain("status: 'started'");
    expect(body).toMatch(/EdgeRuntime.*waitUntil/);
  });
});

describe('outlook-backfill-history progress + resume invariants', () => {
  it('initialises the progress row BEFORE kicking off the background task', () => {
    // The frontend polls `email_connections.backfill_*` to render the
    // progress bar, so the row MUST be written with status='running' before
    // the HTTP 202 response returns. Otherwise the UI would show a stale
    // previous state until the first checkpoint landed.
    const initIdx = BACKFILL_HISTORY.indexOf("backfill_status: 'running'");
    const bgTaskIdx = BACKFILL_HISTORY.indexOf('backfillPromise = (async');
    expect(initIdx).toBeGreaterThan(-1);
    expect(bgTaskIdx).toBeGreaterThan(-1);
    expect(initIdx).toBeLessThan(bgTaskIdx);
  });

  it('forwards trackBackfillProgress + resume cursor to the sync engine', () => {
    expect(BACKFILL_HISTORY).toContain('trackBackfillProgress: true');
    expect(BACKFILL_HISTORY).toContain('resumeFromNextLink: resumeNextLink');
    expect(BACKFILL_HISTORY).toContain('backfillSince: effectiveSince');
  });

  it('refuses to stomp a currently-running row unless resume is explicit', () => {
    // The 409 guard prevents two concurrent backfills from writing to the
    // same progress row. Explicit `resume:true` or `resume:false` bypass it.
    expect(BACKFILL_HISTORY).toContain("backfill_status === 'running'");
    expect(BACKFILL_HISTORY).toMatch(/409/);
    expect(BACKFILL_HISTORY).toMatch(/already running for this mailbox/);
  });

  it('finalises via the DB row source-of-truth (re-reads backfill_next_link)', () => {
    // Regression for BUG #2: the sync engine returns HTTP 200 even when its
    // loop aborted mid-way on a page-fetch error (the inner catch writes a
    // checkpoint with the failed-page cursor and breaks). The orchestrator
    // must NOT trust syncResp.ok alone — it must re-read the row and check
    // whether `backfill_next_link` is still populated. If it is, the sync
    // stopped early and we finalise as 'failed' with the cursor preserved so
    // the Resume button can pick it up. If it's null, we finalise as
    // 'completed'.
    expect(BACKFILL_HISTORY).toMatch(/select\([^)]*backfill_next_link/);
    // The completion decision MUST combine syncCallOk with !cursorRemaining —
    // either alone is insufficient. This exact shape is what catches the
    // aborted-mid-pull regression (syncResp returns 200 even though the sync
    // aborted, and the row still has a non-null next_link cursor).
    expect(BACKFILL_HISTORY).toMatch(
      /const\s+cursorRemaining\s*=\s*postSync\?\.backfill_next_link\s*!==\s*null/,
    );
    expect(BACKFILL_HISTORY).toMatch(
      /const\s+actuallySucceeded\s*=\s*syncCallOk\s*&&\s*!cursorRemaining/,
    );
    // And the failure-message fallback explicitly mentions the Resume path
    // so the operator knows what to do.
    expect(BACKFILL_HISTORY).toMatch(/Click Resume to continue/);
  });

  it('preserves backfill_next_link on failure so Resume has a cursor', () => {
    // If we're finalising as failed, we MUST NOT clear backfill_next_link —
    // that's the cursor the Resume path reads. The success branch clears it.
    expect(BACKFILL_HISTORY).toMatch(/backfill_next_link is intentionally NOT cleared/);
  });

  it('uses a try/catch/finally so the final row write always runs', () => {
    // If the background task throws before the finally, we'd leave the row
    // stuck in 'running' forever. The finally block guarantees finalisation
    // even on unhandled throws.
    expect(BACKFILL_HISTORY).toMatch(/\}\s*finally\s*\{/);
  });
});

describe('outlook-backfill-history request-scope env reads', () => {
  it('does not use `!`-asserted Deno.env.get for SUPABASE_URL / SERVICE_ROLE_KEY', () => {
    // Non-null assertions on env reads were the root cause of one of the
    // throw paths: if either env var is unset, `const x = Deno.env.get(...)!`
    // succeeds but downstream usage crashes with a TypeError. Replacing them
    // with explicit-null checks is what closes the loop on the fix.
    expect(BACKFILL_HISTORY).not.toMatch(/Deno\.env\.get\('SUPABASE_URL'\)!/);
    expect(BACKFILL_HISTORY).not.toMatch(/Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)!/);
    expect(BULK_BACKFILL_ALL).not.toMatch(/Deno\.env\.get\('SUPABASE_URL'\)!/);
    expect(BULK_BACKFILL_ALL).not.toMatch(/Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)!/);
  });

  it('explicitly 500s if SUPABASE_URL or SERVICE_ROLE_KEY is missing', () => {
    for (const source of [BACKFILL_HISTORY, BULK_BACKFILL_ALL]) {
      // The guard uses `if (!supabaseUrl || !serviceRoleKey)` and calls
      // errorResponse with a configured-500 message.
      expect(source).toMatch(/if\s*\(!supabaseUrl\s*\|\|\s*!serviceRoleKey\)/);
      expect(source).toMatch(/not configured on the server/);
    }
  });
});
