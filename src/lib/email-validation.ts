/**
 * Shared email validity helpers.
 *
 * The enrichment pipeline occasionally writes literal junk strings
 * (e.g. "no email found", "none", "n/a") into work_email / buyer_intro_email.
 * Always run candidates through `pickValidEmail` before using one.
 */

export function isValidEmail(s?: string | null): boolean {
  if (!s) return false;
  const t = String(s).trim().toLowerCase();
  if (!t || t.length < 5) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return false;
  if (t.includes('no email')) return false;
  if (t === 'none' || t === 'n/a' || t === 'na' || t === 'null' || t === 'undefined') return false;
  return true;
}

export function pickValidEmail(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (isValidEmail(c)) return (c as string).trim();
  }
  return null;
}
