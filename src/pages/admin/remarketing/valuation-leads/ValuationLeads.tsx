import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterBar, VALUATION_LEAD_FIELDS } from "@/components/filters";
import { useTimeframe } from "@/hooks/use-timeframe";
import { useFilterEngine } from "@/hooks/use-filter-engine";
import { useAdminProfiles } from "@/hooks/admin/use-admin-profiles";
import { EnrichmentProgressIndicator, DealEnrichmentSummaryDialog } from "@/components/remarketing";
import { EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

import type { ValuationLead, SortColumn, SortDirection } from "./types";
import {
  DEFAULT_COL_WIDTHS,
  PAGE_SIZE,
} from "./helpers";
import { useValuationLeadActions } from "./useValuationLeadActions";
import { useFilteredLeads } from "./useFilteredLeads";
import { HeaderToolbar } from "./HeaderToolbar";
import { CalculatorTypeTabs } from "./CalculatorTypeTabs";
import { KpiStatsCards } from "./KpiStatsCards";
import { BulkActionsBar } from "./BulkActionsBar";
import { LeadsTable } from "./LeadsTable";
import { LeadsPagination } from "./LeadsPagination";

// Re-export formatAge so existing imports from ValuationLeads still work
export { formatAge } from "./helpers";

export default function ValuationLeads() {
  // Admin profiles for deal owner display
  const { data: adminProfiles } = useAdminProfiles();

  // Calculator type tab
  const [activeTab, setActiveTab] = useState<string>("all");

  // Timeframe (standardized hook)
  const { timeframe, setTimeframe, isInRange } = useTimeframe("all_time");

  // Sorting -- persisted in URL so navigating back restores the sort
  const [searchParams, setSearchParams] = useSearchParams();
  const sortColumn = (searchParams.get("sort") as SortColumn) ?? "created_at";
  const sortDirection = (searchParams.get("dir") as SortDirection) ?? "desc";

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Hide pushed toggle
  const [hidePushed, setHidePushed] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Column resizing
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COL_WIDTHS);

  const startResize = useCallback(
    (col: string, e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = colWidths[col] ?? DEFAULT_COL_WIDTHS[col] ?? 120;
      const onMouseMove = (mv: MouseEvent) => {
        const newW = Math.max(60, startW + mv.clientX - startX);
        setColWidths((prev) => ({ ...prev, [col]: newW }));
      };
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [colWidths]
  );

  // Fetch valuation leads
  const {
    data: leads,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["remarketing", "valuation-leads"],
    refetchOnMount: "always",
    staleTime: 30_000,
    queryFn: async () => {
      const allData: ValuationLead[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("valuation_leads")
          .select("*, listings!valuation_leads_pushed_listing_id_fkey(description, executive_summary)")
          .eq("excluded", false)
          .order("created_at", { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          const normalized = data.map((row) => ({
            ...row,
            listing_description: row.listings?.description || row.listings?.executive_summary || null,
            listings: undefined,
            revenue: row.revenue != null ? Number(row.revenue) : null,
            ebitda: row.ebitda != null ? Number(row.ebitda) : null,
            valuation_low: row.valuation_low != null ? Number(row.valuation_low) : null,
            valuation_mid: row.valuation_mid != null ? Number(row.valuation_mid) : null,
            valuation_high: row.valuation_high != null ? Number(row.valuation_high) : null,
            lead_score: row.lead_score != null ? Number(row.lead_score) : null,
            readiness_score: row.readiness_score != null ? Number(row.readiness_score) : null,
            locations_count: row.locations_count != null ? Number(row.locations_count) : null,
          }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          allData.push(...(normalized as any[]));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
  });

  // Get distinct calculator types for tabs
  const calculatorTypes = useMemo(() => {
    if (!leads) return ["general"];
    const types = new Set(leads.map((l) => l.calculator_type));
    types.add("general");
    return Array.from(types).sort((a, b) => {
      if (a === "general") return -1;
      if (b === "general") return 1;
      return a.localeCompare(b);
    });
  }, [leads]);

  // Filter engine for advanced filtering
  const {
    filteredItems: engineFiltered,
    filterState,
    setFilterState,
    dynamicOptions,
    filteredCount,
    totalCount: engineTotal,
  } = useFilterEngine(leads ?? [], VALUATION_LEAD_FIELDS);

  // Default filter: "Website is not empty"
  useEffect(() => {
    if (filterState.rules.length === 0) {
      setFilterState((prev) => ({
        ...prev,
        conjunction: "and",
        rules: [{ id: "default-website-filter", field: "website", operator: "is_not_empty", value: "" }],
      }));
    }
  }, [filterState.rules.length, setFilterState]);

  // Apply tab + timeframe + dedup + sort
  const filteredLeads = useFilteredLeads({
    engineFiltered,
    activeTab,
    hidePushed,
    isInRange,
    sortColumn,
    sortDirection,
    adminProfiles,
  });

  // Actions hook
  const {
    handleRowClick,
    handlePushToAllDeals,
    handlePushAndEnrich,
    handleReEnrich,
    handleArchive,
    handleBulkEnrich,
    handleRetryFailedEnrichment,
    handleScoreLeads,
    handleAssignOwner,
    isPushing,
    isPushEnriching,
    isReEnriching,
    isScoring,
    isEnriching,
    enrichmentProgress,
    enrichmentSummary,
    showEnrichmentSummary,
    dismissSummary,
    pauseEnrichment,
    resumeEnrichment,
    cancelEnrichment,
  } = useValuationLeadActions({ leads, filteredLeads, setSelectedIds });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLeads = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, safePage]);

  // Reset page and clear selection on filter change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [activeTab, timeframe, sortColumn, sortDirection, filterState]);

  const handleSort = (col: SortColumn) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("sort") === col) {
        next.set("dir", next.get("dir") === "asc" ? "desc" : "asc");
      } else {
        next.set("sort", col);
        next.set("dir", "asc");
      }
      return next;
    }, { replace: true });
  };

  // Selection helpers
  const allSelected = paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedIds.has(l.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedLeads.map((l) => l.id)));
    }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // KPI Stats
  const kpiStats = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const openToIntros = filteredLeads.filter((l) => l.open_to_intros === true).length;
    const exitNow = filteredLeads.filter((l) => l.exit_timing === "now").length;
    const pushedCount = filteredLeads.filter((l) => l.pushed_to_all_deals === true).length;
    const avgScore = filteredLeads.length > 0
      ? Math.round(filteredLeads.reduce((sum, l) => sum + (l.lead_score ?? 0), 0) / filteredLeads.length)
      : 0;
    return { totalLeads, openToIntros, exitNow, pushedCount, avgScore };
  }, [filteredLeads]);

  const totalLeads = leads?.length || 0;
  const unscoredCount = leads?.filter((l) => l.lead_score == null).length || 0;
  const pushedTotal = leads?.filter((l) => l.pushed_to_all_deals).length || 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <HeaderToolbar
        totalLeads={totalLeads}
        unscoredCount={unscoredCount}
        pushedTotal={pushedTotal}
        isEnriching={isEnriching}
        isScoring={isScoring}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        onBulkEnrich={handleBulkEnrich}
        onScoreLeads={handleScoreLeads}
      />

      <CalculatorTypeTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        calculatorTypes={calculatorTypes}
        leads={leads || []}
      />

      <KpiStatsCards stats={kpiStats} />

      <FilterBar
        filterState={filterState}
        onFilterStateChange={setFilterState}
        fieldDefinitions={VALUATION_LEAD_FIELDS}
        dynamicOptions={dynamicOptions}
        totalCount={engineTotal}
        filteredCount={filteredCount}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => setHidePushed(h => !h)}
          className={cn(
            "flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors",
            hidePushed
              ? "bg-primary/10 border-primary/30 text-primary font-medium"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <EyeOff className="h-3.5 w-3.5" />
          {hidePushed ? "Showing Un-Pushed Only" : "Hide Pushed"}
        </button>
      </div>

      {(enrichmentProgress.isEnriching || enrichmentProgress.isPaused) && (
        <EnrichmentProgressIndicator
          completedCount={enrichmentProgress.completedCount}
          totalCount={enrichmentProgress.totalCount}
          progress={enrichmentProgress.progress}
          estimatedTimeRemaining={enrichmentProgress.estimatedTimeRemaining}
          processingRate={enrichmentProgress.processingRate}
          successfulCount={enrichmentProgress.successfulCount}
          failedCount={enrichmentProgress.failedCount}
          isPaused={enrichmentProgress.isPaused}
          onPause={pauseEnrichment}
          onResume={resumeEnrichment}
          onCancel={cancelEnrichment}
        />
      )}

      <DealEnrichmentSummaryDialog
        open={showEnrichmentSummary}
        onOpenChange={(open) => !open && dismissSummary()}
        summary={enrichmentSummary}
        onRetryFailed={handleRetryFailedEnrichment}
      />

      <BulkActionsBar
        selectedIds={selectedIds}
        filteredLeads={filteredLeads}
        isPushing={isPushing}
        isPushEnriching={isPushEnriching}
        isReEnriching={isReEnriching}
        onClearSelection={() => setSelectedIds(new Set())}
        onPushToAllDeals={handlePushToAllDeals}
        onPushAndEnrich={handlePushAndEnrich}
        onReEnrich={handleReEnrich}
        onArchive={handleArchive}
      />

      <LeadsTable
        paginatedLeads={paginatedLeads}
        activeTab={activeTab}
        colWidths={colWidths}
        sortColumn={sortColumn}
        safePage={safePage}
        pageSize={PAGE_SIZE}
        selectedIds={selectedIds}
        allSelected={allSelected}
        adminProfiles={adminProfiles}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelect={toggleSelect}
        onSort={handleSort}
        onStartResize={startResize}
        onRowClick={handleRowClick}
        onAssignOwner={handleAssignOwner}
        onPushToAllDeals={handlePushToAllDeals}
        onPushAndEnrich={handlePushAndEnrich}
        onReEnrich={handleReEnrich}
        refetch={refetch}
      />

      <LeadsPagination
        filteredCount={filteredLeads.length}
        totalLeads={totalLeads}
        safePage={safePage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
