import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMarkMatchToolLeadsViewed } from '@/hooks/admin/use-mark-match-tool-leads-viewed';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterBar, TimeframeSelector, MATCH_TOOL_LEAD_FIELDS } from '@/components/filters';
import {
  Loader2,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Users,
  Sparkles,
  CheckCircle2,
  EyeOff,
  ThumbsDown,
  Phone,
  ClipboardList,
  Building2,
  Activity,
  Trash2,
  Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMatchToolLeadsData } from './useMatchToolLeadsData';
import { MatchToolLeadsTable } from './MatchToolLeadsTable';
import { MatchToolLeadPanel } from './MatchToolLeadPanel';
import { exportMatchToolLeadsToCSV } from './helpers';
import { useAIUIActionHandler } from '@/hooks/useAIUIActionHandler';
import { useAICommandCenterContext } from '@/components/ai-command-center/AICommandCenterProvider';
import type { Operator, FilterRule } from '@/components/filters';
import type { MatchToolSortColumn } from './types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function MatchToolLeads() {
  const { setPageContext } = useAICommandCenterContext();
  const { markAsViewed } = useMarkMatchToolLeadsViewed();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    markAsViewed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPageContext({ page: 'match_tool_leads', entity_type: 'leads' });
  }, [setPageContext]);

  const {
    leads,
    isLoading,
    refetch,
    filteredLeads,
    paginatedLeads,
    adminProfiles,
    stageCounts,
    kpiStats,
    filterState,
    setFilterState,
    dynamicOptions,
    filteredCount,
    engineTotal,
    sortColumn,
    sortDirection,
    handleSort,
    activeTab,
    setActiveTab,
    timeframe,
    setTimeframe,
    setCurrentPage,
    totalPages,
    safePage,
    PAGE_SIZE,
    selectedIds,
    setSelectedIds,
    allSelected,
    toggleSelectAll,
    toggleSelect,
    hidePushed,
    setHidePushed,
    hideNotFit,
    setHideNotFit,
    showQuarantined,
    setShowQuarantined,
    recentQuarantinedCount,
    handleRowClick,
    handleOpenDeal,
    handlePushToAllDeals,
    handlePushAndEnrich,
    handleReEnrich,
    handleArchive,
    handleMarkNotFit,
    handleBulkEnrich,
    handleScoreLeads,
    handleAssignOwner,
    handleEnrichSelected: _handleEnrichSelected,
    handleDelete,
    handleFindContacts,
    selectedLead,
    setSelectedLead,
    drawerOpen,
    setDrawerOpen,
    isPushing,
    isScoring,
    isEnriching,
    isMarkingNotFit,
    isFindingContacts,
    isDeleting,
  } = useMatchToolLeadsData();

  // Auto-open detail drawer from ?leadId=
  useEffect(() => {
    const leadId = searchParams.get('leadId');
    if (!leadId || !leads?.length) return;
    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      setSelectedLead(lead);
      setDrawerOpen(true);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('leadId');
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, leads, setSelectedLead, setDrawerOpen, setSearchParams]);

  useAIUIActionHandler({
    table: 'leads',
    onSelectRows: (rowIds, mode) => {
      if (mode === 'replace') setSelectedIds(new Set(rowIds));
      else if (mode === 'add')
        setSelectedIds((prev) => {
          const n = new Set(prev);
          rowIds.forEach((id) => n.add(id));
          return n;
        });
      else
        setSelectedIds((prev) => {
          const n = new Set(prev);
          rowIds.forEach((id) => (n.has(id) ? n.delete(id) : n.add(id)));
          return n;
        });
    },
    onClearSelection: () => setSelectedIds(new Set()),
    onApplyFilter: (filters, clearExisting) => {
      const rules = filters.map((f, idx) => ({
        id: `ai-filter-${idx}`,
        field: f.field,
        operator: f.operator as Operator,
        value: f.value,
      }));
      if (clearExisting)
        setFilterState({ rules: rules as FilterRule[], conjunction: 'and', search: '' });
      else
        setFilterState((prev) => ({
          ...prev,
          rules: [...prev.rules, ...rules] as FilterRule[],
        }));
    },
    onSortColumn: (field) => {
      handleSort(field as MatchToolSortColumn);
    },
  });

  const totalLeads = leads?.length || 0;
  const unscoredCount = leads?.filter((l) => l.lead_score == null).length || 0;
  const pushedTotal = leads?.filter((l) => l.pushed_to_all_deals).length || 0;

  const tabConfig: Array<{ id: typeof activeTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: stageCounts.all },
    { id: 'full_form', label: 'Wants Buyers', count: stageCounts.full_form },
    { id: 'financials', label: 'Has Financials', count: stageCounts.financials },
    { id: 'browse', label: 'Browse Only', count: stageCounts.browse },
    { id: 'pushed', label: 'In Active Deals', count: stageCounts.pushed },
    { id: 'archived', label: 'Archived', count: stageCounts.archived },
  ];

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Match Tool Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalLeads} total &middot; {unscoredCount} unscored &middot; {pushedTotal} in Active
            Deals
          </p>
        </div>
        <div className="flex items-center gap-2">
          {kpiStats.contactCoverage.missingContact > 0 && handleFindContacts && (
            <Button
              variant="default"
              size="sm"
              disabled={isFindingContacts}
              onClick={() => {
                const targets = (leads || [])
                  .filter(
                    (l) => !l.excluded && l.full_name && l.email && (!l.phone || !l.linkedin_url),
                  )
                  .map((l) => l.id);
                handleFindContacts(targets);
              }}
            >
              {isFindingContacts ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Phone className="h-4 w-4 mr-1" />
              )}
              Find Contacts ({kpiStats.contactCoverage.missingContact})
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isEnriching}>
                {isEnriching ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                Enrich
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBulkEnrich('unenriched')}>
                Enrich Unenriched
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkEnrich('all')}>
                Re-enrich All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isScoring}>
                {isScoring ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4 mr-1" />
                )}
                Score
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleScoreLeads('unscored')}>
                Score Unscored
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleScoreLeads('all')}>
                Recalculate All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <TimeframeSelector value={timeframe} onChange={setTimeframe} compact />
        </div>
      </div>

      {/* Stage Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {tabConfig.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-muted-foreground">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{kpiStats.totalLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <ClipboardList className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Wants Buyers</p>
                <p className="text-2xl font-bold text-emerald-600">{kpiStats.wantsBuyers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Has Financials</p>
                <p className="text-2xl font-bold text-blue-600">{kpiStats.hasFinancials}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Active Deals</p>
                <p className="text-2xl font-bold text-green-600">{kpiStats.pushedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Phone className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contact Coverage</p>
                <p className="text-2xl font-bold">
                  {kpiStats.contactCoverage.pct}%
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({kpiStats.contactCoverage.withContact}/{kpiStats.contactCoverage.eligible})
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filterState={filterState}
        onFilterStateChange={setFilterState}
        fieldDefinitions={MATCH_TOOL_LEAD_FIELDS}
        dynamicOptions={dynamicOptions}
        totalCount={engineTotal}
        filteredCount={filteredCount}
      />

      {/* Toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setHidePushed(!hidePushed)}
          className={cn(
            'flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors',
            hidePushed
              ? 'bg-primary/10 border-primary/30 text-primary font-medium'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
        >
          <EyeOff className="h-3.5 w-3.5" />
          {hidePushed ? 'Showing Un-Pushed Only' : 'Hide Pushed'}
        </button>
        <button
          onClick={() => setHideNotFit(!hideNotFit)}
          className={cn(
            'flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors',
            hideNotFit
              ? 'bg-orange-100 border-orange-300 text-orange-700 font-medium'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          {hideNotFit ? 'Not Fit Hidden' : 'Show Not Fit'}
        </button>
        <button
          onClick={() => setShowQuarantined(!showQuarantined)}
          className={cn(
            'flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors',
            showQuarantined
              ? 'bg-destructive/10 border-destructive/30 text-destructive font-medium'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
          title="View leads auto-excluded for invalid website / spammy submissions"
        >
          <EyeOff className="h-3.5 w-3.5" />
          {showQuarantined ? 'Viewing Quarantined' : 'Show Quarantined'}
          {!showQuarantined && recentQuarantinedCount > 0 && (
            <span
              className="ml-1 inline-flex items-center justify-center rounded-full bg-destructive/15 text-destructive text-[10px] font-semibold leading-none px-1.5 py-0.5"
              title={`${recentQuarantinedCount} auto-quarantined in the last 7 days`}
            >
              {recentQuarantinedCount}
            </span>
          )}
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const t = toast.loading('Re-evaluating leads against geo + legitimacy gate...');
            try {
              const { data, error } = await supabase.functions.invoke('quarantine-tier3-leads');
              if (error) throw error;
              const reasons = data.reasonCounts
                ? Object.entries(data.reasonCounts)
                    .map(([r, n]) => `${r}: ${n}`)
                    .join(' · ')
                : '';
              toast.success(
                `Evaluated ${data.evaluated} · Quarantined ${data.quarantined} · Kept ${data.kept}`,
                { id: t, description: reasons || undefined, duration: 8000 },
              );
              refetch();
            } catch (e) {
              toast.error(`Failed: ${e instanceof Error ? e.message : 'unknown'}`, { id: t });
            }
          }}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          Re-evaluate Quarantine
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            // Step 1: dry-run preview
            const preview = toast.loading('Previewing outreach backlog...');
            try {
              const { data: dry, error: dryErr } = await supabase.functions.invoke(
                'backfill-match-tool-outreach',
                { body: { dry_run: true } },
              );
              if (dryErr) throw dryErr;
              const count = dry?.evaluated ?? 0;
              toast.dismiss(preview);
              if (count === 0) {
                toast.info('No leads pending outreach.');
                return;
              }
              const ok = window.confirm(
                `Send hyper-personalized intro emails to ${count} owner${count === 1 ? '' : 's'}?\n\n` +
                  (dry?.recipients || [])
                    .slice(0, 8)
                    .map(
                      (r: {
                        full_name: string | null;
                        email: string | null;
                        business_name: string | null;
                      }) =>
                        `• ${r.full_name || '?'} (${r.email}) — ${r.business_name || 'unknown biz'}`,
                    )
                    .join('\n') +
                  (count > 8 ? `\n…and ${count - 8} more` : ''),
              );
              if (!ok) return;

              const t = toast.loading(
                `Sending outreach to ${count} owners (this takes a moment)...`,
              );
              const { data, error } = await supabase.functions.invoke(
                'backfill-match-tool-outreach',
                { body: {} },
              );
              if (error) throw error;
              toast.success(`Sent ${data.sent} · Skipped ${data.skipped} · Failed ${data.failed}`, {
                id: t,
                description:
                  data.failed > 0 ? `First error: ${data.errors?.[0]?.error}` : undefined,
                duration: 8000,
              });
              refetch();
            } catch (e) {
              toast.dismiss(preview);
              toast.error(`Backfill failed: ${e instanceof Error ? e.message : 'unknown'}`);
            }
          }}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          Send outreach to backlog
        </Button>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-primary" />
              <span className="font-medium">{selectedIds.size} selected</span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground underline ml-2"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="default"
                disabled={isPushing}
                onClick={() => handlePushToAllDeals(Array.from(selectedIds))}
              >
                {isPushing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                )}
                Push to Active Deals
              </Button>
              {handleFindContacts && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isFindingContacts}
                  onClick={() => handleFindContacts(Array.from(selectedIds))}
                >
                  <Phone className="h-3.5 w-3.5 mr-1" />
                  Find Contacts
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={isEnriching}
                onClick={() => handleReEnrich(Array.from(selectedIds))}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Enrich
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const selected = filteredLeads.filter((l) => selectedIds.has(l.id));
                  exportMatchToolLeadsToCSV(selected);
                }}
              >
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isMarkingNotFit}
                onClick={() => handleMarkNotFit(Array.from(selectedIds))}
              >
                <ThumbsDown className="h-3.5 w-3.5 mr-1" />
                Not a Fit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleArchive(Array.from(selectedIds))}
              >
                <Archive className="h-3.5 w-3.5 mr-1" />
                Archive
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isDeleting}
                onClick={() => handleDelete(Array.from(selectedIds))}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <MatchToolLeadsTable
        paginatedLeads={paginatedLeads}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        handleSort={handleSort}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        allSelected={allSelected}
        toggleSelectAll={toggleSelectAll}
        toggleSelect={toggleSelect}
        handleRowClick={handleRowClick}
        handleOpenDeal={handleOpenDeal}
        handlePushToAllDeals={handlePushToAllDeals}
        handleReEnrich={handleReEnrich}
        handlePushAndEnrich={handlePushAndEnrich}
        handleMarkNotFit={handleMarkNotFit}
        handleArchive={handleArchive}
        handleDelete={handleDelete}
        handleAssignOwner={handleAssignOwner}
        handleFindContacts={handleFindContacts}
        adminProfiles={adminProfiles}
        refetch={refetch}
      />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {filteredLeads.length > 0 ? (safePage - 1) * PAGE_SIZE + 1 : 0}
          {'\u2013'}
          {Math.min(safePage * PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length} leads
          {filteredLeads.length !== totalLeads && ` (filtered from ${totalLeads})`}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(1)}
            disabled={safePage <= 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-3 tabular-nums flex items-center gap-1">
            Page
            <input
              type="number"
              min={1}
              max={totalPages}
              value={safePage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val);
              }}
              className="w-12 h-7 text-center text-sm border border-input rounded-md bg-background tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage >= totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Detail Drawer */}
      <MatchToolLeadPanel
        lead={selectedLead}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onEnrich={async (lead_id, website, opts) => {
          const force = opts?.force === true;
          const { data, error } = await supabase.functions.invoke('enrich-match-tool-lead', {
            body: { lead_id, website, force },
          });
          if (error) {
            const msg = (error as { message?: string }).message || 'Enrichment failed';
            if (msg.toLowerCase().includes('rate limit') || msg.includes('429')) {
              toast.error('AI rate limited — please try again in a minute.');
            } else if (msg.includes('402') || msg.toLowerCase().includes('credits')) {
              toast.error('AI credits exhausted — please top up the OpenAI account.');
            } else {
              toast.error(`Enrichment failed: ${msg}`);
            }
          } else if (data?.error) {
            toast.error(data.error);
          } else if (force) {
            toast.success(data?.cached ? 'Loaded cached intel' : 'Enrichment refreshed');
          }
          refetch();
        }}
        isEnriching={isEnriching}
        onPushToDeals={(ids) => handlePushToAllDeals(ids)}
        onMarkNotFit={(ids) => handleMarkNotFit(ids)}
        onViewDeal={() => selectedLead && handleOpenDeal(selectedLead)}
        isPushing={isPushing}
      />
    </div>
  );
}
