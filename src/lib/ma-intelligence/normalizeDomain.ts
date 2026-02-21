/**
 * Normalize a domain/URL to a consistent format for unique identification.
 * Removes protocol, www prefix, trailing slashes, and converts to lowercase.
 *
 * @example
 * normalizeDomain("https://www.example.com/") // "example.com"
 * normalizeDomain("WWW.Example.COM") // "example.com"
 * normalizeDomain("http://example.com/page") // "example.com"
 */
// Placeholder values that should be treated as NULL (matches SQL normalize_domain())
const PLACEHOLDER_VALUES = new Set([
  '<unknown>', 'unknown', 'n/a', 'tbd', 'pending', 'none', 'null',
]);

export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;

  try {
    // Trim whitespace
    let domain = input.trim();

    // Match SQL normalize_domain(): treat placeholder values as NULL
    if (!domain || PLACEHOLDER_VALUES.has(domain.toLowerCase())) return null;

    // If it looks like a URL, parse it
    if (domain.includes('://') || domain.includes('/')) {
      try {
        const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
        domain = url.hostname;
      } catch {
        // If URL parsing fails, continue with string manipulation
      }
    }

    // Remove protocol prefixes if still present
    domain = domain.replace(/^https?:\/\//i, '');

    // Remove www. prefix
    domain = domain.replace(/^www\./i, '');

    // Remove trailing slashes and paths
    domain = domain.split('/')[0];

    // Remove port number
    domain = domain.split(':')[0];

    // Convert to lowercase
    domain = domain.toLowerCase();

    // Validate: must have at least one dot and no spaces
    if (!domain.includes('.') || domain.includes(' ')) {
      return null;
    }

    return domain;
  } catch {
    return null;
  }
}
