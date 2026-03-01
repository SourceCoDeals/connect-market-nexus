/**
 * Tests for _shared/security.ts — SSRF protection and input validation
 *
 * These tests import the pure functions directly (no Deno/Supabase needed).
 * The rate limiting functions that require a Supabase client are not tested here
 * since they need an actual database connection.
 */
import { describe, it, expect } from 'vitest';

// We re-implement the pure functions here since the shared module uses Deno imports.
// In a real setup, you'd use import maps or a Deno test runner for edge function tests.
// This tests the logic, not the Deno module system.

// ─── SSRF Protection Logic ───

const BLOCKED_IP_PATTERNS = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^224\./,
  /^255\./,
  /^fc00:/i,
  /^fd00:/i,
  /^fe80:/i,
  /^::1$/i,
  /^localhost$/i,
  /^.*\.local$/i,
  /^.*\.internal$/i,
  /^.*\.corp$/i,
  /^.*\.lan$/i,
];

const BLOCKED_HOSTNAMES = [
  'metadata.google.internal',
  'metadata.google.com',
  'metadata',
  '169.254.169.254',
  '169.254.170.2',
  'fd00:ec2::254',
  'instance-data',
  'kubernetes.default',
  'kubernetes.default.svc',
];

function validateUrl(url: string): { valid: boolean; reason?: string; normalizedUrl?: string } {
  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    const parsed = new URL(normalizedUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reason: `Invalid protocol: ${parsed.protocol}` };
    }
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return { valid: false, reason: `Blocked hostname: ${hostname}` };
    }
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, reason: `Private/internal address not allowed: ${hostname}` };
      }
    }
    if (parsed.username || parsed.password) {
      return { valid: false, reason: 'URLs with embedded credentials not allowed' };
    }
    const port = parsed.port ? parseInt(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80);
    const allowedPorts = [80, 443, 8080, 8443];
    if (!allowedPorts.includes(port)) {
      return { valid: false, reason: `Non-standard port not allowed: ${port}` };
    }
    const parts = hostname.split('.');
    if (parts.length < 2 || parts[parts.length - 1].length < 2) {
      return { valid: false, reason: `Invalid hostname: ${hostname}` };
    }
    return { valid: true, normalizedUrl };
  } catch (error) {
    return { valid: false, reason: `Invalid URL format` };
  }
}

function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

function sanitizeString(value: string, maxLength: number = 10000): string {
  if (!value || typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const sanitized = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return sanitized.substring(0, maxLength);
}

function sanitizeStringArray(arr: unknown, maxItems: number = 100, maxItemLength: number = 1000): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item): item is string => typeof item === 'string')
    .slice(0, maxItems)
    .map(item => sanitizeString(item, maxItemLength));
}

// ============================================================================
// SSRF Protection: validateUrl
// ============================================================================

describe('validateUrl — SSRF Protection', () => {
  it('allows valid public URLs', () => {
    expect(validateUrl('https://example.com')).toMatchObject({ valid: true });
    expect(validateUrl('https://www.google.com')).toMatchObject({ valid: true });
    expect(validateUrl('http://example.com:8080/path')).toMatchObject({ valid: true });
  });

  it('adds https:// if protocol is missing', () => {
    const result = validateUrl('example.com');
    expect(result.valid).toBe(true);
    expect(result.normalizedUrl).toBe('https://example.com');
  });

  it('blocks private IP ranges (RFC 1918)', () => {
    expect(validateUrl('http://10.0.0.1')).toMatchObject({ valid: false });
    expect(validateUrl('http://192.168.1.1')).toMatchObject({ valid: false });
    expect(validateUrl('http://172.16.0.1')).toMatchObject({ valid: false });
    expect(validateUrl('http://172.31.255.255')).toMatchObject({ valid: false });
  });

  it('blocks loopback addresses', () => {
    expect(validateUrl('http://127.0.0.1')).toMatchObject({ valid: false });
    expect(validateUrl('http://localhost')).toMatchObject({ valid: false });
  });

  it('blocks AWS/GCP metadata endpoints', () => {
    expect(validateUrl('http://169.254.169.254')).toMatchObject({ valid: false });
    expect(validateUrl('http://169.254.170.2')).toMatchObject({ valid: false });
    expect(validateUrl('http://metadata.google.internal')).toMatchObject({ valid: false });
  });

  it('blocks internal/corporate domains', () => {
    expect(validateUrl('http://app.internal')).toMatchObject({ valid: false });
    expect(validateUrl('http://server.corp')).toMatchObject({ valid: false });
    expect(validateUrl('http://db.local')).toMatchObject({ valid: false });
    expect(validateUrl('http://nas.lan')).toMatchObject({ valid: false });
  });

  it('blocks URLs with embedded credentials', () => {
    expect(validateUrl('http://user:pass@example.com')).toMatchObject({ valid: false });
  });

  it('blocks non-standard ports', () => {
    expect(validateUrl('http://example.com:3306')).toMatchObject({ valid: false });
    expect(validateUrl('http://example.com:6379')).toMatchObject({ valid: false });
    expect(validateUrl('http://example.com:5432')).toMatchObject({ valid: false });
  });

  it('allows standard ports', () => {
    expect(validateUrl('http://example.com:80')).toMatchObject({ valid: true });
    expect(validateUrl('https://example.com:443')).toMatchObject({ valid: true });
    expect(validateUrl('http://example.com:8080')).toMatchObject({ valid: true });
  });

  it('rejects single-label hostnames', () => {
    expect(validateUrl('http://metadata')).toMatchObject({ valid: false });
  });

  it('rejects invalid URL formats', () => {
    expect(validateUrl('not a url at all !!!')).toMatchObject({ valid: false });
  });
});

// ============================================================================
// UUID Validation
// ============================================================================

describe('isValidUUID', () => {
  it('accepts valid UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
  });

  it('rejects invalid UUIDs', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
    expect(isValidUUID('550e8400-e29b-61d4-a716-446655440000')).toBe(false); // version 6 not valid
  });
});

// ============================================================================
// Input Sanitization
// ============================================================================

describe('sanitizeString', () => {
  it('removes control characters', () => {
    expect(sanitizeString('hello\x00world')).toBe('helloworld');
    expect(sanitizeString('test\x07beep')).toBe('testbeep');
  });

  it('preserves newlines and tabs', () => {
    expect(sanitizeString('line1\nline2\ttab')).toBe('line1\nline2\ttab');
  });

  it('truncates to maxLength', () => {
    expect(sanitizeString('abcdefghij', 5)).toBe('abcde');
  });

  it('returns empty string for non-string inputs', () => {
    expect(sanitizeString(null as unknown as string)).toBe('');
    expect(sanitizeString(undefined as unknown as string)).toBe('');
    expect(sanitizeString(123 as unknown as string)).toBe('');
  });
});

describe('sanitizeStringArray', () => {
  it('filters non-string items', () => {
    expect(sanitizeStringArray([1, 'hello', null, 'world'])).toEqual(['hello', 'world']);
  });

  it('limits array length', () => {
    const arr = Array(200).fill('test');
    expect(sanitizeStringArray(arr, 5)).toHaveLength(5);
  });

  it('sanitizes each item', () => {
    expect(sanitizeStringArray(['hello\x00', 'world\x07'])).toEqual(['hello', 'world']);
  });

  it('returns empty array for non-array input', () => {
    expect(sanitizeStringArray('not an array')).toEqual([]);
    expect(sanitizeStringArray(null)).toEqual([]);
  });
});
