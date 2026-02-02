import { supabase } from "@/integrations/supabase/client";

/**
 * Delete all related records for a buyer before deleting the buyer
 * Updated to work with current schema (remarketing_buyers, remarketing_scores)
 */
export async function deleteBuyerWithRelated(buyerId: string): Promise<{ error: Error | null }> {
  try {
    // Delete buyer_contacts if it exists
    await supabase.from("buyer_contacts").delete().eq("buyer_id", buyerId);

    // Delete buyer_transcripts - schema may not have url/transcript_type
    await supabase.from("buyer_transcripts").delete().eq("buyer_id", buyerId);

    // Delete remarketing_scores for this buyer
    await supabase.from("remarketing_scores").delete().eq("buyer_id", buyerId);

    // Delete call_intelligence
    await supabase.from("call_intelligence").delete().eq("buyer_id", buyerId);

    // Try to delete from remarketing_buyers first, fall back to buyers
    let { error } = await supabase.from("remarketing_buyers").delete().eq("id", buyerId);
    
    if (error) {
      // Fallback - try buyers table if it exists
      const result = await (supabase as any).from("buyers").delete().eq("id", buyerId);
      error = result.error;
    }

    if (error) throw error;

    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

/**
 * Delete all related records for a deal before deleting the deal
 */
export async function deleteDealWithRelated(dealId: string): Promise<{ error: Error | null }> {
  try {
    // Delete remarketing_scores for this deal/listing
    await supabase.from("remarketing_scores").delete().eq("listing_id", dealId);

    // Delete call_intelligence
    await supabase.from("call_intelligence").delete().eq("deal_id", dealId);

    // Finally delete the deal
    const { error } = await supabase.from("deals").delete().eq("id", dealId);

    if (error) throw error;

    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

/**
 * Delete all related records for a tracker before deleting the tracker
 */
export async function deleteTrackerWithRelated(trackerId: string): Promise<{ error: Error | null }> {
  try {
    // Get all buyers for this tracker from remarketing_buyers
    const { data: buyers } = await supabase
      .from("remarketing_buyers")
      .select("id")
      .eq("industry_tracker_id", trackerId);

    // Delete all buyer-related records
    if (buyers && buyers.length > 0) {
      const buyerIds = buyers.map(b => b.id);

      // Delete buyer_contacts
      await supabase.from("buyer_contacts").delete().in("buyer_id", buyerIds);

      // Delete buyer_transcripts
      await supabase.from("buyer_transcripts").delete().in("buyer_id", buyerIds);

      // Delete remarketing_scores for all buyers
      await supabase.from("remarketing_scores").delete().in("buyer_id", buyerIds);

      // Delete call_intelligence for all buyers
      await supabase.from("call_intelligence").delete().in("buyer_id", buyerIds);
    }

    // Delete all buyers from remarketing_buyers
    await supabase.from("remarketing_buyers").delete().eq("industry_tracker_id", trackerId);

    // Get all deals for this tracker (using listing_id reference if applicable)
    const { data: deals } = await supabase
      .from("deals")
      .select("id")
      .eq("listing_id", trackerId);

    // Delete all deal-related records
    if (deals && deals.length > 0) {
      const dealIds = deals.map(d => d.id);

      // Delete remarketing_scores for all deals
      await supabase.from("remarketing_scores").delete().in("listing_id", dealIds);

      // Delete call_intelligence for all deals
      await supabase.from("call_intelligence").delete().in("deal_id", dealIds);
    }

    // Delete all deals
    await supabase.from("deals").delete().eq("listing_id", trackerId);

    // Delete remarketing_buyer_universes for this tracker
    await (supabase as any).from("remarketing_buyer_universes").delete().eq("industry_tracker_id", trackerId);

    // Finally delete the tracker
    const { error } = await (supabase as any).from("industry_trackers").delete().eq("id", trackerId);

    if (error) throw error;

    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}
