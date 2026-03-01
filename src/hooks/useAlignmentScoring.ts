/**
 * useAlignmentScoring
 *
 * React hook that queues and tracks buyer alignment scoring for a given
 * buyer universe. It filters out buyers that already have an alignment score,
 * passes the remaining buyer IDs to {@link queueAlignmentScoring} which inserts
 * rows into `remarketing_scoring_queue` and triggers the background scoring
 * edge function (`process-scoring-queue`).
 *
 * Data flow:
 *   remarketing_scoring_queue (insert) -> process-scoring-queue (edge fn) ->
 *   remarketing_scores (write-back)
 *
 * @param universeId - The buyer universe to score against. When undefined the
 *                     hook is inert and `scoreBuyers` will no-op with a toast.
 *
 * @returns
 *  - `isScoring`  — `true` while the queue request is in flight.
 *  - `progress`   — Current/total/successful/failed counters and a
 *                    `creditsDepleted` flag.
 *  - `scoreBuyers(buyers, onComplete?)` — Accepts an array of
 *                    `{ id, company_name, alignment_score }` objects, filters
 *                    to unscored entries, and queues them for scoring.
 *  - `cancel`     — Shows an informational toast (scoring runs in background).
 *  - `reset`      — Resets progress and scoring state to initial values.
 */

import { useState, useCallback } from 'react';
import { queueAlignmentScoring } from '@/lib/remarketing/queueScoring';
import { toast } from 'sonner';

interface AlignmentScoringProgress {
  current: number;
  total: number;
  successful: number;
  failed: number;
  creditsDepleted: boolean;
}

interface BuyerToScore {
  id: string;
  company_name: string;
  alignment_score: number | null;
}

export function useAlignmentScoring(universeId: string | undefined) {
  const [isScoring, setIsScoring] = useState(false);
  const [progress, setProgress] = useState<AlignmentScoringProgress>({
    current: 0,
    total: 0,
    successful: 0,
    failed: 0,
    creditsDepleted: false,
  });

  const reset = useCallback(() => {
    setIsScoring(false);
    setProgress({ current: 0, total: 0, successful: 0, failed: 0, creditsDepleted: false });
  }, []);

  const cancel = useCallback(() => {
    toast.info('Scoring runs in the background — check the activity bar for progress.');
  }, []);

  const scoreBuyers = useCallback(
    async (buyers: BuyerToScore[], onComplete?: () => void) => {
      if (!universeId || buyers.length === 0) {
        toast.info('No buyers to score');
        return;
      }

      const unscoredBuyers = buyers.filter((b) => b.alignment_score === null);
      if (unscoredBuyers.length === 0) {
        toast.info('All buyers have already been scored');
        return;
      }

      setIsScoring(true);
      setProgress({
        current: 0,
        total: unscoredBuyers.length,
        successful: 0,
        failed: 0,
        creditsDepleted: false,
      });

      try {
        const queued = await queueAlignmentScoring({
          universeId,
          buyerIds: unscoredBuyers.map((b) => b.id),
        });

        setProgress((prev) => ({ ...prev, current: queued, successful: queued }));
        onComplete?.();
      } catch (error) {
        toast.error('Failed to queue scoring. Please try again.');
      } finally {
        setIsScoring(false);
      }
    },
    [universeId],
  );

  return { isScoring, progress, scoreBuyers, cancel, reset };
}

export default useAlignmentScoring;
