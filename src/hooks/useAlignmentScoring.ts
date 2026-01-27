import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const cancelRef = useRef(false);

  const reset = useCallback(() => {
    setIsScoring(false);
    setProgress({
      current: 0,
      total: 0,
      successful: 0,
      failed: 0,
      creditsDepleted: false,
    });
    cancelRef.current = false;
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    toast.info("Stopping alignment scoring...");
  }, []);

  const scoreBuyers = useCallback(
    async (buyers: BuyerToScore[], onComplete?: () => void) => {
      if (!universeId || buyers.length === 0) {
        toast.info("No buyers to score");
        return;
      }

      // Filter to only unscored buyers
      const unscoredBuyers = buyers.filter((b) => b.alignment_score === null);

      if (unscoredBuyers.length === 0) {
        toast.info("All buyers have already been scored");
        return;
      }

      setIsScoring(true);
      cancelRef.current = false;
      setProgress({
        current: 0,
        total: unscoredBuyers.length,
        successful: 0,
        failed: 0,
        creditsDepleted: false,
      });

      const BATCH_SIZE = 3;
      const DELAY_BETWEEN_BATCHES = 2000;
      let successful = 0;
      let failed = 0;

      try {
        for (let i = 0; i < unscoredBuyers.length; i += BATCH_SIZE) {
          if (cancelRef.current) {
            toast.info("Alignment scoring cancelled");
            break;
          }

          const batch = unscoredBuyers.slice(i, i + BATCH_SIZE);

          // Process batch in parallel
          const batchResults = await Promise.allSettled(
            batch.map((buyer) =>
              supabase.functions.invoke("score-industry-alignment", {
                body: {
                  buyerId: buyer.id,
                  universeId,
                },
              })
            )
          );

          // Process results
          for (const result of batchResults) {
            if (result.status === "fulfilled") {
              const response = result.value;
              
              // Check for credit errors
              if (response.data?.error_code === "payment_required") {
                setProgress((prev) => ({ ...prev, creditsDepleted: true }));
                toast.error(
                  "AI credits depleted. Please add credits to continue scoring.",
                  { duration: 10000 }
                );
                cancelRef.current = true;
                break;
              }

              if (response.data?.error_code === "rate_limited") {
                failed++;
                console.warn("Rate limited, will continue with delay");
              } else if (response.data?.success) {
                successful++;
              } else if (response.error) {
                failed++;
                console.error("Scoring error:", response.error);
              } else {
                successful++;
              }
            } else {
              failed++;
              console.error("Batch scoring error:", result.reason);
            }
          }

          // Check if we need to stop due to credits
          if (cancelRef.current) break;

          // Update progress
          const current = Math.min(i + BATCH_SIZE, unscoredBuyers.length);
          setProgress({
            current,
            total: unscoredBuyers.length,
            successful,
            failed,
            creditsDepleted: false,
          });

          // Wait between batches
          if (i + BATCH_SIZE < unscoredBuyers.length && !cancelRef.current) {
            await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
          }
        }

        if (!cancelRef.current) {
          toast.success(
            `Alignment scoring complete: ${successful} scored${failed > 0 ? `, ${failed} failed` : ""}`
          );
        }

        onComplete?.();
      } catch (error) {
        console.error("Alignment scoring failed:", error);
        toast.error("Failed to score buyers. Please try again.");
      } finally {
        setIsScoring(false);
      }
    },
    [universeId]
  );

  return {
    isScoring,
    progress,
    scoreBuyers,
    cancel,
    reset,
  };
}

export default useAlignmentScoring;
