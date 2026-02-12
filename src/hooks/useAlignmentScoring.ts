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

      const MAX_RETRIES = 3;
      const BASE_DELAY = 4000; // 4s between requests
      let successful = 0;
      let failed = 0;

      try {
        for (let i = 0; i < unscoredBuyers.length; i++) {
          if (cancelRef.current) {
            toast.info("Alignment scoring cancelled");
            break;
          }

          const buyer = unscoredBuyers[i];
          let scored = false;

          for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (cancelRef.current) break;

            // On retry, wait with exponential backoff
            if (attempt > 0) {
              const backoff = BASE_DELAY * Math.pow(2, attempt); // 8s, 16s
              console.log(`Retry ${attempt} for ${buyer.company_name}, waiting ${backoff}ms`);
              await new Promise((resolve) => setTimeout(resolve, backoff));
            }

            const response = await supabase.functions.invoke("score-industry-alignment", {
              body: { buyerId: buyer.id, universeId },
            });

            // Check for M&A guide missing error
            if (response.data?.error_code === "ma_guide_missing") {
              toast.error(
                "M&A Guide required. Please create an industry guide before scoring.",
                { duration: 10000 }
              );
              cancelRef.current = true;
              break;
            }

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
              console.warn(`Rate limited on ${buyer.company_name}, attempt ${attempt + 1}`);
              // Will retry after backoff
              continue;
            }

            if (response.data?.success || (!response.error && !response.data?.error_code)) {
              successful++;
              scored = true;
              break;
            }

            if (response.error) {
              console.error("Scoring error:", response.error);
              failed++;
              scored = true; // Don't retry non-rate-limit errors
              break;
            }
          }

          if (!scored && !cancelRef.current) {
            failed++;
            console.warn(`Failed after ${MAX_RETRIES} retries: ${buyer.company_name}`);
          }

          // Check if we need to stop
          if (cancelRef.current) break;

          // Update progress
          setProgress({
            current: i + 1,
            total: unscoredBuyers.length,
            successful,
            failed,
            creditsDepleted: false,
          });

          // Delay before next buyer
          if (i + 1 < unscoredBuyers.length && !cancelRef.current) {
            await new Promise((resolve) => setTimeout(resolve, BASE_DELAY));
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
