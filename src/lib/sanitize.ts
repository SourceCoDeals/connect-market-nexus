/**
 * sanitize.ts — Input sanitization utilities for security hardening
 *
 * Provides HTML sanitization, SQL-safe escaping, URL validation,
 * and email validation to prevent XSS, injection, and other attacks.
 */

import DOMPurify from 'dompurify';

// ---------------------------------------------------------------------------
// HTML Sanitization
// ---------------------------------------------------------------------------

/**
 * Strict HTML sanitization configuration.
 * Only allows safe formatting tags; strips all event handlers, scripts,
 * iframes, forms, and other dangerous elements.
 */
const STRICT_SANITIZE_CONFIG: Record<string, unknown> = {
  ALLOWED_TAGS: [
    // Text formatting
    'p', 'br', 'strong', 'em', 'u', 's', 'span', 'sub', 'sup',
    // Headings
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // Lists
    'ul', 'ol', 'li',
    // Block elements
    'blockquote', 'div', 'pre', 'code', 'hr',
    // Links (href only, target only)
    'a',
    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel',
    // Table attributes
    'colspan', 'rowspan',
  ],
  ALLOW_DATA_ATTR: false,
  // Force all links to open safely
  ADD_ATTR: ['rel'],
  // Security flags
  SANITIZE_DOM: true,
  SAFE_FOR_TEMPLATES: true,
  // Block dangerous URI schemes
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * Sanitize HTML content, stripping dangerous tags, attributes, and scripts.
 * Uses DOMPurify under the hood with a strict allowlist.
 *
 * @param dirty - The untrusted HTML string
 * @param allowLinks - Whether to allow anchor tags (default true)
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export function sanitizeHtml(dirty: string, allowLinks = true): string {
  if (!dirty || typeof dirty !== 'string') return '';

  const config = { ...STRICT_SANITIZE_CONFIG };
  if (!allowLinks) {
    config.ALLOWED_TAGS = (config.ALLOWED_TAGS as string[])?.filter((tag: string) => tag !== 'a');
  }

  // Add noopener noreferrer to all links after sanitization
  const clean = DOMPurify.sanitize(dirty, config as DOMPurify.Config);

  // Post-process: ensure all <a> tags have rel="noopener noreferrer"
  return String(clean).replace(
    /<a\s/g,
    '<a rel="noopener noreferrer" '
  );
}

/**
 * Strip ALL HTML tags and return plain text only.
 * Useful for search indexing, notifications, previews.
 */
export function stripHtml(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') return '';
  const clean = DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  // Decode any remaining HTML entities
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  return doc.body.textContent || '';
}

// ---------------------------------------------------------------------------
// SQL-Safe String Escaping
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe inclusion in contexts where parameterized queries
 * are not available (e.g., dynamic column names in admin tools).
 *
 * IMPORTANT: Always prefer Supabase parameterized queries (.eq(), .filter(), etc.)
 * over manual escaping. This is a defense-in-depth measure only.
 */
export function escapeSqlString(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return input
    // Escape backslashes first
    .replace(/\\/g, '\\\\')
    // Escape single quotes (SQL standard)
    .replace(/'/g, "''")
    // Remove null bytes
    .replace(/\0/g, '')
    // Escape semicolons to prevent statement chaining
    .replace(/;/g, '\\;')
    // Remove comment markers
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}

/**
 * Validate that a string contains only safe identifier characters.
 * Use for table/column names when dynamic SQL is unavoidable.
 */
export function isSafeIdentifier(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  // Only allow alphanumeric, underscores, and must start with letter/underscore
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input);
}

// ---------------------------------------------------------------------------
// URL Validation
// ---------------------------------------------------------------------------

/**
 * Validate a URL string for safety and correctness.
 * Only allows http:// and https:// protocols.
 * Rejects javascript:, data:, vbscript:, and other dangerous schemes.
 *
 * @param url - The URL to validate
 * @param requireHttps - If true, only allows https:// (default false)
 * @returns true if the URL is valid and safe
 */
export function isValidUrl(url: string | null | undefined, requireHttps = false): boolean {
  if (!url || typeof url !== 'string' || !url.trim()) return false;

  const trimmed = url.trim();

  // Block dangerous protocols explicitly
  const dangerousProtocols = /^(javascript|data|vbscript|blob|file):/i;
  if (dangerousProtocols.test(trimmed)) return false;

  try {
    // If no protocol, prepend https:// for URL parsing
    const urlToParse = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(urlToParse);

    // Only allow http(s) protocols
    if (requireHttps && parsed.protocol !== 'https:') return false;
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    // Must have a valid hostname with at least one dot (no localhost-only)
    if (!parsed.hostname.includes('.')) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize a URL by validating and normalizing it.
 * Returns empty string if invalid or dangerous.
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string' || !url.trim()) return '';

  const trimmed = url.trim();

  // Block dangerous protocols
  if (/^(javascript|data|vbscript|blob|file):/i.test(trimmed)) return '';

  // Add https:// if no protocol
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Email Validation
// ---------------------------------------------------------------------------

/**
 * Validate an email address format.
 * Uses a comprehensive regex that handles most real-world email formats.
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string' || !email.trim()) return false;

  const trimmed = email.trim().toLowerCase();

  // Length limits per RFC 5321
  if (trimmed.length > 254) return false;

  // Split and check local/domain parts
  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || local.length > 64) return false;
  if (!domain || domain.length > 253) return false;

  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

  return emailRegex.test(trimmed);
}

/**
 * Sanitize an email by trimming, lowercasing, and validating.
 * Returns empty string if invalid.
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';

  const trimmed = email.trim().toLowerCase();
  return isValidEmail(trimmed) ? trimmed : '';
}

// ---------------------------------------------------------------------------
// General Input Sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize a plain text input by removing control characters and trimming.
 * Does NOT strip HTML (use sanitizeHtml or stripHtml for that).
 */
export function sanitizeTextInput(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';

  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove other control characters (except newline, tab, carriage return)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Sanitize a phone number input — only digits, spaces, dashes, parens, plus.
 */
export function sanitizePhoneNumber(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[^\d\s\-+().]/g, '').trim();
}
