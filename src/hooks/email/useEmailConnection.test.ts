/**
 * Unit tests for extractFunctionError — the helper that translates
 * Supabase `functions.invoke` error shapes into user-facing messages.
 *
 * The helper exists to stop us from showing cryptic errors like
 * "Edge Function returned a non-2xx status code" or "Failed to send a
 * request to the Edge Function" to operators. These tests lock down the
 * behaviour against all four shapes the Supabase client can throw.
 */

import { describe, it, expect } from 'vitest';
import { extractFunctionError } from './useEmailConnection';

describe('extractFunctionError', () => {
  it('returns the fallback when error is null or undefined', async () => {
    expect(await extractFunctionError(null, 'fallback message')).toBe('fallback message');
    expect(await extractFunctionError(undefined, 'fallback message')).toBe('fallback message');
  });

  it('digs the `error` string out of a FunctionsHttpError JSON body', async () => {
    // Simulate FunctionsHttpError — the Supabase client puts the original
    // Response on `context`. Our edge functions always return
    // { error: "..." } via errorResponse().
    const response = new Response(
      JSON.stringify({ error: 'Only admins can backfill other team members mailboxes' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
    const fnError = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: response,
    });

    expect(await extractFunctionError(fnError, 'fallback')).toBe(
      'Only admins can backfill other team members mailboxes',
    );
  });

  it('falls back to body.message if body.error is missing', async () => {
    const response = new Response(JSON.stringify({ message: 'Something went wrong' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
    const fnError = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: response,
    });

    expect(await extractFunctionError(fnError, 'fallback')).toBe('Something went wrong');
  });

  it('uses error.message for FunctionsFetchError (platform timeout) when context body is unusable', async () => {
    // FunctionsFetchError is what the supabase-js client throws when the
    // edge-function request never delivered a response — the exact failure
    // mode behind the original "BackFill Failed — Failed to send a request
    // to the Edge Function" screenshot. There's no `context`, just the
    // error message.
    const fnError = new Error('Failed to send a request to the Edge Function');

    expect(await extractFunctionError(fnError, 'Backfill failed')).toBe(
      'Failed to send a request to the Edge Function',
    );
  });

  it('surfaces the HTTP status + first line when FunctionsHttpError body is not JSON', async () => {
    // Supabase edge-function wall-clock timeouts (>150s) and platform
    // 502/504s return plain text bodies rather than our JSON
    // { error: "..." } envelope. The JSON extraction path falls through,
    // and the old behavior was to return the generic
    // "Edge Function returned a non-2xx status code" toast that left
    // admins guessing. Now we surface the HTTP status + the first line
    // of the body so the operator can tell a 504 timeout from a 403
    // permission error.
    const response = new Response('<!doctype html><html>Bad Gateway</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    });
    const fnError = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: response,
    });

    expect(await extractFunctionError(fnError, 'Backfill failed')).toBe(
      'HTTP 502: <!doctype html><html>Bad Gateway</html>',
    );
  });

  it('surfaces a 504 upstream timeout body text (teaser generation wall-clock case)', async () => {
    // Real-world case: generate-lead-memo exceeds the Supabase edge-function
    // wall-clock limit while producing an anonymous teaser. The platform
    // returns a plain-text 504 rather than our JSON envelope, and the
    // user saw only "Edge Function returned a non-2xx status code". The
    // HTTP-status branch below makes the failure diagnosable.
    const response = new Response('upstream request timeout', {
      status: 504,
      headers: { 'Content-Type': 'text/plain' },
    });
    const fnError = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: response,
    });

    expect(await extractFunctionError(fnError, 'Generation failed')).toBe(
      'HTTP 504: upstream request timeout',
    );
  });

  it('truncates long non-JSON bodies to the first line / 200 chars', async () => {
    const longBody = 'first line details here\n' + 'x'.repeat(500);
    const response = new Response(longBody, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
    const fnError = Object.assign(new Error('non-2xx'), { context: response });

    const result = await extractFunctionError(fnError, 'fallback');
    expect(result).toBe('HTTP 500: first line details here');
  });

  it('returns an empty-body status message when the non-JSON body is also empty', async () => {
    const response = new Response('', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
    const fnError = Object.assign(new Error('non-2xx'), { context: response });

    expect(await extractFunctionError(fnError, 'fallback')).toBe(
      'Edge Function returned HTTP 500 with empty body',
    );
  });

  it('returns a plain string error as-is', async () => {
    expect(await extractFunctionError('boom', 'fallback')).toBe('boom');
  });

  it('returns fallback for non-Error, non-string, non-context shapes', async () => {
    expect(await extractFunctionError(42, 'fallback')).toBe('fallback');
    expect(await extractFunctionError({}, 'fallback')).toBe('fallback');
  });

  it('does not consume the response body (preserves the Response for other readers)', async () => {
    // We call `.clone().json()` on the context response so other callers
    // (including the supabase-js client internals) can still read the body.
    // Verify the original Response body is still readable after extraction.
    const payload = { error: 'server said no' };
    const response = new Response(JSON.stringify(payload), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    const fnError = Object.assign(new Error('non-2xx'), { context: response });

    await extractFunctionError(fnError, 'fallback');

    // Original response should still be readable.
    const reread = await response.json();
    expect(reread).toEqual(payload);
  });
});
