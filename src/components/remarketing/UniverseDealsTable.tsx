import { useState, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Target,
  ThumbsUp,
  ThumbsDown,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  X,
} from 'lucide-react';
import {
  type UniverseDeal,
  type DealEngagement,
  type SortField,
  EMPLOYEE_RANGES,
  SCORE_TIERS,
  useUniverseDealsFilters,
} from './useUniverseDealsFilters';
import { UniverseDealRow } from './UniverseDealRow';

interface UniverseDealsTableProps {
  deals: UniverseDeal[];
  engagementStats?: Record<string, DealEngagement>;
  onRemoveDeal?: (dealId: string, listingId: string) => void;
  onScoreDeal?: (listingId: string) => void;
  onEnrichDeal?: (listingId: string) => void;
  selectedDealIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  universeId?: string;
}

const ResizeHandle = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
  <div
    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 z-10"
    onMouseDown={onMouseDown}
    onClick={(e) => e.stopPropagation()}
  />
);

const DEFAULT_WIDTHS: Record<string, number> = {
  checkbox: 40,
  name: 220,
  description: 200,
  serviceArea: 130,
  approved: 60,
  interested: 60,
  passed: 60,
  added: 90,
  liCount: 75,
  liRange: 75,
  googleReviews: 75,
  googleRating: 70,
  revenue: 85,
  ebitda: 85,
  quality: 70,
  sellerInterest: 70,
  score: 70,
  actions: 50,
};

export const UniverseDealsTable = ({
  deals,
  engagementStats = {},
  onRemoveDeal,
  onScoreDeal,
  onEnrichDeal,
  selectedDealIds: controlledSelected,
  onSelectionChange,
  universeId,
}: UniverseDealsTableProps) => {
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_WIDTHS);
  const resizingRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);

  const selectedIds = controlledSelected ?? internalSelected;
  const setSelectedIds = useCallback(
    (ids: string[]) => {
      if (onSelectionChange) onSelectionChange(ids);
      else setInternalSelected(ids);
    },
    [onSelectionChange],
  );

  const {
    sortField,
    sortDir,
    handleSort,
    search,
    setSearch,
    stateFilter,
    setStateFilter,
    employeeFilter,
    setEmployeeFilter,
    qualityTierFilter,
    setQualityTierFilter,
    enrichmentFilter,
    setEnrichmentFilter,
    showFilters,
    setShowFilters,
    uniqueStates,
    sortedDeals,
    hasActiveFilters,
    clearAllFilters,
  } = useUniverseDealsFilters(deals, engagementStats);

  const allSelected = sortedDeals.length > 0 && selectedIds.length === sortedDeals.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < sortedDeals.length;

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : sortedDeals.map((d) => d.id));
  };

  const toggleOne = (dealId: string) => {
    setSelectedIds(
      selectedIds.includes(dealId)
        ? selectedIds.filter((id) => id !== dealId)
        : [...selectedIds, dealId],
    );
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 ml-1 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1 text-primary" />
    );
  };

  // Column resize handlers
  const handleResizeStart = useCallback(
    (col: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = { col, startX: e.clientX, startWidth: columnWidths[col] };
      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizingRef.current) return;
        const delta = moveEvent.clientX - resizingRef.current.startX;
        const newWidth = Math.max(40, resizingRef.current.startWidth + delta);
        setColumnWidths((prev) => ({ ...prev, [resizingRef.current!.col]: newWidth }));
      };
      const handleMouseUp = () => {
        resizingRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [columnWidths],
  );

  const w = (col: string) => columnWidths[col];

  return (
    <TooltipProvider>
      {/* Filter toolbar */}
      <div className="px-4 py-3 border-b space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-8"
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filters
            {hasActiveFilters && (
              <Badge
                variant="secondary"
                className="ml-1.5 h-4 px-1 text-[10px] bg-primary/10 text-primary"
              >
                {
                  [
                    stateFilter !== 'all',
                    employeeFilter !== 'all',
                    qualityTierFilter !== 'all',
                    enrichmentFilter !== 'all',
                  ].filter(Boolean).length
                }
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 text-xs text-muted-foreground"
            >
              <X className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {sortedDeals.length}
            {sortedDeals.length !== deals.length ? ` of ${deals.length}` : ''} deals
          </span>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2">
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {uniqueStates.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                {EMPLOYEE_RANGES.map((r) => (
                  <SelectItem key={r.label} value={r.label}>
                    {r.label} employees
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={qualityTierFilter} onValueChange={setQualityTierFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Quality Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                {SCORE_TIERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
                <SelectItem value="none">Not Scored</SelectItem>
              </SelectContent>
            </Select>

            <Select value={enrichmentFilter} onValueChange={setEnrichmentFilter}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Enrichment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="enriched">Enriched</SelectItem>
                <SelectItem value="not_enriched">Not Enriched</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table
          className="table-fixed"
          style={{ minWidth: Object.values(columnWidths).reduce((a, b) => a + b, 0) }}
        >
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: w('checkbox') }}>
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  aria-label="Select all deals"
                />
              </TableHead>
              <TableHead
                style={{ width: w('name') }}
                className="relative cursor-pointer select-none"
                onClick={() => handleSort('name')}
              >
                <span className="flex items-center">
                  Deal Name <SortIcon field="name" />
                </span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('name', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('description') }}
                className="relative cursor-pointer select-none"
                onClick={() => handleSort('description')}
              >
                <span className="flex items-center">
                  Description <SortIcon field="description" />
                </span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('description', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('serviceArea') }}
                className="relative cursor-pointer select-none"
                onClick={() => handleSort('serviceArea')}
              >
                <span className="flex items-center">
                  Service Area <SortIcon field="serviceArea" />
                </span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('serviceArea', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('approved') }}
                className="text-center relative cursor-pointer select-none"
                onClick={() => handleSort('approved')}
              >
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />
                    <SortIcon field="approved" />
                  </TooltipTrigger>
                  <TooltipContent>Approved buyers</TooltipContent>
                </Tooltip>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('approved', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('interested') }}
                className="text-center relative cursor-pointer select-none"
                onClick={() => handleSort('interested')}
              >
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <SortIcon field="interested" />
                  </TooltipTrigger>
                  <TooltipContent>Interested buyers</TooltipContent>
                </Tooltip>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('interested', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('passed') }}
                className="text-center relative cursor-pointer select-none"
                onClick={() => handleSort('passed')}
              >
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <ThumbsDown className="h-3.5 w-3.5 text-muted-foreground" />
                    <SortIcon field="passed" />
                  </TooltipTrigger>
                  <TooltipContent>Passed buyers</TooltipContent>
                </Tooltip>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('passed', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('added') }}
                className="relative cursor-pointer select-none"
                onClick={() => handleSort('added')}
              >
                <span className="flex items-center">
                  Added <SortIcon field="added" />
                </span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('added', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('liCount') }}
                className="text-right relative cursor-pointer select-none"
                onClick={() => handleSort('liCount')}
              >
                <span className="flex items-center justify-end">
                  LI Count <SortIcon field="liCount" />
                </span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('liCount', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('liRange') }}
                className="text-right relative cursor-pointer select-none"
                onClick={() => handleSort('liRange')}
              >
                <span className="flex items-center justify-end">
                  LI Range <SortIcon field="liRange" />
                </span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('liRange', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('googleReviews') }}
                className="text-right relative cursor-pointer select-none"
                onClick={() => handleSort('googleReviews')}
              >
                <span className="flex items-center justify-end">
                  Reviews <SortIcon field="googleReviews" />
                </span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('googleReviews', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('googleRating') }}
                className="text-right relative cursor-pointer select-none"
                onClick={() => handleSort('googleRating')}
              >
                <span className="flex items-center justify-end">
                  Rating <SortIcon field="googleRating" />
                </span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('googleRating', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('revenue') }}
                className="text-right relative cursor-pointer select-none"
                onClick={() => handleSort('revenue')}
              >
                <span className="flex items-center justify-end">
                  Revenue <SortIcon field="revenue" />
                </span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('revenue', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('ebitda') }}
                className="text-right relative cursor-pointer select-none"
                onClick={() => handleSort('ebitda')}
              >
                <span className="flex items-center justify-end">
                  EBITDA <SortIcon field="ebitda" />
                </span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('ebitda', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('quality') }}
                className="text-center relative cursor-pointer select-none"
                onClick={() => handleSort('quality')}
              >
                <span className="flex items-center justify-center">
                  Quality <SortIcon field="quality" />
                </span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('quality', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('sellerInterest') }}
                className="text-center relative cursor-pointer select-none"
                onClick={() => handleSort('sellerInterest')}
              >
                <span className="flex items-center justify-center">
                  Seller <SortIcon field="sellerInterest" />
                </span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('sellerInterest', e)} />
              </TableHead>
              <TableHead
                style={{ width: w('score') }}
                className="text-center relative cursor-pointer select-none"
                onClick={() => handleSort('score')}
              >
                <span className="flex items-center justify-center">
                  Score <SortIcon field="score" />
                </span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('score', e)} />
              </TableHead>
              <TableHead style={{ width: w('actions') }}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDeals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={18} className="text-center py-12 text-muted-foreground">
                  <Target className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">
                    {hasActiveFilters ? 'No deals match your filters' : 'No deals in this universe'}
                  </p>
                  <p className="text-sm">
                    {hasActiveFilters
                      ? 'Try adjusting your filters'
                      : 'Add deals to start matching with buyers'}
                  </p>
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={clearAllFilters}>
                      Clear filters
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              sortedDeals.map((deal) => {
                const engagement = engagementStats[deal.listing.id] || {
                  approved: 0,
                  interested: 0,
                  passed: 0,
                  avgScore: 0,
                };

                return (
                  <UniverseDealRow
                    key={deal.id}
                    deal={deal}
                    engagement={engagement}
                    isSelected={selectedIds.includes(deal.id)}
                    onToggleSelect={toggleOne}
                    onRemoveDeal={onRemoveDeal}
                    onScoreDeal={onScoreDeal}
                    onEnrichDeal={onEnrichDeal}
                    universeId={universeId}
                    w={w}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};

export default UniverseDealsTable;
