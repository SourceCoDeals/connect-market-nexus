import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Sparkles, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useBuyerEnrichmentProgress } from '@/hooks/useBuyerEnrichmentProgress';
import { EnrichmentProgressIndicator } from '@/components/remarketing/EnrichmentProgressIndicator';
import { BuyerCSVImport } from '@/components/remarketing';
import { useAIUIActionHandler } from '@/hooks/useAIUIActionHandler';
import { useAICommandCenterContext } from '@/components/ai-command-center/AICommandCenterProvider';
import { useBuyersData } from './useBuyersData';
import AddBuyerDialog from './AddBuyerDialog';
import BuyersTable from './BuyersTable';

const ReMarketingBuyers = () => {
  const { progress: buyerEnrichmentProgress, cancel: cancelBuyerEnrichment } =
    useBuyerEnrichmentProgress();

  const {
    search,
    setSearch,
    activeTab,
    universeFilter,
    isAddDialogOpen,
    setIsAddDialogOpen,
    selectedIds,
    setSelectedIds,
    currentPage,
    setCurrentPage,
    enrichingIds,
    setEnrichingIds,
    sortColumn,
    sortDirection,
    newBuyer,
    setNewBuyer,

    buyers,
    buyersLoading,
    buyerIdsWithTranscripts,
    universes,
    tabCounts,
    platformCountsByFirm,
    filteredBuyers,
    totalPages,
    pagedBuyers,

    createMutation,
    deleteMutation,

    handleTabChange,
    handleEnrichBuyer,
    handleSort,
    setUniverseFilter,
    toggleSelect,
    toggleSelectAll,
    handleExportCSV,

    queryClient,
  } = useBuyersData();

  const { setPageContext } = useAICommandCenterContext();

  useEffect(() => {
    setPageContext({ page: 'remarketing_buyers', entity_type: 'buyers' });
  }, [setPageContext]);

  useAIUIActionHandler({
    table: 'buyers',
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
    onSortColumn: (field) => {
      const fieldMap: Record<string, string> = {
        company_name: 'company_name',
        buyer_type: 'buyer_type',
        created_at: 'created_at',
      };
      handleSort(fieldMap[field] || field);
    },
    onTriggerAction: (action) => {
      if (action === 'enrich_selected') {
        const ids =
          selectedIds.size > 0
            ? Array.from(selectedIds)
            : filteredBuyers.map((b: { id: string }) => b.id);
        if (ids.length > 0) {
          setEnrichingIds(new Set(ids));
          import('@/lib/remarketing/queueEnrichment').then(({ queueBuyerEnrichment }) =>
            queueBuyerEnrichment(ids)
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
              })
              .catch(() => toast.error('Failed to queue enrichment'))
              .finally(() => setEnrichingIds(new Set())),
          );
        }
      }
      if (action === 'export_csv') handleExportCSV();
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Buyers</h1>
          <p className="text-muted-foreground">
            {tabCounts.all} buyers · {tabCounts.needs_agreements} need agreements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BuyerCSVImport />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={enrichingIds.size > 0 || filteredBuyers.length === 0}
            onClick={async () => {
              const ids =
                selectedIds.size > 0
                  ? Array.from(selectedIds)
                  : filteredBuyers.map((b: { id: string }) => b.id);
              if (ids.length === 0) return;
              setEnrichingIds(new Set(ids));
              try {
                const { queueBuyerEnrichment } = await import('@/lib/remarketing/queueEnrichment');
                await queueBuyerEnrichment(ids);
                queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
              } catch (err) {
                // Bulk enrich failed — toast shown to user
                toast.error('Failed to queue enrichment');
              } finally {
                setEnrichingIds(new Set());
              }
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {enrichingIds.size > 0
              ? `Enriching…`
              : selectedIds.size > 0
                ? `Enrich Selected (${selectedIds.size})`
                : 'Enrich All'}
          </Button>
          <AddBuyerDialog
            isOpen={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            newBuyer={newBuyer}
            setNewBuyer={setNewBuyer}
            universes={universes}
            createMutation={createMutation}
          />
        </div>
      </div>

      {/* Buyer Enrichment Progress Bar */}
      {buyerEnrichmentProgress.isEnriching && (
        <EnrichmentProgressIndicator
          completedCount={buyerEnrichmentProgress.completedCount}
          totalCount={buyerEnrichmentProgress.totalCount}
          progress={buyerEnrichmentProgress.progress}
          estimatedTimeRemaining={buyerEnrichmentProgress.estimatedTimeRemaining}
          processingRate={buyerEnrichmentProgress.processingRate}
          itemLabel="buyers"
          successfulCount={
            buyerEnrichmentProgress.completedCount - buyerEnrichmentProgress.failedCount
          }
          failedCount={buyerEnrichmentProgress.failedCount}
          onCancel={cancelBuyerEnrichment}
        />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All Buyers ({tabCounts.all})</TabsTrigger>
          <TabsTrigger value="pe_firm">Sponsors & Firms ({tabCounts.pe_firm})</TabsTrigger>
          <TabsTrigger value="platform">Platforms ({tabCounts.platform})</TabsTrigger>
          <TabsTrigger value="needs_agreements">
            Needs Agreements ({tabCounts.needs_agreements})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button
              size="sm"
              variant="outline"
              disabled={enrichingIds.size > 0}
              onClick={async () => {
                const ids = Array.from(selectedIds);
                if (ids.length === 0) return;
                setEnrichingIds(new Set(ids));
                try {
                  const { queueBuyerEnrichment } =
                    await import('@/lib/remarketing/queueEnrichment');
                  await queueBuyerEnrichment(ids);
                  queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
                } catch (err) {
                  // Bulk enrich failed — toast shown to user
                  toast.error('Failed to queue enrichment');
                } finally {
                  setEnrichingIds(new Set());
                }
              }}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />{' '}
              {enrichingIds.size > 0 ? 'Enriching…' : 'Enrich Selected'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search buyers by name, website, or thesis..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={universeFilter} onValueChange={setUniverseFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Universes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Universes</SelectItem>
                {universes?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Buyers Table */}
      <BuyersTable
        activeTab={activeTab}
        buyersLoading={buyersLoading}
        filteredBuyers={filteredBuyers}
        pagedBuyers={pagedBuyers}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        selectedIds={selectedIds}
        buyers={buyers}
        platformCountsByFirm={platformCountsByFirm}
        buyerIdsWithTranscripts={buyerIdsWithTranscripts}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        toggleSelect={toggleSelect}
        toggleSelectAll={toggleSelectAll}
        handleSort={handleSort}
        handleEnrichBuyer={handleEnrichBuyer}
        deleteMutation={deleteMutation}
      />
    </div>
  );
};

export default ReMarketingBuyers;
