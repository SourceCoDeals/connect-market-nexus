import { useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Building2, 
  MapPin, 
  TrendingUp,
  Target,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Clock,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  Star,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UniverseDeal {
  id: string;
  added_at: string;
  status: string;
  listing: {
    id: string;
    title: string;
    internal_company_name?: string;
    description?: string;
    location?: string;
    revenue?: number;
    ebitda?: number;
    enriched_at?: string;
    geographic_states?: string[];
    linkedin_employee_count?: number;
    linkedin_employee_range?: string;
    google_rating?: number;
    google_review_count?: number;
    deal_total_score?: number | null;
    seller_interest_score?: number | null;
  };
}

interface DealEngagement {
  approved: number;
  interested: number;
  passed: number;
  avgScore: number;
}

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

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '—';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const ResizeHandle = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
  <div
    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 z-10"
    onMouseDown={onMouseDown}
    onClick={(e) => e.stopPropagation()}
  />
);

const getScoreBg = (score: number) => {
  if (score >= 80) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
  if (score >= 60) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
  if (score >= 40) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400';
  return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
};

const getScoreTier = (score: number) => {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
};

type SortField = 'name' | 'description' | 'serviceArea' | 'approved' | 'interested' | 'passed' | 'added' | 'liCount' | 'liRange' | 'googleReviews' | 'googleRating' | 'revenue' | 'ebitda' | 'quality' | 'sellerInterest' | 'score';
type SortDir = 'asc' | 'desc';

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

const EMPLOYEE_RANGES = [
  { label: '1-10', min: 1, max: 10 },
  { label: '11-50', min: 11, max: 50 },
  { label: '51-200', min: 51, max: 200 },
  { label: '200+', min: 201, max: Infinity },
];

const SCORE_TIERS = [
  { label: 'A (80+)', value: 'A' },
  { label: 'B (65-79)', value: 'B' },
  { label: 'C (50-64)', value: 'C' },
  { label: 'D (35-49)', value: 'D' },
  { label: 'F (<35)', value: 'F' },
];

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
  const navigate = useNavigate();
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_WIDTHS);
  const resizingRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);

  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Filter state
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [qualityTierFilter, setQualityTierFilter] = useState<string>('all');
  const [enrichmentFilter, setEnrichmentFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const selectedIds = controlledSelected ?? internalSelected;
  const setSelectedIds = useCallback((ids: string[]) => {
    if (onSelectionChange) onSelectionChange(ids);
    else setInternalSelected(ids);
  }, [onSelectionChange]);

  // Derive unique states from deals
  const uniqueStates = useMemo(() => {
    const states = new Set<string>();
    deals.forEach(d => d.listing.geographic_states?.forEach(s => states.add(s)));
    return Array.from(states).sort();
  }, [deals]);

  // Filter deals
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      const l = deal.listing;
      // Search
      if (search) {
        const q = search.toLowerCase();
        const matchName = (l.internal_company_name || l.title || '').toLowerCase().includes(q);
        const matchDesc = (l.description || '').toLowerCase().includes(q);
        const matchLoc = (l.location || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchLoc) return false;
      }
      // State
      if (stateFilter !== 'all') {
        if (!l.geographic_states?.includes(stateFilter)) return false;
      }
      // Employee range
      if (employeeFilter !== 'all') {
        const range = EMPLOYEE_RANGES.find(r => r.label === employeeFilter);
        if (range) {
          const count = l.linkedin_employee_count || 0;
          if (count < range.min || count > range.max) return false;
        }
      }
      // Quality tier
      if (qualityTierFilter !== 'all') {
        const score = l.deal_total_score;
        if (score == null) return qualityTierFilter === 'none';
        if (getScoreTier(score) !== qualityTierFilter) return false;
      }
      // Enrichment
      if (enrichmentFilter === 'enriched' && !l.enriched_at) return false;
      if (enrichmentFilter === 'not_enriched' && l.enriched_at) return false;
      return true;
    });
  }, [deals, search, stateFilter, employeeFilter, qualityTierFilter, enrichmentFilter]);

  // Sort deals
  const sortedDeals = useMemo(() => {
    if (!sortField) return filteredDeals;
    const sorted = [...filteredDeals].sort((a, b) => {
      const engA = engagementStats[a.listing.id] || { approved: 0, interested: 0, passed: 0, avgScore: 0 };
      const engB = engagementStats[b.listing.id] || { approved: 0, interested: 0, passed: 0, avgScore: 0 };
      let valA: any, valB: any;
      switch (sortField) {
        case 'name': valA = (a.listing.internal_company_name || a.listing.title || '').toLowerCase(); valB = (b.listing.internal_company_name || b.listing.title || '').toLowerCase(); break;
        case 'description': valA = (a.listing.description || '').toLowerCase(); valB = (b.listing.description || '').toLowerCase(); break;
        case 'serviceArea': valA = (a.listing.geographic_states || []).join(','); valB = (b.listing.geographic_states || []).join(','); break;
        case 'approved': valA = engA.approved; valB = engB.approved; break;
        case 'interested': valA = engA.interested; valB = engB.interested; break;
        case 'passed': valA = engA.passed; valB = engB.passed; break;
        case 'added': valA = new Date(a.added_at).getTime(); valB = new Date(b.added_at).getTime(); break;
        case 'liCount': valA = a.listing.linkedin_employee_count || 0; valB = b.listing.linkedin_employee_count || 0; break;
        case 'liRange': valA = (a.listing.linkedin_employee_range || ''); valB = (b.listing.linkedin_employee_range || ''); break;
        case 'googleReviews': valA = a.listing.google_review_count || 0; valB = b.listing.google_review_count || 0; break;
        case 'googleRating': valA = a.listing.google_rating || 0; valB = b.listing.google_rating || 0; break;
        case 'revenue': valA = a.listing.revenue || 0; valB = b.listing.revenue || 0; break;
        case 'ebitda': valA = a.listing.ebitda || 0; valB = b.listing.ebitda || 0; break;
        case 'quality': valA = a.listing.deal_total_score ?? -1; valB = b.listing.deal_total_score ?? -1; break;
        case 'sellerInterest': valA = a.listing.seller_interest_score ?? -1; valB = b.listing.seller_interest_score ?? -1; break;
        case 'score': valA = engA.avgScore; valB = engB.avgScore; break;
        default: return 0;
      }
      if (typeof valA === 'string') return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
    return sorted;
  }, [filteredDeals, sortField, sortDir, engagementStats]);

  const allSelected = sortedDeals.length > 0 && selectedIds.length === sortedDeals.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < sortedDeals.length;

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : sortedDeals.map(d => d.id));
  };

  const toggleOne = (dealId: string) => {
    setSelectedIds(
      selectedIds.includes(dealId)
        ? selectedIds.filter(id => id !== dealId)
        : [...selectedIds, dealId]
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'desc') setSortDir('asc');
      else { setSortField(null); setSortDir('desc'); }
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> 
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  // Column resize handlers
  const handleResizeStart = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { col, startX: e.clientX, startWidth: columnWidths[col] };
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = moveEvent.clientX - resizingRef.current.startX;
      const newWidth = Math.max(40, resizingRef.current.startWidth + delta);
      setColumnWidths(prev => ({ ...prev, [resizingRef.current!.col]: newWidth }));
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
  }, [columnWidths]);

  const w = (col: string) => columnWidths[col];

  const hasActiveFilters = stateFilter !== 'all' || employeeFilter !== 'all' || qualityTierFilter !== 'all' || enrichmentFilter !== 'all' || search.length > 0;

  const clearAllFilters = () => {
    setSearch('');
    setStateFilter('all');
    setEmployeeFilter('all');
    setQualityTierFilter('all');
    setEnrichmentFilter('all');
  };

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
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-8"
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] bg-primary/10 text-primary">
                {[stateFilter !== 'all', employeeFilter !== 'all', qualityTierFilter !== 'all', enrichmentFilter !== 'all'].filter(Boolean).length}
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 text-xs text-muted-foreground">
              <X className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {sortedDeals.length}{sortedDeals.length !== deals.length ? ` of ${deals.length}` : ''} deals
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
                {uniqueStates.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                {EMPLOYEE_RANGES.map(r => (
                  <SelectItem key={r.label} value={r.label}>{r.label} employees</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={qualityTierFilter} onValueChange={setQualityTierFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Quality Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                {SCORE_TIERS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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
        <Table className="table-fixed" style={{ minWidth: Object.values(columnWidths).reduce((a, b) => a + b, 0) }}>
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: w('checkbox') }}>
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Select all deals"
                />
              </TableHead>
              <TableHead style={{ width: w('name') }} className="relative cursor-pointer select-none" onClick={() => handleSort('name')}>
                <span className="flex items-center">Deal Name <SortIcon field="name" /></span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('name', e)} />
              </TableHead>
              <TableHead style={{ width: w('description') }} className="relative cursor-pointer select-none" onClick={() => handleSort('description')}>
                <span className="flex items-center">Description <SortIcon field="description" /></span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('description', e)} />
              </TableHead>
              <TableHead style={{ width: w('serviceArea') }} className="relative cursor-pointer select-none" onClick={() => handleSort('serviceArea')}>
                <span className="flex items-center">Service Area <SortIcon field="serviceArea" /></span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('serviceArea', e)} />
              </TableHead>
              <TableHead style={{ width: w('approved') }} className="text-center relative cursor-pointer select-none" onClick={() => handleSort('approved')}>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />
                    <SortIcon field="approved" />
                  </TooltipTrigger>
                  <TooltipContent>Approved buyers</TooltipContent>
                </Tooltip>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('approved', e)} />
              </TableHead>
              <TableHead style={{ width: w('interested') }} className="text-center relative cursor-pointer select-none" onClick={() => handleSort('interested')}>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <SortIcon field="interested" />
                  </TooltipTrigger>
                  <TooltipContent>Interested buyers</TooltipContent>
                </Tooltip>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('interested', e)} />
              </TableHead>
              <TableHead style={{ width: w('passed') }} className="text-center relative cursor-pointer select-none" onClick={() => handleSort('passed')}>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <ThumbsDown className="h-3.5 w-3.5 text-muted-foreground" />
                    <SortIcon field="passed" />
                  </TooltipTrigger>
                  <TooltipContent>Passed buyers</TooltipContent>
                </Tooltip>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('passed', e)} />
              </TableHead>
              <TableHead style={{ width: w('added') }} className="relative cursor-pointer select-none" onClick={() => handleSort('added')}>
                <span className="flex items-center">Added <SortIcon field="added" /></span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('added', e)} />
              </TableHead>
              <TableHead style={{ width: w('liCount') }} className="text-right relative cursor-pointer select-none" onClick={() => handleSort('liCount')}>
                <span className="flex items-center justify-end">LI Count <SortIcon field="liCount" /></span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('liCount', e)} />
              </TableHead>
              <TableHead style={{ width: w('liRange') }} className="text-right relative cursor-pointer select-none" onClick={() => handleSort('liRange')}>
                <span className="flex items-center justify-end">LI Range <SortIcon field="liRange" /></span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('liRange', e)} />
              </TableHead>
              <TableHead style={{ width: w('googleReviews') }} className="text-right relative cursor-pointer select-none" onClick={() => handleSort('googleReviews')}>
                <span className="flex items-center justify-end">Reviews <SortIcon field="googleReviews" /></span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('googleReviews', e)} />
              </TableHead>
              <TableHead style={{ width: w('googleRating') }} className="text-right relative cursor-pointer select-none" onClick={() => handleSort('googleRating')}>
                <span className="flex items-center justify-end">Rating <SortIcon field="googleRating" /></span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('googleRating', e)} />
              </TableHead>
              <TableHead style={{ width: w('revenue') }} className="text-right relative cursor-pointer select-none" onClick={() => handleSort('revenue')}>
                <span className="flex items-center justify-end">Revenue <SortIcon field="revenue" /></span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('revenue', e)} />
              </TableHead>
              <TableHead style={{ width: w('ebitda') }} className="text-right relative cursor-pointer select-none" onClick={() => handleSort('ebitda')}>
                <span className="flex items-center justify-end">EBITDA <SortIcon field="ebitda" /></span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('ebitda', e)} />
              </TableHead>
              <TableHead style={{ width: w('quality') }} className="text-center relative cursor-pointer select-none" onClick={() => handleSort('quality')}>
                <span className="flex items-center justify-center">Quality <SortIcon field="quality" /></span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('quality', e)} />
              </TableHead>
              <TableHead style={{ width: w('sellerInterest') }} className="text-center relative cursor-pointer select-none" onClick={() => handleSort('sellerInterest')}>
                <span className="flex items-center justify-center">Seller <SortIcon field="sellerInterest" /></span>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('sellerInterest', e)} />
              </TableHead>
              <TableHead style={{ width: w('score') }} className="text-center relative cursor-pointer select-none" onClick={() => handleSort('score')}>
                <span className="flex items-center justify-center">Score <SortIcon field="score" /></span>
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
                  <p className="font-medium">{hasActiveFilters ? 'No deals match your filters' : 'No deals in this universe'}</p>
                  <p className="text-sm">{hasActiveFilters ? 'Try adjusting your filters' : 'Add deals to start matching with buyers'}</p>
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={clearAllFilters}>
                      Clear filters
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              sortedDeals.map((deal) => {
                const engagement = engagementStats[deal.listing.id] || { approved: 0, interested: 0, passed: 0, avgScore: 0 };
                const isSelected = selectedIds.includes(deal.id);
                
                return (
                  <TableRow
                    key={deal.id}
                    className={`cursor-pointer hover:bg-muted/50 ${isSelected ? 'bg-primary/5' : ''}`}
                    onClick={() => navigate(`/admin/deals/${deal.listing.id}`, universeId ? { state: { from: `/admin/buyers/universes/${universeId}` } } : undefined)}
                  >
                    <TableCell style={{ width: w('checkbox') }}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(deal.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${deal.listing.internal_company_name || deal.listing.title}`}
                      />
                    </TableCell>

                    <TableCell style={{ width: w('name') }}>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground truncate">
                              {deal.listing.internal_company_name || deal.listing.title || 'Untitled Deal'}
                            </span>
                            {deal.listing.enriched_at && (
                              <Badge variant="secondary" className="text-xs px-1.5 shrink-0">
                                <Sparkles className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
                          {deal.listing.location && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{deal.listing.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell style={{ width: w('description') }}>
                      {deal.listing.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-2 overflow-hidden">
                          {deal.listing.description}
                        </p>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell style={{ width: w('serviceArea') }}>
                      <div className="flex flex-wrap gap-1">
                        {deal.listing.geographic_states?.slice(0, 3).map((state) => (
                          <Badge key={state} variant="outline" className="text-xs">{state}</Badge>
                        ))}
                        {(deal.listing.geographic_states?.length || 0) > 3 && (
                          <Badge variant="outline" className="text-xs">+{(deal.listing.geographic_states?.length || 0) - 3}</Badge>
                        )}
                        {!deal.listing.geographic_states?.length && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>

                    <TableCell style={{ width: w('approved') }} className="text-center">
                      {engagement.approved > 0 ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">{engagement.approved}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell style={{ width: w('interested') }} className="text-center">
                      {engagement.interested > 0 ? (
                        <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">{engagement.interested}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell style={{ width: w('passed') }} className="text-center">
                      {engagement.passed > 0 ? (
                        <span className="text-sm text-muted-foreground">{engagement.passed}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell style={{ width: w('added') }}>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(deal.added_at), { addSuffix: true })}
                      </span>
                    </TableCell>

                    <TableCell style={{ width: w('liCount') }} className="text-right">
                      {deal.listing.linkedin_employee_count != null ? (
                        <span className="text-sm tabular-nums">{deal.listing.linkedin_employee_count.toLocaleString()}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell style={{ width: w('liRange') }} className="text-right">
                      {deal.listing.linkedin_employee_range ? (
                        <span className="text-sm">{deal.listing.linkedin_employee_range}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell style={{ width: w('googleReviews') }} className="text-right">
                      {deal.listing.google_review_count != null ? (
                        <span className="text-sm tabular-nums">{deal.listing.google_review_count.toLocaleString()}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell style={{ width: w('googleRating') }} className="text-right">
                      {deal.listing.google_rating != null ? (
                        <span className="text-sm tabular-nums">⭐ {deal.listing.google_rating}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell style={{ width: w('revenue') }} className="text-right">
                      <span className="text-sm font-medium">{formatCurrency(deal.listing.revenue)}</span>
                    </TableCell>

                    <TableCell style={{ width: w('ebitda') }} className="text-right">
                      <span className="text-sm">{formatCurrency(deal.listing.ebitda)}</span>
                    </TableCell>

                    <TableCell style={{ width: w('quality') }} className="text-center">
                      {deal.listing.deal_total_score != null ? (
                        <span className={`text-sm font-medium px-2 py-0.5 rounded ${getScoreBg(deal.listing.deal_total_score)}`}>
                          {Math.round(deal.listing.deal_total_score)}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell style={{ width: w('sellerInterest') }} className="text-center">
                      {deal.listing.seller_interest_score != null ? (
                        <span className={`text-sm font-medium px-2 py-0.5 rounded ${getScoreBg(deal.listing.seller_interest_score)}`}>
                          {Math.round(deal.listing.seller_interest_score)}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell style={{ width: w('score') }} className="text-center">
                      {engagement.avgScore > 0 ? (
                        <span className={`text-sm font-medium px-2 py-0.5 rounded ${getScoreBg(engagement.avgScore)}`}>
                          {Math.round(engagement.avgScore)}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell style={{ width: w('actions') }}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/deals/${deal.listing.id}`, universeId ? { state: { from: `/admin/buyers/universes/${universeId}` } } : undefined); }}>
                            <ExternalLink className="h-4 w-4 mr-2" />View Deal
                          </DropdownMenuItem>
                          {onScoreDeal && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onScoreDeal(deal.listing.id); }}>
                              <Target className="h-4 w-4 mr-2" />Score Deal
                            </DropdownMenuItem>
                          )}
                          {onEnrichDeal && !deal.listing.enriched_at && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEnrichDeal(deal.listing.id); }}>
                              <Sparkles className="h-4 w-4 mr-2" />Enrich Deal
                            </DropdownMenuItem>
                          )}
                          {onRemoveDeal && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRemoveDeal(deal.id, deal.listing.id); }} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />Remove from Universe
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
      </div>
    </TooltipProvider>
  );
};

export default UniverseDealsTable;
