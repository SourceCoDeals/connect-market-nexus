import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { TrackerBuyersToolbar } from "./TrackerBuyersToolbar";
import { TrackerBuyersTable } from "./TrackerBuyersTable";
import { AddBuyerDialog } from "./AddBuyerDialog";
import { DedupeDialog } from "./DedupeDialog";
import { InterruptedSessionBanner, saveSessionState, clearSessionState } from "./InterruptedSessionBanner";
import { useToast } from "@/hooks/use-toast";
import type { MABuyer } from "@/lib/ma-intelligence/types";
import { useRealtimeTrackerBuyers } from "@/hooks/ma-intelligence/useRealtimeTrackerBuyers";

interface TrackerBuyersTabProps {
  trackerId: string;
  onBuyerCountChange?: (count: number) => void;
}

interface EnrichmentProgress {
  current: number;
  total: number;
  isPaused: boolean;
  completedIds: string[];
}

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

  useEffect(() => {
    if (trackerId && trackerId !== 'new') {
      loadBuyers();
    }
  }, [trackerId]);

  const loadBuyers = async () => {
    if (!trackerId || trackerId === 'new') return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("remarketing_buyers")
        .select("*")
        .eq("industry_tracker_id", trackerId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setBuyers(data as any[] || []);
      onBuyerCountChange?.(data?.length || 0);
    } catch (error: any) {
      toast({
        title: "Error loading buyers",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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

    const progress: EnrichmentProgress = {
      current: 0,
      total: buyerIds.length,
      isPaused: false,
      completedIds: [],
    };
    setEnrichmentProgress(progress);

    try {
      const failedIds: Array<{ id: string; error: string }> = [];

      for (let i = 0; i < buyerIds.length; i++) {
        if (progress.isPaused) break;

        const buyerId = buyerIds[i];

        try {
          await supabase.functions.invoke("enrich-buyer", {
            body: { buyerId },
          });

          progress.current = i + 1;
          progress.completedIds.push(buyerId);
          setEnrichmentProgress({ ...progress });

          // Save progress to localStorage
          saveSessionState(trackerId, "Bulk Enrichment", progress.current, progress.total);
        } catch (error: any) {
          const errorMessage = error?.message || 'Unknown error';
          console.error(`[ENRICHMENT_ERROR] Buyer ${buyerId}: ${errorMessage}`);
          failedIds.push({ id: buyerId, error: errorMessage });
          progress.current = i + 1;
          setEnrichmentProgress({ ...progress });
        }
      }

      clearSessionState(trackerId);
      setEnrichmentProgress(null);
      setSelectedBuyers(new Set());
      loadBuyers();

      // Show summary with clear success/failure breakdown
      if (failedIds.length > 0) {
        console.warn(
          `[ENRICHMENT_SUMMARY] Partial success: ${progress.completedIds.length}/${buyerIds.length} succeeded. ` +
          `Failed: ${failedIds.map(f => `${f.id} (${f.error})`).join(', ')}`
        );
        toast({
          title: "Enrichment partial success",
          description: `Enriched ${progress.completedIds.length} of ${buyerIds.length} buyers. ${failedIds.length} failed - check logs for details.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Enrichment complete",
          description: `Successfully enriched ${progress.completedIds.length} of ${buyerIds.length} buyers`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error during enrichment",
        description: error.message,
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
      await supabase.functions.invoke("enrich-buyer", {
        body: { buyerId },
      });

      toast({
        title: "Enrichment started",
        description: "Buyer enrichment in progress",
      });

      setTimeout(() => loadBuyers(), 2000);
    } catch (error: any) {
      toast({
        title: "Enrichment failed",
        description: error.message,
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
    } catch (error: any) {
      toast({
        title: "Archive failed",
        description: error.message,
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
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
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

      // Call scoring edge function
      await supabase.functions.invoke("score-buyer-deal", {
        body: {
          buyer_ids: buyerIds,
          deal_id: dealId,
        },
      });

      toast({
        title: "Scoring started",
        description: `Scoring ${buyerIds.length} buyers against the deal`,
      });

      setSelectedBuyers(new Set());
    } catch (error: any) {
      toast({
        title: "Error scoring buyers",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleSelect = (buyerId: string) => {
    const newSelected = new Set(selectedBuyers);
    if (newSelected.has(buyerId)) {
      newSelected.delete(buyerId);
    } else {
      newSelected.add(buyerId);
    }
    setSelectedBuyers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedBuyers.size === buyers.length) {
      setSelectedBuyers(new Set());
    } else {
      setSelectedBuyers(new Set(buyers.map(b => b.id)));
    }
  };

  const filteredBuyers = buyers.filter(buyer => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        buyer.pe_firm_name?.toLowerCase().includes(query) ||
        buyer.platform_company_name?.toLowerCase().includes(query) ||
        buyer.hq_city?.toLowerCase().includes(query) ||
        buyer.hq_state?.toLowerCase().includes(query);

      if (!matchesSearch) return false;
    }

    // Coverage filter
    if (filterCoverage !== "all") {
      // Calculate coverage - simplified version
      const hasThesis = !!buyer.thesis_summary;
      const hasGeo = !!buyer.geo_preferences;
      const hasSize = !!buyer.min_revenue || !!buyer.max_revenue;
      const filledFields = [hasThesis, hasGeo, hasSize].filter(Boolean).length;
      const coverage = filledFields >= 2 ? "high" : filledFields === 1 ? "medium" : "low";

      if (coverage !== filterCoverage) return false;
    }

    return true;
  });

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
