import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Upload,
  ChevronDown,
  ChevronUp,
  Calculator,
  ArrowUpDown,
  Zap,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { getTierFromScore, EnrichmentProgressIndicator } from "@/components/remarketing";
import { useEnrichmentProgress } from "@/hooks/useEnrichmentProgress";
import { useGlobalGateCheck } from "@/hooks/remarketing/useGlobalActivityQueue";
import { useAuth } from "@/context/AuthContext";
import { useAdminProfiles } from "@/hooks/admin/use-admin-profiles";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { FilterBar, DEAL_LISTING_FIELDS } from "@/components/filters";
import { useFilterEngine } from "@/hooks/use-filter-engine";
import { useTimeframe } from "@/hooks/use-timeframe";
import { useSavedViews } from "@/hooks/use-saved-views";

import type { DealListing, ColumnWidths } from "./types";
import { DEFAULT_COLUMN_WIDTHS } from "./types";
import { ResizableHeader } from "./components/ResizableHeader";
import { DealTableRow } from "./components/DealTableRow";
import { DealsKPICards } from "./components/DealsKPICards";
import { DealsBulkActions } from "./components/DealsBulkActions";
import { DealsActionDialogs } from "./components/DealsActionDialogs";

const ReMarketingDeals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  const [search, setSearch] = useState("");
  const [universeFilter, setUniverseFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [referralPartnerFilter, setReferralPartnerFilter] = useState<string>("all");

  // Admin profiles for deal owner assignment
  const { data: adminProfiles } = useAdminProfiles();

  // State for import dialog
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddDealDialog, setShowAddDealDialog] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const sortColumn = searchParams.get("sort") ?? "rank";
  const sortDirection = (searchParams.get("dir") as "asc" | "desc") ?? "asc";
  const [isCalculating, setIsCalculating] = useState(false);
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);

  // Enrichment progress tracking
  const { progress: enrichmentProgress, summary: enrichmentSummary, showSummary: showEnrichmentSummary, dismissSummary, pauseEnrichment, resumeEnrichment, cancelEnrichment } = useEnrichmentProgress();

  // Multi-select and archive/delete state
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUniverseDialog, setShowUniverseDialog] = useState(false);

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

  // Track which deals have been queued in this session
  const enrichingDealsRef = useRef<Set<string>>(new Set());

  // Clear the ref when listings change significantly
  useEffect(() => {
    enrichingDealsRef.current.clear();
  }, [sortColumn, sortDirection]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch all listings (deals)
  const { data: listings, isLoading: listingsLoading, refetch: refetchListings } = useQuery({
    queryKey: ['remarketing', 'deals'],
    refetchOnMount: 'always',
    staleTime: 30_000,
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
          industry,
          website,
          executive_summary,
          service_mix,
          internal_company_name,
          internal_deal_memo_link,
          geographic_states,
          enriched_at,
          full_time_employees,
          linkedin_employee_count,
          linkedin_employee_range,
          google_review_count,
          google_rating,
          is_priority_target,
          needs_buyer_universe,
          need_to_contact_owner,
          deal_total_score,
          seller_interest_score,
          manual_rank_override,
          address_city,
          address_state,
          referral_partner_id,
          referral_partners(id, name),
          deal_source,
          deal_owner_id,
          deal_owner:profiles!listings_deal_owner_id_fkey(id, first_name, last_name, email),
          needs_owner_contact,
          needs_owner_contact_at
        `)
        .eq('status', 'active')
        .neq('deal_source', 'gp_partners')
        .or('deal_source.neq.valuation_calculator,pushed_to_all_deals.eq.true')
        .or('deal_source.neq.valuation_lead,pushed_to_all_deals.eq.true')
        .order('manual_rank_override', { ascending: true, nullsFirst: false })
        .order('deal_total_score', { ascending: false, nullsFirst: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DealListing[];
    }
  });

  // Queue specific deals for enrichment (used by CSV import)
  const queueDealsForEnrichment = useCallback(async (dealIds: string[]) => {
    if (dealIds.length === 0) return;
    const nowIso = new Date().toISOString();
    try {
      const { queued } = await startOrQueueMajorOp({
        operationType: 'deal_enrichment',
        totalItems: dealIds.length,
        description: `Enrich ${dealIds.length} imported deals`,
        userId: user?.id || 'unknown',
      });
      if (queued) return;

      const queueEntries = dealIds.map(id => ({
        listing_id: id,
        status: 'pending',
        attempts: 0,
        queued_at: nowIso,
      }));
      const { error } = await supabase
        .from('enrichment_queue')
        .upsert(queueEntries, { onConflict: 'listing_id' });
      if (error) {
        console.error('Failed to queue deals for enrichment:', error);
        return;
      }
      toast({
        title: "Deals queued for enrichment",
        description: `${dealIds.length} deal${dealIds.length !== 1 ? 's' : ''} added to enrichment queue`
      });
      void supabase.functions
        .invoke('process-enrichment-queue', { body: { source: 'csv_import' } })
        .catch((e) => console.warn('Failed to trigger enrichment worker:', e));
    } catch (err) {
      console.error('Failed to queue deals:', err);
    }
  }, [toast, startOrQueueMajorOp, user?.id]);

  const handleImportCompleteWithIds = useCallback((importedIds: string[]) => {
    if (importedIds.length > 0) {
      queueDealsForEnrichment(importedIds);
    }
  }, [queueDealsForEnrichment]);

  const handleRetryFailedEnrichment = useCallback(async () => {
    dismissSummary();
    if (!enrichmentSummary?.errors.length) return;
    const failedIds = enrichmentSummary.errors.map((e: any) => e.listingId);
    const nowIso = new Date().toISOString();
    await supabase
      .from('enrichment_queue')
      .update({ status: 'pending', attempts: 0, last_error: null, queued_at: nowIso })
      .in('listing_id', failedIds);
    toast({
      title: "Retrying failed deals",
      description: `${failedIds.length} deal${failedIds.length !== 1 ? 's' : ''} queued for retry`
    });
    void supabase.functions
      .invoke('process-enrichment-queue', { body: { source: 'retry_failed' } })
      .catch(console.warn);
  }, [dismissSummary, enrichmentSummary, toast]);

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
          stats[score.listing_id] = { totalMatches: 0, approved: 0, passed: 0, avgScore: 0, universeIds: new Set() };
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

  const universeCount = universes?.length || 0;

  // KPI Stats
  const kpiStats = useMemo(() => {
    const totalDeals = listings?.length || 0;
    const priorityDeals = listings?.filter(listing => listing.is_priority_target === true).length || 0;
    let totalScore = 0;
    let scoredDeals = 0;
    listings?.forEach(listing => {
      if (listing.deal_total_score !== null) {
        totalScore += listing.deal_total_score;
        scoredDeals++;
      }
    });
    const avgScore = scoredDeals > 0 ? Math.round(totalScore / scoredDeals) : 0;
    const needsScoring = listings?.filter(listing => listing.deal_total_score === null).length || 0;
    return { totalDeals, priorityDeals, avgScore, needsScoring };
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

  // Timeframe, filter engine, and saved views
  const { timeframe, setTimeframe } = useTimeframe("all_time");
  const {
    filteredItems: engineFiltered,
    filterState,
    setFilterState,
    dynamicOptions,
    totalCount,
    filteredCount,
  } = useFilterEngine(listings || [], DEAL_LISTING_FIELDS);
  const { views: savedViews, addView, removeView } = useSavedViews("remarketing-deals");

  // Filter listings - use engineFiltered (which handles search + filter rules) as the base
  const filteredListings = useMemo(() => {
    if (!engineFiltered) return [];
    return engineFiltered.filter(listing => {
      if (universeFilter === "needs_build") {
        if (!listing.needs_buyer_universe) return false;
      } else if (universeFilter !== "all") {
        const stats = scoreStats?.[listing.id];
        if (!stats || !stats.universeIds.has(universeFilter)) return false;
      }
      if (scoreFilter !== "all") {
        const score = listing.deal_total_score ?? 0;
        const tier = getTierFromScore(score);
        if (scoreFilter !== tier) return false;
      }
      if (referralPartnerFilter !== "all") {
        if (referralPartnerFilter === "referred") {
          if (!listing.referral_partner_id) return false;
        } else {
          if (listing.referral_partner_id !== referralPartnerFilter) return false;
        }
      }
      if (industryFilter !== "all") {
        const listingIndustry = listing.industry || listing.category;
        if (listingIndustry !== industryFilter) return false;
      }
      if (stateFilter !== "all") {
        if (listing.address_state !== stateFilter) return false;
      }
      if (employeeFilter !== "all") {
        if (listing.linkedin_employee_range !== employeeFilter) return false;
      }
      if (dateFilter !== "all") {
        const createdAt = new Date(listing.created_at);
        if (dateFilter === "custom") {
          if (customDateFrom && createdAt < customDateFrom) return false;
          if (customDateTo) {
            const endOfDay = new Date(customDateTo);
            endOfDay.setHours(23, 59, 59, 999);
            if (createdAt > endOfDay) return false;
          }
        } else {
          const now = new Date();
          const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          if (dateFilter === "7d" && daysDiff > 7) return false;
          if (dateFilter === "30d" && daysDiff > 30) return false;
          if (dateFilter === "90d" && daysDiff > 90) return false;
        }
      }
      return true;
    });
  }, [engineFiltered, universeFilter, scoreFilter, dateFilter, customDateFrom, customDateTo, industryFilter, stateFilter, employeeFilter, referralPartnerFilter, scoreStats]);

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
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("sort") === column) {
        next.set("dir", next.get("dir") === "asc" ? "desc" : "asc");
      } else {
        next.set("sort", column);
        next.set("dir", column === "rank" ? "asc" : "desc");
      }
      return next;
    }, { replace: true });
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
        case "referral_source":
          aVal = (a.referral_partners?.name || "").toLowerCase();
          bVal = (b.referral_partners?.name || "").toLowerCase();
          break;
        case "industry":
          aVal = (a.industry || a.category || "").toLowerCase();
          bVal = (b.industry || b.category || "").toLowerCase();
          break;
        case "revenue":
          aVal = a.revenue || 0;
          bVal = b.revenue || 0;
          break;
        case "ebitda":
          aVal = a.ebitda || 0;
          bVal = b.ebitda || 0;
          break;
        case "linkedinCount":
          aVal = a.linkedin_employee_count || 0;
          bVal = b.linkedin_employee_count || 0;
          break;
        case "linkedinRange": {
          const parseRangeA = (r: string | null) => {
            if (!r) return 0;
            const match = r.match(/^(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          };
          aVal = parseRangeA(a.linkedin_employee_range);
          bVal = parseRangeA(b.linkedin_employee_range);
          break;
        }
        case "googleReviews":
          aVal = a.google_review_count || 0;
          bVal = b.google_review_count || 0;
          break;
        case "googleRating":
          aVal = a.google_rating || 0;
          bVal = b.google_rating || 0;
          break;
        case "score":
          aVal = a.deal_total_score ?? 0;
          bVal = b.deal_total_score ?? 0;
          break;
        case "sellerInterest":
          aVal = a.seller_interest_score ?? 0;
          bVal = b.seller_interest_score ?? 0;
          break;
        case "engagement":
          aVal = (stats_a?.totalMatches || 0);
          bVal = (stats_b?.totalMatches || 0);
          break;
        case "added":
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        case "priority":
          aVal = a.is_priority_target ? 1 : 0;
          bVal = b.is_priority_target ? 1 : 0;
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

  // Shared helper: reorder deals, optimistically update UI, persist only changed ranks
  const persistRankChanges = useCallback(async (reordered: DealListing[], description: string) => {
    const updatedListings = reordered.map((listing, idx) => ({
      ...listing,
      manual_rank_override: idx + 1,
    }));
    const changedDeals = updatedListings.filter((deal, idx) => {
      const original = localOrder.find(d => d.id === deal.id);
      return !original || original.manual_rank_override !== idx + 1;
    });
    setLocalOrder(updatedListings);
    sortedListingsRef.current = updatedListings;
    try {
      if (changedDeals.length > 0) {
        await Promise.all(
          changedDeals.map((deal) =>
            supabase
              .from('listings')
              .update({ manual_rank_override: deal.manual_rank_override })
              .eq('id', deal.id)
              .throwOnError()
          )
        );
      }
      await queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
      toast({ title: "Position updated", description });
    } catch (error) {
      console.error('Failed to update rank:', error);
      await queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
      toast({ title: "Failed to update rank", variant: "destructive" });
    }
  }, [localOrder, queryClient, toast]);

  // Handle drag end
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentListings = [...localOrder];
    const oldIndex = currentListings.findIndex((l) => l.id === active.id);
    const newIndex = currentListings.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(currentListings, oldIndex, newIndex);
    await persistRankChanges(reordered, `Deal moved to position ${newIndex + 1}`);
  }, [localOrder, persistRankChanges]);

  // Multi-select handlers
  const handleToggleSelect = useCallback((dealId: string) => {
    setSelectedDeals(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(dealId)) newSelected.delete(dealId);
      else newSelected.add(dealId);
      return newSelected;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedDeals.size === localOrder.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(localOrder.map(d => d.id)));
    }
  }, [selectedDeals.size, localOrder]);

  const handleClearSelection = useCallback(() => {
    setSelectedDeals(new Set());
  }, []);

  // Archive handlers
  const handleArchiveDeal = useCallback(async (dealId: string, dealName: string) => {
    const { error } = await supabase
      .from('listings')
      .update({ status: 'archived' })
      .eq('id', dealId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deal archived", description: `${dealName} has been archived` });
    refetchListings();
  }, [toast, refetchListings]);

  // Single deal delete state
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteDeal = useCallback((dealId: string, dealName: string) => {
    setSingleDeleteTarget({ id: dealId, name: dealName });
  }, []);

  const handleConfirmSingleDelete = useCallback(async () => {
    if (!singleDeleteTarget) return;
    const { id: dealId, name: dealName } = singleDeleteTarget;
    try {
      await supabase.from('alert_delivery_logs').delete().eq('listing_id', dealId);
      await supabase.from('buyer_approve_decisions').delete().eq('listing_id', dealId);
      await supabase.from('buyer_learning_history').delete().eq('listing_id', dealId);
      await supabase.from('buyer_pass_decisions').delete().eq('listing_id', dealId);
      await supabase.from('chat_conversations').delete().eq('listing_id', dealId);
      await supabase.from('collection_items').delete().eq('listing_id', dealId);
      await supabase.from('connection_requests').delete().eq('listing_id', dealId);
      await supabase.from('deal_ranking_history').delete().eq('listing_id', dealId);
      await supabase.from('deal_referrals').delete().eq('listing_id', dealId);
      await supabase.from('deals').delete().eq('listing_id', dealId);
      await supabase.from('deal_scoring_adjustments').delete().eq('listing_id', dealId);
      await supabase.from('deal_transcripts').delete().eq('listing_id', dealId);
      await supabase.from('enrichment_queue').delete().eq('listing_id', dealId);
      await supabase.from('listing_analytics').delete().eq('listing_id', dealId);
      await supabase.from('listing_conversations').delete().eq('listing_id', dealId);
      await supabase.from('outreach_records').delete().eq('listing_id', dealId);
      await supabase.from('owner_intro_notifications').delete().eq('listing_id', dealId);
      await supabase.from('remarketing_outreach').delete().eq('listing_id', dealId);
      await supabase.from('remarketing_scores').delete().eq('listing_id', dealId);
      await supabase.from('remarketing_universe_deals').delete().eq('listing_id', dealId);
      await supabase.from('saved_listings').delete().eq('listing_id', dealId);
      await supabase.from('similar_deal_alerts').delete().eq('source_listing_id', dealId);
      const { error } = await supabase.from('listings').delete().eq('id', dealId);
      if (error) throw error;
      toast({ title: "Deal deleted", description: `${dealName} has been permanently deleted` });
      refetchListings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSingleDeleteTarget(null);
    }
  }, [singleDeleteTarget, toast, refetchListings]);

  const handleTogglePriority = useCallback(async (dealId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setLocalOrder(prev => prev.map(deal =>
      deal.id === dealId ? { ...deal, is_priority_target: newStatus } : deal
    ));
    const { error } = await supabase
      .from('listings')
      .update({ is_priority_target: newStatus })
      .eq('id', dealId);
    if (error) {
      setLocalOrder(prev => prev.map(deal =>
        deal.id === dealId ? { ...deal, is_priority_target: currentStatus } : deal
      ));
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: newStatus ? "Priority target set" : "Priority removed",
      description: newStatus ? "Deal marked as priority target" : "Deal is no longer a priority target"
    });
  }, [toast]);

  const handleToggleNeedsBuyerUniverse = useCallback(async (dealId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setLocalOrder(prev => prev.map(deal =>
      deal.id === dealId ? { ...deal, needs_buyer_universe: newStatus } : deal
    ));
    const { error } = await supabase
      .from('listings')
      .update({ needs_buyer_universe: newStatus })
      .eq('id', dealId);
    if (error) {
      setLocalOrder(prev => prev.map(deal =>
        deal.id === dealId ? { ...deal, needs_buyer_universe: currentStatus } : deal
      ));
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: newStatus ? "Flagged: Needs Buyer Universe" : "Flag removed",
      description: newStatus ? "Deal flagged as needing a buyer universe" : "Buyer universe flag removed"
    });
  }, [toast]);

  const handleToggleNeedToContactOwner = useCallback(async (dealId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setLocalOrder(prev => prev.map(deal =>
      deal.id === dealId ? { ...deal, need_to_contact_owner: newStatus } : deal
    ));
    const { error } = await supabase
      .from('listings')
      .update({ need_to_contact_owner: newStatus })
      .eq('id', dealId);
    if (error) {
      setLocalOrder(prev => prev.map(deal =>
        deal.id === dealId ? { ...deal, need_to_contact_owner: currentStatus } : deal
      ));
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: newStatus ? "Flagged: Need to Contact Owner" : "Flag removed",
      description: newStatus ? "Deal flagged as needing owner contact" : "Contact owner flag removed"
    });
  }, [toast]);

  const handleAssignOwner = useCallback(async (dealId: string, ownerId: string | null) => {
    const ownerProfile = ownerId && adminProfiles ? adminProfiles[ownerId] : null;
    setLocalOrder(prev => prev.map(deal =>
      deal.id === dealId ? {
        ...deal,
        deal_owner_id: ownerId,
        deal_owner: ownerProfile ? { id: ownerProfile.id, first_name: ownerProfile.first_name, last_name: ownerProfile.last_name, email: ownerProfile.email } : null,
      } : deal
    ));
    const { error } = await supabase
      .from('listings')
      .update({ deal_owner_id: ownerId })
      .eq('id', dealId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      await queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
      return;
    }
    toast({ title: "Deal owner updated", description: ownerId ? "Owner has been assigned" : "Owner has been removed" });
  }, [adminProfiles, toast, queryClient]);

  const handleBulkArchive = useCallback(async () => {
    setIsArchiving(true);
    try {
      const dealIds = Array.from(selectedDeals);
      const { error } = await supabase
        .from('listings')
        .update({ status: 'archived' })
        .in('id', dealIds);
      if (error) throw error;
      toast({ title: "Deals archived", description: `${dealIds.length} deal(s) have been archived` });
      setSelectedDeals(new Set());
      setShowArchiveDialog(false);
      refetchListings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsArchiving(false);
    }
  }, [selectedDeals, toast, refetchListings]);

  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const dealIds = Array.from(selectedDeals);
      for (const dealId of dealIds) {
        await supabase.from('alert_delivery_logs').delete().eq('listing_id', dealId);
        await supabase.from('buyer_approve_decisions').delete().eq('listing_id', dealId);
        await supabase.from('buyer_learning_history').delete().eq('listing_id', dealId);
        await supabase.from('buyer_pass_decisions').delete().eq('listing_id', dealId);
        await supabase.from('chat_conversations').delete().eq('listing_id', dealId);
        await supabase.from('collection_items').delete().eq('listing_id', dealId);
        await supabase.from('connection_requests').delete().eq('listing_id', dealId);
        await supabase.from('deal_ranking_history').delete().eq('listing_id', dealId);
        await supabase.from('deal_referrals').delete().eq('listing_id', dealId);
        await supabase.from('deals').delete().eq('listing_id', dealId);
        await supabase.from('deal_scoring_adjustments').delete().eq('listing_id', dealId);
        await supabase.from('deal_transcripts').delete().eq('listing_id', dealId);
        await supabase.from('enrichment_queue').delete().eq('listing_id', dealId);
        await supabase.from('listing_analytics').delete().eq('listing_id', dealId);
        await supabase.from('listing_conversations').delete().eq('listing_id', dealId);
        await supabase.from('outreach_records').delete().eq('listing_id', dealId);
        await supabase.from('owner_intro_notifications').delete().eq('listing_id', dealId);
        await supabase.from('remarketing_outreach').delete().eq('listing_id', dealId);
        await supabase.from('remarketing_scores').delete().eq('listing_id', dealId);
        await supabase.from('remarketing_universe_deals').delete().eq('listing_id', dealId);
        await supabase.from('saved_listings').delete().eq('listing_id', dealId);
        await supabase.from('similar_deal_alerts').delete().eq('source_listing_id', dealId);
        const { error } = await supabase.from('listings').delete().eq('id', dealId);
        if (error) throw error;
      }
      toast({ title: "Deals permanently deleted", description: `${dealIds.length} deal(s) have been permanently deleted` });
      setSelectedDeals(new Set());
      setShowDeleteDialog(false);
      refetchListings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedDeals, toast, refetchListings]);

  // Calculate scores dialog state
  const [showCalculateDialog, setShowCalculateDialog] = useState(false);
  const [showEnrichDialog, setShowEnrichDialog] = useState(false);

  const handleCalculateScores = async (mode: 'all' | 'unscored') => {
    setShowCalculateDialog(false);
    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-deal-quality', {
        body: mode === 'all'
          ? { forceRecalculate: true, triggerEnrichment: true }
          : { calculateAll: true }
      });
      if (error) throw new Error(error.message || 'Failed to calculate scores');
      if (data?.scored === 0 && !data?.enrichmentQueued) {
        toast({ title: "All deals scored", description: "All deals already have quality scores calculated" });
      } else {
        const enrichmentMsg = data?.enrichmentQueued > 0
          ? `. Queued ${data.enrichmentQueued} deals for enrichment.`
          : '';
        toast({
          title: "Scoring complete",
          description: `Calculated quality scores for ${data?.scored || 0} deals${data?.errors > 0 ? ` (${data.errors} errors)` : ''}${enrichmentMsg}`
        });
      }
      refetchListings();
    } catch (error: any) {
      console.error('Calculate scores error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleEnrichDeals = async (mode: 'all' | 'unenriched') => {
    setShowEnrichDialog(false);
    if (!listings || listings.length === 0) {
      toast({ title: "No deals", description: "No deals available to enrich", variant: "destructive" });
      return;
    }
    setIsEnrichingAll(true);
    try {
      const dealsToEnrich = mode === 'all' ? listings : listings.filter(l => !l.enriched_at);
      if (dealsToEnrich.length === 0) {
        toast({ title: "All deals enriched", description: "All deals have already been enriched" });
        setIsEnrichingAll(false);
        return;
      }
      const dealIds = dealsToEnrich.map(l => l.id);
      const { queued } = await startOrQueueMajorOp({
        operationType: 'deal_enrichment',
        totalItems: dealIds.length,
        description: `Enrich ${dealIds.length} deals (${mode})`,
        userId: user?.id || 'unknown',
      });
      if (queued) { setIsEnrichingAll(false); return; }

      const { error: resetError } = await supabase
        .from('listings')
        .update({ enriched_at: null })
        .in('id', dealIds);
      if (resetError) console.warn('Failed to reset enriched_at:', resetError);

      const nowIso = new Date().toISOString();
      const { error: resetQueueError } = await supabase
        .from('enrichment_queue')
        .update({ status: 'pending', attempts: 0, started_at: null, completed_at: null, last_error: null, queued_at: nowIso, updated_at: nowIso })
        .in('listing_id', dealIds);
      if (resetQueueError) throw resetQueueError;

      const { error: insertMissingError } = await supabase
        .from('enrichment_queue')
        .upsert(
          dealIds.map(id => ({ listing_id: id, status: 'pending', attempts: 0, queued_at: nowIso })),
          { onConflict: 'listing_id', ignoreDuplicates: true }
        );
      if (insertMissingError) throw insertMissingError;

      toast({
        title: "Enrichment queued",
        description: `${dealIds.length} deal${dealIds.length > 1 ? 's' : ''} queued for enrichment. Starting processing now...`,
      });
      void supabase.functions
        .invoke('process-enrichment-queue', { body: { source: 'ui_enrich_deals' } })
        .then(({ error }) => { if (error) console.warn('Failed to trigger enrichment worker:', error); })
        .catch((e) => console.warn('Failed to trigger enrichment worker:', e));
      refetchListings();
    } catch (error: any) {
      console.error('Enrich deals error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsEnrichingAll(false);
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
          <Button variant="outline" onClick={() => setShowAddDealDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Deal
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button
            onClick={() => setShowEnrichDialog(true)}
            disabled={isEnrichingAll}
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10"
          >
            <Zap className="h-4 w-4 mr-2" />
            {isEnrichingAll ? "Queueing..." : "Enrich Deals"}
          </Button>
          <Button
            onClick={() => setShowCalculateDialog(true)}
            disabled={isCalculating}
            className="bg-slate-800 hover:bg-slate-700 text-white"
          >
            <Calculator className="h-4 w-4 mr-2" />
            {isCalculating ? "Scoring..." : "Score Deals"}
          </Button>
          <Popover open={showCustomDatePicker} onOpenChange={setShowCustomDatePicker}>
            <PopoverTrigger asChild>
              <div>
                <Select value={dateFilter} onValueChange={(val) => {
                  setDateFilter(val);
                  if (val === "custom") setShowCustomDatePicker(true);
                }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All Time">
                      {dateFilter === "custom" && customDateFrom
                        ? `${format(customDateFrom, "MM/dd")}${customDateTo ? ` - ${format(customDateTo, "MM/dd")}` : " →"}`
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="90d">Last 90 Days</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverTrigger>
            {dateFilter === "custom" && (
              <PopoverContent className="w-auto p-4" align="end">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Select Date Range</p>
                  <div className="flex gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">From</label>
                      <Input
                        type="date"
                        value={customDateFrom ? format(customDateFrom, "yyyy-MM-dd") : ""}
                        onChange={(e) => setCustomDateFrom(e.target.value ? new Date(e.target.value + "T00:00:00") : undefined)}
                        className="w-[140px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">To</label>
                      <Input
                        type="date"
                        value={customDateTo ? format(customDateTo, "yyyy-MM-dd") : ""}
                        onChange={(e) => setCustomDateTo(e.target.value ? new Date(e.target.value + "T00:00:00") : undefined)}
                        className="w-[140px]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setCustomDateFrom(undefined);
                      setCustomDateTo(undefined);
                      setDateFilter("all");
                      setShowCustomDatePicker(false);
                    }}>Clear</Button>
                    <Button size="sm" onClick={() => setShowCustomDatePicker(false)}>Apply</Button>
                  </div>
                </div>
              </PopoverContent>
            )}
          </Popover>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <DealsKPICards
        totalDeals={kpiStats.totalDeals}
        priorityDeals={kpiStats.priorityDeals}
        avgScore={kpiStats.avgScore}
        needsScoring={kpiStats.needsScoring}
      />

      {/* Enrichment Progress Indicator */}
      {(enrichmentProgress.isEnriching || enrichmentProgress.isPaused) && (
        <EnrichmentProgressIndicator
          completedCount={enrichmentProgress.completedCount}
          totalCount={enrichmentProgress.totalCount}
          progress={enrichmentProgress.progress}
          estimatedTimeRemaining={enrichmentProgress.estimatedTimeRemaining}
          processingRate={enrichmentProgress.processingRate}
          successfulCount={enrichmentProgress.successfulCount}
          failedCount={enrichmentProgress.failedCount}
          isPaused={enrichmentProgress.isPaused}
          onPause={pauseEnrichment}
          onResume={resumeEnrichment}
          onCancel={cancelEnrichment}
        />
      )}

      {/* Unified Filter Bar */}
      <FilterBar
        filterState={filterState}
        onFilterStateChange={setFilterState}
        fieldDefinitions={DEAL_LISTING_FIELDS}
        dynamicOptions={dynamicOptions}
        totalCount={totalCount}
        filteredCount={filteredListings.length}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        savedViews={savedViews}
        onSaveView={(name, filters) => addView({ name, filters })}
        onDeleteView={removeView}
        onSelectView={(view) => setFilterState(view.filters)}
      >
        <Button
          variant={universeFilter === "needs_build" ? "default" : "outline"}
          size="sm"
          onClick={() => setUniverseFilter(universeFilter === "needs_build" ? "all" : "needs_build")}
          className="whitespace-nowrap"
        >
          <Building2 className="h-3.5 w-3.5 mr-1.5" />
          Needs Universe Build
        </Button>
      </FilterBar>

      {/* Bulk Actions Toolbar */}
      <DealsBulkActions
        selectedDeals={selectedDeals}
        localOrder={localOrder}
        onClearSelection={handleClearSelection}
        onShowUniverseDialog={() => setShowUniverseDialog(true)}
        onShowArchiveDialog={() => setShowArchiveDialog(true)}
        onShowDeleteDialog={() => setShowDeleteDialog(true)}
        setSelectedDeals={(deals) => setSelectedDeals(deals)}
        refetchListings={refetchListings}
        toast={toast}
      />

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <TooltipProvider>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragEnd={handleDragEnd}
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            >
              <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                  <tr>
                    <th
                      className="h-10 px-3 text-left align-middle font-medium text-muted-foreground border-b"
                      style={{ width: columnWidths.select, minWidth: 40 }}
                    >
                      <Checkbox
                        checked={localOrder.length > 0 && selectedDeals.size === localOrder.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <ResizableHeader width={columnWidths.rank} onResize={(w) => handleColumnResize('rank', w)} minWidth={50}>
                      <SortableHeader column="rank" label="#" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.dealName} onResize={(w) => handleColumnResize('dealName', w)} minWidth={100}>
                      <SortableHeader column="deal_name" label="Deal Name" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.referralSource} onResize={(w) => handleColumnResize('referralSource', w)} minWidth={60}>
                      <SortableHeader column="referral_source" label="Referral Source" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.industry} onResize={(w) => handleColumnResize('industry', w)} minWidth={60}>
                      <SortableHeader column="industry" label="Industry" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.description} onResize={(w) => handleColumnResize('description', w)} minWidth={100}>
                      <span className="text-muted-foreground font-medium">Description</span>
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
                    <ResizableHeader width={columnWidths.linkedinCount} onResize={(w) => handleColumnResize('linkedinCount', w)} minWidth={50} className="text-right">
                      <SortableHeader column="linkedinCount" label="LI Count" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.linkedinRange} onResize={(w) => handleColumnResize('linkedinRange', w)} minWidth={50} className="text-right">
                      <SortableHeader column="linkedinRange" label="LI Range" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.googleReviews} onResize={(w) => handleColumnResize('googleReviews', w)} minWidth={50} className="text-right">
                      <SortableHeader column="googleReviews" label="Reviews" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.googleRating} onResize={(w) => handleColumnResize('googleRating', w)} minWidth={50} className="text-right">
                      <SortableHeader column="googleRating" label="Rating" className="ml-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.quality} onResize={(w) => handleColumnResize('quality', w)} minWidth={50} className="text-center">
                      <SortableHeader column="score" label="Quality" className="mx-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.sellerInterest} onResize={(w) => handleColumnResize('sellerInterest', w)} minWidth={60} className="text-center">
                      <SortableHeader column="sellerInterest" label="Seller Interest" className="mx-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.engagement} onResize={(w) => handleColumnResize('engagement', w)} minWidth={80} className="text-center">
                      <SortableHeader column="engagement" label="Engagement" className="mx-auto" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.dealOwner} onResize={(w) => handleColumnResize('dealOwner', w)} minWidth={80}>
                      <span className="text-muted-foreground font-medium">Deal Owner</span>
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.added} onResize={(w) => handleColumnResize('added', w)} minWidth={60}>
                      <SortableHeader column="added" label="Added" />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths.priority} onResize={(w) => handleColumnResize('priority', w)} minWidth={50} className="text-center">
                      <SortableHeader column="priority" label="Priority" className="mx-auto" />
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
                      <TableCell colSpan={16} className="text-center py-8 text-muted-foreground">
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
                        <DealTableRow
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
                          isSelected={selectedDeals.has(listing.id)}
                          onToggleSelect={handleToggleSelect}
                          onArchive={handleArchiveDeal}
                          onDelete={handleDeleteDeal}
                          onTogglePriority={handleTogglePriority}
                          onToggleNeedsBuyerUniverse={handleToggleNeedsBuyerUniverse}
                          onToggleNeedToContactOwner={handleToggleNeedToContactOwner}
                          adminProfiles={adminProfiles}
                          onAssignOwner={handleAssignOwner}
                          onUpdateRank={async (dealId, newRank) => {
                            const rankSorted = [...localOrder].sort((a, b) =>
                              (a.manual_rank_override ?? 9999) - (b.manual_rank_override ?? 9999)
                            );
                            const movedIndex = rankSorted.findIndex(l => l.id === dealId);
                            if (movedIndex === -1) return;
                            const targetPos = Math.max(1, Math.min(newRank, rankSorted.length));
                            const [movedDeal] = rankSorted.splice(movedIndex, 1);
                            rankSorted.splice(targetPos - 1, 0, movedDeal);
                            const newRanks = new Map(rankSorted.map((l, idx) => [l.id, idx + 1]));
                            const updatedLocal = localOrder.map(l => ({
                              ...l,
                              manual_rank_override: newRanks.get(l.id) ?? l.manual_rank_override,
                            }));
                            const changedDeals = updatedLocal.filter(deal => {
                              const original = localOrder.find(d => d.id === deal.id);
                              return !original || original.manual_rank_override !== deal.manual_rank_override;
                            });
                            setLocalOrder(updatedLocal);
                            sortedListingsRef.current = updatedLocal;
                            try {
                              if (changedDeals.length > 0) {
                                await Promise.all(
                                  changedDeals.map((deal) =>
                                    supabase
                                      .from('listings')
                                      .update({ manual_rank_override: deal.manual_rank_override })
                                      .eq('id', deal.id)
                                      .throwOnError()
                                  )
                                );
                              }
                              await queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
                              toast({ title: 'Position updated', description: `Deal moved to position ${targetPos}` });
                            } catch (err: any) {
                              console.error('Failed to update rank:', err);
                              await queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
                              toast({ title: 'Failed to update rank', variant: 'destructive' });
                            }
                          }}
                        />
                      ))}
                    </SortableContext>
                  )}
                </TableBody>
              </table>
              </div>
            </DndContext>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* All Dialogs */}
      <DealsActionDialogs
        showImportDialog={showImportDialog}
        setShowImportDialog={setShowImportDialog}
        refetchListings={refetchListings}
        handleImportCompleteWithIds={handleImportCompleteWithIds}
        showArchiveDialog={showArchiveDialog}
        setShowArchiveDialog={setShowArchiveDialog}
        handleBulkArchive={handleBulkArchive}
        isArchiving={isArchiving}
        selectedDealsSize={selectedDeals.size}
        showDeleteDialog={showDeleteDialog}
        setShowDeleteDialog={setShowDeleteDialog}
        handleBulkDelete={handleBulkDelete}
        isDeleting={isDeleting}
        showUniverseDialog={showUniverseDialog}
        setShowUniverseDialog={setShowUniverseDialog}
        selectedDealIds={Array.from(selectedDeals)}
        onUniverseComplete={() => setSelectedDeals(new Set())}
        singleDeleteTarget={singleDeleteTarget}
        setSingleDeleteTarget={setSingleDeleteTarget}
        handleConfirmSingleDelete={handleConfirmSingleDelete}
        showCalculateDialog={showCalculateDialog}
        setShowCalculateDialog={setShowCalculateDialog}
        handleCalculateScores={handleCalculateScores}
        isCalculating={isCalculating}
        showEnrichDialog={showEnrichDialog}
        setShowEnrichDialog={setShowEnrichDialog}
        handleEnrichDeals={handleEnrichDeals}
        isEnrichingAll={isEnrichingAll}
        listingsCount={listings?.length || 0}
        unenrichedCount={listings?.filter(l => !l.enriched_at).length || 0}
        showAddDealDialog={showAddDealDialog}
        setShowAddDealDialog={setShowAddDealDialog}
        totalDeals={listings?.length || 0}
        showEnrichmentSummary={showEnrichmentSummary}
        dismissSummary={dismissSummary}
        enrichmentSummary={enrichmentSummary}
        handleRetryFailedEnrichment={handleRetryFailedEnrichment}
      />
    </div>
  );
};

export default ReMarketingDeals;
