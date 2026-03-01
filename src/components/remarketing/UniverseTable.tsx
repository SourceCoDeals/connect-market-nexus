import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Plus,
  MoreHorizontal,
  Globe2,
  Users,
  Building2,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  ArrowUpDown,
  Network,
  GripVertical,
  Sparkles,
  Loader2,
  ChevronDown,
  X,
  Handshake,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IntelligenceCoverageBar } from '@/components/remarketing';
import type { SortField, FlaggedDeal, BuyerStats, DealStats } from '@/hooks/admin/use-universes';
import { extractGuideDescription } from '@/hooks/admin/use-universes';

// ─── Sortable Header ────────────────────────────────────────────────

function SortableHeader({
  field,
  currentField,
  children,
  onSort,
}: {
  field: SortField;
  currentField: SortField;
  children: React.ReactNode;
  onSort: (field: SortField) => void;
}) {
  return (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown
          className={`h-3.5 w-3.5 ${currentField === field ? 'text-foreground' : 'text-muted-foreground/50'}`}
        />
      </div>
    </TableHead>
  );
}

// ─── Sortable Flagged Row (DnD) ─────────────────────────────────────

function SortableFlaggedRow({
  deal,
  index,
  onCreateClick,
  onNavigate,
  onRemoveClick,
}: {
  deal: FlaggedDeal;
  index: number;
  onCreateClick: (e: React.MouseEvent) => void;
  onNavigate: () => void;
  onRemoveClick: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasAIData = !!deal.buyer_universe_generated_at;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className="cursor-pointer hover:bg-muted/50"
      onClick={onNavigate}
    >
      <TableCell className="w-[40px]" onClick={(e) => e.stopPropagation()}>
        <button
          className="flex items-center justify-center h-8 w-8 cursor-grab active:cursor-grabbing rounded hover:bg-muted"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="w-[40px] text-center text-xs text-muted-foreground tabular-nums">
        {index + 1}
      </TableCell>
      <TableCell>
        {hasAIData ? (
          <span className="text-sm font-medium">{deal.buyer_universe_label}</span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell className="max-w-[320px]">
        {hasAIData && deal.buyer_universe_description ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-sm text-muted-foreground line-clamp-2 cursor-default">
                  {deal.buyer_universe_description}
                </p>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-md">
                <p className="text-sm">{deal.buyer_universe_description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Network className="h-4 w-4 text-blue-600" />
          </div>
          <p className="font-medium text-foreground truncate">
            {deal.internal_company_name || deal.title}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm">{deal.address_state || '—'}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {deal.universe_build_flagged_at
            ? new Date(deal.universe_build_flagged_at).toLocaleDateString()
            : '—'}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onCreateClick}>
            <Plus className="h-3.5 w-3.5" />
            Create
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={onRemoveClick}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Existing Universes Table ────────────────────────────────────────

interface ExistingUniversesTableProps {
  universes: Array<{
    id: string;
    name: string;
    description: string | null;
    archived: boolean;
    fee_agreement_required: boolean;
    ma_guide_content?: string | null;
  }>;
  isLoading: boolean;
  buyerStats: BuyerStats | undefined;
  dealStats: DealStats | undefined;
  sortField: SortField;
  onSort: (field: SortField) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  onOpenNewDialog: () => void;
  onArchive: (args: { id: string; archived: boolean }) => void;
  onDelete: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
  archivedCount: number | undefined;
  onClearSelection: () => void;
  onOpenBulkDelete: () => void;
}

export function ExistingUniversesTable({
  universes,
  isLoading,
  buyerStats,
  dealStats,
  sortField,
  onSort,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  someSelected,
  onOpenNewDialog,
  onArchive,
  onDelete,
  search,
  onSearchChange,
  showArchived,
  onShowArchivedChange,
  archivedCount,
  onClearSelection,
  onOpenBulkDelete,
}: ExistingUniversesTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <>
      {/* Search & Archive Toggle */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search universes..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={onShowArchivedChange}
              />
              <Label htmlFor="show-archived" className="text-sm text-muted-foreground">
                Show archived ({archivedCount})
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {selectedIds.size} universe{selectedIds.size > 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                  className="h-7 px-2 text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <Button variant="destructive" size="sm" onClick={onOpenBulkDelete} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onToggleSelectAll}
                    aria-label="Select all"
                    className={
                      someSelected && !allSelected ? 'data-[state=checked]:bg-primary/50' : ''
                    }
                  />
                </TableHead>
                <SortableHeader field="name" currentField={sortField} onSort={onSort}>
                  Industry / Universe
                </SortableHeader>
                <SortableHeader field="buyers" currentField={sortField} onSort={onSort}>
                  Buyers
                </SortableHeader>
                <SortableHeader field="deals" currentField={sortField} onSort={onSort}>
                  Deals
                </SortableHeader>
                <SortableHeader field="coverage" currentField={sortField} onSort={onSort}>
                  Intelligence Coverage
                </SortableHeader>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-4" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : universes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Globe2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No universes found</p>
                    <p className="text-sm">Create your first buyer universe to get started</p>
                    <Button variant="outline" className="mt-4" onClick={onOpenNewDialog}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Universe
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                universes.map((universe) => {
                  const stats = buyerStats?.[universe.id] || {
                    total: 0,
                    enriched: 0,
                    withTranscripts: 0,
                  };
                  const deals = dealStats?.[universe.id] || 0;
                  const websiteIntel =
                    stats.total > 0 ? Math.round((stats.enriched / stats.total) * 50) : 0;
                  const transcriptIntel =
                    stats.total > 0 ? Math.round((stats.withTranscripts / stats.total) * 50) : 0;
                  const coverage = websiteIntel + transcriptIntel;
                  const isSelected = selectedIds.has(universe.id);

                  return (
                    <TableRow
                      key={universe.id}
                      className={`cursor-pointer hover:bg-muted/50 ${isSelected ? 'bg-primary/5' : ''}`}
                      onClick={() => navigate(`/admin/buyers/universes/${universe.id}`)}
                    >
                      <TableCell onClick={(e) => onToggleSelect(universe.id, e)}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {}}
                          aria-label={`Select ${universe.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Globe2 className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0 max-w-[400px]">
                            <p className="font-medium text-foreground">{universe.name}</p>
                            {(() => {
                              const desc =
                                universe.description ||
                                extractGuideDescription(universe.ma_guide_content);
                              return desc ? (
                                <p className="text-sm text-muted-foreground line-clamp-2">{desc}</p>
                              ) : (
                                <p className="text-sm text-muted-foreground/50 italic">
                                  No description
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span className="font-medium text-foreground">{stats.total}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span className="font-medium text-foreground">{deals}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-40">
                          <IntelligenceCoverageBar
                            current={stats.withTranscripts}
                            total={stats.total}
                            enrichedCount={stats.enriched}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={coverage >= 50 ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {coverage}% intel
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/buyers/universes/${universe.id}`);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async (e) => {
                                e.stopPropagation();
                                const newVal = !universe.fee_agreement_required;
                                await supabase
                                  .from('remarketing_buyer_universes')
                                  .update({ fee_agreement_required: newVal } as never)
                                  .eq('id', universe.id);
                                queryClient.invalidateQueries({ queryKey: ['remarketing'] });
                                toast.success(
                                  newVal ? 'Fee agreement required' : 'Fee agreement not required',
                                );
                              }}
                            >
                              <Handshake
                                className={`h-4 w-4 mr-2 ${universe.fee_agreement_required ? 'text-green-600' : ''}`}
                              />
                              {universe.fee_agreement_required
                                ? '✓ Fee Agreement Required'
                                : 'Flag: Fee Agreement Required'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onArchive({ id: universe.id, archived: !universe.archived });
                              }}
                            >
                              {universe.archived ? (
                                <>
                                  <ArchiveRestore className="h-4 w-4 mr-2" />
                                  Restore
                                </>
                              ) : (
                                <>
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archive
                                </>
                              )}
                            </DropdownMenuItem>
                            {universe.archived && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    confirm(
                                      'Are you sure you want to permanently delete this universe?',
                                    )
                                  ) {
                                    onDelete(universe.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

// ─── To-Be-Created DnD Table ─────────────────────────────────────────

interface ToBeCreatedTableProps {
  orderedFlagged: FlaggedDeal[];
  isDealEnriching: boolean;
  isBulkEnriching: boolean;
  runningOp: { completed_items?: number; total_items?: number } | null;
  onDragEnd: (event: DragEndEvent) => void;
  onEnrichAllFlagged: () => void;
  onBulkDealEnrich: (mode: 'unenriched' | 'all') => void;
  onRemoveDeal: (dealId: string) => void;
  onOpenNewDialog: () => void;
}

export function ToBeCreatedTable({
  orderedFlagged,
  isDealEnriching,
  isBulkEnriching,
  runningOp,
  onDragEnd,
  onEnrichAllFlagged,
  onBulkDealEnrich,
  onRemoveDeal,
  onOpenNewDialog,
}: ToBeCreatedTableProps) {
  const navigate = useNavigate();
  const flaggedSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  return (
    <Card>
      <CardContent className="p-0">
        {/* Enrich toolbar */}
        {orderedFlagged.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm text-muted-foreground">
              {orderedFlagged.filter((d) => !d.enriched_at).length} of {orderedFlagged.length} deals
              need data enrichment &middot;{' '}
              {orderedFlagged.filter((d) => !d.buyer_universe_generated_at).length} need universe
              generation
            </p>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={isDealEnriching}
                  >
                    {isDealEnriching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Enrich Deals
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => onBulkDealEnrich('unenriched')}>
                    Enrich Unenriched
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onBulkDealEnrich('all')}>
                    Re-enrich All
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size="sm"
                className="gap-1.5"
                disabled={
                  isBulkEnriching || orderedFlagged.every((d) => !!d.buyer_universe_generated_at)
                }
                onClick={onEnrichAllFlagged}
              >
                {isBulkEnriching ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating {runningOp?.completed_items || 0}/{runningOp?.total_items || 0}...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate Universes
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
        <DndContext
          sensors={flaggedSensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead>Buyer Universe</TableHead>
                <TableHead className="min-w-[280px]">Description</TableHead>
                <TableHead>Deal Name</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Flagged At</TableHead>
                <TableHead className="w-[150px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderedFlagged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No deals flagged for universe build</p>
                    <p className="text-sm">
                      Flag deals in Active Deals to queue them for universe creation
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                <SortableContext
                  items={orderedFlagged.map((d) => d.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {orderedFlagged.map((deal, idx) => (
                    <SortableFlaggedRow
                      key={deal.id}
                      deal={deal}
                      index={idx}
                      onNavigate={() => navigate(`/admin/deals/${deal.id}`)}
                      onCreateClick={(e) => {
                        e.stopPropagation();
                        onOpenNewDialog();
                      }}
                      onRemoveClick={async (e) => {
                        e.stopPropagation();
                        onRemoveDeal(deal.id);
                      }}
                    />
                  ))}
                </SortableContext>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </CardContent>
    </Card>
  );
}
