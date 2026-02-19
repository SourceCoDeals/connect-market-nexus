import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import {
  Building2,
  ArrowUpDown,
  Sparkles,
  Loader2,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useGlobalGateCheck, useGlobalActivityMutations } from "@/hooks/remarketing/useGlobalActivityQueue";
import { useAuth } from "@/context/AuthContext";

// Sub-components
import { DealsKPICards } from "./components/DealsKPICards";
import { CapTargetSyncBar } from "./components/CapTargetSyncBar";
import { CapTargetExclusionLog } from "./components/CapTargetExclusionLog";
import { CapTargetTableRow } from "./components/CapTargetTableRow";
import { CapTargetBulkActions } from "./components/CapTargetBulkActions";

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
  need_buyer_universe: boolean | null;
  need_owner_contact: boolean | null;
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
  | "google_rating"
  | "priority";
type SortDirection = "asc" | "desc";

export default function CapTargetDeals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  const { completeOperation, updateProgress } = useGlobalActivityMutations();
  const { timeframe, setTimeframe, dateRange, isInRange } = useTimeframe("last_365d");

  // Filters
  const [search, setSearch] = useState("");
  const [pushedFilter, setPushedFilter] = useState<string>("all");
  const [hidePushed, setHidePushed] = useState(false);
  const [sourceTabFilter, setSourceTabFilter] = useState<string>("all");
  const [statusTab, setStatusTab] = useState<"all" | "active" | "inactive">("all");

  // Sorting – persisted in URL so navigating back restores the sort
  const [searchParams, setSearchParams] = useSearchParams();
  const sortColumn = (searchParams.get("sort") as SortColumn) ?? "contact_date";
  const sortDirection = (searchParams.get("dir") as SortDirection) ?? "desc";

  // Column resizing
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    checkbox: 40, number: 50, company: 180, description: 200, industry: 130,
    contact: 120, interest: 80, channel: 100, liCount: 80, liRange: 90,
    reviews: 80, rating: 70, sourceTab: 90, score: 70, date: 80, status: 80,
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

  // Loading states
  const [isPushing, setIsPushing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncAbortRef = useRef<AbortController | null>(null);
  const [syncProgress, setSyncProgress] = useState({ inserted: 0, updated: 0, skipped: 0, excluded: 0, page: 0 });
  const [syncSummaryOpen, setSyncSummaryOpen] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{ inserted: number; updated: number; skipped: number; excluded: number; status: "success" | "error"; message?: string } | null>(null);

  // Cleanup state
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ cleaned: number; total_checked: number; breakdown?: Record<string, number>; sample?: Array<{ company: string; reason: string }> } | null>(null);
  const [cleanupResultOpen, setCleanupResultOpen] = useState(false);
  const [showExclusionLog, setShowExclusionLog] = useState(false);

  // Archive & Delete state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch CapTarget deals
  const { data: deals, isLoading, refetch } = useQuery({
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
          .select(`
            id, title, internal_company_name, captarget_client_name,
            captarget_contact_date, captarget_outreach_channel, captarget_interest_type,
            main_contact_name, main_contact_email, main_contact_title, main_contact_phone,
            captarget_sheet_tab, website, description, owner_response,
            pushed_to_all_deals, pushed_to_all_deals_at, deal_source, status, created_at,
            enriched_at, deal_total_score, linkedin_employee_count, linkedin_employee_range,
            google_rating, google_review_count, captarget_status, is_priority_target,
            need_buyer_universe, need_owner_contact,
            category, executive_summary, industry
          `)
          .eq("deal_source", "captarget")
          .order("captarget_contact_date", { ascending: false, nullsFirst: false })
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

  // Filter deals by everything EXCEPT status tab (for accurate tab counts)
  const preTabFiltered = useMemo(() => {
    if (!deals) return [];
    return deals.filter((deal) => {
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
      if (hidePushed && deal.pushed_to_all_deals) return false;
      if (sourceTabFilter !== "all" && deal.captarget_sheet_tab !== sourceTabFilter) return false;
      if (dateRange.from || dateRange.to) {
        const dateStr = deal.captarget_contact_date || deal.created_at;
        const dealDate = dateStr ? new Date(dateStr) : null;
        if (!dealDate) return false;
        if (dateRange.from && dealDate < dateRange.from) return false;
        if (dateRange.to && dealDate > dateRange.to) return false;
      }
      return true;
    });
  }, [deals, search, pushedFilter, sourceTabFilter, dateRange, hidePushed]);

  const tabItems = useMemo(() => {
    if (statusTab === "all") return preTabFiltered;
    return preTabFiltered.filter((deal) => deal.captarget_status === statusTab);
  }, [preTabFiltered, statusTab]);

  const {
    filteredItems: engineFiltered, filterState, setFilterState,
    activeFilterCount, dynamicOptions, filteredCount, totalCount: engineTotal,
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
        case "interest_type": valA = a.captarget_interest_type || ""; valB = b.captarget_interest_type || ""; break;
        case "outreach_channel": valA = a.captarget_outreach_channel || ""; valB = b.captarget_outreach_channel || ""; break;
        case "contact_date": valA = a.captarget_contact_date || ""; valB = b.captarget_contact_date || ""; break;
        case "pushed": valA = a.pushed_to_all_deals ? 1 : 0; valB = b.pushed_to_all_deals ? 1 : 0; break;
        case "score": valA = a.deal_total_score ?? -1; valB = b.deal_total_score ?? -1; break;
        case "linkedin_employee_count": valA = a.linkedin_employee_count ?? -1; valB = b.linkedin_employee_count ?? -1; break;
        case "linkedin_employee_range": valA = (a.linkedin_employee_range || "").toLowerCase(); valB = (b.linkedin_employee_range || "").toLowerCase(); break;
        case "google_review_count": valA = a.google_review_count ?? -1; valB = b.google_review_count ?? -1; break;
        case "google_rating": valA = a.google_rating ?? -1; valB = b.google_rating ?? -1; break;
        case "priority": valA = a.is_priority_target ? 1 : 0; valB = b.is_priority_target ? 1 : 0; break;
        default: return 0;
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

  useEffect(() => { setCurrentPage(1); }, [filterState, sortColumn, sortDirection]);

  const handleSort = (col: SortColumn) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("sort") === col) {
        next.set("dir", next.get("dir") === "asc" ? "desc" : "asc");
      } else {
        next.set("sort", col);
        next.set("dir", "asc");
      }
      return next;
    }, { replace: true });
  };

  // Selection helpers
  const allSelected = paginatedDeals.length > 0 && paginatedDeals.every((d) => selectedIds.has(d.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginatedDeals.map((d) => d.id)));
  };

  const lastSelectedIndexRef = useRef<number | null>(null);
  const toggleSelect = (id: string, event?: React.MouseEvent) => {
    const currentIndex = paginatedDeals.findIndex((d) => d.id === id);
    if (event?.shiftKey && lastSelectedIndexRef.current !== null && currentIndex !== -1) {
      const start = Math.min(lastSelectedIndexRef.current, currentIndex);
      const end = Math.max(lastSelectedIndexRef.current, currentIndex);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(paginatedDeals[i].id);
        return next;
      });
      lastSelectedIndexRef.current = currentIndex;
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    lastSelectedIndexRef.current = currentIndex;
  };

  // Push to All Deals (approve)
  const handlePushToAllDeals = useCallback(async (dealIds: string[]) => {
    if (dealIds.length === 0) return;
    setIsPushing(true);
    const { error } = await supabase.from("listings")
      .update({ status: "active", pushed_to_all_deals: true, pushed_to_all_deals_at: new Date().toISOString() } as never)
      .in("id", dealIds);
    setIsPushing(false);
    setSelectedIds(new Set());
    if (error) { toast({ title: "Error", description: "Failed to approve deals" }); }
    else { toast({ title: "Approved", description: `${dealIds.length} deal${dealIds.length !== 1 ? "s" : ""} pushed to All Deals.` }); }
    queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
    queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
  }, [toast, queryClient]);

  // Bulk Enrich
  const handleBulkEnrich = useCallback(async (mode: "unenriched" | "all") => {
    if (!deals?.length) return;
    const targets = mode === "unenriched" ? deals.filter((d) => !d.enriched_at) : deals;
    if (!targets.length) { sonnerToast.info("No deals to enrich"); return; }
    setIsEnriching(true);

    let activityItem: { id: string } | null = null;
    try {
      const result = await startOrQueueMajorOp({ operationType: "deal_enrichment", totalItems: targets.length, description: `Enriching ${targets.length} CapTarget deals`, userId: user?.id || "", contextJson: { source: "captarget" } });
      activityItem = result.item;
    } catch { /* Non-blocking */ }

    const now = new Date().toISOString();
    const seen = new Set<string>();
    const rows = targets.filter((d) => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
      .map((d) => ({ listing_id: d.id, status: "pending" as const, attempts: 0, queued_at: now }));

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from("enrichment_queue").upsert(chunk, { onConflict: "listing_id" });
      if (error) {
        console.error("Queue upsert error:", error);
        sonnerToast.error(`Failed to queue enrichment (batch ${Math.floor(i / CHUNK) + 1})`);
        if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
        setIsEnriching(false);
        return;
      }
    }
    sonnerToast.success(`Queued ${targets.length} deals for enrichment`);

    try {
      const { data: result } = await supabase.functions.invoke("process-enrichment-queue", { body: { source: "captarget_bulk" } });
      if (result?.synced > 0 || result?.processed > 0) {
        const totalDone = (result?.synced || 0) + (result?.processed || 0);
        if (activityItem) updateProgress.mutate({ id: activityItem.id, completedItems: totalDone });
        if (result?.processed === 0) {
          sonnerToast.success(`All ${result.synced} deals were already enriched`);
          if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "completed" });
        }
      }
    } catch { /* Non-blocking */ }

    setIsEnriching(false);
    queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
  }, [deals, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient]);

  // Bulk Score
  const handleBulkScore = useCallback(async (mode: "unscored" | "all") => {
    if (!deals?.length) return;
    const totalCount = mode === "unscored" ? deals.filter((d) => d.deal_total_score == null).length : deals.length;
    if (!totalCount) { sonnerToast.info("No deals to score"); return; }
    setIsScoring(true);

    let activityItem: { id: string } | null = null;
    try {
      const result = await startOrQueueMajorOp({ operationType: "deal_enrichment", totalItems: totalCount, description: `Scoring ${totalCount} CapTarget deals`, userId: user?.id || "", contextJson: { source: "captarget_scoring" } });
      activityItem = result.item;
    } catch { /* Non-blocking */ }

    sonnerToast.info(`Scoring ${totalCount} deals in background...`);
    try {
      await supabase.functions.invoke("calculate-deal-quality", {
        body: { batchSource: "captarget", unscoredOnly: mode === "unscored", globalQueueId: activityItem?.id },
      });
    } catch (err) {
      console.error("Scoring invocation failed:", err);
      sonnerToast.error("Failed to start scoring");
      if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
    }

    const refreshInterval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
    }, 10000);
    setTimeout(() => clearInterval(refreshInterval), 20 * 60 * 1000);
    setIsScoring(false);
  }, [deals, user, startOrQueueMajorOp, completeOperation, queryClient]);

  // Enrich selected deals
  const handleEnrichSelected = useCallback(async (dealIds: string[], mode: "all" | "unenriched" = "all") => {
    if (dealIds.length === 0) return;
    let targetIds = dealIds;
    if (mode === "unenriched" && filteredDeals) {
      const enrichedSet = new Set(filteredDeals.filter((d) => d.enriched_at).map((d) => d.id));
      targetIds = dealIds.filter((id) => !enrichedSet.has(id));
      if (targetIds.length === 0) { sonnerToast.info("All selected deals are already enriched"); return; }
    }
    setIsEnriching(true);

    let activityItem: { id: string } | null = null;
    try {
      const result = await startOrQueueMajorOp({ operationType: "deal_enrichment", totalItems: targetIds.length, description: `Enriching ${targetIds.length} CapTarget deals`, userId: user?.id || "", contextJson: { source: "captarget_selected" } });
      activityItem = result.item;
    } catch { /* Non-blocking */ }

    const now = new Date().toISOString();
    try { await supabase.functions.invoke("process-enrichment-queue", { body: { action: "cancel_pending", before: now } }); } catch { /* Non-blocking */ }

    const seen = new Set<string>();
    const rows = targetIds.filter((id) => { if (seen.has(id)) return false; seen.add(id); return true; })
      .map((id) => ({ listing_id: id, status: "pending" as const, attempts: 0, queued_at: now }));

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from("enrichment_queue").upsert(chunk, { onConflict: "listing_id" });
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

    try {
      const { data: result } = await supabase.functions.invoke("process-enrichment-queue", { body: { source: "captarget_selected" } });
      if (result?.synced > 0 || result?.processed > 0) {
        const totalDone = (result?.synced || 0) + (result?.processed || 0);
        if (activityItem) updateProgress.mutate({ id: activityItem.id, completedItems: totalDone });
      }
    } catch { /* Non-blocking */ }

    setIsEnriching(false);
    queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
  }, [user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient, supabase, filteredDeals]);

  // LinkedIn + Google only enrichment
  const handleExternalOnlyEnrich = useCallback(async () => {
    setIsEnriching(true);
    let activityItem: { id: string } | null = null;
    try {
      const missingCount = deals?.filter(d => d.enriched_at && !d.linkedin_employee_count && !d.google_review_count).length || 0;
      const result = await startOrQueueMajorOp({ operationType: "deal_enrichment", totalItems: missingCount || 1, description: `LinkedIn + Google enrichment for CapTarget deals`, userId: user?.id || "", contextJson: { source: "captarget_external_only" } });
      activityItem = result.item;
    } catch { /* Non-blocking */ }

    try {
      const { data: result, error } = await supabase.functions.invoke("enrich-external-only", { body: { dealSource: "captarget", mode: "missing" } });
      if (error) {
        sonnerToast.error("Failed to start LinkedIn/Google enrichment");
        if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
      } else {
        sonnerToast.success(`Queued ${result?.total || 0} deals for LinkedIn + Google enrichment`, { description: "This runs much faster than full enrichment — no website re-scraping" });
      }
    } catch { sonnerToast.error("Failed to invoke external enrichment"); }

    setIsEnriching(false);
    queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
  }, [deals, user, startOrQueueMajorOp, completeOperation, queryClient]);

  // Archive selected deals
  const handleBulkArchive = useCallback(async () => {
    setIsArchiving(true);
    try {
      const dealIds = Array.from(selectedIds);
      const { error } = await supabase.from('listings').update({ captarget_status: 'inactive' } as any).in('id', dealIds);
      if (error) throw error;
      toast({ title: 'Deals Archived', description: `${dealIds.length} deal(s) have been moved to Inactive` });
      setSelectedIds(new Set());
      setShowArchiveDialog(false);
      await queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Archive Failed', description: err.message });
    } finally { setIsArchiving(false); }
  }, [selectedIds, toast, queryClient]);

  // Permanently delete selected deals
  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const dealIds = Array.from(selectedIds);
      for (const dealId of dealIds) {
        await supabase.from('enrichment_queue').delete().eq('listing_id', dealId);
        await supabase.from('remarketing_scores').delete().eq('listing_id', dealId);
        await supabase.from('buyer_deal_scores').delete().eq('deal_id', dealId);
      }
      const { error } = await supabase.from('listings').delete().in('id', dealIds);
      if (error) throw error;
      toast({ title: 'Deals Deleted', description: `${dealIds.length} deal(s) have been permanently deleted` });
      setSelectedIds(new Set());
      setShowDeleteDialog(false);
      await queryClient.invalidateQueries({ queryKey: ["remarketing", "captarget-deals"] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: err.message });
    } finally { setIsDeleting(false); }
  }, [selectedIds, toast, queryClient]);

  // KPI stats
  const dateFilteredDeals = useMemo(() => {
    if (!deals) return [];
    return deals.filter((d) => isInRange(d.captarget_contact_date || d.created_at));
  }, [deals, isInRange]);

  const kpiStats = useMemo(() => {
    const totalDeals = dateFilteredDeals.length;
    const priorityDeals = dateFilteredDeals.filter((d) => d.is_priority_target === true).length;
    let totalScore = 0; let scoredDeals = 0;
    dateFilteredDeals.forEach((d) => { const score = d.deal_total_score; if (score != null) { totalScore += score; scoredDeals++; } });
    const avgScore = scoredDeals > 0 ? Math.round(totalScore / scoredDeals) : 0;
    const needsScoring = dateFilteredDeals.filter((d) => d.deal_total_score == null).length;
    return { totalDeals, priorityDeals, avgScore, needsScoring };
  }, [dateFilteredDeals]);

  // Exclusion log query
  const { data: exclusionLog } = useQuery({
    queryKey: ["captarget-exclusion-log"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("captarget_sync_exclusions")
        .select("id, company_name, exclusion_reason, exclusion_category, source, excluded_at")
        .order("excluded_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    setShowCleanupDialog(false);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-captarget-deals", { body: { confirm: true } });
      if (error) throw error;
      setCleanupResult(data);
      setCleanupResultOpen(true);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["captarget-exclusion-log"] });
    } catch (e: any) {
      sonnerToast.error("Cleanup failed", { description: e.message });
    } finally { setIsCleaningUp(false); }
  };

  // Sync handler
  const handleSync = async () => {
    const abortCtrl = new AbortController();
    syncAbortRef.current = abortCtrl;
    setIsSyncing(true);
    setSyncProgress({ inserted: 0, updated: 0, skipped: 0, excluded: 0, page: 0 });
    let totalInserted = 0, totalUpdated = 0, totalSkipped = 0, totalExcluded = 0, pageNum = 0;
    let page = { startTab: 0, startRow: 0 };
    try {
      let hasMore = true;
      while (hasMore) {
        if (abortCtrl.signal.aborted) {
          setSyncSummary({ inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped, excluded: totalExcluded, status: "success", message: "Sync cancelled by user" });
          setSyncSummaryOpen(true);
          refetch();
          return;
        }
        pageNum++;
        const { data, error } = await supabase.functions.invoke('sync-captarget-sheet', { body: page });
        if (error) throw error;
        totalInserted += data?.rows_inserted ?? 0;
        totalUpdated += data?.rows_updated ?? 0;
        totalSkipped += data?.rows_skipped ?? 0;
        totalExcluded += data?.rows_excluded ?? 0;
        setSyncProgress({ inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped, excluded: totalExcluded, page: pageNum });
        hasMore = data?.hasMore === true;
        if (hasMore) page = { startTab: data.nextTab, startRow: data.nextRow };
      }
      setSyncSummary({ inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped, excluded: totalExcluded, status: "success" });
      setSyncSummaryOpen(true);
      refetch();
    } catch (e: any) {
      setSyncSummary({ inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped, excluded: totalExcluded, status: "error", message: e.message });
      setSyncSummaryOpen(true);
    } finally {
      setIsSyncing(false);
      syncAbortRef.current = null;
    }
  };

  // Summary stats
  const totalDeals = deals?.length || 0;
  const unpushedCount = deals?.filter((d) => !d.pushed_to_all_deals).length || 0;
  const interestCount = deals?.filter((d) => d.captarget_interest_type === "interest").length || 0;
  const enrichedCount = deals?.filter((d) => d.enriched_at).length || 0;
  const scoredCount = deals?.filter((d) => d.deal_total_score != null).length || 0;

  const filteredTotal = preTabFiltered.length;
  const activeCount = useMemo(() => preTabFiltered.filter((d) => d.captarget_status === "active").length, [preTabFiltered]);
  const inactiveCount = useMemo(() => preTabFiltered.filter((d) => d.captarget_status === "inactive").length, [preTabFiltered]);

  const SortHeader = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => (
    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort(column)}>
      {children}
      <ArrowUpDown className={cn("h-3 w-3", sortColumn === column ? "text-foreground" : "text-muted-foreground/50")} />
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
          <h1 className="text-2xl font-bold text-foreground">CapTarget Deals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalDeals} total &middot; {unpushedCount} un-pushed &middot;{" "}
            {interestCount} interest &middot; {enrichedCount} enriched &middot; {scoredCount} scored
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CapTargetSyncBar
            isSyncing={isSyncing}
            syncProgress={syncProgress}
            syncSummaryOpen={syncSummaryOpen}
            setSyncSummaryOpen={setSyncSummaryOpen}
            syncSummary={syncSummary}
            onSync={handleSync}
            onCancelSync={() => syncAbortRef.current?.abort()}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isEnriching}>
                {isEnriching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Enrich
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBulkEnrich("unenriched")}>Enrich Unenriched</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkEnrich("all")}>Re-enrich All</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExternalOnlyEnrich}>LinkedIn + Google Only</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isScoring}>
                {isScoring ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-1" />}
                Score
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBulkScore("unscored")}>Score Unscored</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkScore("all")}>Recalculate All</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <TimeframeSelector value={timeframe} onChange={setTimeframe} compact />
        </div>
      </div>

      {/* KPI Stats Cards */}
      <DealsKPICards totalDeals={kpiStats.totalDeals} priorityDeals={kpiStats.priorityDeals} avgScore={kpiStats.avgScore} needsScoring={kpiStats.needsScoring} />

      {/* Exclusion Log */}
      <CapTargetExclusionLog
        exclusionLog={exclusionLog || []}
        showExclusionLog={showExclusionLog}
        setShowExclusionLog={setShowExclusionLog}
        isCleaningUp={isCleaningUp}
        showCleanupDialog={showCleanupDialog}
        setShowCleanupDialog={setShowCleanupDialog}
        onCleanup={handleCleanup}
        cleanupResultOpen={cleanupResultOpen}
        setCleanupResultOpen={setCleanupResultOpen}
        cleanupResult={cleanupResult}
      />

      {/* Filters */}
      <FilterBar filterState={filterState} onFilterStateChange={setFilterState} fieldDefinitions={CAPTARGET_FIELDS} dynamicOptions={dynamicOptions} totalCount={engineTotal} filteredCount={filteredCount} />

      {/* Hide Pushed Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setHidePushed(h => !h)}
          className={cn(
            "flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors",
            hidePushed
              ? "bg-primary/10 border-primary/30 text-primary font-medium"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <span className="text-xs">🙈</span>
          {hidePushed ? "Showing Un-Pushed Only" : "Hide Pushed"}
        </button>
      </div>

      {/* Bulk Actions */}
      <CapTargetBulkActions
        selectedIds={selectedIds}
        deals={deals}
        isPushing={isPushing}
        isEnriching={isEnriching}
        isArchiving={isArchiving}
        isDeleting={isDeleting}
        onPushToAllDeals={handlePushToAllDeals}
        onEnrichSelected={handleEnrichSelected}
        onClearSelection={() => setSelectedIds(new Set())}
        onRefetch={refetch}
        showArchiveDialog={showArchiveDialog}
        setShowArchiveDialog={setShowArchiveDialog}
        onBulkArchive={handleBulkArchive}
        showDeleteDialog={showDeleteDialog}
        setShowDeleteDialog={setShowDeleteDialog}
        onBulkDelete={handleBulkDelete}
      />

      {/* Active / Inactive Tabs */}
      <Tabs value={statusTab} onValueChange={(val) => { setStatusTab(val as "all" | "active" | "inactive"); setSelectedIds(new Set()); }}>
        <TabsList>
          <TabsTrigger value="all">All ({filteredTotal})</TabsTrigger>
          <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({inactiveCount})</TabsTrigger>
        </TabsList>
        <TabsContent value={statusTab} forceMount>
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
                    { key: 'priority', content: <SortHeader column="priority">Priority</SortHeader> },
                    { key: 'actions', content: '', noResize: true },
                  ].map(({ key, content, noResize }) => (
                    <TableHead
                      key={key}
                      style={{ width: columnWidths[key], minWidth: 40, maxWidth: columnWidths[key], position: 'relative' }}
                      className="overflow-hidden text-ellipsis whitespace-nowrap"
                    >
                      {content}
                      {!noResize && (
                        <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-10" onMouseDown={(e) => handleResizeStart(key, e)} />
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDeals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={17} className="text-center py-12 text-muted-foreground">
                      <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                      <p className="font-medium">No CapTarget deals found</p>
                      <p className="text-sm mt-1">Deals will appear here after the sync runs.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDeals.map((deal, index) => (
                    <CapTargetTableRow
                      key={deal.id}
                      deal={deal}
                      index={index}
                      pageOffset={(safePage - 1) * PAGE_SIZE}
                      isSelected={selectedIds.has(deal.id)}
                      onToggleSelect={toggleSelect}
                      onPushToAllDeals={handlePushToAllDeals}
                      onEnrichSelected={handleEnrichSelected}
                      onDeleteDeal={(id) => { setSelectedIds(new Set([id])); setShowDeleteDialog(true); }}
                      onArchiveDeal={async (id) => {
                        const { error } = await supabase
                          .from('listings')
                          .update({ status: 'archived' } as never)
                          .eq('id', id);
                        if (error) {
                          toast({ title: "Error", description: error.message, variant: "destructive" });
                        } else {
                          toast({ title: "Deal archived", description: "Deal has been archived" });
                          refetch();
                        }
                      }}
                      onRefetch={refetch}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredDeals.length)} of {filteredDeals.length} deals
          {filteredDeals.length !== totalDeals && ` (filtered from ${totalDeals})`}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(1)} disabled={safePage <= 1}><ChevronsLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm px-3 tabular-nums flex items-center gap-1">
            Page
            <input
              type="number" min={1} max={totalPages} value={safePage}
              onChange={(e) => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { const val = parseInt((e.target as HTMLInputElement).value, 10); if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val); } }}
              className="w-12 h-7 text-center text-sm border border-input rounded-md bg-background tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            of {totalPages}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(totalPages)} disabled={safePage >= totalPages}><ChevronsRight className="h-4 w-4" /></Button>
        </div>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
