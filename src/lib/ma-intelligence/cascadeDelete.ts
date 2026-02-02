import { supabase } from "@/integrations/supabase/client";

/**
 * Delete all related records for a buyer before deleting the buyer
 */
export async function deleteBuyerWithRelated(buyerId: string): Promise<{ error: Error | null }> {
  try {
    // Delete buyer_contacts
    await supabase.from("buyer_contacts").delete().eq("buyer_id", buyerId);

    // Delete buyer_transcripts (and their storage files)
    const { data: transcripts } = await supabase
      .from("buyer_transcripts")
      .select("url, transcript_type")
      .eq("buyer_id", buyerId);

    if (transcripts) {
      const fileUrls = transcripts
        .filter(t => t.transcript_type === "file" && t.url)
        .map(t => t.url);

      if (fileUrls.length > 0) {
        await supabase.storage.from("call-transcripts").remove(fileUrls);
      }
    }
    await supabase.from("buyer_transcripts").delete().eq("buyer_id", buyerId);

    // Delete buyer_deal_scores
    await supabase.from("buyer_deal_scores").delete().eq("buyer_id", buyerId);

    // Delete outreach_records
    await supabase.from("outreach_records").delete().eq("buyer_id", buyerId);

    // Delete call_intelligence
    await supabase.from("call_intelligence").delete().eq("buyer_id", buyerId);

    // Finally delete the buyer
    const { error } = await supabase.from("buyers").delete().eq("id", buyerId);

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
    // Delete deal_transcripts (and their storage files)
    const { data: transcripts } = await supabase
      .from("deal_transcripts")
      .select("url, transcript_type")
      .eq("deal_id", dealId);

    if (transcripts) {
      const fileUrls = transcripts
        .filter(t => t.transcript_type === "file" && t.url)
        .map(t => t.url);

      if (fileUrls.length > 0) {
        await supabase.storage.from("call-transcripts").remove(fileUrls);
      }
    }
    await supabase.from("deal_transcripts").delete().eq("deal_id", dealId);

    // Delete buyer_deal_scores
    await supabase.from("buyer_deal_scores").delete().eq("deal_id", dealId);

    // Delete outreach_records
    await supabase.from("outreach_records").delete().eq("deal_id", dealId);

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
    // Get all buyers for this tracker
    const { data: buyers } = await supabase
      .from("buyers")
      .select("id")
      .eq("tracker_id", trackerId);

    // Delete all buyer-related records
    if (buyers && buyers.length > 0) {
      const buyerIds = buyers.map(b => b.id);

      // Delete buyer_contacts
      await supabase.from("buyer_contacts").delete().in("buyer_id", buyerIds);

      // Delete buyer_transcripts
      const { data: buyerTranscripts } = await supabase
        .from("buyer_transcripts")
        .select("url, transcript_type")
        .in("buyer_id", buyerIds);

      if (buyerTranscripts) {
        const fileUrls = buyerTranscripts
          .filter(t => t.transcript_type === "file" && t.url)
          .map(t => t.url);

        if (fileUrls.length > 0) {
          await supabase.storage.from("call-transcripts").remove(fileUrls);
        }
      }
      await supabase.from("buyer_transcripts").delete().in("buyer_id", buyerIds);

      // Delete buyer_deal_scores for all buyers
      await supabase.from("buyer_deal_scores").delete().in("buyer_id", buyerIds);

      // Delete outreach_records for all buyers
      await supabase.from("outreach_records").delete().in("buyer_id", buyerIds);

      // Delete call_intelligence for all buyers
      await supabase.from("call_intelligence").delete().in("buyer_id", buyerIds);
    }

    // Delete all buyers
    await supabase.from("buyers").delete().eq("tracker_id", trackerId);

    // Get all deals for this tracker
    const { data: deals } = await supabase
      .from("deals")
      .select("id")
      .eq("tracker_id", trackerId);

    // Delete all deal-related records
    if (deals && deals.length > 0) {
      const dealIds = deals.map(d => d.id);

      // Delete deal_transcripts
      const { data: dealTranscripts } = await supabase
        .from("deal_transcripts")
        .select("url, transcript_type")
        .in("deal_id", dealIds);

      if (dealTranscripts) {
        const fileUrls = dealTranscripts
          .filter(t => t.transcript_type === "file" && t.url)
          .map(t => t.url);

        if (fileUrls.length > 0) {
          await supabase.storage.from("call-transcripts").remove(fileUrls);
        }
      }
      await supabase.from("deal_transcripts").delete().in("deal_id", dealIds);

      // Delete buyer_deal_scores for all deals
      await supabase.from("buyer_deal_scores").delete().in("deal_id", dealIds);

      // Delete outreach_records for all deals
      await supabase.from("outreach_records").delete().in("deal_id", dealIds);

      // Delete call_intelligence for all deals
      await supabase.from("call_intelligence").delete().in("deal_id", dealIds);
    }

    // Delete all deals
    await supabase.from("deals").delete().eq("tracker_id", trackerId);

    // Delete tracker documents from storage
    const { data: tracker } = await supabase
      .from("industry_trackers")
      .select("documents")
      .eq("id", trackerId)
      .single();

    if (tracker?.documents) {
      const docs = tracker.documents as { path: string }[];
      const docPaths = docs.map(d => d.path).filter(Boolean);
      if (docPaths.length > 0) {
        await supabase.storage.from("tracker-documents").remove(docPaths);
      }
    }

    // Finally delete the tracker
    const { error } = await supabase.from("industry_trackers").delete().eq("id", trackerId);

    if (error) throw error;

    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}
