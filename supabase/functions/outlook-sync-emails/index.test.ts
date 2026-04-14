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
    //
    // NOTE: the source now contains TWO `writeCheckpoint(nextLink)` calls
    // inside the do/while body — one inside the `if (!pageBatchOk)` rewind
    // block (before `pageCount++`) and one on the success path (after
    // `pageCount++`). The success-path call is always the LAST
    // `writeCheckpoint(nextLink)` string occurrence BEFORE the outer
    // `catch (err)` handler, so locate it via `lastIndexOf` scoped to the
    // try-body substring. The old single-occurrence `indexOf` pattern was
    // valid before the batch-failure rewind was added.
    const outerCatchIdx = SRC.indexOf('errors.push(`Page fetch error');
    expect(outerCatchIdx, 'outer catch anchor not found').toBeGreaterThan(-1);
    const tryBody = SRC.slice(0, outerCatchIdx);
    const pageCountIdx = tryBody.lastIndexOf('pageCount++;');
    const successCheckpointIdx = tryBody.lastIndexOf('await writeCheckpoint(nextLink);');
    expect(pageCountIdx).toBeGreaterThan(-1);
    expect(successCheckpointIdx).toBeGreaterThan(-1);
    expect(pageCountIdx).toBeLessThan(successCheckpointIdx);
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

describe('outlook-sync-emails — batch-failure rewind semantics', () => {
  // These tests lock down the fix for a regression introduced when the page
  // loop was rewritten to batch DB writes (commit d5381b0 + follow-up).
  //
  // Pre-fix behavior: if a bulk upsert on page N failed, the error was
  // pushed into `errors[]` but `pageCount++` and `writeCheckpoint(nextLink)`
  // still ran afterwards, advancing the persisted cursor past the page we
  // never successfully persisted. Resume would then silently skip that
  // page, losing every message on it.
  //
  // Post-fix behavior: the loop captures `pagePriorCursor = nextLink` at
  // the top of every iteration, tracks a `pageBatchOk` flag that every
  // error site inside the batch pipeline sets to false, and rewinds
  // `nextLink = pagePriorCursor` + flushes a checkpoint + `break`s when
  // the flag is false.
  it('captures pagePriorCursor at the top of every do/while iteration', () => {
    // The snapshot must live INSIDE the `do { ... }` block (not outside
    // it) so every iteration gets a fresh value after the previous page's
    // `nextLink = result.nextLink` reassignment.
    expect(SRC).toMatch(/do\s*\{[\s\S]*?const\s+pagePriorCursor\s*=\s*nextLink/);
  });

  it('declares a pageBatchOk flag that defaults to true per iteration', () => {
    expect(SRC).toMatch(/let\s+pageBatchOk\s*=\s*true/);
  });

  it('sets pageBatchOk = false at the matched-upsert error site', () => {
    // The matched email_messages bulk upsert is the critical failure site
    // — if this error doesn't flag the page we lose every matched email.
    const matchedTaskMatch = SRC.match(/Bulk matched upsert failed[\s\S]*?pageBatchOk\s*=\s*false/);
    expect(matchedTaskMatch, 'matched upsert error must set pageBatchOk = false').not.toBeNull();
  });

  it('sets pageBatchOk = false at the unmatched-upsert error site', () => {
    const unmatchedTaskMatch = SRC.match(
      /Bulk unmatched upsert failed[\s\S]*?pageBatchOk\s*=\s*false/,
    );
    expect(
      unmatchedTaskMatch,
      'unmatched upsert error must set pageBatchOk = false',
    ).not.toBeNull();
  });

  it('sets pageBatchOk = false on unexpected runtime throws inside the batch pipeline', () => {
    // The try/catch at the bottom of the batch pipeline catches anything
    // the inner per-message try/catches didn't, and must flag the page.
    const catchMatch = SRC.match(/Page batch processing error[\s\S]*?pageBatchOk\s*=\s*false/);
    expect(catchMatch, 'batch-pipeline catch must set pageBatchOk = false').not.toBeNull();
  });

  it('rewinds nextLink to pagePriorCursor and breaks when pageBatchOk is false', () => {
    // After the batch pipeline, the loop must check the flag, rewind the
    // cursor, flush a checkpoint, and break — in that order. Any refactor
    // that hoists `pageCount++` or the final `writeCheckpoint(nextLink)`
    // above the flag check re-introduces the lost-page regression.
    const rewindMatch = SRC.match(
      /if\s*\(\s*!pageBatchOk\s*\)\s*\{[\s\S]*?nextLink\s*=\s*pagePriorCursor[\s\S]*?writeCheckpoint\(nextLink\)[\s\S]*?break;/,
    );
    expect(
      rewindMatch,
      'rewind + checkpoint + break sequence on failed page not found',
    ).not.toBeNull();
  });

  it('places the pageBatchOk check BEFORE pageCount++ and the success checkpoint', () => {
    // Ordering invariant: the rewind/break must short-circuit the
    // success-path checkpoint, otherwise the failing page still advances.
    const flagCheckIdx = SRC.indexOf('if (!pageBatchOk)');
    const pageCountIdx = SRC.indexOf('pageCount++;');
    expect(flagCheckIdx).toBeGreaterThan(-1);
    expect(pageCountIdx).toBeGreaterThan(-1);
    expect(flagCheckIdx).toBeLessThan(pageCountIdx);
  });

  it('outer page-fetch catch also rewinds nextLink to pagePriorCursor', () => {
    // Defense-in-depth: the outer catch (fetchMessages throw) used to rely
    // on the implicit invariant "nextLink wasn't reassigned yet". Any
    // future refactor that moves a throwing op below the reassignment
    // would silently break that invariant — the explicit rewind keeps the
    // contract visible in the code instead of in a comment.
    const anchor = SRC.indexOf('errors.push(`Page fetch error');
    expect(anchor).toBeGreaterThan(-1);
    const catchOpen = SRC.lastIndexOf('catch', anchor);
    const openBrace = SRC.indexOf('{', catchOpen);
    let depth = 1;
    let i = openBrace + 1;
    while (i < SRC.length && depth > 0) {
      if (SRC[i] === '{') depth++;
      else if (SRC[i] === '}') depth--;
      if (depth === 0) break;
      i++;
    }
    const catchBody = SRC.slice(openBrace + 1, i);
    expect(catchBody).toContain('nextLink = pagePriorCursor');
  });
});

describe('outlook-sync-emails — attachment-failure visibility', () => {
  // These tests lock down the fix for a latent bug surfaced by the
  // post-refactor audit: `fetchAttachmentMetadata` used to swallow all
  // errors to `[]`, so a Microsoft Graph throttle or network hiccup was
  // indistinguishable from "really has no attachments". The row got
  // persisted with `attachment_metadata: []` and the unique dedup index
  // on `(microsoft_message_id, contact_id)` made it impossible to fix
  // without a manual re-fetch. The fix makes the fetcher return `null`
  // on failure and the batch version returns a `failedIds` set that
  // flags the whole page for resume.
  it('fetchAttachmentMetadata returns null on failure instead of empty array', () => {
    // The helper must type-signal failure — searching for `| null` in
    // its return type ensures a future refactor that silently removes
    // the null branch trips the test.
    expect(SRC).toMatch(
      /async function fetchAttachmentMetadata\([\s\S]*?\):\s*Promise<[^>]*AttachmentMeta\[\]\s*\|\s*null>/,
    );
    // And both failure sites must return null, not an empty array.
    // Use \r?\n so the regex works on both LF (CI/Linux) and CRLF (Windows)
    // — the source file's line endings depend on git's autocrlf setting and
    // this test was previously LF-only, silently failing on Windows dev.
    const fnMatch = SRC.match(/async function fetchAttachmentMetadata[\s\S]*?\r?\n\}\r?\n/);
    expect(fnMatch, 'fetchAttachmentMetadata body not found').not.toBeNull();
    const body = fnMatch![0];
    expect(body).toMatch(/if\s*\(!resp\.ok\)\s*return\s+null/);
    expect(body).toMatch(/catch[\s\S]*?return\s+null/);
    // The old bug pattern was `return \[\]` in either error branch.
    // The success path still returns an array via .map, which is fine.
    const errorReturns = body.match(/return\s+\[\]/g) || [];
    expect(errorReturns.length, 'no bare `return []` allowed in error branches').toBe(0);
  });

  it('fetchAttachmentMetadataBatch returns both results and failedIds', () => {
    // The batch wrapper must expose which messages couldn't be fetched so
    // the sync loop can exclude them from the persisted rows and flag the
    // page for resume.
    expect(SRC).toMatch(
      /fetchAttachmentMetadataBatch[\s\S]*?Promise<\s*\{\s*results:[\s\S]*?failedIds:\s*Set<string>/,
    );
  });

  it('flags pageBatchOk = false when attachment fetches fail', () => {
    // Regression for "persist email rows with empty attachment metadata
    // when Graph throttled the fetch": the sync loop must treat any
    // attachment fetch failure as a recoverable page-level failure so
    // resume re-fetches with a fresh access token.
    const match = SRC.match(/attachmentFailedIds\.size\s*>\s*0[\s\S]*?pageBatchOk\s*=\s*false/);
    expect(match, 'attachment fetch failures must flag pageBatchOk = false').not.toBeNull();
  });

  it('skips messages with failed attachment fetches during row accumulation', () => {
    // Messages whose attachments we couldn't fetch MUST be excluded from
    // the matched/unmatched row batches, otherwise the dedup unique index
    // on `(microsoft_message_id, contact_id)` locks in the empty
    // `attachment_metadata: []` state forever.
    expect(SRC).toMatch(/if\s*\(\s*attachmentFailedIds\.has\(msg\.id\)\s*\)\s*continue;/);
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
