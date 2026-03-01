/**
 * formatDuration.ts
 *
 * Formats a duration in seconds to a human-readable "Xm Ys" string.
 *
 * Extracted from ContactHistoryTracker.tsx
 */

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}
