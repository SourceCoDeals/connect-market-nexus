/**
 * StaleScoreWarning
 *
 * A standalone alert component that displays a warning when buyer
 * recommendation scores are older than a configurable threshold.
 * Wraps the `useStaleScoreWarning` hook so consumers can drop it in
 * without any additional logic.
 *
 * Usage:
 *   <StaleScoreWarning cachedAt={data.cachedAt} />
 *
 * Renders nothing when scores are fresh.
 */

import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStaleScoreWarning } from '@/hooks/admin/use-stale-score-warning';

interface StaleScoreWarningProps {
  /** ISO 8601 timestamp from the scoring cache. */
  cachedAt: string | undefined | null;
  /** Days after which the warning appears (default 7). */
  staleDays?: number;
  /** Optional className for the outer Alert. */
  className?: string;
}

export function StaleScoreWarning({ cachedAt, staleDays = 7, className }: StaleScoreWarningProps) {
  const { isStale, staleMessage } = useStaleScoreWarning(cachedAt, staleDays);

  if (!isStale) return null;

  return (
    <Alert className={`border-amber-200 bg-amber-50 ${className ?? ''}`}>
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-sm text-amber-800">{staleMessage}</AlertDescription>
    </Alert>
  );
}

export default StaleScoreWarning;
