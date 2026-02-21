import { useState, useEffect } from "react";
import { useEnrichmentProgress } from "@/hooks/useEnrichmentProgress";
import { EnrichmentProgressIndicator } from "@/components/remarketing/EnrichmentProgressIndicator";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithTimeout } from "@/lib/invoke-with-timeout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { TrackerDealsToolbar } from "./TrackerDealsToolbar";
import { TrackerDealsTable } from "./TrackerDealsTable";
import { DealCSVImport } from "../DealCSVImport";
import { InterruptedSessionBanner, saveSessionState, clearSessionState } from "./InterruptedSessionBanner";
import { useToast } from "@/hooks/use-toast";
import type { MADeal } from "@/lib/ma-intelligence/types";
import { useGlobalGateCheck, useGlobalActivityMutations } from "@/hooks/remarketing/useGlobalActivityQueue";
import { useAuth } from "@/context/AuthContext";

interface TrackerDealsTabProps {
  trackerId: string;
  onDealCountChange?: (count: number) => void;
}

interface ScoringProgress {
  current: number;
  total: number;
  isPaused: boolean;
  completedIds: string[];
}

export function TrackerDealsTab({ trackerId, onDealCountChange }: TrackerDealsTabProps) {
  const [deals, setDeals] = useState<MADeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterScore, setFilterScore] = useState<string>("all");
  const [scoringProgress, setScoringProgress] = useState<ScoringProgress | null>(null);
  const { toast } = useToast();
  const { progress: enrichmentProgress, cancelEnrichment } = useEnrichmentProgress();
  const { user } = useAuth();
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  const { completeOperation, updateProgress } = useGlobalActivityMutations();

  useEffect(() => {
    if (trackerId && trackerId !== 'new') {
      loadDeals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackerId]);

  const loadDeals = async () => {
    if (!trackerId || trackerId === 'new') return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("listing_id", trackerId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDeals(data as any[] || []);
      onDealCountChange?.(data?.length || 0);
    } catch (error: any) {
      toast({
        title: "Error loading deals",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkEnrich = async () => {
    const dealIds = Array.from(selectedDeals);
    if (dealIds.length === 0) {
      toast({
        title: "No deals selected",
        description: "Please select deals to enrich",
        variant: "destructive",
      });
      return;
    }

    // Register in global activity queue
    let activityItem: { id: string } | null = null;
    try {
      const result = await startOrQueueMajorOp({
        operationType: "deal_enrichment",
        totalItems: dealIds.length,
        description: `Enriching ${dealIds.length} tracker deals`,
        userId: user?.id || "",
        contextJson: { trackerId, source: "tracker_deals" },
      });
      activityItem = result.item;
    } catch {
      // Non-blocking
    }

    try {
      const { queueDealEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      await queueDealEnrichment(dealIds);

      let successCount = dealIds.length;
      if (activityItem) {
        updateProgress.mutate({ id: activityItem.id, completedItems: successCount });
      }

      toast({
        title: "Enrichment complete",
        description: `Enriched ${successCount} of ${dealIds.length} deals`,
      });

      if (activityItem) {
        completeOperation.mutate({ id: activityItem.id, finalStatus: "completed" });
      }

      setTimeout(() => {
        loadDeals();
        setSelectedDeals(new Set());
      }, 5000);
    } catch (error: any) {
      if (activityItem) {
        completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
      }
      toast({
        title: "Error enriching deals",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleBulkScore = async () => {
    const dealIds = Array.from(selectedDeals);
    if (dealIds.length === 0) {
      toast({
        title: "No deals selected",
        description: "Please select deals to score",
        variant: "destructive",
      });
      return;
    }

    // Register in global activity queue
    let activityItem: { id: string } | null = null;
    try {
      const result = await startOrQueueMajorOp({
        operationType: "buyer_scoring",
        totalItems: dealIds.length,
        description: `Scoring ${dealIds.length} tracker deals`,
        userId: user?.id || "",
        contextJson: { trackerId, source: "tracker_deals_scoring" },
      });
      activityItem = result.item;
    } catch {
      // Non-blocking
    }

    const progress: ScoringProgress = {
      current: 0,
      total: dealIds.length,
      isPaused: false,
      completedIds: [],
    };
    setScoringProgress(progress);

    try {
      for (let i = 0; i < dealIds.length; i++) {
        if (progress.isPaused) break;

        const dealId = dealIds[i];

        try {
          await invokeWithTimeout("score-deal", {
            body: { dealId },
            timeoutMs: 90_000,
          });

          progress.current = i + 1;
          progress.completedIds.push(dealId);
          setScoringProgress({ ...progress });

          if (activityItem) {
            updateProgress.mutate({ id: activityItem.id, completedItems: progress.current });
          }

          // Save progress to localStorage
          saveSessionState(trackerId, "Bulk Scoring", progress.current, progress.total);
        } catch (error: any) {
          console.error(`Error scoring deal ${dealId}:`, error);
        }
      }

      clearSessionState(trackerId);
      setScoringProgress(null);
      setSelectedDeals(new Set());
      loadDeals();

      if (activityItem) {
        completeOperation.mutate({ id: activityItem.id, finalStatus: "completed" });
      }

      toast({
        title: "Scoring complete",
        description: `Successfully scored ${progress.completedIds.length} of ${dealIds.length} deals`,
      });
    } catch (error: any) {
      if (activityItem) {
        completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
      }
      toast({
        title: "Error during scoring",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePauseScoring = () => {
    if (scoringProgress) {
      setScoringProgress({
        ...scoringProgress,
        isPaused: !scoringProgress.isPaused,
      });
    }
  };

  const handleScoreSingle = async (dealId: string) => {
    try {
      await invokeWithTimeout("score-deal", {
        body: { dealId },
        timeoutMs: 90_000,
      });

      toast({
        title: "Scoring started",
        description: "Deal scoring in progress",
      });

      setTimeout(loadDeals, 5000);
    } catch (error: any) {
      toast({
        title: "Scoring failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEnrichSingle = async (dealId: string) => {
    try {
      const { queueDealEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      await queueDealEnrichment([dealId]);

      toast({
        title: "Enrichment started",
        description: "Deal enrichment in progress",
      });

      setTimeout(loadDeals, 5000);
    } catch (error: any) {
      toast({
        title: "Enrichment failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleArchiveDeal = async (dealId: string) => {
    try {
      // deals table doesn't have 'status' column - use soft delete via deleted_at
      await supabase
        .from("deals")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", dealId);

      toast({ title: "Deal archived" });
      loadDeals();
    } catch (error: any) {
      toast({
        title: "Archive failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (!confirm("Are you sure you want to delete this deal? This action cannot be undone.")) {
      return;
    }

    try {
      await supabase
        .from("deals")
        .delete()
        .eq("id", dealId);

      toast({ title: "Deal deleted" });
      loadDeals();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleSelect = (dealId: string) => {
    const newSelected = new Set(selectedDeals);
    if (newSelected.has(dealId)) {
      newSelected.delete(dealId);
    } else {
      newSelected.add(dealId);
    }
    setSelectedDeals(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedDeals.size === deals.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(deals.map(d => d.id)));
    }
  };

  const filteredDeals = deals.filter(deal => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        deal.deal_name?.toLowerCase().includes(query) ||
        deal.company_website?.toLowerCase().includes(query) ||
        deal.headquarters?.toLowerCase().includes(query);

      if (!matchesSearch) return false;
    }

    // Status filter
    if (filterStatus !== "all" && deal.status !== filterStatus) {
      return false;
    }

    // Score filter
    if (filterScore !== "all") {
      const score = deal.deal_score;
      if (filterScore === "hot" && (score === null || score < 85)) return false;
      if (filterScore === "high" && (score === null || score < 70 || score >= 85)) return false;
      if (filterScore === "medium" && (score === null || score < 40 || score >= 70)) return false;
      if (filterScore === "low" && (score === null || score >= 40)) return false;
      if (filterScore === "unscored" && score !== null) return false;
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

      {/* Enrichment Progress Bar */}
      {(enrichmentProgress.isEnriching || enrichmentProgress.isPaused) && (
        <EnrichmentProgressIndicator
          completedCount={enrichmentProgress.completedCount}
          totalCount={enrichmentProgress.totalCount}
          progress={enrichmentProgress.progress}
          estimatedTimeRemaining={enrichmentProgress.estimatedTimeRemaining}
          processingRate={enrichmentProgress.processingRate}
          itemLabel="deals"
          successfulCount={enrichmentProgress.successfulCount}
          failedCount={enrichmentProgress.failedCount}
          isPaused={enrichmentProgress.isPaused}
          onCancel={cancelEnrichment}
        />
      )}

      <TrackerDealsToolbar
        selectedCount={selectedDeals.size}
        totalCount={deals.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        filterScore={filterScore}
        onFilterScoreChange={setFilterScore}
        onAddDeal={() => setImportDialogOpen(true)}
        onBulkEnrich={handleBulkEnrich}
        onBulkScore={handleBulkScore}
        scoringProgress={scoringProgress}
        onPauseScoring={handlePauseScoring}
      />

      <Card>
        <CardContent className="p-0">
          <TrackerDealsTable
            deals={filteredDeals}
            selectedDeals={selectedDeals}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onRefresh={loadDeals}
            onScore={handleScoreSingle}
            onEnrich={handleEnrichSingle}
            onArchive={handleArchiveDeal}
            onDelete={handleDeleteDeal}
          />
        </CardContent>
      </Card>

      <DealCSVImport
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        trackerId={trackerId}
        onDealsImported={loadDeals}
      />
    </div>
  );
}
