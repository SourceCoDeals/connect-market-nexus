import { useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  MoreHorizontal, 
  Sparkles, 
  Trash2, 
  MapPin,
  Building,
  ExternalLink,
  Search as SearchIcon,
  DollarSign,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  XCircle,
  Loader2,
  Unlink
} from "lucide-react";
import { IntelligenceBadge } from "./IntelligenceBadge";
import { AlignmentScoreBadge } from "./AlignmentScoreBadge";
import type { DataCompleteness } from "@/types/remarketing";

interface BuyerRow {
  id: string;
  company_name: string;
  company_website?: string | null;
  buyer_type?: string | null;
  pe_firm_name?: string | null;
  pe_firm_website?: string | null;
  hq_city?: string | null;
  hq_state?: string | null;
  thesis_summary?: string | null;
  business_summary?: string | null;
  data_completeness?: string | null;
  target_geographies?: string[];
  geographic_footprint?: string[];
  has_fee_agreement?: boolean | null;
  alignment_score?: number | null;
  alignment_reasoning?: string | null;
  alignment_checked_at?: string | null;
}

type SortKey = 'company_name' | 'pe_firm_name' | 'data_completeness' | 'alignment_score';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

interface ColumnWidths {
  platform: number;
  industryFit: number;
  peFirm: number;
  description: number;
  intel: number;
}

const DEFAULT_WIDTHS: ColumnWidths = {
  platform: 280,
  industryFit: 120,
  peFirm: 160,
  description: 400,
  intel: 120,
};

const MIN_WIDTH = 80;

interface BuyerTableEnhancedProps {
  buyers: BuyerRow[];
  onEnrich?: (buyerId: string) => void;
  onDelete?: (buyerId: string) => void;
  isEnriching?: string | null;
  showPEColumn?: boolean;
  scoringBuyerIds?: string[];
  /** Set of buyer IDs that have transcripts - needed to determine "Strong" vs "Some Intel" */
  buyerIdsWithTranscripts?: Set<string>;
  /** Enable multi-select mode with checkboxes */
  selectable?: boolean;
  /** Called when selection changes */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Called when user clicks "Remove from Universe" on selected items */
  onRemoveFromUniverse?: (buyerIds: string[]) => Promise<void>;
}

export const BuyerTableEnhanced = ({
  buyers,
  onEnrich,
  onDelete,
  isEnriching,
  showPEColumn = true,
  scoringBuyerIds = [],
  buyerIdsWithTranscripts = new Set(),
  selectable = false,
  onSelectionChange,
  onRemoveFromUniverse,
}: BuyerTableEnhancedProps) => {
  const navigate = useNavigate();
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'company_name',
    direction: 'asc'
  });
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(DEFAULT_WIDTHS);
  const resizingRef = useRef<{ column: keyof ColumnWidths; startX: number; startWidth: number } | null>(null);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRemoving, setIsRemoving] = useState(false);
  const lastClickedIndexRef = useRef<number | null>(null);

  const handleToggleSelect = useCallback((buyerId: string, checked: boolean, event?: React.MouseEvent) => {
    const currentIndex = buyers.findIndex(b => b.id === buyerId);
    
    // Shift+click: select range from last clicked to current
    if (event?.shiftKey && lastClickedIndexRef.current !== null && currentIndex !== -1) {
      const start = Math.min(lastClickedIndexRef.current, currentIndex);
      const end = Math.max(lastClickedIndexRef.current, currentIndex);
      const rangeIds = buyers.slice(start, end + 1).map(b => b.id);
      
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        rangeIds.forEach(id => {
          if (checked) {
            newSet.add(id);
          } else {
            newSet.delete(id);
          }
        });
        onSelectionChange?.(Array.from(newSet));
        return newSet;
      });
      lastClickedIndexRef.current = currentIndex;
      return;
    }
    
    // Normal click: toggle single item
    lastClickedIndexRef.current = currentIndex;
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(buyerId);
      } else {
        newSet.delete(buyerId);
      }
      onSelectionChange?.(Array.from(newSet));
      return newSet;
    });
  }, [buyers, onSelectionChange]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const allIds = new Set(buyers.map(b => b.id));
      setSelectedIds(allIds);
      onSelectionChange?.(Array.from(allIds));
    } else {
      setSelectedIds(new Set());
      onSelectionChange?.([]);
    }
    lastClickedIndexRef.current = null;
  }, [buyers, onSelectionChange]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    onSelectionChange?.([]);
    lastClickedIndexRef.current = null;
  }, [onSelectionChange]);

  const handleRemoveFromUniverse = useCallback(async () => {
    if (!onRemoveFromUniverse || selectedIds.size === 0) return;
    setIsRemoving(true);
    try {
      await onRemoveFromUniverse(Array.from(selectedIds));
      setSelectedIds(new Set());
      onSelectionChange?.([]);
    } finally {
      setIsRemoving(false);
    }
  }, [onRemoveFromUniverse, selectedIds, onSelectionChange]);

  const isAllSelected = buyers.length > 0 && selectedIds.size === buyers.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < buyers.length;

  const getLocation = (buyer: BuyerRow) => {
    const parts = [];
    if (buyer.hq_city) parts.push(buyer.hq_city);
    if (buyer.hq_state) parts.push(buyer.hq_state);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleMouseDown = useCallback((column: keyof ColumnWidths, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      column,
      startX: e.clientX,
      startWidth: columnWidths[column],
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = moveEvent.clientX - resizingRef.current.startX;
      const newWidth = Math.max(MIN_WIDTH, resizingRef.current.startWidth + delta);
      setColumnWidths((prev) => ({
        ...prev,
        [resizingRef.current!.column]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths]);

  const sortedBuyers = useMemo(() => {
    return [...buyers].sort((a, b) => {
      const { key, direction } = sortConfig;
      const multiplier = direction === 'asc' ? 1 : -1;

      switch (key) {
        case 'company_name':
          return multiplier * (a.company_name || '').localeCompare(b.company_name || '');
        
        case 'pe_firm_name':
          const peA = a.pe_firm_name || '';
          const peB = b.pe_firm_name || '';
          if (!peA && !peB) return 0;
          if (!peA) return 1;
          if (!peB) return -1;
          return multiplier * peA.localeCompare(peB);
        
        case 'data_completeness':
          const orderMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
          const compA = orderMap[a.data_completeness || 'low'] || 0;
          const compB = orderMap[b.data_completeness || 'low'] || 0;
          return multiplier * (compA - compB);
        
        case 'alignment_score':
          // Null scores go to the end
          if (a.alignment_score === null && b.alignment_score === null) return 0;
          if (a.alignment_score === null) return 1;
          if (b.alignment_score === null) return -1;
          return multiplier * (a.alignment_score - b.alignment_score);
        
        default:
          return 0;
      }
    });
  }, [buyers, sortConfig]);

  const SortButton = ({ label, sortKey }: { label: string; sortKey: SortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 font-medium"
        onClick={() => handleSort(sortKey)}
      >
        {label}
        {isActive ? (
          sortConfig.direction === 'asc' ? (
            <ArrowUp className="ml-1 h-3 w-3" />
          ) : (
            <ArrowDown className="ml-1 h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
        )}
      </Button>
    );
  };

  const ResizeHandle = ({ column }: { column: keyof ColumnWidths }) => (
    <div
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize group/resize hover:bg-primary/50 z-10"
      onMouseDown={(e) => handleMouseDown(column, e)}
    >
      <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/resize:opacity-100 transition-opacity">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );

  // Calculate colSpan for empty state
  const colSpan = (selectable ? 1 : 0) + 1 + 1 + (showPEColumn ? 1 : 0) + 1 + 1 + 1; // checkbox + platform + industryFit + peFirm? + description + intel + actions

  return (
    <TooltipProvider>
      {/* Bulk Action Bar */}
       {selectable && selectedIds.size > 0 && onRemoveFromUniverse && (
        <div className="sticky top-0 z-20 bg-background border rounded-lg p-3 shadow-sm mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm font-medium">
              {selectedIds.size} selected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="text-muted-foreground"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={handleRemoveFromUniverse}
            disabled={isRemoving}
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Unlink className="h-4 w-4 mr-1" />
            )}
             Remove {selectedIds.size} from Universe
          </Button>
        </div>
      )}
      
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={isAllSelected}
                  ref={(ref) => {
                    if (ref) {
                      (ref as any).indeterminate = isSomeSelected;
                    }
                  }}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            <TableHead className="relative" style={{ width: columnWidths.platform }}>
              <SortButton label="Platform / Buyer" sortKey="company_name" />
              <ResizeHandle column="platform" />
            </TableHead>
            <TableHead className="relative" style={{ width: columnWidths.industryFit }}>
              <SortButton label="Industry Fit" sortKey="alignment_score" />
              <ResizeHandle column="industryFit" />
            </TableHead>
            {showPEColumn && (
              <TableHead className="relative" style={{ width: columnWidths.peFirm }}>
                <SortButton label="PE Firm" sortKey="pe_firm_name" />
                <ResizeHandle column="peFirm" />
              </TableHead>
            )}
            <TableHead className="relative" style={{ width: columnWidths.description }}>
              Description
              <ResizeHandle column="description" />
            </TableHead>
            <TableHead className="relative" style={{ width: columnWidths.intel }}>
              <SortButton label="Intel" sortKey="data_completeness" />
              <ResizeHandle column="intel" />
            </TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedBuyers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center py-12 text-muted-foreground">
                <SearchIcon className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No buyers found</p>
                <p className="text-sm">Add buyers manually or import from CSV</p>
              </TableCell>
            </TableRow>
          ) : (
            sortedBuyers.map((buyer) => {
              const location = getLocation(buyer);
              const isCurrentlyEnriching = isEnriching === buyer.id;
              const isCurrentlyScoring = scoringBuyerIds.includes(buyer.id);
              const isSelected = selectedIds.has(buyer.id);

              return (
                <TableRow
                  key={buyer.id}
                  className={`cursor-pointer hover:bg-muted/50 group ${isSelected ? 'bg-muted/30' : ''}`}
                  onClick={() => navigate(`/admin/remarketing/buyers/${buyer.id}`)}
                >
                  {selectable && (
                    <TableCell 
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle selection with shift-key support
                        handleToggleSelect(buyer.id, !isSelected, e);
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        aria-label={`Select ${buyer.company_name}`}
                        tabIndex={-1}
                      />
                    </TableCell>
                  )}
                  {/* Platform / Buyer Column */}
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground truncate">
                            {buyer.company_name}
                          </span>
                          {/* Only show Enriched badge if completeness is high AND actual data exists */}
                          {buyer.data_completeness === 'high' && (buyer.business_summary || buyer.thesis_summary || buyer.pe_firm_name) && (
                            <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-xs px-1.5 py-0">
                              Enriched
                            </Badge>
                          )}
                          {buyer.has_fee_agreement && (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs px-1.5 py-0 flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Fee Agreed
                            </Badge>
                          )}
                        </div>
                        {location && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {location}
                          </div>
                        )}
                        {buyer.company_website && (
                          <a
                            href={buyer.company_website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {buyer.company_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Industry Fit Column */}
                  <TableCell>
                    <AlignmentScoreBadge
                      score={buyer.alignment_score ?? null}
                      reasoning={buyer.alignment_reasoning}
                      isScoring={isCurrentlyScoring}
                    />
                  </TableCell>

                  {/* PE Firm Column */}
                  {showPEColumn && (
                    <TableCell>
                      {buyer.pe_firm_name ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                            <Building className="h-3 w-3 text-muted-foreground" />
                          </div>
                          {buyer.pe_firm_website ? (
                            <a
                              href={buyer.pe_firm_website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {buyer.pe_firm_name}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-sm">{buyer.pe_firm_name}</span>
                          )}
                        </div>
                      ) : buyer.buyer_type === 'pe_firm' ? (
                        <Badge variant="outline" className="text-xs">
                          PE Firm
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}

                  {/* Description Column - Platform company description, fallback to thesis */}
                  <TableCell>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {buyer.business_summary || buyer.thesis_summary || '—'}
                    </p>
                  </TableCell>

                  {/* Intel Column */}
                  <TableCell>
                    <IntelligenceBadge 
                      completeness={buyer.data_completeness as DataCompleteness | null}
                      hasTranscript={buyerIdsWithTranscripts.has(buyer.id)}
                      size="sm"
                    />
                  </TableCell>

                  {/* Actions Column */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEnrich && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onEnrich(buyer.id);
                            }}
                            disabled={isCurrentlyEnriching}
                          >
                            <Sparkles className="mr-2 h-4 w-4" />
                            {isCurrentlyEnriching ? 'Enriching...' : 'Enrich Data'}
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(buyer.id);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                             Remove
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
    </TooltipProvider>
  );
};

export default BuyerTableEnhanced;
