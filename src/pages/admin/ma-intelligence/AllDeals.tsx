import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, FileText, MoreHorizontal, Archive, Trash2, ArrowUp, ArrowDown,
  Sparkles, ThumbsUp, ThumbsDown, UserCheck, ArrowUpDown, Upload, Calculator,
  BarChart3, Flame, Star, Target, ChevronUp, ChevronDown, HelpCircle, Globe
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeDomain } from "@/lib/ma-intelligence/normalizeDomain";
import { deleteDealWithRelated } from "@/lib/ma-intelligence/cascadeDelete";
import { DealScoreBadge } from "@/components/ma-intelligence/DealScoreBadge";
import { DealFiltersBar } from "@/components/ma-intelligence/DealFiltersBar";
import { TimeframeFilter, TimeframeOption, getDateRange } from "@/components/ma-intelligence/TimeframeFilter";
import { StatCard } from "@/components/ma-intelligence/StatCard";

type SortColumn = "rank" | "deal_name" | "industry" | "location" | "revenue" | "ebitda" | "employees" | "score" | "date";
type SortDirection = "asc" | "desc";

interface TrackerInfo {
  id: string;
  industry_name: string;
}

interface BuyerCounts {
  approved: number;
  interested: number;
  passed: number;
}

interface DealRow {
  id: string;
  deal_name: string;
  tracker_id: string;
  company_website: string | null;
  company_overview: string | null;
  geography: string[] | null;
  revenue: number | null;
  ebitda_amount: number | null;
  ebitda_percentage: number | null;
  deal_score: number | null;
  previous_score: number | null;
  status: string | null;
  last_enriched_at: string | null;
  created_at: string;
  industry_type: string | null;
  employee_count: number | null;
  seller_motivation: string | null;
  lead_source: string | null;
}

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  rank: 70,
  deal_name: 200,
  industry: 120,
  location: 100,
  revenue: 90,
  ebitda: 90,
  employees: 80,
  score: 70,
  motivation: 50,
  engagement: 120,
  lead_source: 100,
  date: 100,
  status: 90,
  actions: 50,
};

export default function MAAllDeals() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [trackers, setTrackers] = useState<Record<string, TrackerInfo>>({});
  const [buyerCounts, setBuyerCounts] = useState<Record<string, BuyerCounts>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dealDeleteDialogOpen, setDealDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<{ id: string; name: string } | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTracker, setSelectedTracker] = useState("all");
  const [scoreRange, setScoreRange] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [motivationFilter, setMotivationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeframe, setTimeframe] = useState<TimeframeOption>("all");

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    const [dealsRes, trackersRes, scoresRes] = await Promise.all([
      supabase.from("deals").select("id, deal_name, tracker_id, company_website, company_overview, geography, revenue, ebitda_amount, ebitda_percentage, deal_score, previous_score, status, last_enriched_at, created_at, industry_type, employee_count, seller_motivation, lead_source").order("deal_score", { ascending: false, nullsFirst: false }),
      supabase.from("industry_trackers").select("id, industry_name"),
      supabase.from("buyer_deal_scores").select("deal_id, selected_for_outreach, interested, passed_on_deal"),
    ]);

    setDeals(dealsRes.data || []);

    const trackerMap: Record<string, TrackerInfo> = {};
    (trackersRes.data || []).forEach((t) => { trackerMap[t.id] = t; });
    setTrackers(trackerMap);

    const counts: Record<string, BuyerCounts> = {};
    (scoresRes.data || []).forEach((score) => {
      if (!counts[score.deal_id]) {
        counts[score.deal_id] = { approved: 0, interested: 0, passed: 0 };
      }
      if (score.selected_for_outreach) counts[score.deal_id].approved++;
      if (score.interested) counts[score.deal_id].interested++;
      if (score.passed_on_deal) counts[score.deal_id].passed++;
    });
    setBuyerCounts(counts);

    setIsLoading(false);
  };

  const archiveDeal = async (e: React.MouseEvent, dealId: string, dealName: string) => {
    e.preventDefault();
    e.stopPropagation();

    const { error } = await supabase.from("deals").update({ status: "Archived" }).eq("id", dealId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deal archived", description: `${dealName} has been archived` });
    loadDeals();
  };

  const confirmDeleteDeal = (e: React.MouseEvent, dealId: string, dealName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDealToDelete({ id: dealId, name: dealName });
    setDealDeleteDialogOpen(true);
  };

  const deleteDeal = async () => {
    if (!dealToDelete) return;

    const { error } = await deleteDealWithRelated(dealToDelete.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deal deleted", description: `${dealToDelete.name} has been deleted` });
      loadDeals();
    }

    setDealDeleteDialogOpen(false);
    setDealToDelete(null);
  };

  // Get unique industries for filter
  const uniqueIndustries = useMemo(() => {
    const industries = new Set<string>();
    deals.forEach(deal => {
      if (deal.industry_type) industries.add(deal.industry_type);
      const tracker = trackers[deal.tracker_id];
      if (tracker?.industry_name) industries.add(tracker.industry_name);
    });
    return Array.from(industries).sort();
  }, [deals, trackers]);

  // Filter deals based on all criteria
  const filteredDeals = useMemo(() => {
    const { start } = getDateRange(timeframe);

    return deals.filter((deal) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = deal.deal_name?.toLowerCase().includes(query);
        const matchesDomain = normalizeDomain(deal.company_website || "")?.toLowerCase().includes(query);
        const matchesGeo = deal.geography?.some((g: string) => g.toLowerCase().includes(query));
        if (!matchesName && !matchesDomain && !matchesGeo) return false;
      }

      // Tracker filter
      if (selectedTracker !== "all" && deal.tracker_id !== selectedTracker) return false;

      // Score range filter
      if (scoreRange !== "all") {
        const score = deal.deal_score;
        if (scoreRange === "hot" && (score === null || score < 85)) return false;
        if (scoreRange === "high" && (score === null || score < 70 || score >= 85)) return false;
        if (scoreRange === "medium" && (score === null || score < 40 || score >= 70)) return false;
        if (scoreRange === "low" && (score === null || score >= 40)) return false;
        if (scoreRange === "unscored" && score !== null) return false;
      }

      // Industry filter
      if (industryFilter !== "all") {
        const dealIndustry = deal.industry_type || trackers[deal.tracker_id]?.industry_name;
        if (dealIndustry !== industryFilter) return false;
      }

      // Motivation filter
      if (motivationFilter !== "all" && deal.seller_motivation !== motivationFilter) return false;

      // Status filter
      if (statusFilter !== "all" && deal.status !== statusFilter) return false;

      // Timeframe filter
      if (start) {
        const dealDate = new Date(deal.created_at);
        if (dealDate < start) return false;
      }

      return true;
    });
  }, [deals, searchQuery, selectedTracker, scoreRange, industryFilter, motivationFilter, statusFilter, timeframe, trackers]);

  // Sort filtered deals and assign ranks
  const sortedDeals = useMemo(() => {
    const sorted = [...filteredDeals].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortColumn) {
        case "rank":
        case "score":
          aVal = a.deal_score ?? -1;
          bVal = b.deal_score ?? -1;
          break;
        case "deal_name":
          aVal = a.deal_name?.toLowerCase() || "";
          bVal = b.deal_name?.toLowerCase() || "";
          break;
        case "industry":
          aVal = (a.industry_type || trackers[a.tracker_id]?.industry_name || "").toLowerCase();
          bVal = (b.industry_type || trackers[b.tracker_id]?.industry_name || "").toLowerCase();
          break;
        case "location":
          aVal = a.geography?.[0]?.toLowerCase() || "";
          bVal = b.geography?.[0]?.toLowerCase() || "";
          break;
        case "revenue":
          aVal = a.revenue ?? -1;
          bVal = b.revenue ?? -1;
          break;
        case "ebitda":
          aVal = a.ebitda_amount ?? -1;
          bVal = b.ebitda_amount ?? -1;
          break;
        case "employees":
          aVal = a.employee_count ?? -1;
          bVal = b.employee_count ?? -1;
          break;
        case "date":
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string") {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === "asc" ? comparison : -comparison;
      }

      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }, [filteredDeals, sortColumn, sortDirection, trackers]);

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "deal_name" || column === "industry" ? "asc" : "desc");
    }
  };

  const resetColumns = () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
  };

  const handleResize = (columnKey: string, startX: number, startWidth: number) => (e: MouseEvent) => {
    const newWidth = Math.max(50, startWidth + (e.clientX - startX));
    setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }));
  };

  const startResize = (columnKey: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[columnKey];

    const onMouseMove = handleResize(columnKey, startX, startWidth);
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const ResizeHandle = ({ columnKey }: { columnKey: string }) => (
    <div
      onMouseDown={startResize(columnKey)}
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary group-hover:bg-border"
    />
  );

  const SortableHeader = ({ column, columnKey, children, className = "" }: { column: SortColumn; columnKey: string; children: React.ReactNode; className?: string }) => (
    <TableHead className={`relative group ${className}`} style={{ width: columnWidths[columnKey], minWidth: columnWidths[columnKey] }}>
      <button
        onClick={() => toggleSort(column)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        {sortColumn === column ? (
          sortDirection === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </button>
      <ResizeHandle columnKey={columnKey} />
    </TableHead>
  );

  const ResizableHeader = ({ columnKey, children, className = "" }: { columnKey: string; children: React.ReactNode; className?: string }) => (
    <TableHead className={`relative group ${className}`} style={{ width: columnWidths[columnKey], minWidth: columnWidths[columnKey] }}>
      {children}
      <ResizeHandle columnKey={columnKey} />
    </TableHead>
  );

  const hasActiveFilters = searchQuery !== "" || selectedTracker !== "all" || scoreRange !== "all" || industryFilter !== "all" || motivationFilter !== "all" || statusFilter !== "all" || timeframe !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTracker("all");
    setScoreRange("all");
    setIndustryFilter("all");
    setMotivationFilter("all");
    setStatusFilter("all");
    setTimeframe("all");
  };

  const trackerList = Object.values(trackers).map((t) => ({ id: t.id, industry_name: t.industry_name }));

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "—";
    if (value >= 1) return `$${value.toFixed(1)}M`;
    return `$${Math.round(value * 1000)}K`;
  };

  // Calculate stats
  const totalDeals = filteredDeals.length;
  const hotDeals = filteredDeals.filter(d => d.deal_score !== null && d.deal_score >= 85).length;
  const scoredDeals = filteredDeals.filter(d => d.deal_score !== null);
  const avgScore = scoredDeals.length > 0
    ? Math.round(scoredDeals.reduce((sum, d) => sum + (d.deal_score || 0), 0) / scoredDeals.length)
    : 0;
  const needsAnalysis = filteredDeals.filter(d => d.deal_score === null).length;

  // Score trend calculation
  const getScoreTrend = (deal: DealRow) => {
    if (deal.deal_score === null) return null;
    if (deal.previous_score === null || deal.previous_score === undefined) return null;
    return deal.deal_score - deal.previous_score;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const uniqueTrackers = new Set(filteredDeals.map(d => d.tracker_id)).size;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">All Deals</h1>
            <p className="text-muted-foreground">
              {filteredDeals.length} {filteredDeals.length === 1 ? 'deal' : 'deals'} across {uniqueTrackers} buyer universe{uniqueTrackers !== 1 ? 's' : ''}
              {hasActiveFilters && <span className="text-primary"> (filtered)</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate("/admin/data-import")}>
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button variant="outline" onClick={() => toast({ title: "Coming soon", description: "Bulk score calculation will be available soon" })}>
              <Calculator className="w-4 h-4 mr-2" />
              Calculate Scores
            </Button>
            <button
              onClick={resetColumns}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset columns
            </button>
            <TimeframeFilter value={timeframe} onChange={setTimeframe} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Deals"
            value={totalDeals}
            icon={BarChart3}
          />
          <StatCard
            title="Hot Deals (85+)"
            value={hotDeals}
            icon={Flame}
            variant={hotDeals > 0 ? "warning" : "default"}
          />
          <StatCard
            title="Avg Score"
            value={`${avgScore}/100`}
            icon={Star}
            variant={avgScore >= 70 ? "success" : avgScore >= 40 ? "warning" : "default"}
          />
          <StatCard
            title="Needs Analysis"
            value={needsAnalysis}
            icon={Target}
            variant={needsAnalysis > 0 ? "accent" : "default"}
          />
        </div>

        {/* Filters Bar */}
        <DealFiltersBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTracker={selectedTracker}
          onTrackerChange={setSelectedTracker}
          trackers={trackerList}
          scoreRange={scoreRange}
          onScoreRangeChange={setScoreRange}
          industryFilter={industryFilter}
          onIndustryChange={setIndustryFilter}
          industries={uniqueIndustries}
          motivationFilter={motivationFilter}
          onMotivationChange={setMotivationFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {filteredDeals.length === 0 ? (
          <div className="bg-card rounded-lg border p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">{deals.length === 0 ? "No deals yet" : "No deals match your filters"}</h3>
            <p className="text-muted-foreground">
              {deals.length === 0
                ? "List a deal in a buyer universe to get started."
                : "Try adjusting your search criteria."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortableHeader column="rank" columnKey="rank">Rank</SortableHeader>
                    <SortableHeader column="deal_name" columnKey="deal_name">Deal Name</SortableHeader>
                    <SortableHeader column="industry" columnKey="industry">Industry</SortableHeader>
                    <SortableHeader column="location" columnKey="location">Location</SortableHeader>
                    <SortableHeader column="revenue" columnKey="revenue" className="text-right">Rev...</SortableHeader>
                    <SortableHeader column="ebitda" columnKey="ebitda" className="text-right">EBI...</SortableHeader>
                    <SortableHeader column="employees" columnKey="employees" className="text-right">Empl...</SortableHeader>
                    <SortableHeader column="score" columnKey="score" className="text-right">S...</SortableHeader>
                    <ResizableHeader columnKey="motivation" className="text-center">M...</ResizableHeader>
                    <ResizableHeader columnKey="engagement" className="text-center">Engagem...</ResizableHeader>
                    <ResizableHeader columnKey="lead_source">Lead Source</ResizableHeader>
                    <SortableHeader column="date" columnKey="date">Added</SortableHeader>
                    <ResizableHeader columnKey="status">St...</ResizableHeader>
                    <TableHead style={{ width: columnWidths.actions }}>A...</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDeals.map((deal, index) => {
                    const tracker = trackers[deal.tracker_id];
                    const counts = buyerCounts[deal.id] || { approved: 0, interested: 0, passed: 0 };
                    const isEnriched = !!deal.last_enriched_at;
                    const rank = index + 1;
                    const scoreTrend = getScoreTrend(deal);
                    const industry = deal.industry_type || tracker?.industry_name || "—";

                    return (
                      <TableRow key={deal.id} className="group">
                        {/* Rank */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            <ChevronUp className="w-3 h-3 text-muted-foreground/50 hover:text-foreground cursor-pointer" />
                            <span className="font-semibold">{rank}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground/50 hover:text-foreground cursor-pointer" />
                          </div>
                        </TableCell>

                        {/* Deal Name */}
                        <TableCell className="font-medium">
                          <Link to={`/admin/ma-intelligence/deals/${deal.id}`} className="hover:text-primary transition-colors flex items-center gap-2">
                            {deal.deal_name}
                            {isEnriched && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent>Enriched on {new Date(deal.last_enriched_at!).toLocaleDateString()}</TooltipContent>
                              </Tooltip>
                            )}
                          </Link>
                          {deal.company_website && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Globe className="w-3 h-3" />
                              {normalizeDomain(deal.company_website)}
                            </div>
                          )}
                        </TableCell>

                        {/* Industry */}
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground truncate block max-w-[100px]">
                                {industry}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{industry}</TooltipContent>
                          </Tooltip>
                        </TableCell>

                        {/* Location */}
                        <TableCell className="text-muted-foreground text-sm">
                          {deal.geography && deal.geography.length > 0 ? deal.geography[0] : "—"}
                        </TableCell>

                        {/* Revenue */}
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(deal.revenue)}
                        </TableCell>

                        {/* EBITDA */}
                        <TableCell className="text-right tabular-nums">
                          {deal.ebitda_amount ? formatCurrency(deal.ebitda_amount) : deal.ebitda_percentage ? `${deal.ebitda_percentage}%` : "—"}
                        </TableCell>

                        {/* Employees */}
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {deal.employee_count || "—"}
                        </TableCell>

                        {/* Score with Trend */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {deal.deal_score !== null ? (
                              <>
                                <span className={`tabular-nums ${deal.deal_score >= 85 ? 'text-amber-600 font-semibold' : deal.deal_score >= 70 ? 'text-emerald-600' : ''}`}>
                                  {deal.deal_score}
                                </span>
                                {scoreTrend !== null && scoreTrend !== 0 && (
                                  <span className={`text-xs ${scoreTrend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {scoreTrend > 0 ? '↗' : '↘'}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Motivation */}
                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-4 h-4 text-muted-foreground/50 mx-auto cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              {deal.seller_motivation || "Motivation not specified"}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>

                        {/* Engagement */}
                        <TableCell>
                          <div className="flex items-center justify-center gap-3">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-sm">
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className={counts.approved > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                                    {counts.approved}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Approved for outreach</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-sm">
                                  <ThumbsUp className="w-3.5 h-3.5 text-blue-500" />
                                  <span className={counts.interested > 0 ? "text-blue-600 font-medium" : "text-muted-foreground"}>
                                    {counts.interested}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Buyers interested</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-sm">
                                  <ThumbsDown className="w-3.5 h-3.5 text-rose-400" />
                                  <span className={counts.passed > 0 ? "text-rose-500" : "text-muted-foreground"}>
                                    {counts.passed}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Buyers passed</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>

                        {/* Lead Source */}
                        <TableCell className="text-muted-foreground text-sm">
                          {deal.lead_source || "—"}
                        </TableCell>

                        {/* Date Added */}
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(deal.created_at).toLocaleDateString()}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge variant={deal.status === "Active" ? "default" : deal.status === "Inactive" ? "secondary" : "outline"}>
                            {deal.status || "Active"}
                          </Badge>
                        </TableCell>

                        {/* Actions */}
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => archiveDeal(e, deal.id, deal.deal_name)}>
                                <Archive className="w-4 h-4 mr-2" />
                                Archive
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => confirmDeleteDeal(e, deal.id, deal.deal_name)} className="text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={dealDeleteDialogOpen} onOpenChange={setDealDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {dealToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this deal and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteDeal} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
