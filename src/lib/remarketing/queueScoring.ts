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
  const { data: existing, error: existingError } = await supabase
    .from("remarketing_scoring_queue")
    .select("listing_id")
    .eq("universe_id", universeId)
    .eq("score_type", "deal")
    .in("status", ["pending", "processing"])
    .in("listing_id", listingIds);
  if (existingError) throw existingError;

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

  // Use RPC to handle partial unique index (PostgREST .upsert() can't target partial indexes)
  const upsertErrors: string[] = [];
  await Promise.all(
    rows.map(async (row) => {
      const { error } = await supabase.rpc('upsert_deal_scoring_queue', {
        p_universe_id: row.universe_id,
        p_listing_id: row.listing_id,
        p_score_type: row.score_type,
        p_status: row.status,
      });
      if (error) upsertErrors.push(error.message);
    })
  );
  if (upsertErrors.length > 0) {
    console.error("Failed to queue deal scoring:", upsertErrors);
    toast.error("Failed to queue scoring");
    throw new Error(upsertErrors.join('; '));
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

  const { data: existing, error: existingError } = await supabase
    .from("remarketing_scoring_queue")
    .select("buyer_id")
    .eq("universe_id", universeId)
    .eq("score_type", "alignment")
    .in("status", ["pending", "processing"])
    .in("buyer_id", buyerIds);
  if (existingError) throw existingError;

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

  // Use RPC to handle partial unique index (PostgREST .upsert() can't target partial indexes)
  const upsertErrors: string[] = [];
  await Promise.all(
    rows.map(async (row) => {
      const { error } = await supabase.rpc('upsert_alignment_scoring_queue', {
        p_universe_id: row.universe_id,
        p_buyer_id: row.buyer_id,
        p_score_type: row.score_type,
        p_status: row.status,
      });
      if (error) upsertErrors.push(error.message);
    })
  );
  if (upsertErrors.length > 0) {
    console.error("Failed to queue alignment scoring:", upsertErrors);
    toast.error("Failed to queue scoring");
    throw new Error(upsertErrors.join('; '));
  }

  supabase.functions.invoke("process-scoring-queue", {
    body: { trigger: "alignment-scoring" },
  }).catch(err => console.warn("Worker trigger failed:", err));

  toast.info(`Queued ${newIds.length} buyer(s) for alignment scoring`);
  return newIds.length;
}

/**
 * Queue deal scoring across ALL active universes for a given listing.
 * Use this when universe context is unknown (e.g. MA Intelligence module).
 */
export async function queueDealScoringAllUniverses(listingId: string): Promise<number> {
  // Find universes the deal is already assigned to
  const { data: universeLinks } = await supabase
    .from("remarketing_universe_deals")
    .select("universe_id")
    .eq("listing_id", listingId)
    .eq("status", "active");

  let universeIds = (universeLinks || []).map(l => l.universe_id);

  // Fall back to all active universes if not assigned to any
  if (universeIds.length === 0) {
    const { data: allUniverses } = await supabase
      .from("remarketing_buyer_universes")
      .select("id")
      .eq("archived", false);
    universeIds = (allUniverses || []).map(u => u.id);
  }

  if (universeIds.length === 0) {
    toast.info("No buyer universes available for scoring");
    return 0;
  }

  let totalQueued = 0;
  for (const uid of universeIds) {
    try {
      totalQueued += await queueDealScoring({ universeId: uid, listingIds: [listingId] });
    } catch (err) {
      console.warn(`[queueDealScoringAllUniverses] Failed for universe ${uid}:`, err);
    }
  }
  return totalQueued;
}

/**
 * Queue deal quality scoring via the calculate-deal-quality edge function.
 * Consolidates all callers into a single utility with proper toast feedback.
 */
export async function queueDealQualityScoring(
  options:
    | { listingIds: string[] }
    | { mode: "all" | "unscored"; forceRecalculate?: boolean; triggerEnrichment?: boolean }
    | { batchSource: string; unscoredOnly?: boolean; globalQueueId?: string }
): Promise<{ scored: number; errors: number; enrichmentQueued?: number }> {
  let body: Record<string, unknown>;

  if ("listingIds" in options) {
    const { listingIds } = options;
    if (listingIds.length === 0) return { scored: 0, errors: 0 };

    // Process multiple deals sequentially through the edge function
    let scored = 0;
    let errors = 0;
    for (const listingId of listingIds) {
      try {
        const { error } = await supabase.functions.invoke("calculate-deal-quality", {
          body: { listingId },
        });
        if (error) { errors++; } else { scored++; }
      } catch {
        errors++;
      }
    }
    toast.info(`Scored ${scored} deal(s)${errors > 0 ? ` (${errors} failed)` : ""}`);
    return { scored, errors };
  }

  if ("batchSource" in options) {
    body = {
      batchSource: options.batchSource,
      unscoredOnly: options.unscoredOnly ?? false,
      globalQueueId: options.globalQueueId,
    };
  } else {
    body = options.forceRecalculate
      ? { forceRecalculate: true, triggerEnrichment: options.triggerEnrichment ?? false }
      : { calculateAll: true };
  }

  const { data, error } = await supabase.functions.invoke("calculate-deal-quality", { body });
  if (error) {
    toast.error("Failed to calculate scores");
    throw error;
  }

  const scored = data?.scored ?? 0;
  const errors = data?.errors ?? 0;
  const enrichmentQueued = data?.enrichmentQueued ?? 0;

  if (scored === 0 && !enrichmentQueued) {
    toast.info("All deals already have quality scores");
  } else {
    const enrichMsg = enrichmentQueued > 0 ? `. Queued ${enrichmentQueued} deals for enrichment.` : "";
    toast.success(`Scored ${scored} deal(s)${errors > 0 ? ` (${errors} errors)` : ""}${enrichMsg}`);
  }
  return { scored, errors, enrichmentQueued };
}
