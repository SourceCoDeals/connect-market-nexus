import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sparkles, Loader2, BarChart3, ChevronDown, Plus, FileSpreadsheet, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DealImportDialog } from "@/components/remarketing/DealImportDialog";
import { FilterBar, TimeframeSelector, GP_PARTNER_FIELDS } from "@/components/filters";
import { EnrichmentProgressIndicator } from "@/components/remarketing/EnrichmentProgressIndicator";
import { useGPPartnerDeals } from "./useGPPartnerDeals";
import { useAIUIActionHandler } from "@/hooks/useAIUIActionHandler";
import { useAICommandCenterContext } from "@/components/ai-command-center/AICommandCenterProvider";
import { GPPartnerKPICards } from "./GPPartnerKPICards";
import { GPPartnerBulkActions } from "./GPPartnerBulkActions";
import { GPPartnerTable } from "./GPPartnerTable";
import { GPPartnerPagination } from "./GPPartnerPagination";
import { AddDealDialog } from "./AddDealDialog";
import { PushToDialerModal } from "@/components/remarketing/PushToDialerModal";
import { AddDealsToListDialog } from "@/components/remarketing";
import type { DealForList } from "@/components/remarketing";

export default function GPPartnerDeals() {
  const hook = useGPPartnerDeals();
  const { setPageContext } = useAICommandCenterContext();
  const [dialerOpen, setDialerOpen] = useState(false);
  const [addToListOpen, setAddToListOpen] = useState(false);

  const selectedDealsForList = useMemo((): DealForList[] => {
    if (!hook.filteredDeals || hook.selectedIds.size === 0) return [];
    return hook.filteredDeals
      .filter((d) => hook.selectedIds.has(d.id))
      .map((d) => ({
        dealId: d.id,
        dealName: d.internal_company_name || d.title || "Unknown Deal",
        contactName: d.main_contact_name,
        contactEmail: d.main_contact_email,
        contactPhone: d.main_contact_phone,
      }));
  }, [hook.filteredDeals, hook.selectedIds]);

  useEffect(() => {
    setPageContext({ page: 'gp_partners', entity_type: 'leads' });
  }, [setPageContext]);

  useAIUIActionHandler({
    table: 'leads',
    onSelectRows: (rowIds, mode) => {
      if (mode === 'replace') hook.setSelectedIds(new Set(rowIds));
      else if (mode === 'add')
        hook.setSelectedIds((prev) => {
          const n = new Set(prev);
          rowIds.forEach((id) => n.add(id));
          return n;
        });
      else
        hook.setSelectedIds((prev) => {
          const n = new Set(prev);
          rowIds.forEach((id) => (n.has(id) ? n.delete(id) : n.add(id)));
          return n;
        });
    },
    onClearSelection: () => hook.setSelectedIds(new Set()),
    onSortColumn: (field) => {
      const fieldMap: Record<string, string> = {
        company_name: 'company_name',
        score: 'score',
        created_at: 'created_at',
        priority: 'priority',
      };
      hook.handleSort((fieldMap[field] || field) as any);
    },
  });

  if (hook.isLoading) {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">GP Partner Deals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hook.totalDeals} total &middot; {hook.unpushedCount} un-pushed &middot;{' '}
            {hook.enrichedCount} enriched &middot; {hook.scoredCount} scored
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => hook.setAddDealOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Deal
          </Button>
          <Button variant="outline" size="sm" onClick={() => hook.setCsvUploadOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Import CSV
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={hook.isEnriching}>
                {hook.isEnriching ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                Enrich
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => hook.handleBulkEnrich('unenriched')}>
                Enrich Unenriched
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => hook.handleBulkEnrich('all')}>
                Re-enrich All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={hook.isScoring}>
                {hook.isScoring ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4 mr-1" />
                )}
                Score
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => hook.handleBulkScore('unscored')}>
                Score Unscored
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => hook.handleBulkScore('all')}>
                Recalculate All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <TimeframeSelector value={hook.timeframe} onChange={hook.setTimeframe} compact />
        </div>
      </div>

      {/* KPI Stats Cards */}
      <GPPartnerKPICards
        totalDeals={hook.kpiStats.totalDeals}
        priorityDeals={hook.kpiStats.priorityDeals}
        avgScore={hook.kpiStats.avgScore}
        needsScoring={hook.kpiStats.needsScoring}
      />

      {/* Enrichment Progress Bar */}
      {(hook.enrichmentProgress.isEnriching || hook.enrichmentProgress.isPaused) && (
        <EnrichmentProgressIndicator
          completedCount={hook.enrichmentProgress.completedCount}
          totalCount={hook.enrichmentProgress.totalCount}
          progress={hook.enrichmentProgress.progress}
          estimatedTimeRemaining={hook.enrichmentProgress.estimatedTimeRemaining}
          processingRate={hook.enrichmentProgress.processingRate}
          itemLabel="deals"
          successfulCount={hook.enrichmentProgress.successfulCount}
          failedCount={hook.enrichmentProgress.failedCount}
          isPaused={hook.enrichmentProgress.isPaused}
          onCancel={hook.cancelEnrichment}
        />
      )}

      {/* Filters */}
      <FilterBar
        filterState={hook.filterState}
        onFilterStateChange={hook.setFilterState}
        fieldDefinitions={GP_PARTNER_FIELDS}
        dynamicOptions={hook.dynamicOptions}
        totalCount={hook.engineTotal}
        filteredCount={hook.filteredCount}
      />

      {/* Hide Pushed Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => hook.setHidePushed((h) => !h)}
          className={cn(
            'flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors',
            hook.hidePushed
              ? 'bg-primary/10 border-primary/30 text-primary font-medium'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
        >
          <EyeOff className="h-3.5 w-3.5" />
          {hook.hidePushed ? 'Showing Un-Pushed Only' : 'Hide Pushed'}
        </button>
      </div>

      {/* Bulk Actions */}
      <GPPartnerBulkActions
        selectedIds={hook.selectedIds}
        setSelectedIds={hook.setSelectedIds}
        filteredDeals={hook.filteredDeals}
        isPushing={hook.isPushing}
        isEnriching={hook.isEnriching}
        handlePushToAllDeals={hook.handlePushToAllDeals}
        handleEnrichSelected={hook.handleEnrichSelected}
        onPushToDialer={() => setDialerOpen(true)}
        onAddToList={() => setAddToListOpen(true)}
      />
      <PushToDialerModal
        open={dialerOpen}
        onOpenChange={setDialerOpen}
        contactIds={Array.from(hook.selectedIds)}
        contactCount={hook.selectedIds.size}
        entityType="listings"
      />
      <AddDealsToListDialog
        open={addToListOpen}
        onOpenChange={setAddToListOpen}
        selectedDeals={selectedDealsForList}
        entityType="gp_partner_deal"
      />

      {/* Deals Table */}
      <GPPartnerTable
        paginatedDeals={hook.paginatedDeals}
        safePage={hook.safePage}
        PAGE_SIZE={hook.PAGE_SIZE}
        sortColumn={hook.sortColumn}
        allSelected={hook.allSelected}
        toggleSelectAll={hook.toggleSelectAll}
        selectedIds={hook.selectedIds}
        toggleSelect={hook.toggleSelect}
        handleSort={hook.handleSort}
        handlePushToAllDeals={hook.handlePushToAllDeals}
        handleEnrichSelected={hook.handleEnrichSelected}
        handleAssignOwner={hook.handleAssignOwner}
        adminProfiles={hook.adminProfiles}
        setAddDealOpen={hook.setAddDealOpen}
        setCsvUploadOpen={hook.setCsvUploadOpen}
      />

      {/* Pagination */}
      <GPPartnerPagination
        filteredCount={hook.filteredDeals.length}
        totalDeals={hook.totalDeals}
        safePage={hook.safePage}
        totalPages={hook.totalPages}
        PAGE_SIZE={hook.PAGE_SIZE}
        setCurrentPage={hook.setCurrentPage}
      />

      {/* Add Deal Dialog */}
      <AddDealDialog
        open={hook.addDealOpen}
        onOpenChange={hook.setAddDealOpen}
        newDeal={hook.newDeal}
        setNewDeal={hook.setNewDeal}
        isAddingDeal={hook.isAddingDeal}
        handleAddDeal={hook.handleAddDeal}
      />

      {/* CSV Upload Dialog */}
      <DealImportDialog
        open={hook.csvUploadOpen}
        onOpenChange={hook.setCsvUploadOpen}
        onImportComplete={hook.handleImportComplete}
        dealSource="gp_partners"
        hideFromAllDeals
      />
    </div>
  );
}
