import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithTimeout } from "@/lib/invoke-with-timeout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTimeframe } from "@/hooks/use-timeframe";
import { useFilterEngine } from "@/hooks/use-filter-engine";
import { FilterBar, TimeframeSelector, CAPTARGET_FIELDS } from "@/components/filters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import {
  Building2,
  ArrowUpDown,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Loader2,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Star,
  Target,
  Calculator,
  RefreshCw,
  Archive,
  Trash2,
  MoreHorizontal,
  ExternalLink,
  Zap,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  owner_response: string | null;
  pushed_to_all_deals: boolean | null;
  pushed_to_all_deals_at: string | null;
  deal_source: string | null;
  status: string | null;
  created_at: string;
  enriched_at: string | null;
  deal_total_score: number | null;
  linkedin_employee_count: number | null;
  linkedin_employee_range: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  captarget_status: string | null;
  is_priority_target: boolean | null;
  category: string | null;
  executive_summary: string | null;
  industry: string | null;
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
  const [pushedFilter, setPushedFilter] = useState<string>("all");
  const [sourceTabFilter, setSourceTabFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [statusTab, setStatusTab] = useState<"all" | "active" | "inactive">("all");

  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>("contact_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Column resizing
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    checkbox: 40,
    number: 50,
    company: 180,
    description: 200,
    industry: 130,
    contact: 120,
    interest: 80,
    channel: 100,
    liCount: 80,
    liRange: 90,
    reviews: 80,
    rating: 70,
    sourceTab: 90,
    score: 70,
    date: 80,
    status: 80,
  });
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

  const handleResizeStart = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = columnWidths[col] || 100;
    resizingRef.current = { col, startX, startW };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(40, resizingRef.current.startW + diff);
      setColumnWidths(prev => ({ ...prev, [resizingRef.current!.col]: newWidth }));
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [columnWidths]);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  // Push in progress
  const [isPushing, setIsPushing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncAbortRef = useRef<AbortController | null>(null);
  const [syncProgress, setSyncProgress] = useState({ inserted: 0, updated: 0, skipped: 0, page: 0 });
  const [syncSummaryOpen, setSyncSummaryOpen] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{ inserted: number; updated: number; skipped: number; status: "success" | "error"; message?: string } | null>(null);

  // Archive & Delete state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      const allData: CapTargetDeal[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
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
            owner_response,
            pushed_to_all_deals,
            pushed_to_all_deals_at,
            deal_source,
            status,
            created_at,
            enriched_at,
            deal_total_score,
            linkedin_employee_count,
            linkedin_employee_range,
            google_rating,
            google_review_count,
            captarget_status,
            is_priority_target,
            category,
            executive_summary,
            industry
          `
          )
          .eq("deal_source", "captarget")
          .order("captarget_contact_date", {
            ascending: false,
            nullsFirst: false,
          })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...(data as CapTargetDeal[]));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
  });

  // Filter + sort deals
  const filteredDeals = useMemo(() => {
    if (!deals) return [];

    let filtered = deals.filter((deal) => {
      // Tab filter
      if (statusTab !== "all" && deal.captarget_status !== statusTab) return false;
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
      if (pushedFilter === "pushed" && !deal.pushed_to_all_deals) return false;
      if (pushedFilter === "not_pushed" && deal.pushed_to_all_deals) return false;
      if (sourceTabFilter !== "all" && deal.captarget_sheet_tab !== sourceTabFilter) return false;
      if (dateFrom && deal.captarget_contact_date) {
        if (deal.captarget_contact_date < dateFrom) return false;
      }
      if (dateTo && deal.captarget_contact_date) {
        if (deal.captarget_contact_date > dateTo + "T23:59:59") return false;
      }
      return true;
    });

  const {
    filteredItems: engineFiltered,
    filterState,
    setFilterState,
    activeFilterCount,
    dynamicOptions,
    filteredCount,
    totalCount: engineTotal,
  } = useFilterEngine(tabItems, CAPTARGET_FIELDS);

  // Sort the engine-filtered results
  const filteredDeals = useMemo(() => {
    const sorted = [...engineFiltered];
    sorted.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "company_name":
          valA = (a.internal_company_name || a.title || "").toLowerCase();
          valB = (b.internal_company_name || b.title || "").toLowerCase();
          break;
        case "client_name":
          valA = (a.category || a.industry || "").toLowerCase();
          valB = (b.category || b.industry || "").toLowerCase();
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
          valA = a.deal_total_score ?? -1;
          valB = b.deal_total_score ?? -1;
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
    return sorted;
  }, [engineFiltered, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredDeals.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedDeals = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredDeals.slice(start, start + PAGE_SIZE);
  }, [filteredDeals, safePage]);

  // Reset to page 1 when filters/sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterState, sortColumn, sortDirection]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  // Selection helpers — scoped to current page
  const allSelected = paginatedDeals.length > 0 && paginatedDeals.every((d) => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedDeals.map((d) => d.id)));
    }
  };

  const lastSelectedIndexRef = useRef<number | null>(null);

  const toggleSelect = (id: string, event?: React.MouseEvent) => {
    const currentIndex = paginatedDeals.findIndex((d) => d.id === id);

    if (event?.shiftKey && lastSelectedIndexRef.current !== null && currentIndex !== -1) {
      const start = Math.min(lastSelectedIndexRef.current, currentIndex);
      const end = Math.max(lastSelectedIndexRef.current, currentIndex);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(paginatedDeals[i].id);
        }
        return next;
      });
      lastSelectedIndexRef.current = currentIndex;
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastSelectedIndexRef.current = currentIndex;
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
    if (statusTab === "all") return deals;
    return deals.filter((d) => d.captarget_status === statusTab);
  }, [deals, statusTab]);

  // Tab counts for labels
  const activeCount = useMemo(() => deals?.filter((d) => d.captarget_status === "active").length ?? 0, [deals]);
  const inactiveCount = useMemo(() => deals?.filter((d) => d.captarget_status === "inactive").length ?? 0, [deals]);

  // Bulk Enrich
  const handleBulkEnrich = useCallback(
    async (mode: "unenriched" | "all") => {
      // Use ALL deals (not filteredDeals) so bulk enrich works across active/inactive tabs
      if (!deals?.length) return;
      const targets = mode === "unenriched"
        ? deals.filter((d) => !d.enriched_at)
        : deals;

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
      // Deduplicate by listing_id to avoid "ON CONFLICT DO UPDATE cannot affect row a second time"
      const seen = new Set<string>();
      const rows = targets
        .filter((d) => {
          if (seen.has(d.id)) return false;
          seen.add(d.id);
          return true;
        })
        .map((d) => ({
          listing_id: d.id,
          status: "pending" as const,
          attempts: 0,
          queued_at: now,
        }));

      // Batch upsert in chunks to avoid PostgREST size limits
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("enrichment_queue")
          .upsert(chunk, { onConflict: "listing_id" });

        if (error) {
          console.error("Queue upsert error:", error);
          sonnerToast.error(`Failed to queue enrichment (batch ${Math.floor(i / CHUNK) + 1})`);
          if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
          setIsEnriching(false);
          return;
        }
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
    [deals, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient]
  );

  // Bulk Score — single backend call with self-continuation
  const handleBulkScore = useCallback(
    async (mode: "unscored" | "all") => {
      if (!deals?.length) return;

      const totalCount = mode === "unscored"
        ? deals.filter((d) => d.deal_total_score == null).length
        : deals.length;

      if (!totalCount) {
        sonnerToast.info("No deals to score");
        return;
      }

      setIsScoring(true);

      // Register in global activity queue
      let activityItem: { id: string } | null = null;
      try {
        const result = await startOrQueueMajorOp({
          operationType: "deal_enrichment",
          totalItems: totalCount,
          description: `Scoring ${totalCount} CapTarget deals`,
          userId: user?.id || "",
          contextJson: { source: "captarget_scoring" },
        });
        activityItem = result.item;
      } catch {
        // Non-blocking
      }

      sonnerToast.info(`Scoring ${totalCount} deals in background...`);

      try {
        // Single call — the backend handles batching + self-continuation
        await supabase.functions.invoke("calculate-deal-quality", {
          body: {
            batchSource: "captarget",
            unscoredOnly: mode === "unscored",
            globalQueueId: activityItem?.id,
          },
        });
      } catch (err) {
        console.error("Scoring invocation failed:", err);
        sonnerToast.error("Failed to start scoring");
        if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
      }

      // Set up periodic refetching while scoring runs in background
      const refreshInterval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
      }, 10000); // Refresh every 10 seconds
      
      // Stop polling after 20 minutes max
      setTimeout(() => clearInterval(refreshInterval), 20 * 60 * 1000);
      
      setIsScoring(false);
    },
    [deals, user, startOrQueueMajorOp, completeOperation, queryClient]
  );

  // Enrich selected deals — queue-based (same pattern as Enrich All)
  const handleEnrichSelected = useCallback(
    async (dealIds: string[], mode: "all" | "unenriched" = "all") => {
      if (dealIds.length === 0) return;

      // Filter to unenriched only if requested
      let targetIds = dealIds;
      if (mode === "unenriched" && filteredDeals) {
        const enrichedSet = new Set(
          filteredDeals.filter((d) => d.enriched_at).map((d) => d.id)
        );
        targetIds = dealIds.filter((id) => !enrichedSet.has(id));
        if (targetIds.length === 0) {
          sonnerToast.info("All selected deals are already enriched");
          return;
        }
      }
      setIsEnriching(true);

      // Register in global activity queue
      let activityItem: { id: string } | null = null;
      try {
        const result = await startOrQueueMajorOp({
          operationType: "deal_enrichment",
          totalItems: targetIds.length,
          description: `Enriching ${targetIds.length} CapTarget deals`,
          userId: user?.id || "",
          contextJson: { source: "captarget_selected" },
        });
        activityItem = result.item;
      } catch {
        // Non-blocking
      }

      const now = new Date().toISOString();

      // Cancel any old pending items so only these deals run
      try {
        await supabase.functions.invoke("process-enrichment-queue", {
          body: { action: "cancel_pending", before: now },
        });
      } catch {
        // Non-blocking — old items will just finish naturally
      }

      const seen = new Set<string>();
      const rows = targetIds
        .filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map((id) => ({
          listing_id: id,
          status: "pending" as const,
          attempts: 0,
          queued_at: now,
        }));

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("enrichment_queue")
          .upsert(chunk, { onConflict: "listing_id" });
        if (error) {
          console.error("Queue upsert error:", error);
          sonnerToast.error("Failed to queue enrichment");
          if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
          setIsEnriching(false);
          return;
        }
      }

      sonnerToast.success(`Queued ${rows.length} deals for enrichment`);
      setSelectedIds(new Set());

      // Trigger worker
      try {
        const { data: result } = await supabase.functions
          .invoke("process-enrichment-queue", { body: { source: "captarget_selected" } });

        if (result?.synced > 0 || result?.processed > 0) {
          const totalDone = (result?.synced || 0) + (result?.processed || 0);
          if (activityItem) updateProgress.mutate({ id: activityItem.id, completedItems: totalDone });
        }
      } catch {
        // Non-blocking
      }

      setIsEnriching(false);
      queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
    },
    [user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient, supabase, filteredDeals]
  );

  // LinkedIn + Google only enrichment (skips website scraping)
  const handleExternalOnlyEnrich = useCallback(async () => {
    setIsEnriching(true);

    let activityItem: { id: string } | null = null;
    try {
      const missingCount = deals?.filter(d => d.enriched_at && !d.linkedin_employee_count && !d.google_review_count).length || 0;
      const result = await startOrQueueMajorOp({
        operationType: "deal_enrichment",
        totalItems: missingCount || 1,
        description: `LinkedIn + Google enrichment for CapTarget deals`,
        userId: user?.id || "",
        contextJson: { source: "captarget_external_only" },
      });
      activityItem = result.item;
    } catch {
      // Non-blocking
    }

    try {
      const { data: result, error } = await supabase.functions.invoke("enrich-external-only", {
        body: { dealSource: "captarget", mode: "missing" },
      });

      if (error) {
        sonnerToast.error("Failed to start LinkedIn/Google enrichment");
        if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
      } else {
        sonnerToast.success(`Queued ${result?.total || 0} deals for LinkedIn + Google enrichment`, {
          description: "This runs much faster than full enrichment — no website re-scraping",
        });
      }
    } catch {
      sonnerToast.error("Failed to invoke external enrichment");
    }

    setIsEnriching(false);
    queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
  }, [deals, user, startOrQueueMajorOp, completeOperation, queryClient]);

  // Archive selected deals (soft delete via status change)
  const handleBulkArchive = useCallback(async () => {
    setIsArchiving(true);
    try {
      const dealIds = Array.from(selectedIds);
      const { error } = await supabase
        .from('listings')
        .update({ captarget_status: 'inactive' } as any)
        .in('id', dealIds);

      if (error) throw error;

      toast({
        title: 'Deals Archived',
        description: `${dealIds.length} deal(s) have been moved to Inactive`,
      });
      setSelectedIds(new Set());
      setShowArchiveDialog(false);
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Archive Failed', description: err.message });
    } finally {
      setIsArchiving(false);
    }
  }, [selectedIds, toast, refetch]);

  // Permanently delete selected deals
  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const dealIds = Array.from(selectedIds);

      // Delete related records first
      for (const dealId of dealIds) {
        await supabase.from('enrichment_queue').delete().eq('listing_id', dealId);
        await supabase.from('remarketing_scores').delete().eq('listing_id', dealId);
        await supabase.from('buyer_deal_scores').delete().eq('deal_id', dealId);
      }

      const { error } = await supabase
        .from('listings')
        .delete()
        .in('id', dealIds);

      if (error) throw error;

      toast({
        title: 'Deals Deleted',
        description: `${dealIds.length} deal(s) have been permanently deleted`,
      });
      setSelectedIds(new Set());
      setShowDeleteDialog(false);
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: err.message });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, toast, refetch]);

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

  // Date-filtered deals for KPI stats (driven by TimeframeSelector)
  const dateFilteredDeals = useMemo(() => {
    if (!deals) return [];
    return deals.filter((d) => isInRange(d.created_at));
  }, [deals, isInRange]);

  // KPI Stats (based on date-filtered deals)
  const kpiStats = useMemo(() => {
    const totalDeals = dateFilteredDeals.length;
    const priorityDeals = dateFilteredDeals.filter((d) => d.is_priority_target === true).length;
    let totalScore = 0;
    let scoredDeals = 0;
    dateFilteredDeals.forEach((d) => {
      const score = d.deal_total_score;
      if (score != null) {
        totalScore += score;
        scoredDeals++;
      }
    });
    const avgScore = scoredDeals > 0 ? Math.round(totalScore / scoredDeals) : 0;
    const needsScoring = dateFilteredDeals.filter((d) => d.deal_total_score == null).length;
    return { totalDeals, priorityDeals, avgScore, needsScoring };
  }, [dateFilteredDeals]);

  // Summary stats
  const totalDeals = deals?.length || 0;
  const unpushedCount = deals?.filter((d) => !d.pushed_to_all_deals).length || 0;
  const interestCount = deals?.filter((d) => d.captarget_interest_type === "interest").length || 0;
  const enrichedCount = deals?.filter((d) => d.enriched_at).length || 0;
  const scoredCount = deals?.filter((d) => d.deal_total_score != null).length || 0;

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
              <DropdownMenuItem onClick={handleExternalOnlyEnrich}>
                LinkedIn + Google Only
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

          <TimeframeSelector value={timeframe} onChange={setTimeframe} compact />
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
      <FilterBar
        filterState={filterState}
        onFilterStateChange={setFilterState}
        fieldDefinitions={CAPTARGET_FIELDS}
        dynamicOptions={dynamicOptions}
        totalCount={engineTotal}
        filteredCount={filteredCount}
      />

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isEnriching}
                className="gap-2"
              >
                {isEnriching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Enrich Selected
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleEnrichSelected(Array.from(selectedIds), "unenriched")}>
                Enrich Unenriched
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEnrichSelected(Array.from(selectedIds), "all")}>
                Re-enrich All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-5 w-px bg-border" />

          {(() => {
            const dealIds = Array.from(selectedIds);
            const allPriority = dealIds.length > 0 && dealIds.every(id => deals?.find(d => d.id === id)?.is_priority_target);
            return (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const newValue = !allPriority;
                  const { error } = await supabase
                    .from("listings")
                    .update({ is_priority_target: newValue } as never)
                    .in("id", dealIds);
                  if (error) {
                    toast({ title: "Error", description: "Failed to update priority" });
                  } else {
                    toast({ title: newValue ? "Priority Set" : "Priority Removed", description: `${dealIds.length} deal(s) updated` });
                    setSelectedIds(new Set());
                    refetch();
                  }
                }}
                className={cn("gap-2", allPriority ? "text-muted-foreground" : "text-amber-600 border-amber-200 hover:bg-amber-50")}
              >
                <Star className={cn("h-4 w-4", allPriority ? "" : "fill-amber-500")} />
                {allPriority ? "Remove Priority" : "Mark as Priority"}
              </Button>
            );
          })()}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowArchiveDialog(true)}
            disabled={isArchiving}
            className="gap-2"
          >
            {isArchiving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Archive
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
            className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete
          </Button>

          <div className="h-5 w-px bg-border" />

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedIds.size} Deal(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the selected deals to the Inactive tab. They can be found there later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkArchive} disabled={isArchiving}>
              {isArchiving ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Permanently Delete {selectedIds.size} Deal(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected deals and all related data (scores, enrichment records). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Active / Inactive Tabs */}
      <Tabs
        value={statusTab}
        onValueChange={(val) => {
          setStatusTab(val as "all" | "active" | "inactive");
          setSelectedIds(new Set());
        }}
      >
        <TabsList>
          <TabsTrigger value="all">
            All ({totalDeals})
          </TabsTrigger>
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
            <Table style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
              <TableHeader>
                <TableRow>
                  {[
                    { key: 'checkbox', content: <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />, noResize: true },
                    { key: 'number', content: '#', noResize: true },
                    { key: 'company', content: <SortHeader column="company_name">Company</SortHeader> },
                    { key: 'description', content: 'Description' },
                    { key: 'industry', content: <SortHeader column="client_name">Industry</SortHeader> },
                    { key: 'contact', content: <SortHeader column="contact_name">Contact</SortHeader> },
                    { key: 'interest', content: <SortHeader column="interest_type">Interest</SortHeader> },
                    { key: 'channel', content: <SortHeader column="outreach_channel">Channel</SortHeader> },
                    { key: 'liCount', content: <SortHeader column="linkedin_employee_count">LI Count</SortHeader> },
                    { key: 'liRange', content: <SortHeader column="linkedin_employee_range">LI Range</SortHeader> },
                    { key: 'reviews', content: <SortHeader column="google_review_count">Reviews</SortHeader> },
                    { key: 'rating', content: <SortHeader column="google_rating">Rating</SortHeader> },
                    { key: 'sourceTab', content: 'Source Tab' },
                    { key: 'score', content: <SortHeader column="score">Score</SortHeader> },
                    { key: 'date', content: <SortHeader column="contact_date">Date</SortHeader> },
                    { key: 'status', content: <SortHeader column="pushed">Status</SortHeader> },
                    { key: 'actions', content: '', noResize: true },
                  ].map(({ key, content, noResize }) => (
                    <TableHead
                      key={key}
                      style={{ width: columnWidths[key], minWidth: 40, maxWidth: columnWidths[key], position: 'relative' }}
                      className="overflow-hidden text-ellipsis whitespace-nowrap"
                    >
                      {content}
                      {!noResize && (
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-10"
                          onMouseDown={(e) => handleResizeStart(key, e)}
                        />
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDeals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={17}
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
                  paginatedDeals.map((deal, index) => (
                    <TableRow
                      key={deal.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors",
                        deal.is_priority_target && "bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/50",
                        !deal.is_priority_target && deal.pushed_to_all_deals && "bg-green-50/60 hover:bg-green-50"
                      )}
                      onClick={() =>
                        navigate(
                          `/admin/remarketing/captarget-deals/${deal.id}`,
                          { state: { from: "/admin/remarketing/captarget-deals" } }
                        )
                      }
                    >
                      <TableCell
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(deal.id, e);
                        }}
                        className="w-[40px] cursor-pointer select-none"
                      >
                        <Checkbox
                          checked={selectedIds.has(deal.id)}
                          onCheckedChange={() => {/* handled by TableCell onClick for shift support */}}
                        />
                      </TableCell>
                      <TableCell className="w-[50px] text-center text-xs text-muted-foreground tabular-nums">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
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
                          {deal.description || deal.executive_summary || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground truncate max-w-[160px] block">
                          {deal.industry || deal.category || "—"}
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
                      <TableCell className="text-center">
                        {(() => {
                          const score = deal.deal_total_score;
                          return score != null ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={cn(
                              "text-sm font-medium px-2 py-0.5 rounded tabular-nums",
                              score >= 80 ? "bg-green-100 text-green-700" :
                              score >= 60 ? "bg-blue-100 text-blue-700" :
                              score >= 40 ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                            )}>
                              {Math.round(score)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        );
                        })()}
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/admin/remarketing/captarget-deals/${deal.id}`, { state: { from: "/admin/remarketing/captarget-deals" } })}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Deal
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEnrichSelected([deal.id], "all")}>
                              <Zap className="h-4 w-4 mr-2" />
                              Enrich Deal
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={async () => {
                                const newValue = !deal.is_priority_target;
                                const { error } = await supabase.from("listings").update({ is_priority_target: newValue } as never).eq("id", deal.id);
                                if (error) { toast({ title: "Error", description: "Failed to update priority" }); }
                                else { toast({ title: newValue ? "Priority Set" : "Priority Removed" }); refetch(); }
                              }}
                              className={deal.is_priority_target ? "text-amber-600" : ""}
                            >
                              <Star className={cn("h-4 w-4 mr-2", deal.is_priority_target && "fill-amber-500")} />
                              {deal.is_priority_target ? "Remove Priority" : "Mark as Priority"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handlePushToAllDeals([deal.id])}
                              disabled={!!deal.pushed_to_all_deals}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve to All Deals
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedIds(new Set([deal.id]));
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Deal
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination + Footer */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredDeals.length)} of {filteredDeals.length} deals
          {filteredDeals.length !== totalDeals && ` (filtered from ${totalDeals})`}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(1)}
            disabled={safePage <= 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-3 tabular-nums flex items-center gap-1">
            Page
            <input
              type="number"
              min={1}
              max={totalPages}
              value={safePage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= totalPages) {
                  setCurrentPage(val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = parseInt((e.target as HTMLInputElement).value, 10);
                  if (!isNaN(val) && val >= 1 && val <= totalPages) {
                    setCurrentPage(val);
                  }
                }
              }}
              className="w-12 h-7 text-center text-sm border border-input rounded-md bg-background tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage >= totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
