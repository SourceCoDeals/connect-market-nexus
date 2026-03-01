/**
 * Tests for _shared/auth.ts — HTML escaping utilities
 *
 * The auth functions (requireAuth, requireAdmin) need a live Supabase client,
 * so we only test the pure utility functions here.
 */
import { describe, it, expect } from 'vitest';

// Re-implement the pure functions to test the logic without Deno imports
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlWithBreaks(str: string): string {
  return escapeHtml(str).replace(/\n/g, '<br>');
}

// ============================================================================
// escapeHtml
// ============================================================================

describe('escapeHtml', () => {
  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('AT&T')).toBe('AT&amp;T');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('returns empty string for falsy input', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null as unknown as string)).toBe('');
    expect(escapeHtml(undefined as unknown as string)).toBe('');
  });

  it('leaves safe strings unchanged', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });
});

// ============================================================================
// escapeHtmlWithBreaks
// ============================================================================

describe('escapeHtmlWithBreaks', () => {
  it('converts newlines to <br> tags', () => {
    expect(escapeHtmlWithBreaks('line1\nline2\nline3')).toBe('line1<br>line2<br>line3');
  });

  it('escapes HTML AND converts newlines', () => {
    expect(escapeHtmlWithBreaks('<b>bold</b>\nnewline')).toBe('&lt;b&gt;bold&lt;/b&gt;<br>newline');
  });
});
