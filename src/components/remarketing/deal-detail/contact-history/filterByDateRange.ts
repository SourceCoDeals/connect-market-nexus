/**
 * filterByDateRange.ts
 *
 * Filters an array of UnifiedActivityEntry by a date-range preset.
 *
 * Extracted from ContactHistoryTracker.tsx
 */
import { subDays } from 'date-fns';
import type { UnifiedActivityEntry } from '@/hooks/use-contact-combined-history';

export type DateRangeValue = '7d' | '30d' | '90d' | 'all';

function getDateRangeCutoff(range: DateRangeValue): Date | null {
  switch (range) {
    case '7d':
      return subDays(new Date(), 7);
    case '30d':
      return subDays(new Date(), 30);
    case '90d':
      return subDays(new Date(), 90);
    case 'all':
    default:
      return null;
  }
}

export function filterByDateRange(
  entries: UnifiedActivityEntry[],
  range: DateRangeValue,
): UnifiedActivityEntry[] {
  const cutoff = getDateRangeCutoff(range);
  if (!cutoff) return entries;
  return entries.filter((e) => new Date(e.timestamp) >= cutoff);
}
