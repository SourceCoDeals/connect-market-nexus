import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Star
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
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

// Column resize handle component
const ResizeHandle = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
  <div
    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 z-10"
    onMouseDown={onMouseDown}
    onClick={(e) => e.stopPropagation()}
  />
);

// Default column widths
const DEFAULT_WIDTHS: Record<string, number> = {
  checkbox: 40,
  name: 220,
  description: 200,
  serviceArea: 130,
  approved: 60,
  interested: 60,
  passed: 60,
  added: 90,
  liEmployees: 85,
  googleReviews: 110,
  revenue: 85,
  ebitda: 85,
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
  const navigate = useNavigate();
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_WIDTHS);
  const resizingRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);

  const selectedIds = controlledSelected ?? internalSelected;
  const setSelectedIds = useCallback((ids: string[]) => {
    if (onSelectionChange) onSelectionChange(ids);
    else setInternalSelected(ids);
  }, [onSelectionChange]);

  const allSelected = deals.length > 0 && selectedIds.length === deals.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < deals.length;

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : deals.map(d => d.id));
  };

  const toggleOne = (dealId: string) => {
    setSelectedIds(
      selectedIds.includes(dealId)
        ? selectedIds.filter(id => id !== dealId)
        : [...selectedIds, dealId]
    );
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

  return (
    <TooltipProvider>
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
              <TableHead style={{ width: w('name') }} className="relative">
                Deal Name
                <ResizeHandle onMouseDown={(e) => handleResizeStart('name', e)} />
              </TableHead>
              <TableHead style={{ width: w('description') }} className="relative">
                Description
                <ResizeHandle onMouseDown={(e) => handleResizeStart('description', e)} />
              </TableHead>
              <TableHead style={{ width: w('serviceArea') }} className="relative">
                Service Area
                <ResizeHandle onMouseDown={(e) => handleResizeStart('serviceArea', e)} />
              </TableHead>
              <TableHead style={{ width: w('approved') }} className="text-center relative">
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />
                  </TooltipTrigger>
                  <TooltipContent>Approved buyers</TooltipContent>
                </Tooltip>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('approved', e)} />
              </TableHead>
              <TableHead style={{ width: w('interested') }} className="text-center relative">
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>Interested buyers</TooltipContent>
                </Tooltip>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('interested', e)} />
              </TableHead>
              <TableHead style={{ width: w('passed') }} className="text-center relative">
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <ThumbsDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Passed buyers</TooltipContent>
                </Tooltip>
                <ResizeHandle onMouseDown={(e) => handleResizeStart('passed', e)} />
              </TableHead>
              <TableHead style={{ width: w('added') }} className="relative">
                Added
                <ResizeHandle onMouseDown={(e) => handleResizeStart('added', e)} />
              </TableHead>
              <TableHead style={{ width: w('liEmployees') }} className="text-center relative">
                LI Employees
                <ResizeHandle onMouseDown={(e) => handleResizeStart('liEmployees', e)} />
              </TableHead>
              <TableHead style={{ width: w('googleReviews') }} className="text-center relative">
                Google Reviews
                <ResizeHandle onMouseDown={(e) => handleResizeStart('googleReviews', e)} />
              </TableHead>
              <TableHead style={{ width: w('revenue') }} className="text-right relative">
                Revenue
                <ResizeHandle onMouseDown={(e) => handleResizeStart('revenue', e)} />
              </TableHead>
              <TableHead style={{ width: w('ebitda') }} className="text-right relative">
                EBITDA
                <ResizeHandle onMouseDown={(e) => handleResizeStart('ebitda', e)} />
              </TableHead>
              <TableHead style={{ width: w('score') }} className="text-center relative">
                Score
                <ResizeHandle onMouseDown={(e) => handleResizeStart('score', e)} />
              </TableHead>
              <TableHead style={{ width: w('actions') }}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-12 text-muted-foreground">
                  <Target className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No deals in this universe</p>
                  <p className="text-sm">Add deals to start matching with buyers</p>
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal) => {
                const engagement = engagementStats[deal.listing.id] || {
                  approved: 0,
                  interested: 0,
                  passed: 0,
                  avgScore: 0,
                };
                const isSelected = selectedIds.includes(deal.id);
                
                return (
                  <TableRow
                    key={deal.id}
                    className={`cursor-pointer hover:bg-muted/50 ${isSelected ? 'bg-primary/5' : ''}`}
                    onClick={() => navigate(`/admin/remarketing/deals/${deal.listing.id}`, universeId ? { state: { from: `/admin/remarketing/universes/${universeId}` } } : undefined)}
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
                          <Badge key={state} variant="outline" className="text-xs">
                            {state}
                          </Badge>
                        ))}
                        {(deal.listing.geographic_states?.length || 0) > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{(deal.listing.geographic_states?.length || 0) - 3}
                          </Badge>
                        )}
                        {!deal.listing.geographic_states?.length && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell style={{ width: w('approved') }} className="text-center">
                      {engagement.approved > 0 ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                          {engagement.approved}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell style={{ width: w('interested') }} className="text-center">
                      {engagement.interested > 0 ? (
                        <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                          {engagement.interested}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell style={{ width: w('passed') }} className="text-center">
                      {engagement.passed > 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {engagement.passed}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell style={{ width: w('added') }}>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(deal.added_at), { addSuffix: true })}
                      </span>
                    </TableCell>

                    <TableCell style={{ width: w('liEmployees') }} className="text-center">
                      {deal.listing.linkedin_employee_count ? (
                        <Badge variant="secondary" className="text-xs font-medium">
                          <span className="text-blue-600 mr-1">LI</span>
                          {deal.listing.linkedin_employee_count.toLocaleString()}
                        </Badge>
                      ) : deal.listing.linkedin_employee_range ? (
                        <Badge variant="secondary" className="text-xs">
                          <span className="text-blue-600 mr-1">LI</span>
                          {deal.listing.linkedin_employee_range}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell style={{ width: w('googleReviews') }} className="text-center">
                      {deal.listing.google_rating ? (
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                          <span className="text-sm font-medium">{deal.listing.google_rating}</span>
                          {deal.listing.google_review_count != null && (
                            <span className="text-xs text-muted-foreground">
                              ({deal.listing.google_review_count})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell style={{ width: w('revenue') }} className="text-right">
                      <span className="text-sm font-medium">
                        {formatCurrency(deal.listing.revenue)}
                      </span>
                    </TableCell>

                    <TableCell style={{ width: w('ebitda') }} className="text-right">
                      <span className="text-sm">
                        {formatCurrency(deal.listing.ebitda)}
                      </span>
                    </TableCell>

                    <TableCell style={{ width: w('score') }} className="text-center">
                      {engagement.avgScore > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm font-medium">
                            {Math.round(engagement.avgScore)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell style={{ width: w('actions') }}>
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
                              navigate(`/admin/remarketing/deals/${deal.listing.id}`, universeId ? { state: { from: `/admin/remarketing/universes/${universeId}` } } : undefined);
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Deal
                          </DropdownMenuItem>
                          {onScoreDeal && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onScoreDeal(deal.listing.id);
                              }}
                            >
                              <Target className="h-4 w-4 mr-2" />
                              Score Deal
                            </DropdownMenuItem>
                          )}
                          {onEnrichDeal && !deal.listing.enriched_at && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onEnrichDeal(deal.listing.id);
                              }}
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              Enrich Deal
                            </DropdownMenuItem>
                          )}
                          {onRemoveDeal && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveDeal(deal.id, deal.listing.id);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove from Universe
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
