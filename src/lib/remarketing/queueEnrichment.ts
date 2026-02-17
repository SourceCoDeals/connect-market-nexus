/**
 * Shared utility to queue enrichment tasks into existing queue tables
 * and trigger the background workers.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Queue a single deal for enrichment via the enrichment_queue table.
 * The process-enrichment-queue worker will pick it up.
 */
export async function queueDealEnrichment(dealIds: string[]): Promise<number> {
  if (dealIds.length === 0) return 0;

  // Check which are already queued
  const { data: existing } = await supabase
    .from("enrichment_queue")
    .select("listing_id")
    .in("status", ["pending", "processing"])
    .in("listing_id", dealIds);

  const existingSet = new Set((existing || []).map((e: any) => e.listing_id));
  const newIds = dealIds.filter(id => !existingSet.has(id));

  if (newIds.length === 0) {
    toast.info("Enrichment already in progress for these deals");
    return 0;
  }

  const rows = newIds.map(id => ({
    listing_id: id,
    status: "pending",
    attempts: 0,
    queued_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("enrichment_queue")
    .upsert(rows, { onConflict: "listing_id", ignoreDuplicates: false });
  if (error) {
    console.error("Failed to queue deal enrichment:", error);
    toast.error("Failed to queue enrichment");
    throw error;
  }

  // Trigger the worker
  supabase.functions.invoke("process-enrichment-queue", {
    body: { trigger: "deal-enrichment" },
  }).catch(err => console.warn("Worker trigger failed:", err));

  if (newIds.length === 1) {
    toast.info("Deal queued for background enrichment");
  } else {
    toast.info(`Queued ${newIds.length} deal(s) for background enrichment`);
  }
  return newIds.length;
}

/**
 * Queue buyer(s) for enrichment via the buyer_enrichment_queue table.
 * The process-buyer-enrichment-queue worker will pick them up.
 */
export async function queueBuyerEnrichment(buyerIds: string[], universeId?: string): Promise<number> {
  if (buyerIds.length === 0) return 0;

  // Check which are already queued
  const { data: existing } = await supabase
    .from("buyer_enrichment_queue")
    .select("buyer_id")
    .in("status", ["pending", "processing"])
    .in("buyer_id", buyerIds);

  const existingSet = new Set((existing || []).map((e: any) => e.buyer_id));
  const newIds = buyerIds.filter(id => !existingSet.has(id));

  if (newIds.length === 0) {
    toast.info("Enrichment already in progress for these buyers");
    return 0;
  }

  const rows = newIds.map(id => ({
    buyer_id: id,
    universe_id: universeId || null,
    status: "pending",
    attempts: 0,
    queued_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("buyer_enrichment_queue")
    .upsert(rows, { onConflict: "buyer_id", ignoreDuplicates: false });

  if (error) {
    console.error("Failed to queue buyer enrichment:", error);
    toast.error("Failed to queue enrichment");
    throw error;
  }

  // Trigger the worker
  supabase.functions.invoke("process-buyer-enrichment-queue", {
    body: { trigger: "buyer-enrichment" },
  }).catch(err => console.warn("Worker trigger failed:", err));

  if (newIds.length === 1) {
    toast.info("Buyer queued for background enrichment");
  } else {
    toast.info(`Queued ${newIds.length} buyer(s) for background enrichment`);
  }
  return newIds.length;
}
