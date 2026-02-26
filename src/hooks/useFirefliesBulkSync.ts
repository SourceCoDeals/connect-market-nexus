import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BulkSyncResult {
  success: boolean;
  fireflies_total: number;
  pairing: {
    buyers_paired: number;
    buyers_skipped: number;
    deals_paired: number;
    deals_skipped: number;
    unmatched: number;
  };
  content:
    | {
        fetched: number;
        skipped_empty: number;
        failed: number;
        total_queued: number;
      }
    | string;
  elapsed_seconds?: number;
  timed_out?: boolean;
  resume_from_page?: number;
  content_still_needed?: number;
  errors?: string[];
}

export function useFirefliesBulkSync() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkSyncResult | null>(null);
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["remarketing"] });
    queryClient.invalidateQueries({
      queryKey: ["fireflies-integration-stats"],
    });
    queryClient.invalidateQueries({
      queryKey: ["fireflies-recent-pairings"],
    });
  };

  const runBulkSync = async () => {
    setLoading(true);
    setResult(null);
    const toastId = toast.loading(
      "Pulling ALL Fireflies transcripts — this may take a few minutes...",
    );

    try {
      let cumulativeResult: BulkSyncResult | null = null;
      let startPage = 0;

      // Phase 1: Keep calling until all pages are processed
      while (true) {
        const { data, error } = await supabase.functions.invoke(
          "bulk-sync-all-fireflies",
          {
            body: {
              phase: "all",
              fetchContent: true,
              contentBatchSize: 5,
              startPage,
            },
          },
        );

        if (error) throw error;
        const res = data as BulkSyncResult;

        if (!cumulativeResult) {
          cumulativeResult = res;
        } else {
          // Merge results from continuation calls
          cumulativeResult.fireflies_total += res.fireflies_total;
          cumulativeResult.pairing.buyers_paired += res.pairing.buyers_paired;
          cumulativeResult.pairing.buyers_skipped += res.pairing.buyers_skipped;
          cumulativeResult.pairing.deals_paired += res.pairing.deals_paired;
          cumulativeResult.pairing.deals_skipped += res.pairing.deals_skipped;
          cumulativeResult.pairing.unmatched += res.pairing.unmatched;
          if (
            typeof res.content === "object" &&
            typeof cumulativeResult.content === "object"
          ) {
            cumulativeResult.content.fetched += res.content.fetched;
            cumulativeResult.content.skipped_empty += res.content.skipped_empty;
            cumulativeResult.content.failed += res.content.failed;
            cumulativeResult.content.total_queued += res.content.total_queued;
          }
          cumulativeResult.elapsed_seconds =
            (cumulativeResult.elapsed_seconds || 0) +
            (res.elapsed_seconds || 0);
          if (res.errors?.length) {
            cumulativeResult.errors = [
              ...(cumulativeResult.errors || []),
              ...res.errors,
            ].slice(0, 50);
          }
        }

        // If it timed out, continue from where it left off
        if (res.timed_out && res.resume_from_page) {
          toast.loading(
            `Still syncing... ${cumulativeResult.fireflies_total} transcripts so far`,
            { id: toastId },
          );
          startPage = res.resume_from_page;
          continue;
        }

        // Done with pairing
        break;
      }

      // Phase 2: Backfill missing content if any
      const contentNeeded = cumulativeResult?.content_still_needed || 0;
      if (contentNeeded > 0) {
        toast.loading(
          `Pairing done! Now downloading ${contentNeeded} transcript texts...`,
          { id: toastId },
        );

        let remainingContent = contentNeeded;
        while (remainingContent > 0) {
          const { data, error } = await supabase.functions.invoke(
            "bulk-sync-all-fireflies",
            { body: { phase: "content", contentBatchSize: 5 } },
          );

          if (error) break;
          const contentRes = data as {
            fetched: number;
            skipped_empty: number;
            failed: number;
            remaining: number;
          };

          if (
            typeof cumulativeResult!.content === "object"
          ) {
            cumulativeResult!.content.fetched += contentRes.fetched;
            cumulativeResult!.content.skipped_empty +=
              contentRes.skipped_empty;
            cumulativeResult!.content.failed += contentRes.failed;
          }

          remainingContent = contentRes.remaining;
          if (remainingContent <= 0) break;

          toast.loading(
            `Downloading transcripts... ${remainingContent} remaining`,
            { id: toastId },
          );
        }
      }

      setResult(cumulativeResult!);

      // Build toast message
      const res = cumulativeResult!;
      const parts: string[] = [];
      parts.push(`${res.fireflies_total} transcripts scanned`);
      if (res.pairing.buyers_paired > 0)
        parts.push(`${res.pairing.buyers_paired} buyer links`);
      if (res.pairing.deals_paired > 0)
        parts.push(`${res.pairing.deals_paired} deal links`);
      if (typeof res.content === "object" && res.content.fetched > 0)
        parts.push(`${res.content.fetched} transcripts downloaded`);

      if (
        res.pairing.buyers_paired > 0 ||
        res.pairing.deals_paired > 0 ||
        (typeof res.content === "object" && res.content.fetched > 0)
      ) {
        toast.success(parts.join(", "), { id: toastId });
      } else {
        toast.info(
          `Scanned ${res.fireflies_total} transcripts — everything already synced`,
          { id: toastId },
        );
      }

      if (res.errors?.length) {
        toast.warning(
          `${res.errors.length} error${res.errors.length !== 1 ? "s" : ""} during sync`,
        );
      }

      invalidateQueries();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Bulk sync failed: ${error.message}`
          : "Bulk sync failed",
        { id: toastId },
      );
    } finally {
      setLoading(false);
    }
  };

  return { loading, result, runBulkSync };
}
