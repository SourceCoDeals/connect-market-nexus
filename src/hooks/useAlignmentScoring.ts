import { useState, useCallback } from "react";
import { queueAlignmentScoring } from "@/lib/remarketing/queueScoring";
import { toast } from "sonner";

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
    toast.info("Scoring runs in the background — check the activity bar for progress.");
  }, []);

  const scoreBuyers = useCallback(
    async (buyers: BuyerToScore[], onComplete?: () => void) => {
      if (!universeId || buyers.length === 0) {
        toast.info("No buyers to score");
        return;
      }

      const unscoredBuyers = buyers.filter((b) => b.alignment_score === null);
      if (unscoredBuyers.length === 0) {
        toast.info("All buyers have already been scored");
        return;
      }

      setIsScoring(true);
      setProgress({ current: 0, total: unscoredBuyers.length, successful: 0, failed: 0, creditsDepleted: false });

      try {
        const queued = await queueAlignmentScoring({
          universeId,
          buyerIds: unscoredBuyers.map((b) => b.id),
        });

        setProgress((prev) => ({ ...prev, current: queued, successful: queued }));
        onComplete?.();
      } catch (error) {
        console.error("Failed to queue alignment scoring:", error);
        toast.error("Failed to queue scoring. Please try again.");
      } finally {
        setIsScoring(false);
      }
    },
    [universeId]
  );

  return { isScoring, progress, scoreBuyers, cancel, reset };
}

export default useAlignmentScoring;
