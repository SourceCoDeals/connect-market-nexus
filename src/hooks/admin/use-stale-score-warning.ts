/**
 * useStaleScoreWarning
 *
 * Utility hook that determines whether a set of buyer recommendation scores
 * should be considered "stale" based on the cache timestamp. Scores are
 * considered stale when they are older than the configured threshold
 * (default: 7 days).
 *
 * This hook is designed to be consumed by any component that displays
 * recommended buyer data and wants to warn the user that the scores may
 * be out of date. It intentionally lives outside of
 * PipelineDetailRecommendedBuyers.tsx so it can be composed independently.
 *
 * @param cachedAt       - ISO 8601 timestamp of when the scores were last computed.
 * @param staleDays      - Number of days after which scores are considered stale (default 7).
 *
 * @returns
 *  - `isStale`           — `true` when the score data is older than `staleDays`.
 *  - `daysSinceScored`   — Number of whole days since the scores were computed.
 *  - `staleMessage`      — Human-readable warning string suitable for display in an Alert.
 */

import { useMemo } from 'react';

interface StaleScoreWarning {
  isStale: boolean;
  daysSinceScored: number;
  staleMessage: string;
}

export function useStaleScoreWarning(
  cachedAt: string | undefined | null,
  staleDays = 7,
): StaleScoreWarning {
  return useMemo(() => {
    if (!cachedAt) {
      return {
        isStale: false,
        daysSinceScored: 0,
        staleMessage: '',
      };
    }

    const cachedDate = new Date(cachedAt);
    const now = new Date();
    const diffMs = now.getTime() - cachedDate.getTime();
    const daysSinceScored = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const isStale = daysSinceScored >= staleDays;

    const staleMessage = isStale
      ? `These buyer scores are ${daysSinceScored} day${daysSinceScored !== 1 ? 's' : ''} old and may not reflect recent changes. Re-run scoring in ReMarketing to refresh.`
      : '';

    return { isStale, daysSinceScored, staleMessage };
  }, [cachedAt, staleDays]);
}

export default useStaleScoreWarning;
