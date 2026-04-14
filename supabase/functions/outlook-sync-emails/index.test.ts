/**
 * Regression tests for the resumable-backfill instrumentation added to
 * `outlook-sync-emails`. The edge function runs in Deno and can't be imported
 * by vitest, so this locks down the invariants via static analysis against
 * the source file (same pattern as the other edge-function unit tests in
 * this repo — see `_shared/auth.test.ts`, `outlook-backfill-history/index.test.ts`).
 *
 * These tests exist because the "if it freezes we don't have to resync what
 * we already synced" contract relies on several subtle properties of the
 * sync loop that are easy to accidentally break in a later refactor:
 *
 *   1. The loop must accept a `resumeFromNextLink` cursor and start from it.
 *   2. Every successful page must call writeCheckpoint AFTER the upserts.
 *   3. The page-fetch catch block must ALSO call writeCheckpoint (so the
 *      failed-page cursor is stored for the next Resume call).
 *   4. writeCheckpoint is a no-op unless `trackBackfillProgress` is true.
 *   5. The checkpoint update targets the right row (eq sourceco_user_id).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, 'index.ts'), 'utf-8');

describe('outlook-sync-emails — resumable backfill invariants', () => {
  it('accepts a resumeFromNextLink cursor on the request body', () => {
    expect(SRC).toMatch(/resumeFromNextLink\?:\s*string/);
  });

  it('accepts a backfillSince override so resume cutoff never drifts', () => {
    expect(SRC).toMatch(/backfillSince\?:\s*string/);
    // And the handler prefers the caller-provided backfillSince over
    // re-computing `Date.now() - lookback`:
    expect(SRC).toContain('body.backfillSince ||');
  });

  it('accepts a trackBackfillProgress flag that defaults off', () => {
    expect(SRC).toMatch(/trackBackfillProgress\?:\s*boolean/);
    // And the check-in helper no-ops when it's false:
    expect(SRC).toMatch(/if\s*\(\s*!options\.trackBackfillProgress\s*\)\s*return/);
  });

  it('threads options through from the handler into syncEmails()', () => {
    expect(SRC).toContain('resumeFromNextLink: body.resumeFromNextLink');
    expect(SRC).toContain('trackBackfillProgress: body.trackBackfillProgress === true');
  });

  it('initialises the loop cursor from options.resumeFromNextLink', () => {
    expect(SRC).toMatch(
      /let\s+nextLink\s*:\s*string\s*\|\s*undefined\s*=\s*options\.resumeFromNextLink/,
    );
  });
});

describe('outlook-sync-emails — checkpoint placement', () => {
  it('writes a checkpoint at the END of every successful page (after upserts)', () => {
    // The checkpoint must come AFTER `pageCount++` so the persisted counter
    // reflects the page we just processed, and after all the inner upserts
    // so `backfill_next_link` points at the NEXT page (never at one whose
    // messages haven't been persisted yet).
    const pageCountIdx = SRC.indexOf('pageCount++;');
    const checkpointCallIdx = SRC.indexOf('await writeCheckpoint(nextLink);');
    expect(pageCountIdx).toBeGreaterThan(-1);
    expect(checkpointCallIdx).toBeGreaterThan(-1);
    expect(pageCountIdx).toBeLessThan(checkpointCallIdx);
  });

  it('also flushes a checkpoint on page-fetch error before breaking the loop', () => {
    // Regression for the "lose the cursor" bug: if fetchMessages throws on
    // page N, the catch block MUST still write a checkpoint so the Resume
    // path has a cursor to pick up from. `nextLink` at that point still
    // holds the URL for page N (the one we just failed to fetch) because
    // the successful `nextLink = result.nextLink` assignment never ran.
    //
    // Extract the exact page-fetch catch block by walking forward from the
    // `Page fetch error` errors.push call and brace-matching to the closing
    // brace of the catch. This avoids the trap of a greedy regex accidentally
    // capturing the outer try's own `writeCheckpoint` call and passing the
    // assertion on a broken mutation.
    const anchor = SRC.indexOf('errors.push(`Page fetch error');
    expect(anchor, 'Page fetch error anchor not found').toBeGreaterThan(-1);
    // Walk backward to find the enclosing `catch (err) {` brace.
    const catchOpen = SRC.lastIndexOf('catch', anchor);
    const openBrace = SRC.indexOf('{', catchOpen);
    // Walk forward from openBrace counting braces to find the matching close.
    let depth = 1;
    let i = openBrace + 1;
    while (i < SRC.length && depth > 0) {
      if (SRC[i] === '{') depth++;
      else if (SRC[i] === '}') depth--;
      if (depth === 0) break;
      i++;
    }
    const catchBody = SRC.slice(openBrace + 1, i);
    expect(catchBody).toContain('await writeCheckpoint(nextLink)');
    expect(catchBody).toContain('break;');
    // The checkpoint call must come BEFORE the break (flush then exit):
    const ckpIdx = catchBody.indexOf('writeCheckpoint');
    const breakIdx = catchBody.indexOf('break');
    expect(ckpIdx).toBeLessThan(breakIdx);
  });

  it('checkpoint targets the correct row via eq(sourceco_user_id)', () => {
    // The checkpoint write must not accidentally update multiple rows.
    expect(SRC).toMatch(
      /\.from\('email_connections'\)\.update\(update\)\.eq\('sourceco_user_id',\s*userId\)/,
    );
  });

  it('checkpoint updates the heartbeat timestamp for stall detection', () => {
    expect(SRC).toMatch(/backfill_heartbeat_at:\s*new Date\(\)\.toISOString\(\)/);
  });

  it('swallows checkpoint write failures so the sync never aborts on progress-write errors', () => {
    // The whole point of the checkpoint being "best-effort" is that a DB
    // hiccup during progress write must NOT cause the sync to abort and
    // waste the work already done. The try/catch inside writeCheckpoint
    // logs the error and returns normally.
    const helperMatch = SRC.match(/const\s+writeCheckpoint\s*=[\s\S]*?\n\s{2}\};/);
    expect(helperMatch, 'writeCheckpoint helper not found').not.toBeNull();
    const helperBody = helperMatch![0];
    expect(helperBody).toMatch(/try\s*\{/);
    expect(helperBody).toMatch(/\}\s*catch/);
    expect(helperBody).toContain("console.error('[outlook-sync] checkpoint write failed");
  });
});

describe('outlook-sync-emails — earliest-seen watermark', () => {
  it('tracks earliest sentDateTime seen so far as the progress-bar driver', () => {
    // The watermark exists and is declared before the loop so both the
    // loop body and the closure can update it.
    expect(SRC).toMatch(/let\s+earliestSeenAt\s*:\s*string\s*\|\s*null\s*=\s*null/);
    // Watermark is monotonically decreasing (newest-first iteration order):
    expect(SRC).toMatch(/oldestTs\s*<\s*earliestSeenAt/);
    // And the checkpoint persists it when non-null:
    expect(SRC).toMatch(
      /if\s*\(\s*earliestSeenAt\s*\)\s*update\.backfill_earliest_seen_at\s*=\s*earliestSeenAt/,
    );
  });

  it('picks the LAST message on a page as the oldest (desc-ordered fetch)', () => {
    // Graph returns pages sorted `sentDateTime desc`, so array[length-1]
    // is the oldest on that page. Any refactor that changes the ordering
    // without updating this selection breaks the watermark.
    expect(SRC).toContain('result.messages[result.messages.length - 1]');
  });
});
