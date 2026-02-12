import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithTimeout } from "@/lib/invoke-with-timeout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import {
  Search,
  Building2,
  ArrowUpDown,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Calendar,
  Loader2,
  BarChart3,
  ChevronDown,
  Star,
  Target,
  Calculator,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useGlobalGateCheck, useGlobalActivityMutations } from "@/hooks/remarketing/useGlobalActivityQueue";
import { useAuth } from "@/context/AuthContext";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface CapTargetDeal {
  id: string;
  title: string | null;
  internal_company_name: string | null;
  captarget_client_name: string | null;
  captarget_contact_date: string | null;
  captarget_outreach_channel: string | null;
  captarget_interest_type: string | null;
  main_contact_name: string | null;
  main_contact_email: string | null;
  main_contact_title: string | null;
  main_contact_phone: string | null;
  captarget_sheet_tab: string | null;
  website: string | null;
  description: string | null;
  pushed_to_all_deals: boolean | null;
  pushed_to_all_deals_at: string | null;
  deal_source: string | null;
  status: string | null;
  created_at: string;
  enriched_at: string | null;
  deal_quality_score: number | null;
  linkedin_employee_count: number | null;
  linkedin_employee_range: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  captarget_status: string | null;
  is_priority_target: boolean | null;
}

type SortColumn =
  | "company_name"
  | "client_name"
  | "contact_name"
  | "interest_type"
  | "outreach_channel"
  | "contact_date"
  | "pushed"
  | "score"
  | "linkedin_employee_count"
  | "linkedin_employee_range"
  | "google_review_count"
  | "google_rating";
type SortDirection = "asc" | "desc";

export default function CapTargetDeals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  const { completeOperation, updateProgress } = useGlobalActivityMutations();

  // Filters
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [interestFilter, setInterestFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [pushedFilter, setPushedFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [statusTab, setStatusTab] = useState<"active" | "inactive">("active");

  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>("contact_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Push in progress
  const [isPushing, setIsPushing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncAbortRef = useRef<AbortController | null>(null);
  const [syncProgress, setSyncProgress] = useState({ inserted: 0, updated: 0, skipped: 0, page: 0 });
  const [syncSummaryOpen, setSyncSummaryOpen] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{ inserted: number; updated: number; skipped: number; status: "success" | "error"; message?: string } | null>(null);

  // Fetch CapTarget deals
  const {
    data: deals,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["remarketing", "captarget-deals"],
    refetchOnMount: "always",
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select(
          `
          id,
          title,
          internal_company_name,
          captarget_client_name,
          captarget_contact_date,
          captarget_outreach_channel,
          captarget_interest_type,
          main_contact_name,
          main_contact_email,
          main_contact_title,
          main_contact_phone,
          captarget_sheet_tab,
          website,
          description,
          pushed_to_all_deals,
          pushed_to_all_deals_at,
          deal_source,
          status,
          created_at,
          enriched_at,
          deal_quality_score,
          linkedin_employee_count,
          linkedin_employee_range,
          google_rating,
          google_review_count,
          captarget_status,
          is_priority_target
        `
        )
        .eq("deal_source", "captarget")
        .order("captarget_contact_date", {
          ascending: false,
          nullsFirst: false,
        });

      if (error) throw error;
      return data as CapTargetDeal[];
    },
  });

  // Get unique client names for filter dropdown
  const clientNames = useMemo(() => {
    if (!deals) return [];
    const names = new Set(
      deals
        .map((d) => d.captarget_client_name)
        .filter(Boolean) as string[]
    );
    return Array.from(names).sort();
  }, [deals]);

  // Filter + sort deals
  const filteredDeals = useMemo(() => {
    if (!deals) return [];

    let filtered = deals.filter((deal) => {
      // Tab filter
      if (deal.captarget_status !== statusTab) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesSearch =
          (deal.title || "").toLowerCase().includes(q) ||
          (deal.internal_company_name || "").toLowerCase().includes(q) ||
          (deal.captarget_client_name || "").toLowerCase().includes(q) ||
          (deal.main_contact_name || "").toLowerCase().includes(q) ||
          (deal.main_contact_email || "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (clientFilter !== "all" && deal.captarget_client_name !== clientFilter) return false;
      if (interestFilter !== "all" && deal.captarget_interest_type !== interestFilter) return false;
      if (channelFilter !== "all" && deal.captarget_outreach_channel !== channelFilter) return false;
      if (pushedFilter === "pushed" && !deal.pushed_to_all_deals) return false;
      if (pushedFilter === "not_pushed" && deal.pushed_to_all_deals) return false;
      if (dateFrom && deal.captarget_contact_date) {
        if (deal.captarget_contact_date < dateFrom) return false;
      }
      if (dateTo && deal.captarget_contact_date) {
        if (deal.captarget_contact_date > dateTo + "T23:59:59") return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "company_name":
          valA = (a.internal_company_name || a.title || "").toLowerCase();
          valB = (b.internal_company_name || b.title || "").toLowerCase();
          break;
        case "client_name":
          valA = (a.captarget_client_name || "").toLowerCase();
          valB = (b.captarget_client_name || "").toLowerCase();
          break;
        case "contact_name":
          valA = (a.main_contact_name || "").toLowerCase();
          valB = (b.main_contact_name || "").toLowerCase();
          break;
        case "interest_type":
          valA = a.captarget_interest_type || "";
          valB = b.captarget_interest_type || "";
          break;
        case "outreach_channel":
          valA = a.captarget_outreach_channel || "";
          valB = b.captarget_outreach_channel || "";
          break;
        case "contact_date":
          valA = a.captarget_contact_date || "";
          valB = b.captarget_contact_date || "";
          break;
        case "pushed":
          valA = a.pushed_to_all_deals ? 1 : 0;
          valB = b.pushed_to_all_deals ? 1 : 0;
          break;
        case "score":
          valA = a.deal_quality_score ?? -1;
          valB = b.deal_quality_score ?? -1;
          break;
        case "linkedin_employee_count":
          valA = a.linkedin_employee_count ?? -1;
          valB = b.linkedin_employee_count ?? -1;
          break;
        case "linkedin_employee_range":
          valA = (a.linkedin_employee_range || "").toLowerCase();
          valB = (b.linkedin_employee_range || "").toLowerCase();
          break;
        case "google_review_count":
          valA = a.google_review_count ?? -1;
          valB = b.google_review_count ?? -1;
          break;
        case "google_rating":
          valA = a.google_rating ?? -1;
          valB = b.google_rating ?? -1;
          break;
        default:
          return 0;
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [deals, search, clientFilter, interestFilter, channelFilter, pushedFilter, dateFrom, dateTo, sortColumn, sortDirection, statusTab]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  // Selection helpers
  const allSelected = filteredDeals.length > 0 && filteredDeals.every((d) => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDeals.map((d) => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Push to All Deals (approve)
  const handlePushToAllDeals = useCallback(
    async (dealIds: string[]) => {
      if (dealIds.length === 0) return;
      setIsPushing(true);

      const { error } = await supabase
        .from("listings")
        .update({
          status: "active",
          pushed_to_all_deals: true,
          pushed_to_all_deals_at: new Date().toISOString(),
        } as never)
        .in("id", dealIds);

      setIsPushing(false);
      setSelectedIds(new Set());

      if (error) {
        toast({ title: "Error", description: "Failed to approve deals" });
      } else {
        toast({
          title: "Approved",
          description: `${dealIds.length} deal${dealIds.length !== 1 ? "s" : ""} pushed to All Deals.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    },
    [toast, queryClient]
  );

  // Deals filtered by the current status tab (for bulk operations)
  const tabDeals = useMemo(() => {
    if (!deals) return [];
    return deals.filter((d) => d.captarget_status === statusTab);
  }, [deals, statusTab]);

  // Tab counts for labels
  const activeCount = useMemo(() => deals?.filter((d) => d.captarget_status === "active").length ?? 0, [deals]);
  const inactiveCount = useMemo(() => deals?.filter((d) => d.captarget_status === "inactive").length ?? 0, [deals]);

  // Bulk Enrich
  const handleBulkEnrich = useCallback(
    async (mode: "unenriched" | "all") => {
      if (!tabDeals.length) return;
      const targets = mode === "unenriched"
        ? tabDeals.filter((d) => !d.enriched_at)
        : tabDeals;

      if (!targets.length) {
        sonnerToast.info("No deals to enrich");
        return;
      }

      setIsEnriching(true);

      // Register in global activity queue
      let activityItem: { id: string } | null = null;
      try {
        const result = await startOrQueueMajorOp({
          operationType: "deal_enrichment",
          totalItems: targets.length,
          description: `Enriching ${targets.length} CapTarget deals`,
          userId: user?.id || "",
          contextJson: { source: "captarget" },
        });
        activityItem = result.item;
      } catch {
        // Non-blocking
      }

      const now = new Date().toISOString();
      const rows = targets.map((d) => ({
        listing_id: d.id,
        status: "pending",
        attempts: 0,
        queued_at: now,
      }));

      const { error } = await supabase
        .from("enrichment_queue")
        .upsert(rows, { onConflict: "listing_id" });

      if (error) {
        sonnerToast.error("Failed to queue enrichment");
        if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
        setIsEnriching(false);
        return;
      }

      sonnerToast.success(`Queued ${targets.length} deals for enrichment`);

      // Trigger worker
      try {
        const { data: result } = await supabase.functions
          .invoke("process-enrichment-queue", { body: { source: "captarget_bulk" } });

        if (result?.synced > 0 || result?.processed > 0) {
          const totalDone = (result?.synced || 0) + (result?.processed || 0);
          if (activityItem) updateProgress.mutate({ id: activityItem.id, completedItems: totalDone });
          if (result?.processed === 0) {
            sonnerToast.success(`All ${result.synced} deals were already enriched`);
            if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "completed" });
          }
        }
      } catch {
        // Non-blocking
      }

      setIsEnriching(false);
      queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
    },
    [tabDeals, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient]
  );

  // Bulk Score
  const handleBulkScore = useCallback(
    async (mode: "unscored" | "all") => {
      if (!tabDeals.length) return;
      const targets = mode === "unscored"
        ? tabDeals.filter((d) => d.deal_quality_score == null)
        : tabDeals;

      if (!targets.length) {
        sonnerToast.info("No deals to score");
        return;
      }

      setIsScoring(true);

      // Register in global activity queue
      let activityItem: { id: string } | null = null;
      try {
        const result = await startOrQueueMajorOp({
          operationType: "deal_enrichment",
          totalItems: targets.length,
          description: `Scoring ${targets.length} CapTarget deals`,
          userId: user?.id || "",
          contextJson: { source: "captarget_scoring" },
        });
        activityItem = result.item;
      } catch {
        // Non-blocking
      }

      sonnerToast.info(`Scoring ${targets.length} deals...`);

      let successCount = 0;
      for (const deal of targets) {
        try {
          await supabase.functions.invoke("calculate-deal-quality", {
            body: { listingId: deal.id },
          });
          successCount++;
          if (activityItem) updateProgress.mutate({ id: activityItem.id, completedItems: successCount });
        } catch {
          // continue
        }
      }

      sonnerToast.success(`Scored ${successCount} of ${targets.length} deals`);
      if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "completed" });

      setIsScoring(false);
      queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
    },
    [tabDeals, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient]
  );

  // Enrich selected deals (existing)
  const handleEnrichSelected = useCallback(
    async (dealIds: string[]) => {
      if (dealIds.length === 0) return;
      setIsEnriching(true);

      let queued = 0;
      for (const id of dealIds) {
        try {
          await invokeWithTimeout("enrich-deal", {
            body: { dealId: id },
            timeoutMs: 90_000,
          });
          queued++;
        } catch (err) {
          console.error(`Failed to enrich deal ${id}:`, err);
        }
      }

      setIsEnriching(false);
      setSelectedIds(new Set());

      toast({
        title: "Enrichment Started",
        description: `${queued} deal${queued !== 1 ? "s" : ""} queued for enrichment.`,
      });

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
      }, 5000);
    },
    [toast, queryClient]
  );

  const interestTypeLabel = (type: string | null) => {
    switch (type) {
      case "interest": return "Interest";
      case "no_interest": return "No Interest";
      case "keep_in_mind": return "Keep in Mind";
      default: return "Unknown";
    }
  };

  const interestTypeBadgeClass = (type: string | null) => {
    switch (type) {
      case "interest": return "bg-green-50 text-green-700 border-green-200";
      case "no_interest": return "bg-red-50 text-red-700 border-red-200";
      case "keep_in_mind": return "bg-amber-50 text-amber-700 border-amber-200";
      default: return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  // Date-filtered deals for KPI stats
  const dateFilteredDeals = useMemo(() => {
    if (!deals || dateFilter === "all") return deals || [];
    const now = new Date();
    let cutoff: Date;
    switch (dateFilter) {
      case "7d": cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case "30d": cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case "90d": cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      default: return deals;
    }
    return deals.filter((d) => new Date(d.created_at) >= cutoff);
  }, [deals, dateFilter]);

  // KPI Stats (based on date-filtered deals)
  const kpiStats = useMemo(() => {
    const totalDeals = dateFilteredDeals.length;
    const priorityDeals = dateFilteredDeals.filter((d) => d.is_priority_target === true).length;
    let totalScore = 0;
    let scoredDeals = 0;
    dateFilteredDeals.forEach((d) => {
      if (d.deal_quality_score != null) {
        totalScore += d.deal_quality_score;
        scoredDeals++;
      }
    });
    const avgScore = scoredDeals > 0 ? Math.round(totalScore / scoredDeals) : 0;
    const needsScoring = dateFilteredDeals.filter((d) => d.deal_quality_score == null).length;
    return { totalDeals, priorityDeals, avgScore, needsScoring };
  }, [dateFilteredDeals]);

  // Summary stats
  const totalDeals = deals?.length || 0;
  const unpushedCount = deals?.filter((d) => !d.pushed_to_all_deals).length || 0;
  const interestCount = deals?.filter((d) => d.captarget_interest_type === "interest").length || 0;
  const enrichedCount = deals?.filter((d) => d.enriched_at).length || 0;
  const scoredCount = deals?.filter((d) => d.deal_quality_score != null).length || 0;

  const SortHeader = ({
    column,
    children,
  }: {
    column: SortColumn;
    children: React.ReactNode;
  }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => handleSort(column)}
    >
      {children}
      <ArrowUpDown
        className={cn(
          "h-3 w-3",
          sortColumn === column ? "text-foreground" : "text-muted-foreground/50"
        )}
      />
    </button>
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            CapTarget Deals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalDeals} total &middot; {unpushedCount} un-pushed &middot;{" "}
            {interestCount} interest &middot; {enrichedCount} enriched &middot; {scoredCount} scored
          </p>
        </div>

        {/* Global bulk actions */}
        <div className="flex items-center gap-2">
          {/* Sync from Sheet */}
          <Button
            variant="outline"
            size="sm"
            disabled={isSyncing}
            onClick={async () => {
              const abortCtrl = new AbortController();
              syncAbortRef.current = abortCtrl;
              setIsSyncing(true);
              setSyncProgress({ inserted: 0, updated: 0, skipped: 0, page: 0 });
              let totalInserted = 0;
              let totalUpdated = 0;
              let totalSkipped = 0;
              let pageNum = 0;
              let page = { startTab: 0, startRow: 0 };
              try {
                let hasMore = true;
                while (hasMore) {
                  if (abortCtrl.signal.aborted) {
                    setSyncSummary({ inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped, status: "success", message: "Sync cancelled by user" });
                    setSyncSummaryOpen(true);
                    refetch();
                    return;
                  }
                  pageNum++;
                  const { data, error } = await supabase.functions.invoke('sync-captarget-sheet', {
                    body: page
                  });
                  if (error) throw error;
                  totalInserted += data?.rows_inserted ?? 0;
                  totalUpdated += data?.rows_updated ?? 0;
                  totalSkipped += data?.rows_skipped ?? 0;
                  setSyncProgress({ inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped, page: pageNum });
                  hasMore = data?.hasMore === true;
                  if (hasMore) {
                    page = { startTab: data.nextTab, startRow: data.nextRow };
                  }
                }
                setSyncSummary({ inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped, status: "success" });
                setSyncSummaryOpen(true);
                refetch();
              } catch (e: any) {
                setSyncSummary({ inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped, status: "error", message: e.message });
                setSyncSummaryOpen(true);
              } finally {
                setIsSyncing(false);
                syncAbortRef.current = null;
              }
            }}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Sync Sheet
          </Button>

          {/* Sync progress bar */}
          {isSyncing && (
            <div className="flex items-center gap-3 min-w-[200px]">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Page {syncProgress.page}...</span>
                  <span>+{syncProgress.inserted} new, ~{syncProgress.updated} updated</span>
                </div>
                <Progress value={undefined} className="h-1.5 animate-pulse" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => syncAbortRef.current?.abort()}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Sync summary dialog */}
          <Dialog open={syncSummaryOpen} onOpenChange={setSyncSummaryOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {syncSummary?.status === "success" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <RefreshCw className="h-5 w-5 text-destructive" />
                  )}
                  {syncSummary?.status === "success" ? "Sync Complete" : "Sync Failed"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg border p-3">
                    <p className="text-2xl font-bold text-emerald-600">{syncSummary?.inserted ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Inserted</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-2xl font-bold text-blue-600">{syncSummary?.updated ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Updated</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-2xl font-bold text-muted-foreground">{syncSummary?.skipped ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Skipped</p>
                  </div>
                </div>
                {syncSummary?.status === "error" && syncSummary.message && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">{syncSummary.message}</p>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setSyncSummaryOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isEnriching}>
                {isEnriching ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                Enrich
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBulkEnrich("unenriched")}>
                Enrich Unenriched
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkEnrich("all")}>
                Re-enrich All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bulk Score dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isScoring}>
                {isScoring ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4 mr-1" />
                )}
                Score
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBulkScore("unscored")}>
                Score Unscored
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkScore("all")}>
                Recalculate All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
              <div className="p-2 bg-amber-100 rounded-lg">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Priority Deals</p>
                <p className="text-2xl font-bold text-amber-600">{kpiStats.priorityDeals}</p>
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
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search company, client, contact..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Client filter */}
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Client Name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clientNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Interest type filter */}
            <Select value={interestFilter} onValueChange={setInterestFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Interest Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="interest">Interest</SelectItem>
                <SelectItem value="no_interest">No Interest</SelectItem>
                <SelectItem value="keep_in_mind">Keep in Mind</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>

            {/* Channel filter */}
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="Cold Call">Cold Call</SelectItem>
                <SelectItem value="Cold Email">Cold Email</SelectItem>
                <SelectItem value="Not Interested">Not Interested</SelectItem>
                <SelectItem value="Unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>

            {/* Pushed filter */}
            <Select value={pushedFilter} onValueChange={setPushedFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Pushed Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pushed">Pushed</SelectItem>
                <SelectItem value="not_pushed">Not Pushed</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range filter */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px] h-9"
                placeholder="From"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px] h-9"
                placeholder="To"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions (selection-based) */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} deal{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <Button
            size="sm"
            onClick={() => handlePushToAllDeals(Array.from(selectedIds))}
            disabled={isPushing}
            className="gap-2"
          >
            {isPushing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Approve to All Deals
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEnrichSelected(Array.from(selectedIds))}
            disabled={isEnriching}
            className="gap-2"
          >
            {isEnriching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Enrich Selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Active / Inactive Tabs */}
      <Tabs
        value={statusTab}
        onValueChange={(val) => {
          setStatusTab(val as "active" | "inactive");
          setSelectedIds(new Set());
        }}
      >
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeCount})
          </TabsTrigger>
          <TabsTrigger value="inactive">
            Inactive ({inactiveCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={statusTab} forceMount>

      {/* Deals Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader column="company_name">Company</SortHeader>
                  </TableHead>
                  <TableHead className="max-w-[200px]">Description</TableHead>
                  <TableHead>
                    <SortHeader column="client_name">Client</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="contact_name">Contact</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="interest_type">Interest</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="outreach_channel">Channel</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="linkedin_employee_count">LI Count</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="linkedin_employee_range">LI Range</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="google_review_count">Reviews</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="google_rating">Rating</SortHeader>
                  </TableHead>
                  <TableHead>Source Tab</TableHead>
                  <TableHead>
                    <SortHeader column="score">Score</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="contact_date">Date</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="pushed">Status</SortHeader>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={15}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                      <p className="font-medium">No CapTarget deals found</p>
                      <p className="text-sm mt-1">
                        Deals will appear here after the sync runs.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDeals.map((deal) => (
                    <TableRow
                      key={deal.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors",
                        deal.pushed_to_all_deals && "bg-green-50/60 hover:bg-green-50"
                      )}
                      onClick={() =>
                        navigate(
                          `/admin/remarketing/captarget-deals/${deal.id}`,
                          { state: { from: "/admin/remarketing/captarget-deals" } }
                        )
                      }
                    >
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        className="w-[40px]"
                      >
                        <Checkbox
                          checked={selectedIds.has(deal.id)}
                          onCheckedChange={() => toggleSelect(deal.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground truncate max-w-[220px]">
                            {deal.internal_company_name || deal.title || "—"}
                          </span>
                          {deal.website && (
                            <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                              {deal.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {deal.description || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground truncate max-w-[160px] block">
                          {deal.captarget_client_name || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {deal.main_contact_name || "—"}
                          </span>
                          {deal.main_contact_title && (
                            <span className="text-xs text-muted-foreground">
                              {deal.main_contact_title}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={interestTypeBadgeClass(deal.captarget_interest_type)}
                        >
                          {interestTypeLabel(deal.captarget_interest_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {deal.captarget_outreach_channel || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {deal.linkedin_employee_count != null ? (
                          <span className="text-sm tabular-nums">{deal.linkedin_employee_count.toLocaleString()}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.linkedin_employee_range ? (
                          <span className="text-sm">{deal.linkedin_employee_range}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.google_review_count != null ? (
                          <span className="text-sm tabular-nums">{deal.google_review_count.toLocaleString()}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.google_rating != null ? (
                          <span className="text-sm tabular-nums">⭐ {deal.google_rating}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.captarget_sheet_tab ? (
                          <span className="text-sm">{deal.captarget_sheet_tab}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.deal_quality_score != null ? (
                          <Badge variant="outline" className={cn(
                            "tabular-nums",
                            deal.deal_quality_score >= 80 ? "bg-green-50 text-green-700 border-green-200" :
                            deal.deal_quality_score >= 60 ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-gray-50 text-gray-600 border-gray-200"
                          )}>
                            {deal.deal_quality_score}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.captarget_status ? (
                          <Badge variant="outline" className={cn(
                            "text-xs capitalize",
                            deal.captarget_status === "active"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          )}>
                            {deal.captarget_status}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {deal.captarget_contact_date
                            ? format(new Date(deal.captarget_contact_date), "MMM d, yyyy")
                            : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {deal.pushed_to_all_deals ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Pushed
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {deal.enriched_at && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                              Enriched
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

        </TabsContent>
      </Tabs>

      {/* Footer stats */}
      <p className="text-xs text-muted-foreground text-center">
        Showing {filteredDeals.length} of {statusTab === "active" ? activeCount : inactiveCount} {statusTab} deals
      </p>
    </div>
  );
}
