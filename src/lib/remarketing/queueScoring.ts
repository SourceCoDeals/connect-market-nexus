/**
 * Shared utility to queue scoring tasks into remarketing_scoring_queue
 * and trigger the background worker.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QueueDealScoringParams {
  universeId: string;
  listingIds: string[];
}

interface QueueAlignmentScoringParams {
  universeId: string;
  buyerIds: string[];
}

/**
 * Queue deal scoring for one or more listings against all buyers in a universe.
 * Each listing gets one queue entry.
 */
export async function queueDealScoring({ universeId, listingIds }: QueueDealScoringParams): Promise<number> {
  if (listingIds.length === 0) return 0;

  // Check which listings are already queued/processing to avoid duplicates
  const { data: existing } = await supabase
    .from("remarketing_scoring_queue")
    .select("listing_id")
    .eq("universe_id", universeId)
    .eq("score_type", "deal")
    .in("status", ["pending", "processing"])
    .in("listing_id", listingIds);

  const existingSet = new Set((existing || []).map(e => e.listing_id));
  const newIds = listingIds.filter(id => !existingSet.has(id));

  if (newIds.length === 0) {
    toast.info("Scoring already in progress for these deals");
    return 0;
  }

  const rows = newIds.map(listingId => ({
    universe_id: universeId,
    listing_id: listingId,
    score_type: "deal" as const,
    status: "pending" as const,
  }));

  const { error } = await supabase
    .from("remarketing_scoring_queue")
    .upsert(rows, { onConflict: "universe_id,listing_id,score_type", ignoreDuplicates: false });
  if (error) {
    console.error("Failed to queue deal scoring:", error);
    toast.error("Failed to queue scoring");
    throw error;
  }

  // Fire-and-forget worker invocation
  supabase.functions.invoke("process-scoring-queue", {
    body: { trigger: "deal-scoring" },
  }).catch(err => console.warn("Worker trigger failed:", err));

  toast.info(`Queued ${newIds.length} deal(s) for background scoring`);
  return newIds.length;
}

/**
 * Queue alignment scoring for one or more buyers in a universe.
 */
export async function queueAlignmentScoring({ universeId, buyerIds }: QueueAlignmentScoringParams): Promise<number> {
  if (buyerIds.length === 0) return 0;

  const { data: existing } = await supabase
    .from("remarketing_scoring_queue")
    .select("buyer_id")
    .eq("universe_id", universeId)
    .eq("score_type", "alignment")
    .in("status", ["pending", "processing"])
    .in("buyer_id", buyerIds);

  const existingSet = new Set((existing || []).map(e => e.buyer_id));
  const newIds = buyerIds.filter(id => !existingSet.has(id));

  if (newIds.length === 0) {
    toast.info("Alignment scoring already in progress");
    return 0;
  }

  const rows = newIds.map(buyerId => ({
    universe_id: universeId,
    buyer_id: buyerId,
    score_type: "alignment" as const,
    status: "pending" as const,
  }));

  const { error } = await supabase
    .from("remarketing_scoring_queue")
    .upsert(rows, { onConflict: "universe_id,buyer_id,score_type", ignoreDuplicates: false });
  if (error) {
    console.error("Failed to queue alignment scoring:", error);
    toast.error("Failed to queue scoring");
    throw error;
  }

  supabase.functions.invoke("process-scoring-queue", {
    body: { trigger: "alignment-scoring" },
  }).catch(err => console.warn("Worker trigger failed:", err));

  toast.info(`Queued ${newIds.length} buyer(s) for alignment scoring`);
  return newIds.length;
}
