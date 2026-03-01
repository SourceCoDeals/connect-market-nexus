import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { TrackerBuyersToolbar } from "./TrackerBuyersToolbar";
import { TrackerBuyersTable } from "./TrackerBuyersTable";
import { AddBuyerDialog } from "./AddBuyerDialog";
import { DedupeDialog } from "./DedupeDialog";
import { InterruptedSessionBanner, clearSessionState } from "./InterruptedSessionBanner";
import { useToast } from "@/hooks/use-toast";
import type { MABuyer } from "@/lib/ma-intelligence/types";
import { useRealtimeTrackerBuyers } from "@/hooks/ma-intelligence/useRealtimeTrackerBuyers";
import { useGlobalGateCheck, useGlobalActivityMutations } from "@/hooks/remarketing/useGlobalActivityQueue";
import { useAuth } from "@/context/AuthContext";
import { useShiftSelect } from "@/hooks/useShiftSelect";

interface TrackerBuyersTabProps {
  trackerId: string;
  onBuyerCountChange?: (count: number) => void;
}

import type { EnrichmentProgress } from "@/lib/ma-intelligence/types";

export function TrackerBuyersTab({ trackerId, onBuyerCountChange }: TrackerBuyersTabProps) {
  const [buyers, setBuyers] = useState<MABuyer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBuyers, setSelectedBuyers] = useState<Set<string>>(new Set());
  const [addBuyerDialogOpen, setAddBuyerDialogOpen] = useState(false);
  const [dedupeDialogOpen, setDedupeDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCoverage, setFilterCoverage] = useState<"all" | "high" | "medium" | "low">("all");
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  const { completeOperation, updateProgress: _updateProgress } = useGlobalActivityMutations();

  const loadBuyers = useCallback(async () => {
    if (!trackerId || trackerId === 'new') return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("remarketing_buyers")
        .select("*")
        .eq("industry_tracker_id", trackerId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setBuyers((data || []) as unknown as MABuyer[]);
      onBuyerCountChange?.(data?.length || 0);
    } catch (error: unknown) {
      toast({
        title: "Error loading buyers",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [trackerId, onBuyerCountChange, toast]);

  useEffect(() => {
    if (trackerId && trackerId !== 'new') {
      loadBuyers();
    }
  }, [trackerId, loadBuyers]);

  useRealtimeTrackerBuyers({
    trackerId,
    enabled: !!trackerId && trackerId !== "new",
    buyers,
    onChange: setBuyers,
    onRefresh: loadBuyers,
  });

  const handleBulkEnrich = async () => {
    const buyerIds = Array.from(selectedBuyers);
    if (buyerIds.length === 0) {
      toast({
        title: "No buyers selected",
        description: "Please select buyers to enrich",
        variant: "destructive",
      });
      return;
    }

    // Register in global activity queue
    let activityItem: { id: string } | null = null;
    try {
      const result = await startOrQueueMajorOp({
        operationType: "buyer_enrichment",
        totalItems: buyerIds.length,
        description: `Enriching ${buyerIds.length} tracker buyers`,
        userId: user?.id || "",
        contextJson: { trackerId, source: "tracker_buyers" },
      });
      activityItem = result.item;
    } catch {
      // Non-blocking
    }

    const progress: EnrichmentProgress = {
      current: 0,
      total: buyerIds.length,
      isPaused: false,
      completedIds: [],
    };
    setEnrichmentProgress(progress);

    try {
      const { queueBuyerEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      await queueBuyerEnrichment(buyerIds);

      if (activityItem) {
        completeOperation.mutate({ id: activityItem.id, finalStatus: "completed" });
      }

      clearSessionState(trackerId);
      setEnrichmentProgress(null);
      setSelectedBuyers(new Set());

      toast({
        title: "Enrichment queued",
        description: `Queued ${buyerIds.length} buyers for background enrichment`,
      });
    } catch (error: unknown) {
      if (activityItem) {
        completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
      }
      toast({
        title: "Error during enrichment",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const handlePauseEnrichment = () => {
    if (enrichmentProgress) {
      setEnrichmentProgress({
        ...enrichmentProgress,
        isPaused: !enrichmentProgress.isPaused,
      });
    }
  };

  const handleEnrichSingle = async (buyerId: string) => {
    try {
      const { queueBuyerEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      await queueBuyerEnrichment([buyerId]);

      toast({
        title: "Enrichment started",
        description: "Buyer enrichment in progress",
      });

      setTimeout(loadBuyers, 5000);
    } catch (error: unknown) {
      toast({
        title: "Enrichment failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const handleArchiveBuyer = async (buyerId: string) => {
    try {
      // remarketing_buyers doesn't have 'status' column - use 'archived' boolean instead
      await supabase
        .from("remarketing_buyers")
        .update({ archived: true })
        .eq("id", buyerId);

      toast({ title: "Buyer archived" });
      loadBuyers();
    } catch (error: unknown) {
      toast({
        title: "Archive failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const handleDeleteBuyer = async (buyerId: string) => {
    if (!confirm("Are you sure you want to delete this buyer? This action cannot be undone.")) {
      return;
    }

    try {
      await supabase
        .from("remarketing_buyers")
        .delete()
        .eq("id", buyerId);

      toast({ title: "Buyer deleted" });
      loadBuyers();
    } catch (error: unknown) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const handleBulkScore = async (dealId: string) => {
    if (selectedBuyers.size === 0) {
      toast({
        title: "No buyers selected",
        description: "Please select buyers to score",
        variant: "destructive",
      });
      return;
    }

    try {
      const buyerIds = Array.from(selectedBuyers);

      // Queue scoring
      const { queueDealScoring } = await import("@/lib/remarketing/queueScoring");
      await queueDealScoring({ universeId: dealId || "", listingIds: [dealId || ""] });

      toast({
        title: "Scoring started",
        description: `Scoring ${buyerIds.length} buyers against the deal`,
      });

      setSelectedBuyers(new Set());
    } catch (error: unknown) {
      toast({
        title: "Error scoring buyers",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const filteredBuyers = useMemo(() => buyers.filter(buyer => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        buyer.pe_firm_name?.toLowerCase().includes(query) ||
        buyer.platform_company_name?.toLowerCase().includes(query) ||
        buyer.hq_city?.toLowerCase().includes(query) ||
        buyer.hq_state?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    if (filterCoverage !== "all") {
      const hasThesis = !!buyer.thesis_summary;
      const hasGeo = !!buyer.geo_preferences;
      const hasSize = !!buyer.min_revenue || !!buyer.max_revenue;
      const filledFields = [hasThesis, hasGeo, hasSize].filter(Boolean).length;
      const coverage = filledFields >= 2 ? "high" : filledFields === 1 ? "medium" : "low";
      if (coverage !== filterCoverage) return false;
    }
    return true;
  }), [buyers, searchQuery, filterCoverage]);

  const orderedIds = useMemo(() => filteredBuyers.map((b) => b.id), [filteredBuyers]);
  const { handleToggle: handleToggleSelect } = useShiftSelect(orderedIds, selectedBuyers, setSelectedBuyers);

  const handleSelectAll = () => {
    if (selectedBuyers.size === buyers.length) {
      setSelectedBuyers(new Set());
    } else {
      setSelectedBuyers(new Set(buyers.map(b => b.id)));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <InterruptedSessionBanner trackerId={trackerId} />

      <TrackerBuyersToolbar
        selectedCount={selectedBuyers.size}
        totalCount={buyers.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterCoverage={filterCoverage}
        onFilterCoverageChange={setFilterCoverage}
        onAddBuyer={() => setAddBuyerDialogOpen(true)}
        onBulkEnrich={handleBulkEnrich}
        onBulkScore={handleBulkScore}
        onDedupe={() => setDedupeDialogOpen(true)}
        enrichmentProgress={enrichmentProgress}
        onPauseEnrichment={handlePauseEnrichment}
      />

      <Card>
        <CardContent className="p-0">
          <TrackerBuyersTable
            buyers={filteredBuyers}
            selectedBuyers={selectedBuyers}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onRefresh={loadBuyers}
            onEnrich={handleEnrichSingle}
            onArchive={handleArchiveBuyer}
            onDelete={handleDeleteBuyer}
          />
        </CardContent>
      </Card>

      <AddBuyerDialog
        open={addBuyerDialogOpen}
        onOpenChange={setAddBuyerDialogOpen}
        trackerId={trackerId}
        onBuyerAdded={loadBuyers}
      />

      <DedupeDialog
        open={dedupeDialogOpen}
        onOpenChange={setDedupeDialogOpen}
        trackerId={trackerId}
      />
    </div>
  );
}
