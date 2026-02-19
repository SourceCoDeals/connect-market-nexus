import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { formatCompactCurrency } from "@/lib/utils";
import { DealImportDialog } from "@/components/remarketing/DealImportDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { useTimeframe } from "@/hooks/use-timeframe";
import { useFilterEngine } from "@/hooks/use-filter-engine";
import { FilterBar, TimeframeSelector, GP_PARTNER_FIELDS } from "@/components/filters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import {
  Building2,
  ArrowUpDown,
  CheckCircle2,
  Sparkles,
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
  Plus,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  XCircle,
  MoreHorizontal,
  ExternalLink,
  Zap,
  Archive,
  Download,
  Users,
  Phone,
  EyeOff,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { exportDealsToCSV } from "@/lib/exportUtils";
import { useGlobalGateCheck, useGlobalActivityMutations } from "@/hooks/remarketing/useGlobalActivityQueue";
import { useAuth } from "@/context/AuthContext";
import { useAdminProfiles } from "@/hooks/admin/use-admin-profiles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GPPartnerDeal {
  id: string;
  title: string | null;
  internal_company_name: string | null;
  main_contact_name: string | null;
  main_contact_email: string | null;
  main_contact_title: string | null;
  main_contact_phone: string | null;
  website: string | null;
  description: string | null;
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
  is_priority_target: boolean | null;
  need_buyer_universe: boolean | null;
  need_owner_contact: boolean | null;
  category: string | null;
  executive_summary: string | null;
  industry: string | null;
  revenue: number | null;
  ebitda: number | null;
  location: string | null;
  address_city: string | null;
  address_state: string | null;
  deal_owner_id: string | null;
  deal_owner: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
}

type SortColumn =
  | "company_name"
  | "industry"
  | "owner"
  | "revenue"
  | "ebitda"
  | "score"
  | "linkedin_employee_count"
  | "linkedin_employee_range"
  | "google_review_count"
  | "google_rating"
  | "created_at"
  | "pushed"
  | "priority";
type SortDirection = "asc" | "desc";

export default function GPPartnerDeals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  const { completeOperation, updateProgress } = useGlobalActivityMutations();

  // Admin profiles for deal owner assignment
  const { data: adminProfiles } = useAdminProfiles();

  // Filters
  const { timeframe, setTimeframe, isInRange } = useTimeframe("all_time");

  // Sorting – persisted in URL so going back restores the sort
  const [searchParams, setSearchParams] = useSearchParams();
  const sortColumn = (searchParams.get("sort") as SortColumn) ?? "created_at";
  const sortDirection = (searchParams.get("dir") as SortDirection) ?? "desc";

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Hide pushed toggle
  const [hidePushed, setHidePushed] = useState(false);

  // Pagination
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  // Action states
  const [isPushing, setIsPushing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);

  // Add deal dialog
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [isAddingDeal, setIsAddingDeal] = useState(false);
  const [newDeal, setNewDeal] = useState({
    company_name: "",
    website: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    contact_title: "",
    industry: "",
    description: "",
    location: "",
    revenue: "",
    ebitda: "",
  });

  // CSV upload dialog
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);

  // Fetch GP Partner deals
  const {
    data: deals,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["remarketing", "gp-partner-deals"],
    refetchOnMount: "always",
    staleTime: 30_000,
    queryFn: async () => {
      const allData: GPPartnerDeal[] = [];
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
            main_contact_name,
            main_contact_email,
            main_contact_title,
            main_contact_phone,
            website,
            description,
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
            is_priority_target,
            need_buyer_universe,
            need_owner_contact,
            category,
            executive_summary,
            industry,
            revenue,
            ebitda,
            location,
            address_city,
            address_state,
            deal_owner_id,
            deal_owner:profiles!listings_deal_owner_id_fkey(id, first_name, last_name, email)
          `
          )
          .eq("deal_source", "gp_partners")
          .order("created_at", { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...(data as GPPartnerDeal[]));
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
  // Shared filter engine
  const {
    filteredItems: engineFiltered,
    filterState,
    setFilterState,
    activeFilterCount,
    dynamicOptions,
    filteredCount,
    totalCount: engineTotal,
  } = useFilterEngine(deals ?? [], GP_PARTNER_FIELDS);

  // Sort the engine-filtered results
  const filteredDeals = useMemo(() => {
    let items = [...engineFiltered];
    if (hidePushed) items = items.filter((d) => !d.pushed_to_all_deals);
    const sorted = items;
    sorted.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "company_name":
          valA = (a.internal_company_name || a.title || "").toLowerCase();
          valB = (b.internal_company_name || b.title || "").toLowerCase();
          break;
        case "industry":
          valA = (a.industry || a.category || "").toLowerCase();
          valB = (b.industry || b.category || "").toLowerCase();
          break;
        case "owner":
          valA = (a.deal_owner?.first_name || a.deal_owner?.email || "").toLowerCase();
          valB = (b.deal_owner?.first_name || b.deal_owner?.email || "").toLowerCase();
          break;
        case "revenue":
          valA = a.revenue ?? -1;
          valB = b.revenue ?? -1;
          break;
        case "ebitda":
          valA = a.ebitda ?? -1;
          valB = b.ebitda ?? -1;
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
        case "created_at":
          valA = a.created_at || "";
          valB = b.created_at || "";
          break;
        case "pushed":
          valA = a.pushed_to_all_deals ? 1 : 0;
          valB = b.pushed_to_all_deals ? 1 : 0;
          break;
        case "priority":
          valA = a.is_priority_target ? 1 : 0;
          valB = b.is_priority_target ? 1 : 0;
          break;
        default:
          return 0;
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [engineFiltered, sortColumn, sortDirection, hidePushed]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredDeals.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedDeals = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredDeals.slice(start, start + PAGE_SIZE);
  }, [filteredDeals, safePage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterState, sortColumn, sortDirection]);

  const handleSort = (col: SortColumn) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (sortColumn === col) {
        next.set("dir", sortDirection === "asc" ? "desc" : "asc");
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
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedDeals.map((d) => d.id)));
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

      queryClient.invalidateQueries({ queryKey: ["remarketing", "gp-partner-deals"] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    },
    [toast, queryClient]
  );

  // Bulk Enrich
  const handleBulkEnrich = useCallback(
    async (mode: "unenriched" | "all") => {
      if (!filteredDeals?.length) return;
      const targets = mode === "unenriched"
        ? filteredDeals.filter((d) => !d.enriched_at)
        : filteredDeals;

      if (!targets.length) {
        sonnerToast.info("No deals to enrich");
        return;
      }

      setIsEnriching(true);

      let activityItem: { id: string } | null = null;
      try {
        const result = await startOrQueueMajorOp({
          operationType: "deal_enrichment",
          totalItems: targets.length,
          description: `Enriching ${targets.length} GP Partner deals`,
          userId: user?.id || "",
          contextJson: { source: "gp_partners" },
        });
        activityItem = result.item;
      } catch {
        // Non-blocking
      }

      const now = new Date().toISOString();
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

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("enrichment_queue")
          .upsert(chunk, { onConflict: "listing_id" });

        if (error) {
          console.error("Queue upsert error:", error);
          sonnerToast.error(`Failed to queue enrichment`);
          if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
          setIsEnriching(false);
          return;
        }
      }

      sonnerToast.success(`Queued ${targets.length} deals for enrichment`);

      try {
        const { data: result } = await supabase.functions
          .invoke("process-enrichment-queue", { body: { source: "gp_partners_bulk" } });

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
      queryClient.invalidateQueries({ queryKey: ["remarketing", "gp-partner-deals"] });
    },
    [filteredDeals, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient]
  );

  // Bulk Score
  const handleBulkScore = useCallback(
    async (mode: "unscored" | "all") => {
      if (!filteredDeals?.length) return;
      const targets = mode === "unscored"
        ? filteredDeals.filter((d) => d.deal_total_score == null)
        : filteredDeals;

      if (!targets.length) {
        sonnerToast.info("No deals to score");
        return;
      }

      setIsScoring(true);

      let activityItem: { id: string } | null = null;
      try {
        const result = await startOrQueueMajorOp({
          operationType: "deal_enrichment",
          totalItems: targets.length,
          description: `Scoring ${targets.length} GP Partner deals`,
          userId: user?.id || "",
          contextJson: { source: "gp_partners_scoring" },
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
      queryClient.invalidateQueries({ queryKey: ["remarketing", "gp-partner-deals"] });
    },
    [filteredDeals, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient]
  );

  // Enrich selected deals
  const handleEnrichSelected = useCallback(
    async (dealIds: string[]) => {
      if (dealIds.length === 0) return;
      setIsEnriching(true);

      let activityItem: { id: string } | null = null;
      try {
        const result = await startOrQueueMajorOp({
          operationType: "deal_enrichment",
          totalItems: dealIds.length,
          description: `Enriching ${dealIds.length} GP Partner deals`,
          userId: user?.id || "",
          contextJson: { source: "gp_partners_selected" },
        });
        activityItem = result.item;
      } catch {
        // Non-blocking
      }

      const now = new Date().toISOString();

      try {
        await supabase.functions.invoke("process-enrichment-queue", {
          body: { action: "cancel_pending", before: now },
        });
      } catch {
        // Non-blocking
      }

      const seen = new Set<string>();
      const rows = dealIds
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

      try {
        const { data: result } = await supabase.functions
          .invoke("process-enrichment-queue", { body: { source: "gp_partners_selected" } });

        if (result?.synced > 0 || result?.processed > 0) {
          const totalDone = (result?.synced || 0) + (result?.processed || 0);
          if (activityItem) updateProgress.mutate({ id: activityItem.id, completedItems: totalDone });
        }
      } catch {
        // Non-blocking
      }

      setIsEnriching(false);
      queryClient.invalidateQueries({ queryKey: ["remarketing", "gp-partner-deals"] });
    },
    [user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient]
  );

  // Add single deal
  const handleAddDeal = useCallback(async () => {
    if (!newDeal.company_name.trim()) {
      sonnerToast.error("Company name is required");
      return;
    }

    setIsAddingDeal(true);

    let website = newDeal.website.trim();
    if (website && !website.startsWith("http://") && !website.startsWith("https://")) {
      website = `https://${website}`;
    }

    const { data, error } = await supabase
      .from("listings")
      .insert({
        title: newDeal.company_name.trim(),
        internal_company_name: newDeal.company_name.trim(),
        website: website || null,
        main_contact_name: newDeal.contact_name.trim() || null,
        main_contact_email: newDeal.contact_email.trim() || null,
        main_contact_phone: newDeal.contact_phone.trim() || null,
        main_contact_title: newDeal.contact_title.trim() || null,
        industry: newDeal.industry.trim() || null,
        description: newDeal.description.trim() || null,
        location: newDeal.location.trim() || null,
        revenue: newDeal.revenue ? parseFloat(newDeal.revenue) : null,
        ebitda: newDeal.ebitda ? parseFloat(newDeal.ebitda) : null,
        deal_source: "gp_partners",
        status: "active",
        is_internal_deal: true,
        pushed_to_all_deals: false,
      } as never)
      .select("id")
      .single();

    setIsAddingDeal(false);

    if (error) {
      sonnerToast.error(`Failed to add deal: ${error.message}`);
    } else {
      sonnerToast.success("Deal added successfully");
      setAddDealOpen(false);
      setNewDeal({
        company_name: "", website: "", contact_name: "", contact_email: "",
        contact_phone: "", contact_title: "", industry: "", description: "",
        location: "", revenue: "", ebitda: "",
      });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "gp-partner-deals"] });

      // Queue for enrichment if website provided
      if (website && data?.id) {
        try {
          await supabase.from("enrichment_queue").upsert({
            listing_id: data.id,
            status: "pending",
            attempts: 0,
            queued_at: new Date().toISOString(),
          }, { onConflict: "listing_id" });
          await supabase.functions.invoke("process-enrichment-queue", {
            body: { source: "gp_partners_add" },
          });
        } catch {
          // Non-blocking
        }
      }
    }
  }, [newDeal, queryClient]);
  // CSV import handled by DealImportDialog
  const handleImportComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["remarketing", "gp-partner-deals"] });
    queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    setCsvUploadOpen(false);
  }, [queryClient]);

  // Assign deal owner
  const handleAssignOwner = useCallback(async (dealId: string, ownerId: string | null) => {
    const ownerProfile = ownerId && adminProfiles ? adminProfiles[ownerId] : null;
    queryClient.setQueryData(["remarketing", "gp-partner-deals"], (old: GPPartnerDeal[] | undefined) =>
      old?.map(deal =>
        deal.id === dealId ? {
          ...deal,
          deal_owner_id: ownerId,
          deal_owner: ownerProfile ? { id: ownerProfile.id, first_name: ownerProfile.first_name, last_name: ownerProfile.last_name, email: ownerProfile.email } : null,
        } : deal
      )
    );

    const { error } = await supabase
      .from('listings')
      .update({ deal_owner_id: ownerId })
      .eq('id', dealId);

    if (error) {
      queryClient.invalidateQueries({ queryKey: ["remarketing", "gp-partner-deals"] });
      sonnerToast.error("Failed to update deal owner");
      return;
    }
    sonnerToast.success(ownerId ? "Owner assigned" : "Owner removed");
  }, [adminProfiles, queryClient]);

  const dateFilteredDeals = useMemo(() => {
    if (!deals) return [];
    return deals.filter((d) => isInRange(d.created_at));
  }, [deals, isInRange]);

  // KPI Stats
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
            GP Partner Deals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalDeals} total &middot; {unpushedCount} un-pushed &middot;{" "}
            {enrichedCount} enriched &middot; {scoredCount} scored
          </p>
        </div>

        {/* Global bulk actions */}
        <div className="flex items-center gap-2">
          {/* Add Deal */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddDealOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Deal
          </Button>

          {/* CSV Upload */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCsvUploadOpen(true)}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Import CSV
          </Button>

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
              <div className="p-2 bg-orange-100 rounded-lg">
                <Building2 className="h-5 w-5 text-orange-600" />
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
        fieldDefinitions={GP_PARTNER_FIELDS}
        dynamicOptions={dynamicOptions}
        totalCount={engineTotal}
        filteredCount={filteredCount}
      />

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
          <EyeOff className="h-3.5 w-3.5" />
          {hidePushed ? "Showing Un-Pushed Only" : "Hide Pushed"}
        </button>
      </div>

      {/* Bulk Actions (selection-based) */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Badge variant="secondary" className="text-sm font-medium">
            {selectedIds.size} selected
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            <XCircle className="h-4 w-4 mr-1" />
            Clear
          </Button>

          <div className="h-5 w-px bg-border" />

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
          {(() => {
            const dealIds = Array.from(selectedIds);
            const allPriority = dealIds.length > 0 && dealIds.every(id => filteredDeals?.find(d => d.id === id)?.is_priority_target);
            return (
              <Button
                size="sm"
                variant="outline"
                className={cn("gap-2", allPriority ? "text-muted-foreground" : "text-amber-600 border-amber-200 hover:bg-amber-50")}
                onClick={async () => {
                  const newValue = !allPriority;
                  const { error } = await supabase
                    .from("listings")
                    .update({ is_priority_target: newValue } as never)
                    .in("id", dealIds);
                  if (error) {
                    sonnerToast.error("Failed to update priority");
                  } else {
                    sonnerToast.success(newValue ? `${dealIds.length} deal(s) marked as priority` : `${dealIds.length} deal(s) priority removed`);
                    setSelectedIds(new Set());
                    queryClient.invalidateQueries({ queryKey: ["remarketing", "gp-partner-deals"] });
                  }
                }}
              >
                <Star className={cn("h-4 w-4", allPriority ? "" : "fill-amber-500")} />
                {allPriority ? "Remove Priority" : "Mark as Priority"}
              </Button>
            );
          })()}
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={async () => {
              const ids = Array.from(selectedIds);
              const result = await exportDealsToCSV(ids);
              if (result.success) {
                sonnerToast.success(`${result.count} deal(s) exported to CSV`);
              } else {
                sonnerToast.error(result.error || "Export failed");
              }
            }}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      )}

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
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead>
                    <SortHeader column="company_name">Company</SortHeader>
                  </TableHead>
                  <TableHead className="max-w-[200px]">Description</TableHead>
                  <TableHead>
                    <SortHeader column="industry">Industry</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="owner">Deal Owner</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="revenue">Revenue</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="ebitda">EBITDA</SortHeader>
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
                  <TableHead>
                    <SortHeader column="score">Quality</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="created_at">Added</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="pushed">Status</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="priority">Priority</SortHeader>
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
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
                      <p className="font-medium">No GP Partner deals yet</p>
                      <p className="text-sm mt-1">
                        Add deals manually or import a CSV spreadsheet.
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <Button size="sm" variant="outline" onClick={() => setAddDealOpen(true)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Deal
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setCsvUploadOpen(true)}>
                          <FileSpreadsheet className="h-4 w-4 mr-1" />
                          Import CSV
                        </Button>
                      </div>
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
                          `/admin/remarketing/gp-partner-deals/${deal.id}`,
                          { state: { from: "/admin/remarketing/gp-partner-deals" } }
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
                      <TableCell className="w-[50px] text-center text-xs text-muted-foreground tabular-nums">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground truncate max-w-[220px]">
                            {deal.internal_company_name || deal.title || "\u2014"}
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
                          {deal.description || deal.executive_summary || "\u2014"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground truncate max-w-[160px] block">
                          {deal.industry || deal.category || "\u2014"}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={deal.deal_owner_id || "__none"}
                          onValueChange={(val) => handleAssignOwner(deal.id, val === "__none" ? null : val)}
                        >
                          <SelectTrigger className="h-7 text-xs border-dashed w-[120px]">
                            <SelectValue placeholder="Assign...">
                              {deal.deal_owner?.first_name
                                ? `${deal.deal_owner.first_name} ${deal.deal_owner.last_name || ''}`.trim()
                                : <span className="text-muted-foreground">Assign...</span>
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">
                              <span className="text-muted-foreground">Unassigned</span>
                            </SelectItem>
                            {adminProfiles && Object.values(adminProfiles).map((admin) => (
                              <SelectItem key={admin.id} value={admin.id}>
                                {admin.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {deal.revenue != null && deal.revenue !== 0 ? (
                          <span className="text-sm tabular-nums">{formatCompactCurrency(deal.revenue)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.ebitda != null && deal.ebitda !== 0 ? (
                          <span className="text-sm tabular-nums">{formatCompactCurrency(deal.ebitda)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.linkedin_employee_count != null ? (
                          <span className="text-sm tabular-nums">{deal.linkedin_employee_count.toLocaleString()}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.linkedin_employee_range ? (
                          <span className="text-sm">{deal.linkedin_employee_range}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.google_review_count != null ? (
                          <span className="text-sm tabular-nums">{deal.google_review_count.toLocaleString()}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.google_rating != null ? (
                          <span className="text-sm tabular-nums">⭐ {deal.google_rating}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {deal.deal_total_score != null ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={cn(
                              "text-sm font-medium px-2 py-0.5 rounded tabular-nums",
                              deal.deal_total_score >= 80 ? "bg-green-100 text-green-700" :
                              deal.deal_total_score >= 60 ? "bg-blue-100 text-blue-700" :
                              deal.deal_total_score >= 40 ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                            )}>
                              {Math.round(deal.deal_total_score)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(deal.created_at), "MMM d, yyyy")}
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
                            <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                          )}
                          {deal.enriched_at && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                              Enriched
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {deal.is_priority_target ? (
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400 mx-auto" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/admin/remarketing/gp-partner-deals/${deal.id}`, { state: { from: "/admin/remarketing/gp-partner-deals" } })}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Deal
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEnrichSelected([deal.id])}>
                              <Zap className="h-4 w-4 mr-2" />
                              Enrich Deal
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={async () => {
                                const newValue = !deal.is_priority_target;
                                const { error } = await supabase.from("listings").update({ is_priority_target: newValue } as never).eq("id", deal.id);
                if (error) { sonnerToast.error("Failed to update priority"); }
                                else { sonnerToast.success(newValue ? "Marked as priority" : "Priority removed"); queryClient.invalidateQueries({ queryKey: ["remarketing", "gp-partner-deals"] }); }
                              }}
                              className={deal.is_priority_target ? "text-amber-600" : ""}
                            >
                              <Star className={cn("h-4 w-4 mr-2", deal.is_priority_target && "fill-amber-500")} />
                              {deal.is_priority_target ? "Remove Priority" : "Mark as Priority"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                const newVal = !deal.need_buyer_universe;
                                const { error } = await supabase.from("listings").update({ need_buyer_universe: newVal } as never).eq("id", deal.id);
                                if (!error) { sonnerToast.success(newVal ? "Flagged: Needs Buyer Universe" : "Flag removed"); queryClient.invalidateQueries({ queryKey: ["remarketing", "gp-partner-deals"] }); }
                              }}
                              className={deal.need_buyer_universe ? "text-blue-600" : ""}
                            >
                              <Users className={cn("h-4 w-4 mr-2", deal.need_buyer_universe && "text-blue-600")} />
                              {deal.need_buyer_universe ? "✓ Needs Buyer Universe" : "Flag: Needs Buyer Universe"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                const newVal = !deal.need_owner_contact;
                                const { error } = await supabase.from("listings").update({ need_owner_contact: newVal } as never).eq("id", deal.id);
                                if (!error) { sonnerToast.success(newVal ? "Flagged: Need to Contact Owner" : "Flag removed"); queryClient.invalidateQueries({ queryKey: ["remarketing", "gp-partner-deals"] }); }
                              }}
                              className={deal.need_owner_contact ? "text-orange-600" : ""}
                            >
                              <Phone className={cn("h-4 w-4 mr-2", deal.need_owner_contact && "text-orange-600")} />
                              {deal.need_owner_contact ? "✓ Need to Contact Owner" : "Flag: Need to Contact Owner"}
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
                              className="text-amber-600 focus:text-amber-600"
                              onClick={async () => {
                                const { error } = await supabase
                                  .from('listings')
                                  .update({ status: 'archived' } as never)
                                  .eq('id', deal.id);
                                if (error) {
                                  toast({ title: "Error", description: error.message, variant: "destructive" });
                                } else {
                                  toast({ title: "Deal archived", description: "Deal has been archived" });
                                  refetch();
                                }
                              }}
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Archive Deal
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {filteredDeals.length > 0 ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filteredDeals.length)} of {filteredDeals.length} deals
          {filteredDeals.length !== totalDeals && ` (filtered from ${totalDeals})`}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(1)} disabled={safePage <= 1}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>
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
                if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val);
              }}
              className="w-12 h-7 text-center text-sm border border-input rounded-md bg-background tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            of {totalPages}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(totalPages)} disabled={safePage >= totalPages}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Add Deal Dialog */}
      <Dialog open={addDealOpen} onOpenChange={setAddDealOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add GP Partner Deal</DialogTitle>
            <DialogDescription>
              Add a single deal manually. It will be queued for enrichment if a website is provided.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                value={newDeal.company_name}
                onChange={(e) => setNewDeal(d => ({ ...d, company_name: e.target.value }))}
                placeholder="Acme Services Inc."
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={newDeal.website}
                onChange={(e) => setNewDeal(d => ({ ...d, website: e.target.value }))}
                placeholder="www.example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  value={newDeal.contact_name}
                  onChange={(e) => setNewDeal(d => ({ ...d, contact_name: e.target.value }))}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Title</Label>
                <Input
                  value={newDeal.contact_title}
                  onChange={(e) => setNewDeal(d => ({ ...d, contact_title: e.target.value }))}
                  placeholder="CEO"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={newDeal.contact_email}
                  onChange={(e) => setNewDeal(d => ({ ...d, contact_email: e.target.value }))}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input
                  value={newDeal.contact_phone}
                  onChange={(e) => setNewDeal(d => ({ ...d, contact_phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input
                  value={newDeal.industry}
                  onChange={(e) => setNewDeal(d => ({ ...d, industry: e.target.value }))}
                  placeholder="HVAC, Plumbing, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={newDeal.location}
                  onChange={(e) => setNewDeal(d => ({ ...d, location: e.target.value }))}
                  placeholder="Dallas, TX"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Revenue ($)</Label>
                <Input
                  type="number"
                  value={newDeal.revenue}
                  onChange={(e) => setNewDeal(d => ({ ...d, revenue: e.target.value }))}
                  placeholder="5000000"
                />
              </div>
              <div className="space-y-2">
                <Label>EBITDA ($)</Label>
                <Input
                  type="number"
                  value={newDeal.ebitda}
                  onChange={(e) => setNewDeal(d => ({ ...d, ebitda: e.target.value }))}
                  placeholder="1000000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newDeal.description}
                onChange={(e) => setNewDeal(d => ({ ...d, description: e.target.value }))}
                placeholder="Brief description of the company..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDealOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDeal} disabled={isAddingDeal || !newDeal.company_name.trim()}>
              {isAddingDeal && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Upload Dialog - reuses the shared DealImportDialog */}
      <DealImportDialog
        open={csvUploadOpen}
        onOpenChange={setCsvUploadOpen}
        onImportComplete={handleImportComplete}
        dealSource="gp_partners"
        hideFromAllDeals
      />
    </div>
  );
}
