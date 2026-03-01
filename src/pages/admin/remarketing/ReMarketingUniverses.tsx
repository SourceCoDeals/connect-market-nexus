import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Globe2, Network } from 'lucide-react';
import { useAICommandCenterContext } from '@/components/ai-command-center/AICommandCenterProvider';
import { useAIUIActionHandler } from '@/hooks/useAIUIActionHandler';
import {
  useUniversesQuery,
  useBuyerStatsQuery,
  useDealStatsQuery,
  useArchivedCountQuery,
  useFlaggedDealsQuery,
  useCreateUniverseMutation,
  useArchiveUniverseMutation,
  useDeleteUniverseMutation,
  useBulkDeleteUniversesMutation,
  useFlaggedDealsManager,
  useGenerateDescription,
  useSortedUniverses,
  type SortField,
  type SortOrder,
} from '@/hooks/admin/use-universes';
import { ExistingUniversesTable, ToBeCreatedTable } from '@/components/remarketing/UniverseTable';
import { CreateUniverseDialog, BulkDeleteDialog } from '@/components/remarketing/UniverseDialogs';

const ReMarketingUniverses = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'existing' | 'to_be_created'>('existing');
  const search = searchParams.get('q') ?? '';
  const [showArchived, setShowArchived] = useState(false);
  const sortField = (searchParams.get('sort') as SortField) ?? 'name';
  const sortOrder = (searchParams.get('dir') as SortOrder) ?? 'asc';
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const showNewDialog = searchParams.get('new') === 'true';
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // AI Command Center context
  const { setPageContext } = useAICommandCenterContext();
  useEffect(() => {
    setPageContext({ page: 'universes', entity_type: 'universes' });
  }, [setPageContext]);
  useAIUIActionHandler({
    table: 'universes',
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
          rowIds.forEach((id) => {
            if (n.has(id)) n.delete(id);
            else n.add(id);
          });
          return n;
        });
    },
    onClearSelection: () => setSelectedIds(new Set()),
  });

  // Queries
  const { data: universes, isLoading } = useUniversesQuery(showArchived);
  const { data: buyerStats } = useBuyerStatsQuery();
  const { data: dealStats } = useDealStatsQuery();
  const { data: archivedCount } = useArchivedCountQuery();
  const flaggedPrecheck = useFlaggedDealsManager(undefined);
  const { data: flaggedDeals } = useFlaggedDealsQuery(flaggedPrecheck.isBulkEnriching);
  const flagged = useFlaggedDealsManager(flaggedDeals);

  // Mutations
  const createMutation = useCreateUniverseMutation();
  const archiveMutation = useArchiveUniverseMutation();
  const deleteMutation = useDeleteUniverseMutation();
  const bulkDeleteMutation = useBulkDeleteUniversesMutation(() => setSelectedIds(new Set()));
  const { isGenerating: isGeneratingDesc, generate: generateDesc } = useGenerateDescription(
    newName,
    setNewDescription,
  );

  // Sorting & search helpers
  const sortedUniverses = useSortedUniverses(
    universes,
    search,
    sortField,
    sortOrder,
    buyerStats,
    dealStats,
  );
  const handleSort = (field: SortField) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (n.get('sort') === field) n.set('dir', n.get('dir') === 'asc' ? 'desc' : 'asc');
        else {
          n.set('sort', field);
          n.set('dir', 'asc');
        }
        return n;
      },
      { replace: true },
    );
  };
  const setSearch = (v: string) =>
    setSearchParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (v) n.set('q', v);
        else n.delete('q');
        return n;
      },
      { replace: true },
    );
  const openNewDialog = () =>
    setSearchParams((p) => {
      const n = new URLSearchParams(p);
      n.set('new', 'true');
      return n;
    });
  const closeNewDialog = () =>
    setSearchParams((p) => {
      const n = new URLSearchParams(p);
      n.delete('new');
      return n;
    });

  // Selection
  const allSelected =
    sortedUniverses.length > 0 && sortedUniverses.every((u) => selectedIds.has(u.id));
  const someSelected = sortedUniverses.some((u) => selectedIds.has(u.id));
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(sortedUniverses.map((u) => u.id)));
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const n = new Set(selectedIds);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelectedIds(n);
  };

  return (
    <div className="p-6 space-y-6 h-fit">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Buyer Universes</h1>
          <p className="text-muted-foreground">
            {universes?.length || 0} existing · {flaggedDeals?.length || 0} to be created{' '}
            {archivedCount ? `· ${archivedCount} archived` : ''}
          </p>
        </div>
        <Button onClick={openNewDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          New Universe
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'existing' | 'to_be_created')}
      >
        <TabsList>
          <TabsTrigger value="existing">
            <Globe2 className="h-4 w-4 mr-1.5" />
            Existing ({universes?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="to_be_created">
            <Network className="h-4 w-4 mr-1.5" />
            To Be Created ({flaggedDeals?.length || 0})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === 'existing' ? (
        <ExistingUniversesTable
          universes={sortedUniverses}
          isLoading={isLoading}
          buyerStats={buyerStats}
          dealStats={dealStats}
          sortField={sortField}
          onSort={handleSort}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          allSelected={allSelected}
          someSelected={someSelected}
          onOpenNewDialog={openNewDialog}
          onArchive={(a) => archiveMutation.mutate(a)}
          onDelete={(id) => deleteMutation.mutate(id)}
          search={search}
          onSearchChange={setSearch}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
          archivedCount={archivedCount}
          onClearSelection={() => setSelectedIds(new Set())}
          onOpenBulkDelete={() => setShowBulkDeleteDialog(true)}
        />
      ) : (
        <ToBeCreatedTable
          orderedFlagged={flagged.orderedFlagged}
          isDealEnriching={flagged.isDealEnriching}
          isBulkEnriching={flagged.isBulkEnriching}
          runningOp={flagged.runningOp}
          onDragEnd={flagged.handleFlaggedDragEnd}
          onEnrichAllFlagged={flagged.enrichAllFlaggedDeals}
          onBulkDealEnrich={flagged.handleBulkDealEnrich}
          onRemoveDeal={flagged.removeDealFromFlagged}
          onOpenNewDialog={openNewDialog}
        />
      )}

      <CreateUniverseDialog
        open={showNewDialog}
        onOpenChange={(o) => !o && closeNewDialog()}
        name={newName}
        onNameChange={setNewName}
        description={newDescription}
        onDescriptionChange={setNewDescription}
        isGeneratingDescription={isGeneratingDesc}
        onGenerateDescription={generateDesc}
        isPending={createMutation.isPending}
        onSubmit={() => createMutation.mutate({ name: newName, description: newDescription })}
      />
      <BulkDeleteDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        count={selectedIds.size}
        isPending={bulkDeleteMutation.isPending}
        onConfirm={() => {
          bulkDeleteMutation.mutate(Array.from(selectedIds));
          setShowBulkDeleteDialog(false);
        }}
      />
    </div>
  );
};

export default ReMarketingUniverses;
