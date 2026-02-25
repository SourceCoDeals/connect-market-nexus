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
  errors?: string[];
}

interface BulkSyncOptions {
  /** Fetch full transcript content after pairing. Default true. */
  fetchContent?: boolean;
  /** How many transcripts to fetch content for per batch. Default 10, max 25. */
  contentBatchSize?: number;
}

export function useFirefliesBulkSync() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkSyncResult | null>(null);
  const queryClient = useQueryClient();

  const runBulkSync = async (options?: BulkSyncOptions) => {
    setLoading(true);
    setResult(null);
    const toastId = toast.loading(
      "Pulling ALL Fireflies transcripts — this may take a few minutes...",
    );

    try {
      const { data, error } = await supabase.functions.invoke(
        "bulk-sync-all-fireflies",
        {
          body: {
            fetchContent: options?.fetchContent ?? true,
            contentBatchSize: options?.contentBatchSize ?? 10,
          },
        },
      );

      if (error) throw error;

      const res = data as BulkSyncResult;
      setResult(res);

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

      queryClient.invalidateQueries({ queryKey: ["remarketing"] });
      queryClient.invalidateQueries({
        queryKey: ["fireflies-integration-stats"],
      });
      queryClient.invalidateQueries({
        queryKey: ["fireflies-recent-pairings"],
      });
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
