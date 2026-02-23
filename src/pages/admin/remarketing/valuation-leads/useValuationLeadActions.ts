import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";
import { useGlobalGateCheck, useGlobalActivityMutations } from "@/hooks/remarketing/use-global-activity-queue";
import { useEnrichmentProgress } from "@/hooks/use-enrichment-progress";
import { useAuth } from "@/context/AuthContext";
import type { ValuationLead } from "./types";
import { buildListingFromLead, inferWebsite } from "./helpers";

interface UseValuationLeadActionsOptions {
  leads: ValuationLead[] | undefined;
  filteredLeads: ValuationLead[];
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useValuationLeadActions({
  leads,
  filteredLeads,
  setSelectedIds,
}: UseValuationLeadActionsOptions) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  const { completeOperation, updateProgress } = useGlobalActivityMutations();

  // Enrichment progress tracking
  const {
    progress: enrichmentProgress,
    summary: enrichmentSummary,
    showSummary: showEnrichmentSummary,
    dismissSummary,
    pauseEnrichment,
    resumeEnrichment,
    cancelEnrichment,
  } = useEnrichmentProgress();

  // Action states
  const [isPushing, setIsPushing] = useState(false);
  const [isPushEnriching, setIsPushEnriching] = useState(false);
  const [isReEnriching, setIsReEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  // Row click handler -- navigate to deal detail for every lead.
  // Auto-creates a listing (without pushing) if one doesn't exist yet.
  const handleRowClick = useCallback(
    async (lead: ValuationLead) => {
      if (lead.pushed_listing_id) {
        navigate('/admin/deals/' + lead.pushed_listing_id, {
          state: { from: "/admin/remarketing/leads/valuation" },
        });
        return;
      }

      const dealIdentifier = `vlead_${lead.id.slice(0, 8)}`;

      const { data: existing, error: existingError } = await supabase
        .from("listings")
        .select("id")
        .eq("deal_identifier", dealIdentifier)
        .maybeSingle();
      if (existingError) throw existingError;

      let listingId: string;

      if (existing?.id) {
        listingId = existing.id;
        await supabase
          .from("valuation_leads")
          .update({ pushed_listing_id: listingId } as never)
          .eq("id", lead.id);
      } else {
        const { data: listing, error: insertError } = await supabase
          .from("listings")
          .insert(buildListingFromLead(lead, false))
          .select("id")
          .single();

        if (insertError || !listing) {
          console.error("Failed to create listing for lead:", lead.id, insertError);
          sonnerToast.error("Failed to open deal page");
          return;
        }

        listingId = listing.id;

        await supabase
          .from("valuation_leads")
          .update({ pushed_listing_id: listingId } as never)
          .eq("id", lead.id);
      }

      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });

      navigate('/admin/deals/' + listingId, {
        state: { from: "/admin/remarketing/leads/valuation" },
      });
    },
    [navigate, queryClient]
  );

  // Push to All Deals
  const handlePushToAllDeals = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0 || isPushing) return;
      setIsPushing(true);

      const leadsToProcess = (leads || []).filter((l) => leadIds.includes(l.id) && !l.pushed_to_all_deals);

      let successCount = 0;
      let errorCount = 0;
      for (const lead of leadsToProcess) {
        let listingId = lead.pushed_listing_id;

        if (listingId) {
          const { error } = await supabase
            .from("listings")
            .update({ pushed_to_all_deals: true, pushed_to_all_deals_at: new Date().toISOString() })
            .eq("id", listingId);
          if (error) { console.error("Failed to update listing:", error); errorCount++; continue; }
        } else {
          const { data: listing, error: insertError } = await supabase
            .from("listings")
            .insert(buildListingFromLead(lead, true))
            .select("id")
            .single();
          if (insertError || !listing) { console.error("Failed to create listing:", insertError); errorCount++; continue; }
          listingId = listing.id;
        }

        const { error: updateError } = await supabase
          .from("valuation_leads")
          .update({
            pushed_to_all_deals: true,
            pushed_to_all_deals_at: new Date().toISOString(),
            pushed_listing_id: listingId,
            status: "pushed",
          } as never)
          .eq("id", lead.id);

        if (updateError) {
          console.error("Listing created but failed to mark lead as pushed:", lead.id, updateError);
        }

        successCount++;
      }

      setIsPushing(false);
      setSelectedIds(new Set());

      if (successCount > 0) {
        sonnerToast.success(`Added ${successCount} lead${successCount !== 1 ? "s" : ""} to All Deals${errorCount > 0 ? ` (${errorCount} failed)` : ""}`);
      } else {
        sonnerToast.info("Nothing to add \u2014 selected leads are already in All Deals.");
      }

      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    },
    [leads, isPushing, queryClient, setSelectedIds]
  );

  // Push & Enrich
  const handlePushAndEnrich = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      setIsPushEnriching(true);

      const leadsToProcess = (leads || []).filter((l) => leadIds.includes(l.id) && !l.pushed_to_all_deals);
      if (!leadsToProcess.length) {
        sonnerToast.info("No unpushed leads selected");
        setIsPushEnriching(false);
        return;
      }

      let pushed = 0;
      let enrichQueued = 0;
      const listingIds: string[] = [];

      for (const lead of leadsToProcess) {
        let listingId = lead.pushed_listing_id;

        if (listingId) {
          const { error } = await supabase
            .from("listings")
            .update({ pushed_to_all_deals: true, pushed_to_all_deals_at: new Date().toISOString() })
            .eq("id", listingId);
          if (error) { console.error("Failed to update listing:", error); continue; }
        } else {
          const { data: listing, error: insertError } = await supabase
            .from("listings")
            .insert(buildListingFromLead(lead, true))
            .select("id")
            .single();
          if (insertError || !listing) { console.error("Failed to create listing:", insertError); continue; }
          listingId = listing.id;
        }

        listingIds.push(listingId);

        await supabase
          .from("valuation_leads")
          .update({
            pushed_to_all_deals: true,
            pushed_to_all_deals_at: new Date().toISOString(),
            pushed_listing_id: listingId,
            status: "pushed",
          } as never)
          .eq("id", lead.id);

        pushed++;
      }

      if (listingIds.length > 0) {
        let activityItem: { id: string } | null = null;
        try {
          const result = await startOrQueueMajorOp({
            operationType: "deal_enrichment",
            totalItems: listingIds.length,
            description: `Push & enrich ${listingIds.length} valuation leads`,
            userId: user?.id || "",
            contextJson: { source: "valuation_leads_push_enrich" },
          });
          activityItem = result.item;
        } catch {
          // Non-blocking
        }

        const now = new Date().toISOString();
        const rows = listingIds.map((id) => ({
          listing_id: id,
          status: "pending" as const,
          attempts: 0,
          queued_at: now,
        }));

        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const { error } = await supabase
            .from("enrichment_queue")
            .upsert(chunk, { onConflict: "listing_id" });
          if (!error) enrichQueued += chunk.length;
          else {
            console.error("Queue upsert error:", error);
            if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
          }
        }

        try {
          const { data: result, error: resultError } = await supabase.functions.invoke("process-enrichment-queue", {
            body: { source: "valuation_leads_push_enrich" },
          });
          if (resultError) throw resultError;
          if (result?.synced > 0 || result?.processed > 0) {
            const totalDone = (result?.synced || 0) + (result?.processed || 0);
            if (activityItem) updateProgress.mutate({ id: activityItem.id, completedItems: totalDone });
          }
        } catch {
          // Non-blocking
        }
      }

      setIsPushEnriching(false);
      setSelectedIds(new Set());

      if (pushed > 0) {
        sonnerToast.success(`Added ${pushed} lead${pushed !== 1 ? "s" : ""} to All Deals and queued ${enrichQueued} for enrichment`);
      } else {
        sonnerToast.info("Select leads that haven't been added to All Deals yet.");
      }

      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    },
    [leads, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient, setSelectedIds]
  );

  // Re-Enrich selected
  const handleReEnrich = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      setIsReEnriching(true);

      const leadsToProcess = (leads || []).filter(
        (l) => leadIds.includes(l.id) && l.pushed_to_all_deals && l.pushed_listing_id
      );

      if (!leadsToProcess.length) {
        sonnerToast.info("No pushed leads with listing IDs found");
        setIsReEnriching(false);
        return;
      }

      let activityItem: { id: string } | null = null;
      try {
        const result = await startOrQueueMajorOp({
          operationType: "deal_enrichment",
          totalItems: leadsToProcess.length,
          description: `Re-enriching ${leadsToProcess.length} valuation leads`,
          userId: user?.id || "",
          contextJson: { source: "valuation_leads_re_enrich" },
        });
        activityItem = result.item;
      } catch {
        // Non-blocking
      }

      const now = new Date().toISOString();
      const seen = new Set<string>();
      const rows = leadsToProcess
        .filter((l) => {
          if (!l.pushed_listing_id || seen.has(l.pushed_listing_id)) return false;
          seen.add(l.pushed_listing_id!);
          return true;
        })
        .map((l) => ({
          listing_id: l.pushed_listing_id!,
          status: "pending" as const,
          attempts: 0,
          queued_at: now,
          force: true,
          completed_at: null,
          last_error: null,
          started_at: null,
        }));

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("enrichment_queue")
          .upsert(chunk, { onConflict: "listing_id" });
        if (error) {
          console.error("Queue upsert error:", error);
          sonnerToast.error("Failed to queue enrichment");
          if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
          setIsReEnriching(false);
          return;
        }
      }

      if (rows.length > 0) {
        sonnerToast.success(`Re-queued ${rows.length} lead${rows.length !== 1 ? "s" : ""} for enrichment`);
      } else {
        sonnerToast.info("No leads in All Deals found to re-enrich");
      }
      setSelectedIds(new Set());

      setIsReEnriching(false);
      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
    },
    [leads, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient, setSelectedIds]
  );

  // Archive selected leads
  const handleArchive = useCallback(async (leadIds: string[]) => {
    if (leadIds.length === 0) return;
    const { error } = await supabase
      .from("valuation_leads")
      .update({ is_archived: true } as never)
      .in("id", leadIds);
    if (error) {
      sonnerToast.error("Failed to archive leads");
      return;
    }
    sonnerToast.success(`Archived ${leadIds.length} lead${leadIds.length !== 1 ? "s" : ""}`);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
  }, [queryClient, setSelectedIds]);

  // Enrich All
  const handleBulkEnrich = useCallback(
    async (mode: "unenriched" | "all") => {
      const allLeads = leads || [];
      const leadsWithWebsite = allLeads.filter((l) => !!inferWebsite(l));
      const enrichableLeads = mode === "unenriched"
        ? leadsWithWebsite.filter((l) => !l.pushed_listing_id)
        : leadsWithWebsite;

      if (!enrichableLeads.length) {
        sonnerToast.info(mode === "unenriched" ? "All leads have already been enriched" : "No leads with websites to enrich");
        return;
      }

      setIsEnriching(true);

      const leadsNeedingListing = enrichableLeads.filter((l) => !l.pushed_listing_id);
      if (leadsNeedingListing.length > 0) {
        sonnerToast.info(`Creating listings for ${leadsNeedingListing.length} leads...`);
        const LISTING_BATCH = 50;
        for (let i = 0; i < leadsNeedingListing.length; i += LISTING_BATCH) {
          const batch = leadsNeedingListing.slice(i, i + LISTING_BATCH);
          await Promise.all(
            batch.map(async (lead) => {
              try {
                const dealIdentifier = `vlead_${lead.id.slice(0, 8)}`;
                const { data: existing, error: existingError } = await supabase
                  .from("listings")
                  .select("id")
                  .eq("deal_identifier", dealIdentifier)
                  .maybeSingle();
                if (existingError) throw existingError;

                let listingId: string;
                if (existing?.id) {
                  listingId = existing.id;
                } else {
                  const { data: listing, error: insertError } = await supabase
                    .from("listings")
                    .insert(buildListingFromLead(lead, false))
                    .select("id")
                    .single();
                  if (insertError || !listing) return;
                  listingId = listing.id;
                }
                await supabase
                  .from("valuation_leads")
                  .update({ pushed_listing_id: listingId } as never)
                  .eq("id", lead.id);
                lead.pushed_listing_id = listingId;
              } catch {
                // Non-blocking per-lead
              }
            })
          );
        }
      }

      const targets = enrichableLeads.filter((l) => !!l.pushed_listing_id);

      let activityItem: { id: string } | null = null;
      try {
        const result = await startOrQueueMajorOp({
          operationType: "deal_enrichment",
          totalItems: targets.length,
          description: `Enriching ${targets.length} valuation lead listings`,
          userId: user?.id || "",
          contextJson: { source: "valuation_leads_bulk" },
        });
        activityItem = result.item;
      } catch {
        // Non-blocking
      }

      const now = new Date().toISOString();
      const seen = new Set<string>();
      const rows = targets
        .filter((l) => {
          if (!l.pushed_listing_id || seen.has(l.pushed_listing_id)) return false;
          seen.add(l.pushed_listing_id!);
          return true;
        })
        .map((l) => ({
          listing_id: l.pushed_listing_id!,
          status: "pending" as const,
          attempts: 0,
          queued_at: now,
          force: mode === "all",
          completed_at: null,
          last_error: null,
          started_at: null,
        }));

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const listingIds = chunk.map((r) => r.listing_id);

        const { error: updateError } = await supabase
          .from("enrichment_queue")
          .update({
            status: "pending",
            force: mode === "all",
            attempts: 0,
            queued_at: now,
            completed_at: null,
            last_error: null,
            started_at: null,
          })
          .in("listing_id", listingIds);

        if (updateError) console.warn("Queue pre-update error (non-fatal):", updateError);

        const { error } = await supabase
          .from("enrichment_queue")
          .upsert(chunk, { onConflict: "listing_id", ignoreDuplicates: true });

        if (error) {
          console.error("Queue upsert error:", error);
          sonnerToast.error(`Failed to queue enrichment (batch ${Math.floor(i / CHUNK) + 1})`);
          if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
          setIsEnriching(false);
          return;
        }
      }

      sonnerToast.success(`Queued ${rows.length} lead${rows.length !== 1 ? "s" : ""} in All Deals for enrichment`);

      try {
        const { data: result, error: resultError } = await supabase.functions.invoke("process-enrichment-queue", {
          body: { source: "valuation_leads_bulk" },
        });
        if (resultError) throw resultError;
        if (result?.synced > 0 || result?.processed > 0) {
          const totalDone = (result?.synced || 0) + (result?.processed || 0);
          if (activityItem) updateProgress.mutate({ id: activityItem.id, completedItems: totalDone });
          if (result?.processed === 0) {
            sonnerToast.success(`All ${result.synced} deals were already enriched`);
            if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "completed" });
          }
        }
      } catch {
        // Non-blocking
      }

      setIsEnriching(false);
      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
    },
    [leads, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient]
  );

  // Retry failed enrichment
  const handleRetryFailedEnrichment = useCallback(async () => {
    dismissSummary();
    if (!enrichmentSummary?.errors.length) return;
    const failedIds = enrichmentSummary.errors.map((e) => e.listingId);
    const nowIso = new Date().toISOString();
    await supabase
      .from("enrichment_queue")
      .update({ status: "pending", attempts: 0, last_error: null, queued_at: nowIso })
      .in("listing_id", failedIds);
    sonnerToast.success(
      `Retrying ${failedIds.length} failed deal${failedIds.length !== 1 ? "s" : ""}`
    );
    void supabase.functions
      .invoke("process-enrichment-queue", { body: { source: "valuation_leads_retry" } })
      .catch(console.warn);
  }, [dismissSummary, enrichmentSummary]);

  // Score leads
  const handleScoreLeads = useCallback(
    async (mode: "unscored" | "all") => {
      const targets = mode === "unscored"
        ? filteredLeads.filter((l) => l.lead_score == null)
        : filteredLeads;

      if (!targets.length) {
        sonnerToast.info("No leads to score");
        return;
      }

      setIsScoring(true);
      sonnerToast.info(`Scoring ${targets.length} leads...`);

      try {
        const { data, error } = await supabase.functions.invoke("calculate-valuation-lead-score", {
          body: { mode },
        });

        if (error) throw error;

        sonnerToast.success(`Scored ${data?.scored ?? targets.length} leads`);
      } catch (err) {
        console.error("Scoring failed:", err);
        sonnerToast.error("Scoring failed");
      }

      setIsScoring(false);
      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
    },
    [filteredLeads, queryClient]
  );

  // Assign deal owner
  const handleAssignOwner = useCallback(async (lead: ValuationLead, ownerId: string | null) => {
    const { error } = await supabase
      .from("valuation_leads")
      .update({ deal_owner_id: ownerId })
      .eq("id", lead.id);
    if (error) {
      sonnerToast.error("Failed to update owner");
      return;
    }
    if (lead.pushed_listing_id) {
      await supabase
        .from("listings")
        .update({ deal_owner_id: ownerId })
        .eq("id", lead.pushed_listing_id);
    }
    sonnerToast.success(ownerId ? "Owner assigned" : "Owner removed");
    queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
  }, [queryClient]);

  return {
    // Action handlers
    handleRowClick,
    handlePushToAllDeals,
    handlePushAndEnrich,
    handleReEnrich,
    handleArchive,
    handleBulkEnrich,
    handleRetryFailedEnrichment,
    handleScoreLeads,
    handleAssignOwner,
    // Action states
    isPushing,
    isPushEnriching,
    isReEnriching,
    isScoring,
    isEnriching,
    // Enrichment progress
    enrichmentProgress,
    enrichmentSummary,
    showEnrichmentSummary,
    dismissSummary,
    pauseEnrichment,
    resumeEnrichment,
    cancelEnrichment,
  };
}
