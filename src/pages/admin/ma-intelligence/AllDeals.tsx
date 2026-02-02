import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileText, MoreHorizontal, Archive, Trash2, ArrowUp, ArrowDown, Sparkles, ThumbsUp, ThumbsDown, UserCheck, ArrowUpDown, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeDomain } from "@/lib/ma-intelligence/normalizeDomain";
import { deleteDealWithRelated } from "@/lib/ma-intelligence/cascadeDelete";
import { DealScoreBadge } from "@/components/ma-intelligence/DealScoreBadge";

type SortColumn = "deal_name" | "tracker" | "geography" | "revenue" | "ebitda" | "score" | "date";
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
  status: string | null;
  last_enriched_at: string | null;
  created_at: string;
}

export default function MAAllDeals() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [trackers, setTrackers] = useState<Record<string, TrackerInfo>>({});
  const [buyerCounts, setBuyerCounts] = useState<Record<string, BuyerCounts>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dealDeleteDialogOpen, setDealDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<{ id: string; name: string } | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    const [dealsRes, trackersRes, scoresRes] = await Promise.all([
      supabase.from("deals").select("*").order("created_at", { ascending: false }),
      supabase.from("industry_trackers").select("id, name"),
      supabase.from("remarketing_scores").select("listing_id, status"),
    ]);

    // Map deals to our interface
    const mappedDeals: DealRow[] = ((dealsRes.data || []) as any[]).map((d) => ({
      id: d.id,
      deal_name: d.contact_name || d.deal_name || 'Unknown Deal',
      tracker_id: d.listing_id || d.tracker_id || '',
      company_website: d.company_website ?? null,
      company_overview: d.company_overview ?? null,
      geography: d.geography ?? null,
      revenue: d.revenue ?? null,
      ebitda_amount: d.ebitda_amount ?? null,
      ebitda_percentage: d.ebitda_percentage ?? null,
      deal_score: d.deal_score ?? null,
      status: d.status ?? null,
      last_enriched_at: d.last_enriched_at ?? null,
      created_at: d.created_at,
    }));
    setDeals(mappedDeals);

    const trackerMap: Record<string, TrackerInfo> = {};
    ((trackersRes.data || []) as any[]).forEach((t) => {
      trackerMap[t.id] = { id: t.id, industry_name: t.name || t.industry_name || 'Unknown' };
    });
    setTrackers(trackerMap);

    const counts: Record<string, BuyerCounts> = {};
    ((scoresRes.data || []) as any[]).forEach((score) => {
      if (!counts[score.listing_id]) {
        counts[score.listing_id] = { approved: 0, interested: 0, passed: 0 };
      }
      if (score.status === 'approved') counts[score.listing_id].approved++;
      if (score.status === 'interested') counts[score.listing_id].interested++;
      if (score.status === 'passed') counts[score.listing_id].passed++;
    });
    setBuyerCounts(counts);

    setIsLoading(false);
  };

  const archiveDeal = async (e: React.MouseEvent, dealId: string, dealName: string) => {
    e.preventDefault();
    e.stopPropagation();

    const { error } = await supabase.from("deals").update({ status: "Archived" } as any).eq("id", dealId);
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

  const filteredDeals = useMemo(() => {
    if (!searchQuery) return deals;
    const query = searchQuery.toLowerCase();
    return deals.filter((deal) => {
      const matchesName = deal.deal_name?.toLowerCase().includes(query);
      const matchesDomain = normalizeDomain(deal.company_website || "")?.toLowerCase().includes(query);
      const matchesGeo = deal.geography?.some((g: string) => g.toLowerCase().includes(query));
      return matchesName || matchesDomain || matchesGeo;
    });
  }, [deals, searchQuery]);

  const sortedDeals = useMemo(() => {
    return [...filteredDeals].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortColumn) {
        case "deal_name":
          aVal = a.deal_name?.toLowerCase() || "";
          bVal = b.deal_name?.toLowerCase() || "";
          break;
        case "tracker":
          aVal = trackers[a.tracker_id]?.industry_name?.toLowerCase() || "";
          bVal = trackers[b.tracker_id]?.industry_name?.toLowerCase() || "";
          break;
        case "geography":
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
        case "score":
          aVal = a.deal_score ?? -1;
          bVal = b.deal_score ?? -1;
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
  }, [filteredDeals, sortColumn, sortDirection, trackers]);

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortableHeader = ({ column, children, className = "" }: { column: SortColumn; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
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
    </TableHead>
  );

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "—";
    return `$${value.toFixed(1)}M`;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">All Deals</h1>
            <p className="text-muted-foreground">
              {filteredDeals.length} {filteredDeals.length === 1 ? 'deal' : 'deals'} across {uniqueTrackers} buyer universe{uniqueTrackers !== 1 ? 's' : ''}
              {searchQuery && <span className="text-primary"> (filtered)</span>}
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search deals by name, domain, or geography..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {filteredDeals.length === 0 ? (
          <div className="bg-card rounded-lg border p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">{deals.length === 0 ? "No deals yet" : "No deals match your filters"}</h3>
            <p className="text-muted-foreground">
              {deals.length === 0
                ? "List a deal in a buyer universe to get started."
                : "Try adjusting your search criteria."}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortableHeader column="deal_name">Deal Name</SortableHeader>
                  <SortableHeader column="tracker">Buyer Universe</SortableHeader>
                  <TableHead>Description</TableHead>
                  <SortableHeader column="geography">Geography</SortableHeader>
                  <SortableHeader column="revenue" className="text-right">Revenue</SortableHeader>
                  <SortableHeader column="ebitda" className="text-right">EBITDA</SortableHeader>
                  <SortableHeader column="score" className="text-right">Score</SortableHeader>
                  <TableHead className="text-center">Engagement</TableHead>
                  <SortableHeader column="date">Added</SortableHeader>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDeals.map((deal) => {
                  const tracker = trackers[deal.tracker_id];
                  const counts = buyerCounts[deal.id] || { approved: 0, interested: 0, passed: 0 };
                  const isEnriched = !!deal.last_enriched_at;

                  return (
                    <TableRow key={deal.id} className="group">
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
                          <span className="text-xs text-muted-foreground">{normalizeDomain(deal.company_website)}</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Link
                          to={`/admin/ma-intelligence/trackers/${deal.tracker_id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {tracker?.industry_name || "Unknown"}
                        </Link>
                      </TableCell>

                      <TableCell className="max-w-[250px]">
                        {deal.company_overview ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground truncate block cursor-default">
                                {deal.company_overview}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="text-sm">{deal.company_overview}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {deal.geography && deal.geography.length > 0 ? (
                          <span className="text-sm">{deal.geography.slice(0, 2).join(", ")}{deal.geography.length > 2 && ` +${deal.geography.length - 2}`}</span>
                        ) : "—"}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(deal.revenue)}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {deal.ebitda_amount ? formatCurrency(deal.ebitda_amount) : deal.ebitda_percentage ? `${deal.ebitda_percentage}%` : "—"}
                      </TableCell>

                      <TableCell className="text-right">
                        <DealScoreBadge score={deal.deal_score} size="sm" />
                      </TableCell>

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

                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(deal.created_at).toLocaleDateString()}
                      </TableCell>

                      <TableCell>
                        <Badge variant={deal.status === "Active" ? "default" : deal.status === "Closed" ? "secondary" : "outline"}>
                          {deal.status || "Active"}
                        </Badge>
                      </TableCell>

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
        )}

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
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
