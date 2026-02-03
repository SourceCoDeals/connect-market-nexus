import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  MoreHorizontal,
  Building2,
  ThumbsUp,
  ThumbsDown,
  Users,
  ExternalLink,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Sparkles,
  Upload,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Calculator,
  ArrowUpDown,
} from "lucide-react";
import { format } from "date-fns";
import { getTierFromScore } from "@/components/remarketing";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface DealListing {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  revenue: number | null;
  ebitda: number | null;
  status: string | null;
  created_at: string;
  category: string | null;
  website: string | null;
  executive_summary: string | null;
  service_mix: any | null;
  internal_company_name: string | null;
  internal_deal_memo_link: string | null;
  geographic_states: string[] | null;
  enriched_at: string | null;
  full_time_employees: number | null;
  deal_quality_score: number | null;
  deal_total_score: number | null;
  manual_rank_override: number | null;
}

// Column width configuration
interface ColumnWidths {
  rank: number;
  dealName: number;
  industry: number;
  location: number;
  revenue: number;
  ebitda: number;
  employees: number;
  quality: number;
  margin: number;
  engagement: number;
  added: number;
  actions: number;
}

const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  rank: 60,
  dealName: 200,
  industry: 120,
  location: 100,
  revenue: 90,
  ebitda: 90,
  employees: 80,
  quality: 80,
  margin: 70,
  engagement: 130,
  added: 90,
  actions: 50,
};

// Resizable column header component
const ResizableHeader = ({
  children,
  width,
  onResize,
  minWidth = 50,
  className = "",
}: {
  children: React.ReactNode;
  width: number;
  onResize: (newWidth: number) => void;
  minWidth?: number;
  className?: string;
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, startWidthRef.current + diff);
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <th
      className={cn(
        "relative h-10 px-3 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 border-b",
        className
      )}
      style={{ width: `${width}px`, minWidth: `${minWidth}px` }}
    >
      <div className="flex items-center h-full">{children}</div>
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors",
          isResizing && "bg-primary"
        )}
        onMouseDown={handleMouseDown}
      />
    </th>
  );
};

// Sortable table row component
const SortableTableRow = ({
  listing,
  index,
  stats,
  navigate,
  formatCurrency,
  formatWebsiteDomain,
  getEffectiveWebsite,
  formatGeographyBadges,
  getScoreTrendIcon,
  columnWidths,
}: {
  listing: DealListing;
  index: number;
  stats: any;
  navigate: (path: string) => void;
  formatCurrency: (value: number | null) => string;
  formatWebsiteDomain: (url: string | null) => string | null;
  getEffectiveWebsite: (listing: any) => string | null;
  formatGeographyBadges: (states: string[] | null) => string | null;
  getScoreTrendIcon: (score: number) => JSX.Element;
  columnWidths: ColumnWidths;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: listing.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const effectiveWebsite = getEffectiveWebsite(listing);
  const domain = formatWebsiteDomain(effectiveWebsite);
  const isEnriched = !!listing.enriched_at;
  const displayName = listing.internal_company_name || listing.title;
  const geographyDisplay = formatGeographyBadges(listing.geographic_states);
  
  // Use deal quality score (the custom algorithm score)
  const qualityScore = listing.deal_quality_score ?? listing.deal_total_score ?? null;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-pointer hover:bg-muted/50",
        isDragging && "bg-muted/80 opacity-80 shadow-lg z-50"
      )}
      onClick={() => navigate(`/admin/remarketing/deals/${listing.id}`)}
    >
      {/* Drag Handle + Rank */}
      <TableCell style={{ width: columnWidths.rank, minWidth: 50 }}>
        <div className="flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="font-medium text-muted-foreground w-5 text-center">
            {index + 1}
          </span>
        </div>
      </TableCell>

      {/* Deal Name */}
      <TableCell style={{ width: columnWidths.dealName, minWidth: 100 }}>
        <div>
          <p className="font-medium text-foreground flex items-center gap-1.5">
            {displayName}
            {isEnriched && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enriched on {format(new Date(listing.enriched_at!), 'dd/MM/yyyy')}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </p>
          {domain && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {domain}
            </p>
          )}
        </div>
      </TableCell>

      {/* Industry */}
      <TableCell style={{ width: columnWidths.industry, minWidth: 60 }}>
        {listing.category ? (
          <span className="text-sm text-muted-foreground truncate max-w-[120px] block">
            {listing.category.length > 18 ? listing.category.substring(0, 18) + '...' : listing.category}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Location */}
      <TableCell style={{ width: columnWidths.location, minWidth: 60 }}>
        {geographyDisplay ? (
          <span className="text-sm">{geographyDisplay}</span>
        ) : listing.location ? (
          <span className="text-sm">
            {listing.location.substring(0, 15)}{listing.location.length > 15 ? '...' : ''}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Revenue */}
      <TableCell className="text-right font-medium" style={{ width: columnWidths.revenue, minWidth: 60 }}>
        {formatCurrency(listing.revenue)}
      </TableCell>

      {/* EBITDA */}
      <TableCell className="text-right font-medium" style={{ width: columnWidths.ebitda, minWidth: 60 }}>
        {formatCurrency(listing.ebitda)}
      </TableCell>

      {/* Employees */}
      <TableCell className="text-right" style={{ width: columnWidths.employees, minWidth: 50 }}>
        {listing.full_time_employees ? (
          <span className="text-sm">{listing.full_time_employees}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Deal Quality Score */}
      <TableCell className="text-center" style={{ width: columnWidths.quality, minWidth: 50 }}>
        {qualityScore !== null ? (
          <div className="flex items-center justify-center gap-1.5">
            <span className={cn(
              "text-sm font-medium px-2 py-0.5 rounded",
              qualityScore >= 80 ? "bg-green-100 text-green-700" :
              qualityScore >= 60 ? "bg-blue-100 text-blue-700" :
              qualityScore >= 40 ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            )}>
              {Math.round(qualityScore)}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>

      {/* Margin */}
      <TableCell className="text-right" style={{ width: columnWidths.margin, minWidth: 50 }}>
        {listing.ebitda && listing.revenue ? (
          <span className="text-sm">{Math.round((listing.ebitda / listing.revenue) * 100)}%</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Engagement */}
      <TableCell style={{ width: columnWidths.engagement, minWidth: 80 }}>
        <div className="flex items-center justify-center gap-3 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{stats?.totalMatches || 0}</span>
          </div>
          <div className="flex items-center gap-1 text-green-600">
            <ThumbsUp className="h-3.5 w-3.5" />
            <span>{stats?.approved || 0}</span>
          </div>
          <div className="flex items-center gap-1 text-red-500">
            <ThumbsDown className="h-3.5 w-3.5" />
            <span>{stats?.passed || 0}</span>
          </div>
        </div>
      </TableCell>

      {/* Added date */}
      <TableCell className="text-muted-foreground text-sm" style={{ width: columnWidths.added, minWidth: 60 }}>
        {format(new Date(listing.created_at), 'dd/MM/yyyy')}
      </TableCell>

      {/* Actions */}
      <TableCell style={{ width: columnWidths.actions, minWidth: 40 }}>
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
                navigate(`/admin/remarketing/deals/${listing.id}`);
              }}
            >
              <Building2 className="h-4 w-4 mr-2" />
              View Deal
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/admin/remarketing/matching/${listing.id}`);
              }}
            >
              <Target className="h-4 w-4 mr-2" />
              Match Buyers
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/listing/${listing.id}`);
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Listing
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

const ReMarketingDeals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [universeFilter, setUniverseFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // State for import dialog
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>("rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isCalculating, setIsCalculating] = useState(false);
  
  // Local order state for optimistic UI updates during drag-and-drop
  const [localOrder, setLocalOrder] = useState<DealListing[]>([]);
  
  // Column widths state for resizable columns
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(DEFAULT_COLUMN_WIDTHS);
  
  // Ref to always have access to current listings (prevents stale closure bug)
  const sortedListingsRef = useRef<DealListing[]>([]);
  
  // Handle column resize
  const handleColumnResize = useCallback((column: keyof ColumnWidths, newWidth: number) => {
    setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
  }, []);

  // Track which deals are currently being enriched to prevent duplicate calls
  const enrichingDealsRef = useRef<Set<string>>(new Set());
  const [enrichmentProgress, setEnrichmentProgress] = useState<{ current: number; total: number } | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  // Handle file import
  const handleImport = async () => {
    if (!importFile) {
      toast({ title: "No file selected", description: "Please select a CSV file to import", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const deals = lines.slice(1).map(line => {
        const values = line.split(',');
        const deal: Record<string, any> = {};
        headers.forEach((header, i) => {
          const value = values[i]?.trim();
          if (header === 'revenue' || header === 'ebitda' || header === 'employee_count') {
            deal[header] = value ? parseFloat(value.replace(/[^0-9.-]/g, '')) : null;
          } else {
            deal[header] = value || null;
          }
        });
        return deal;
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('bulk-import-remarketing', {
        body: { action: 'validate', data: deals },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` }
      });

      if (response.error) throw new Error(response.error.message);

      if (response.data?.valid) {
        const importResponse = await supabase.functions.invoke('bulk-import-remarketing', {
          body: { action: 'import', data: deals },
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` }
        });

        if (importResponse.error) throw new Error(importResponse.error.message);

        toast({ title: "Import successful", description: `Imported ${importResponse.data?.imported || deals.length} deals` });
        setShowImportDialog(false);
        setImportFile(null);
        refetchListings();
      } else {
        toast({
          title: "Validation failed",
          description: response.data?.errors?.join(', ') || "Invalid data format",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  // Fetch all listings (deals)
  const { data: listings, isLoading: listingsLoading, refetch: refetchListings } = useQuery({
    queryKey: ['remarketing', 'deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          id,
          title,
          description,
          location,
          revenue,
          ebitda,
          status,
          created_at,
          category,
          website,
          executive_summary,
          service_mix,
          internal_company_name,
          internal_deal_memo_link,
          geographic_states,
          enriched_at,
          full_time_employees,
          deal_quality_score,
          deal_total_score,
          manual_rank_override
        `)
        .eq('status', 'active')
        .order('manual_rank_override', { ascending: true, nullsFirst: false })
        .order('deal_quality_score', { ascending: false, nullsFirst: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DealListing[];
    }
  });

  // Auto-enrich deals that don't have enriched_at set
  useEffect(() => {
    const autoEnrichDeals = async () => {
      if (!listings) return;

      // Find deals that need enrichment (no enriched_at and have a website)
      const dealsToEnrich = listings.filter(deal => {
        const website = deal.website || (deal.internal_deal_memo_link && !deal.internal_deal_memo_link.includes('sharepoint'));
        return !deal.enriched_at && website && !enrichingDealsRef.current.has(deal.id);
      });

      if (dealsToEnrich.length === 0) return;

      // Mark all as being enriched to prevent duplicate calls
      dealsToEnrich.forEach(deal => enrichingDealsRef.current.add(deal.id));
      
      setEnrichmentProgress({ current: 0, total: dealsToEnrich.length });
      
      // Enrich in batches of 3 to avoid overwhelming the API
      const batchSize = 3;
      let enriched = 0;
      
      for (let i = 0; i < dealsToEnrich.length; i += batchSize) {
        const batch = dealsToEnrich.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (deal) => {
          try {
            await supabase.functions.invoke('enrich-deal', {
              body: { dealId: deal.id, onlyFillEmpty: true }
            });
            enriched++;
            setEnrichmentProgress({ current: enriched, total: dealsToEnrich.length });
          } catch (err) {
            console.error(`Failed to auto-enrich deal ${deal.id}:`, err);
          }
        }));
        
        // Small delay between batches
        if (i + batchSize < dealsToEnrich.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Clear progress and refetch
      setEnrichmentProgress(null);
      if (enriched > 0) {
        toast({
          title: "Auto-enrichment complete",
          description: `Enriched ${enriched} deal${enriched !== 1 ? 's' : ''} with company data`
        });
        refetchListings();
      }
    };

    autoEnrichDeals();
  }, [listings, toast, refetchListings]);

  // Fetch universes for the filter
  const { data: universes } = useQuery({
    queryKey: ['remarketing', 'universes-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_buyer_universes')
        .select('id, name')
        .eq('archived', false)
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  // Fetch score stats for engagement metrics
  const { data: scoreStats } = useQuery({
    queryKey: ['remarketing', 'deal-score-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_scores')
        .select('listing_id, composite_score, status, universe_id');

      if (error) throw error;

      const stats: Record<string, {
        totalMatches: number;
        approved: number;
        passed: number;
        avgScore: number;
        universeIds: Set<string>;
      }> = {};

      data?.forEach(score => {
        if (!stats[score.listing_id]) {
          stats[score.listing_id] = {
            totalMatches: 0,
            approved: 0,
            passed: 0,
            avgScore: 0,
            universeIds: new Set(),
          };
        }
        stats[score.listing_id].totalMatches++;
        if (score.status === 'approved') stats[score.listing_id].approved++;
        if (score.status === 'passed') stats[score.listing_id].passed++;
        stats[score.listing_id].avgScore += score.composite_score || 0;
        if (score.universe_id) stats[score.listing_id].universeIds.add(score.universe_id);
      });

      Object.keys(stats).forEach(key => {
        if (stats[key].totalMatches > 0) {
          stats[key].avgScore = stats[key].avgScore / stats[key].totalMatches;
        }
      });

      return stats;
    }
  });

  // Get universe count
  const universeCount = universes?.length || 0;

  // KPI Stats
  const kpiStats = useMemo(() => {
    const totalDeals = listings?.length || 0;
    
    const hotDeals = listings?.filter(listing => 
      listing.deal_quality_score !== null && listing.deal_quality_score >= 80
    ).length || 0;
    
    let totalScore = 0;
    let scoredDeals = 0;
    listings?.forEach(listing => {
      if (listing.deal_quality_score !== null) {
        totalScore += listing.deal_quality_score;
        scoredDeals++;
      }
    });
    const avgScore = scoredDeals > 0 ? Math.round(totalScore / scoredDeals) : 0;
    
    const needsScoring = listings?.filter(listing => 
      listing.deal_quality_score === null
    ).length || 0;
    
    return { totalDeals, hotDeals, avgScore, needsScoring };
  }, [listings]);

  // Helper functions
  const extractWebsiteFromMemo = (memoLink: string | null): string | null => {
    if (!memoLink) return null;
    if (memoLink.includes('sharepoint.com') || memoLink.includes('onedrive')) return null;
    const websiteMatch = memoLink.match(/Website:\s*(https?:\/\/[^\s]+)/i);
    if (websiteMatch) return websiteMatch[1];
    if (memoLink.match(/^https?:\/\/[a-zA-Z0-9]/) && !memoLink.includes('sharepoint')) return memoLink;
    if (memoLink.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/)) return `https://${memoLink}`;
    return null;
  };

  const getEffectiveWebsite = (listing: any): string | null => {
    if (listing.website) return listing.website;
    return extractWebsiteFromMemo(listing.internal_deal_memo_link);
  };

  const formatGeographyBadges = (states: string[] | null): string | null => {
    if (!states || states.length === 0) return null;
    if (states.length <= 3) return states.join(', ');
    return `${states.slice(0, 2).join(', ')} +${states.length - 2}`;
  };

  // Filter listings
  const filteredListings = useMemo(() => {
    if (!listings) return [];
    
    return listings.filter(listing => {
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch = 
          listing.title?.toLowerCase().includes(searchLower) ||
          listing.internal_company_name?.toLowerCase().includes(searchLower) ||
          listing.description?.toLowerCase().includes(searchLower) ||
          listing.location?.toLowerCase().includes(searchLower) ||
          listing.website?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (universeFilter !== "all") {
        const stats = scoreStats?.[listing.id];
        if (!stats || !stats.universeIds.has(universeFilter)) return false;
      }

      if (scoreFilter !== "all") {
        const score = listing.deal_quality_score ?? 0;
        const tier = getTierFromScore(score);
        if (scoreFilter !== tier) return false;
      }

      if (dateFilter !== "all") {
        const createdAt = new Date(listing.created_at);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dateFilter === "7d" && daysDiff > 7) return false;
        if (dateFilter === "30d" && daysDiff > 30) return false;
        if (dateFilter === "90d" && daysDiff > 90) return false;
      }

      return true;
    });
  }, [listings, search, universeFilter, scoreFilter, dateFilter, scoreStats]);

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  const formatWebsiteDomain = (website: string | null) => {
    if (!website) return null;
    return website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  };

  const getScoreTrendIcon = (score: number) => {
    if (score >= 75) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
    if (score >= 55) return <Minus className="h-3.5 w-3.5 text-yellow-500" />;
    return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  };

  // Handle sort column click
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "rank" ? "asc" : "desc");
    }
  };

  // Sort listings
  const sortedListings = useMemo(() => {
    if (!filteredListings) return [];

    return [...filteredListings].sort((a, b) => {
      const stats_a = scoreStats?.[a.id];
      const stats_b = scoreStats?.[b.id];
      let aVal: any, bVal: any;

      switch (sortColumn) {
        case "rank":
          aVal = a.manual_rank_override ?? 9999;
          bVal = b.manual_rank_override ?? 9999;
          break;
        case "deal_name":
          aVal = (a.internal_company_name || a.title || "").toLowerCase();
          bVal = (b.internal_company_name || b.title || "").toLowerCase();
          break;
        case "industry":
          aVal = (a.category || "").toLowerCase();
          bVal = (b.category || "").toLowerCase();
          break;
        case "revenue":
          aVal = a.revenue || 0;
          bVal = b.revenue || 0;
          break;
        case "ebitda":
          aVal = a.ebitda || 0;
          bVal = b.ebitda || 0;
          break;
        case "employees":
          aVal = a.full_time_employees || 0;
          bVal = b.full_time_employees || 0;
          break;
        case "score":
          aVal = a.deal_quality_score ?? a.deal_total_score ?? 0;
          bVal = b.deal_quality_score ?? b.deal_total_score ?? 0;
          break;
        case "margin":
          aVal = a.ebitda && a.revenue ? (a.ebitda / a.revenue) * 100 : 0;
          bVal = b.ebitda && b.revenue ? (b.ebitda / b.revenue) * 100 : 0;
          break;
        case "engagement":
          aVal = (stats_a?.totalMatches || 0);
          bVal = (stats_b?.totalMatches || 0);
          break;
        case "added":
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        default:
          aVal = a.manual_rank_override ?? 9999;
          bVal = b.manual_rank_override ?? 9999;
      }

      if (typeof aVal === "string") {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === "asc" ? comparison : -comparison;
      }

      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [filteredListings, sortColumn, sortDirection, scoreStats]);

  // Keep ref and local order in sync with sortedListings
  useEffect(() => {
    sortedListingsRef.current = sortedListings;
    setLocalOrder(sortedListings);
  }, [sortedListings]);

  // Handle drag end - update ranks with proper sequential numbering
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const currentListings = sortedListingsRef.current;
    const oldIndex = currentListings.findIndex((l) => l.id === active.id);
    const newIndex = currentListings.findIndex((l) => l.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(currentListings, oldIndex, newIndex);
    
    const updatedListings = reordered.map((listing, idx) => ({
      ...listing,
      manual_rank_override: idx + 1,
    }));

    setLocalOrder(updatedListings);
    sortedListingsRef.current = updatedListings;

    const updates = updatedListings.map((listing) => ({
      id: listing.id,
      manual_rank_override: listing.manual_rank_override,
    }));

    try {
      for (const update of updates) {
        await supabase
          .from('listings')
          .update({ manual_rank_override: update.manual_rank_override })
          .eq('id', update.id);
      }

      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
      
      toast({ 
        title: "Rank updated", 
        description: `Deal moved to position ${newIndex + 1}` 
      });
    } catch (error) {
      console.error('Failed to update rank:', error);
      setLocalOrder(currentListings);
      sortedListingsRef.current = currentListings;
      toast({ 
        title: "Failed to update rank", 
        variant: "destructive" 
      });
    }
  }, [queryClient, toast]);

  // Handle calculate scores - uses a simple formula-based scoring
  const handleCalculateScores = async () => {
    setIsCalculating(true);
    try {
      const dealsToScore = listings?.filter(listing => 
        listing.deal_quality_score === null
      ) || [];

      if (dealsToScore.length === 0) {
        toast({ title: "All deals scored", description: "All deals already have quality scores calculated" });
        setIsCalculating(false);
        return;
      }

      let scored = 0;
      for (const deal of dealsToScore.slice(0, 50)) {
        try {
          // Calculate a deal quality score based on available data
          let score = 50; // Base score
          
          // Revenue scoring (0-20 points)
          if (deal.revenue) {
            if (deal.revenue >= 5000000) score += 20;
            else if (deal.revenue >= 2000000) score += 15;
            else if (deal.revenue >= 1000000) score += 10;
            else if (deal.revenue >= 500000) score += 5;
          }
          
          // EBITDA margin scoring (0-15 points)
          if (deal.ebitda && deal.revenue) {
            const margin = (deal.ebitda / deal.revenue) * 100;
            if (margin >= 25) score += 15;
            else if (margin >= 20) score += 12;
            else if (margin >= 15) score += 8;
            else if (margin >= 10) score += 4;
          }
          
          // Data completeness scoring (0-15 points)
          if (deal.category) score += 3;
          if (deal.location || (deal.geographic_states && deal.geographic_states.length > 0)) score += 3;
          if (deal.full_time_employees) score += 3;
          if (deal.website) score += 3;
          if (deal.enriched_at) score += 3;
          
          // Cap at 100
          score = Math.min(100, Math.max(0, score));
          
          // Update the listing with the calculated score
          await supabase
            .from('listings')
            .update({ deal_quality_score: score })
            .eq('id', deal.id);
          
          scored++;
        } catch (err) {
          console.error(`Failed to score deal ${deal.id}:`, err);
        }
      }

      toast({ 
        title: "Scoring complete", 
        description: `Calculated quality scores for ${scored} deals` 
      });
      refetchListings();
    } catch (error: any) {
      console.error('Calculate scores error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsCalculating(false);
    }
  };

  // Sortable header component
  const SortableHeader = ({ column, label, className = "" }: { column: string; label: string; className?: string }) => (
    <button 
      onClick={() => handleSort(column)} 
      className={cn("flex items-center gap-1 hover:text-foreground transition-colors", className)}
    >
      {label}
      {sortColumn === column ? (
        sortDirection === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Deals</h1>
          <p className="text-muted-foreground">
            {listings?.length || 0} deals across {universeCount} buyer universes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button 
            onClick={handleCalculateScores} 
            disabled={isCalculating}
            className="bg-slate-800 hover:bg-slate-700 text-white"
          >
            <Calculator className="h-4 w-4 mr-2" />
            {isCalculating ? "Calculating..." : "Calculate Scores"}
          </Button>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Auto-enrichment progress indicator */}
      {enrichmentProgress && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Sparkles className="h-5 w-5 text-blue-600 animate-pulse" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-blue-900">
                    Auto-enriching deals with company data...
                  </span>
                  <span className="text-sm text-blue-700">
                    {enrichmentProgress.current} / {enrichmentProgress.total}
                  </span>
                </div>
                <Progress 
                  value={(enrichmentProgress.current / enrichmentProgress.total) * 100} 
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold">{kpiStats.totalDeals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hot Deals (80+)</p>
                <p className="text-2xl font-bold text-green-600">{kpiStats.hotDeals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Quality Score</p>
                <p className="text-2xl font-bold">{kpiStats.avgScore}<span className="text-base font-normal text-muted-foreground">/100</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calculator className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Needs Scoring</p>
                <p className="text-2xl font-bold text-orange-600">{kpiStats.needsScoring}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deals by name, domain, or geography..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={universeFilter} onValueChange={setUniverseFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Trackers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trackers</SelectItem>
                {universes?.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Any Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Score</SelectItem>
                <SelectItem value="A">Tier A (80+)</SelectItem>
                <SelectItem value="B">Tier B (60-79)</SelectItem>
                <SelectItem value="C">Tier C (40-59)</SelectItem>
                <SelectItem value="D">Tier D (&lt;40)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Deals</DialogTitle>
            <DialogDescription>
              Upload a CSV file with deal data. Required columns: title, location, revenue, ebitda
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="csvFile">CSV File</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </div>
            {importFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {importFile.name} ({Math.round(importFile.size / 1024)} KB)
              </p>
            )}
            <div className="bg-muted p-3 rounded text-xs">
              <p className="font-medium mb-1">Expected CSV format:</p>
              <code className="text-muted-foreground">
                title, location, revenue, ebitda, category, employee_count, lead_source
              </code>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importFile || isImporting}>
              {isImporting ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deals Table with Drag & Drop */}
      <Card>
        <CardContent className="p-0">
          <TooltipProvider>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                  <tr>
                    <ResizableHeader width={columnWidths.rank} onResize={(w) => handleColumnResize('rank', w)} minWidth={50}>
                      <SortableHeader column="rank" label="#" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.dealName} onResize={(w) => handleColumnResize('dealName', w)} minWidth={100}>
                      <SortableHeader column="deal_name" label="Deal Name" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.industry} onResize={(w) => handleColumnResize('industry', w)} minWidth={60}>
                      <SortableHeader column="industry" label="Industry" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.location} onResize={(w) => handleColumnResize('location', w)} minWidth={60}>
                      <span className="text-muted-foreground font-medium">Location</span>
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.revenue} onResize={(w) => handleColumnResize('revenue', w)} minWidth={60} className="text-right">
                      <SortableHeader column="revenue" label="Revenue" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.ebitda} onResize={(w) => handleColumnResize('ebitda', w)} minWidth={60} className="text-right">
                      <SortableHeader column="ebitda" label="EBITDA" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.employees} onResize={(w) => handleColumnResize('employees', w)} minWidth={50} className="text-right">
                      <SortableHeader column="employees" label="Employees" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.quality} onResize={(w) => handleColumnResize('quality', w)} minWidth={50} className="text-center">
                      <SortableHeader column="score" label="Quality" className="mx-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.margin} onResize={(w) => handleColumnResize('margin', w)} minWidth={50} className="text-right">
                      <SortableHeader column="margin" label="Margin" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.engagement} onResize={(w) => handleColumnResize('engagement', w)} minWidth={80} className="text-center">
                      <SortableHeader column="engagement" label="Engagement" className="mx-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.added} onResize={(w) => handleColumnResize('added', w)} minWidth={60}>
                      <SortableHeader column="added" label="Added" />
                    </ResizableHeader>
                    <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground border-b" style={{ width: columnWidths.actions, minWidth: 40 }}></th>
                  </tr>
                </thead>
                <TableBody>
                  {listingsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : localOrder.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No deals found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <SortableContext
                      items={localOrder.map(l => l.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {localOrder.map((listing, index) => (
                        <SortableTableRow
                          key={listing.id}
                          listing={listing}
                          index={index}
                          stats={scoreStats?.[listing.id]}
                          navigate={navigate}
                          formatCurrency={formatCurrency}
                          formatWebsiteDomain={formatWebsiteDomain}
                          getEffectiveWebsite={getEffectiveWebsite}
                          formatGeographyBadges={formatGeographyBadges}
                          getScoreTrendIcon={getScoreTrendIcon}
                          columnWidths={columnWidths}
                        />
                      ))}
                    </SortableContext>
                  )}
                </TableBody>
              </Table>
            </DndContext>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReMarketingDeals;
