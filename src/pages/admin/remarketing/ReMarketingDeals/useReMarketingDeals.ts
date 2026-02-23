import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getTierFromScore } from "@/components/remarketing";
import { useEnrichmentProgress } from "@/hooks/useEnrichmentProgress";
import { useGlobalGateCheck } from "@/hooks/remarketing/useGlobalActivityQueue";
import { useAuth } from "@/context/AuthContext";
import { useAdminProfiles } from "@/hooks/admin/use-admin-profiles";
import { useFilterEngine } from "@/hooks/use-filter-engine";
import { DEAL_LISTING_FIELDS } from "@/components/filters";
import { useTimeframe } from "@/hooks/use-timeframe";
import { useSavedViews } from "@/hooks/use-saved-views";
import {
  DndContext, closestCorners, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent, MeasuringStrategy,
} from "@dnd-kit/core";
import {
  arrayMove, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import type { DealListing, ColumnWidths } from "../types";
import { DEFAULT_COLUMN_WIDTHS } from "../types";

const PAGE_SIZE = 50;

export function useReMarketingDeals() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  const [universeFilter] = useState<string>("all");
  const [scoreFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [industryFilter] = useState<string>("all");
  const [stateFilter] = useState<string>("all");
  const [employeeFilter] = useState<string>("all");
  const [referralPartnerFilter] = useState<string>("all");
  const [universeBuildFilter, setUniverseBuildFilter] = useState<boolean>(false);

  const { data: adminProfiles } = useAdminProfiles();

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddDealDialog, setShowAddDealDialog] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const sortColumn = searchParams.get("sort") ?? "rank";
  const sortDirection = (searchParams.get("dir") as "asc" | "desc") ?? "asc";
  const [isCalculating, setIsCalculating] = useState(false);
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);

  const { progress: enrichmentProgress, summary: enrichmentSummary, showSummary: showEnrichmentSummary, dismissSummary, pauseEnrichment, resumeEnrichment, cancelEnrichment } = useEnrichmentProgress();

  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUniverseDialog, setShowUniverseDialog] = useState(false);

  const [localOrder, setLocalOrder] = useState<DealListing[]>([]);
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(DEFAULT_COLUMN_WIDTHS);
  const sortedListingsRef = useRef<DealListing[]>([]);

  const handleColumnResize = useCallback((column: keyof ColumnWidths, newWidth: number) => {
    setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
  }, []);

  const enrichingDealsRef = useRef<Set<string>>(new Set());
  useEffect(() => { enrichingDealsRef.current.clear(); }, [sortColumn, sortDirection]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [page, setPage] = useState(0);

  // Fetch all listings
  const { data: listings, isLoading: listingsLoading, isError: listingsError, refetch: refetchListings } = useQuery({
    queryKey: ['remarketing', 'deals'],
    refetchOnMount: 'always',
    staleTime: 30_000,
    queryFn: async () => {
      const BATCH = 1000;
      const allRows: DealListing[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('listings')
          .select(`
            id, title, description, location, revenue, ebitda, status, created_at,
            category, industry, website, executive_summary, service_mix,
            internal_company_name, internal_deal_memo_link, geographic_states,
            enriched_at, full_time_employees, linkedin_employee_count,
            linkedin_employee_range, google_review_count, google_rating,
            is_priority_target, need_buyer_universe, deal_total_score,
            seller_interest_score, manual_rank_override, address_city,
            address_state, referral_partner_id, referral_partners(id, name),
            deal_source, deal_owner_id,
            deal_owner:profiles!listings_deal_owner_id_fkey(id, first_name, last_name, email),
            needs_owner_contact, needs_owner_contact_at,
            universe_build_flagged, universe_build_flagged_at, universe_build_flagged_by,
            is_internal_deal
          `)
          .eq('remarketing_status', 'active')
          .or(
            'deal_source.in.(marketplace,manual,referral,remarketing),' +
            'and(deal_source.in.(captarget,valuation_calculator,valuation_lead),pushed_to_all_deals.eq.true)'
          )
          .order('manual_rank_override', { ascending: true, nullsFirst: false })
          .order('deal_total_score', { ascending: false, nullsFirst: true })
          .order('created_at', { ascending: false })
          .range(offset, offset + BATCH - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allRows.push(...(data as unknown as DealListing[]));
          offset += BATCH;
          hasMore = data.length === BATCH;
        } else {
          hasMore = false;
        }
      }
      return allRows;
    }
  });

  // Queue deals for enrichment
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
      const queueEntries = dealIds.map(id => ({ listing_id: id, status: 'pending', attempts: 0, queued_at: nowIso }));
      const { error } = await supabase.from('enrichment_queue').upsert(queueEntries, { onConflict: 'listing_id' });
      if (error) { console.error('Failed to queue deals:', error); return; }
      toast({ title: "Deals queued for enrichment", description: `${dealIds.length} deal${dealIds.length !== 1 ? 's' : ''} added to enrichment queue` });
      void supabase.functions.invoke('process-enrichment-queue', { body: { source: 'csv_import' } }).catch((e) => console.warn('Failed to trigger enrichment worker:', e));
    } catch (err) {
      console.error('Failed to queue deals:', err);
    }
  }, [toast, startOrQueueMajorOp, user?.id]);

  const handleImportCompleteWithIds = useCallback((importedIds: string[]) => {
    if (importedIds.length > 0) queueDealsForEnrichment(importedIds);
  }, [queueDealsForEnrichment]);

  const handleRetryFailedEnrichment = useCallback(async () => {
    dismissSummary();
    if (!enrichmentSummary?.errors.length) return;
    const failedIds = enrichmentSummary.errors.map((e: any) => e.listingId);
    const nowIso = new Date().toISOString();
    await supabase.from('enrichment_queue').update({ status: 'pending', attempts: 0, last_error: null, queued_at: nowIso }).in('listing_id', failedIds);
    toast({ title: "Retrying failed deals", description: `${failedIds.length} deal${failedIds.length !== 1 ? 's' : ''} queued for retry` });
    void supabase.functions.invoke('process-enrichment-queue', { body: { source: 'retry_failed' } }).catch(console.warn);
  }, [dismissSummary, enrichmentSummary, toast]);

  // Fetch universes
  const { data: universes } = useQuery({
    queryKey: ['remarketing', 'universes-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('remarketing_buyer_universes').select('id, name').eq('archived', false).order('name');
      if (error) throw error;
      return data;
    }
  });

  // Universe deal map
  const { data: universeDealMap } = useQuery({
    queryKey: ['remarketing', 'universe-deal-map'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('remarketing_universe_deals').select('listing_id, universe_id, remarketing_buyer_universes(id, name)').limit(5000);
      if (error) throw error;
      const map: Record<string, { id: string; name: string }[]> = {};
      data?.forEach((row) => {
        const u = row.remarketing_buyer_universes as { id: string; name: string } | null;
        if (!u || !u.name) return;
        if (!map[row.listing_id]) map[row.listing_id] = [];
        map[row.listing_id].push({ id: u.id, name: u.name });
      });
      return map;
    }
  });

  // Score stats
  const { data: scoreStats } = useQuery({
    queryKey: ['remarketing', 'deal-score-stats'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('remarketing_scores').select('listing_id, composite_score, status, universe_id').limit(10000);
      if (error) throw error;
      const stats: Record<string, { totalMatches: number; approved: number; passed: number; avgScore: number; universeIds: Set<string>; }> = {};
      data?.forEach(score => {
        if (!stats[score.listing_id]) stats[score.listing_id] = { totalMatches: 0, approved: 0, passed: 0, avgScore: 0, universeIds: new Set() };
        stats[score.listing_id].totalMatches++;
        if (score.status === 'approved') stats[score.listing_id].approved++;
        if (score.status === 'passed') stats[score.listing_id].passed++;
        stats[score.listing_id].avgScore += score.composite_score || 0;
        if (score.universe_id) stats[score.listing_id].universeIds.add(score.universe_id);
      });
      Object.keys(stats).forEach(key => { if (stats[key].totalMatches > 0) stats[key].avgScore = stats[key].avgScore / stats[key].totalMatches; });
      return stats;
    }
  });

  // Pipeline counts
  const { data: pipelineCounts } = useQuery({
    queryKey: ['remarketing', 'pipeline-counts'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('deals').select('listing_id').is('deleted_at', null).limit(5000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach(row => { if (row.listing_id) counts[row.listing_id] = (counts[row.listing_id] || 0) + 1; });
      return counts;
    }
  });

  const initialTab = searchParams.get("tab") || "all";
  const [dealTab, setDealTab] = useState<string>(initialTab);
  const universeCount = universes?.length || 0;

  // KPI Stats
  const kpiStats = useMemo(() => {
    const totalDeals = listings?.length || 0;
    const priorityDeals = listings?.filter(l => l.is_priority_target === true).length || 0;
    let totalScore = 0; let scoredDeals = 0;
    listings?.forEach(l => { if (l.deal_total_score !== null) { totalScore += l.deal_total_score; scoredDeals++; } });
    const avgScore = scoredDeals > 0 ? Math.round(totalScore / scoredDeals) : 0;
    const needsScoring = listings?.filter(l => l.deal_total_score === null).length || 0;
    return { totalDeals, priorityDeals, avgScore, needsScoring };
  }, [listings]);

  // Timeframe, filter engine, saved views
  const { timeframe, setTimeframe } = useTimeframe("all_time");
  const { filteredItems: engineFiltered, filterState, setFilterState, dynamicOptions, totalCount } = useFilterEngine(listings || [], DEAL_LISTING_FIELDS);
  const { views: savedViews, addView, removeView } = useSavedViews("remarketing-deals");

  // Filter listings
  const filteredListings = useMemo(() => {
    if (!engineFiltered) return [];
    return engineFiltered.filter(listing => {
      if (universeFilter === "needs_build") { if (!listing.need_buyer_universe) return false; }
      else if (universeFilter !== "all") { const stats = scoreStats?.[listing.id]; if (!stats || !stats.universeIds.has(universeFilter)) return false; }
      if (scoreFilter !== "all") { const score = listing.deal_total_score ?? 0; const tier = getTierFromScore(score); if (scoreFilter !== tier) return false; }
      if (referralPartnerFilter !== "all") { if (referralPartnerFilter === "referred") { if (!listing.referral_partner_id) return false; } else { if (listing.referral_partner_id !== referralPartnerFilter) return false; } }
      if (industryFilter !== "all") { const li = listing.industry || listing.category; if (li !== industryFilter) return false; }
      if (stateFilter !== "all") { if (listing.address_state !== stateFilter) return false; }
      if (employeeFilter !== "all") { if (listing.linkedin_employee_range !== employeeFilter) return false; }
      if (dateFilter !== "all") {
        const createdAt = new Date(listing.created_at);
        if (dateFilter === "custom") { if (customDateFrom && createdAt < customDateFrom) return false; if (customDateTo) { const end = new Date(customDateTo); end.setHours(23,59,59,999); if (createdAt > end) return false; } }
        else { const now = new Date(); const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000*60*60*24)); if (dateFilter === "7d" && daysDiff > 7) return false; if (dateFilter === "30d" && daysDiff > 30) return false; if (dateFilter === "90d" && daysDiff > 90) return false; }
      }
      if (universeBuildFilter && !listing.universe_build_flagged) return false;
      if (dealTab === "marketplace") { if (listing.is_internal_deal !== false || listing.status !== 'active') return false; }
      else if (dealTab === "internal") { if (listing.is_internal_deal === false) return false; }
      else if (dealTab === "pipeline") { if (!pipelineCounts?.[listing.id]) return false; }
      else if (dealTab === "needs_universe") { const u = universeDealMap?.[listing.id]; if (u && u.length > 0) return false; }
      else if (dealTab === "needs_enrichment") { if (listing.enriched_at && listing.deal_total_score !== null) return false; }
      return true;
    });
  }, [engineFiltered, universeFilter, scoreFilter, dateFilter, customDateFrom, customDateTo, industryFilter, stateFilter, employeeFilter, referralPartnerFilter, scoreStats, universeBuildFilter, dealTab, pipelineCounts, universeDealMap]);

  // Handle sort
  const handleSort = (column: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("sort") === column) { next.set("dir", next.get("dir") === "asc" ? "desc" : "asc"); }
      else { next.set("sort", column); next.set("dir", column === "rank" ? "asc" : "desc"); }
      return next;
    }, { replace: true });
  };

  // Sort listings
  const sortedListings = useMemo(() => {
    if (!filteredListings) return [];
    return [...filteredListings].sort((a, b) => {
      const stats_a = scoreStats?.[a.id]; const stats_b = scoreStats?.[b.id];
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case "rank": aVal = a.manual_rank_override ?? 9999; bVal = b.manual_rank_override ?? 9999; break;
        case "deal_name": aVal = (a.internal_company_name || a.title || "").toLowerCase(); bVal = (b.internal_company_name || b.title || "").toLowerCase(); break;
        case "referral_source": aVal = (a.referral_partners?.name || "").toLowerCase(); bVal = (b.referral_partners?.name || "").toLowerCase(); break;
        case "industry": aVal = (a.industry || a.category || "").toLowerCase(); bVal = (b.industry || b.category || "").toLowerCase(); break;
        case "revenue": aVal = a.revenue || 0; bVal = b.revenue || 0; break;
        case "ebitda": aVal = a.ebitda || 0; bVal = b.ebitda || 0; break;
        case "linkedinCount": aVal = a.linkedin_employee_count || 0; bVal = b.linkedin_employee_count || 0; break;
        case "linkedinRange": { const p = (r: string | null) => { if (!r) return 0; const m = r.match(/^(\d+)/); return m ? parseInt(m[1], 10) : 0; }; aVal = p(a.linkedin_employee_range); bVal = p(b.linkedin_employee_range); break; }
        case "googleReviews": aVal = a.google_review_count || 0; bVal = b.google_review_count || 0; break;
        case "googleRating": aVal = a.google_rating || 0; bVal = b.google_rating || 0; break;
        case "score": aVal = a.deal_total_score ?? 0; bVal = b.deal_total_score ?? 0; break;
        case "engagement": aVal = (stats_a?.totalMatches || 0); bVal = (stats_b?.totalMatches || 0); break;
        case "added": aVal = new Date(a.created_at).getTime(); bVal = new Date(b.created_at).getTime(); break;
        case "priority": aVal = a.is_priority_target ? 1 : 0; bVal = b.is_priority_target ? 1 : 0; break;
        default: aVal = a.manual_rank_override ?? 9999; bVal = b.manual_rank_override ?? 9999;
      }
      if (typeof aVal === "string") { const c = aVal.localeCompare(bVal); return sortDirection === "asc" ? c : -c; }
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [filteredListings, sortColumn, sortDirection, scoreStats]);

  useEffect(() => { setPage(0); }, [filteredListings.length, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedListings.length / PAGE_SIZE));
  const paginatedListings = useMemo(() => {
    const start = page * PAGE_SIZE;
    return sortedListings.slice(start, start + PAGE_SIZE);
  }, [sortedListings, page]);

  useEffect(() => {
    sortedListingsRef.current = sortedListings;
    setLocalOrder(paginatedListings);
  }, [paginatedListings, sortedListings]);

  // Rank persistence
  const persistRankChanges = useCallback(async (reordered: DealListing[], description: string) => {
    const updated = reordered.map((listing, idx) => ({ ...listing, manual_rank_override: idx + 1 }));
    const changed = updated.filter((deal, idx) => { const orig = localOrder.find(d => d.id === deal.id); return !orig || orig.manual_rank_override !== idx + 1; });
    setLocalOrder(updated);
    sortedListingsRef.current = updated;
    try {
      if (changed.length > 0) await Promise.all(changed.map((d) => supabase.from('listings').update({ manual_rank_override: d.manual_rank_override }).eq('id', d.id).throwOnError()));
      await queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
      toast({ title: "Position updated", description });
    } catch (error) {
      console.error('Failed to update rank:', error);
      await queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
      toast({ title: "Failed to update rank", variant: "destructive" });
    }
  }, [localOrder, queryClient, toast]);

  // Drag end
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = [...localOrder];
    const oldIdx = current.findIndex(l => l.id === active.id);
    const newIdx = current.findIndex(l => l.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(current, oldIdx, newIdx);
    await persistRankChanges(reordered, `Deal moved to position ${newIdx + 1}`);
  }, [localOrder, persistRankChanges]);

  // Selection handlers
  const handleToggleSelect = useCallback((dealId: string) => {
    setSelectedDeals(prev => { const n = new Set(prev); if (n.has(dealId)) n.delete(dealId); else n.add(dealId); return n; });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedDeals.size === localOrder.length) setSelectedDeals(new Set());
    else setSelectedDeals(new Set(localOrder.map(d => d.id)));
  }, [selectedDeals.size, localOrder]);

  const handleClearSelection = useCallback(() => { setSelectedDeals(new Set()); }, []);

  // Archive/delete handlers
  const handleArchiveDeal = useCallback(async (dealId: string, dealName: string) => {
    const { error } = await supabase.from('listings').update({ remarketing_status: 'archived' }).eq('id', dealId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Deal archived", description: `${dealName} has been archived` });
    refetchListings();
  }, [toast, refetchListings]);

  const [singleDeleteTarget, setSingleDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteDeal = useCallback((dealId: string, dealName: string) => {
    setSingleDeleteTarget({ id: dealId, name: dealName });
  }, []);

  const handleConfirmSingleDelete = useCallback(async () => {
    if (!singleDeleteTarget) return;
    try {
      const { error } = await supabase.rpc('delete_listing_cascade', { p_listing_id: singleDeleteTarget.id });
      if (error) throw error;
      toast({ title: "Deal deleted", description: `${singleDeleteTarget.name} has been permanently deleted` });
      refetchListings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSingleDeleteTarget(null);
    }
  }, [singleDeleteTarget, toast, refetchListings]);

  const handleTogglePriority = useCallback(async (dealId: string, currentStatus: boolean) => {
    const ns = !currentStatus;
    setLocalOrder(prev => prev.map(d => d.id === dealId ? { ...d, is_priority_target: ns } : d));
    const { error } = await supabase.from('listings').update({ is_priority_target: ns }).eq('id', dealId);
    if (error) { setLocalOrder(prev => prev.map(d => d.id === dealId ? { ...d, is_priority_target: currentStatus } : d)); toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: ns ? "Priority target set" : "Priority removed", description: ns ? "Deal marked as priority target" : "Deal is no longer a priority target" });
  }, [toast]);

  const handleToggleUniverseBuild = useCallback(async (dealId: string, currentStatus: boolean) => {
    const ns = !currentStatus; const now = new Date().toISOString();
    setLocalOrder(prev => prev.map(d => d.id === dealId ? { ...d, universe_build_flagged: ns, universe_build_flagged_at: ns ? now : null } : d));
    const { error } = await supabase.from('listings').update({ universe_build_flagged: ns, universe_build_flagged_at: ns ? now : null, universe_build_flagged_by: ns ? user?.id : null }).eq('id', dealId);
    if (error) { setLocalOrder(prev => prev.map(d => d.id === dealId ? { ...d, universe_build_flagged: currentStatus } : d)); toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: ns ? "Flagged: Build Buyer Universe" : "Flag removed", description: ns ? "Deal flagged \u2014 a buyer universe needs to be built" : "Universe build flag removed" });
  }, [toast, user?.id]);

  const handleAssignOwner = useCallback(async (dealId: string, ownerId: string | null) => {
    const ownerProfile = ownerId && adminProfiles ? adminProfiles[ownerId] : null;
    setLocalOrder(prev => prev.map(d => d.id === dealId ? { ...d, deal_owner_id: ownerId, deal_owner: ownerProfile ? { id: ownerProfile.id, first_name: ownerProfile.first_name, last_name: ownerProfile.last_name, email: ownerProfile.email } : null } : d));
    const { error } = await supabase.from('listings').update({ deal_owner_id: ownerId }).eq('id', dealId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); await queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] }); return; }
    toast({ title: "Deal owner updated", description: ownerId ? "Owner has been assigned" : "Owner has been removed" });
  }, [adminProfiles, toast, queryClient]);

  const handleBulkArchive = useCallback(async () => {
    setIsArchiving(true);
    try {
      const ids = Array.from(selectedDeals);
      const { error } = await supabase.from('listings').update({ remarketing_status: 'archived' }).in('id', ids);
      if (error) throw error;
      toast({ title: "Deals archived", description: `${ids.length} deal(s) have been archived` });
      setSelectedDeals(new Set()); setShowArchiveDialog(false); refetchListings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsArchiving(false);
    }
  }, [selectedDeals, toast, refetchListings]);

  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const ids = Array.from(selectedDeals);
      for (const dealId of ids) {
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
      toast({ title: "Deals permanently deleted", description: `${ids.length} deal(s) have been permanently deleted` });
      setSelectedDeals(new Set()); setShowDeleteDialog(false); refetchListings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedDeals, toast, refetchListings]);

  // Calculate/enrich dialog states
  const [showCalculateDialog, setShowCalculateDialog] = useState(false);
  const [showEnrichDialog, setShowEnrichDialog] = useState(false);

  const handleCalculateScores = async (mode: 'all' | 'unscored') => {
    setShowCalculateDialog(false);
    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-deal-quality', {
        body: mode === 'all' ? { forceRecalculate: true, triggerEnrichment: true } : { calculateAll: true }
      });
      if (error) throw new Error(error.message || 'Failed to calculate scores');
      if (data?.scored === 0 && !data?.enrichmentQueued) {
        toast({ title: "All deals scored", description: "All deals already have quality scores calculated" });
      } else {
        const enrichMsg = data?.enrichmentQueued > 0 ? `. Queued ${data.enrichmentQueued} deals for enrichment.` : '';
        toast({ title: "Scoring complete", description: `Calculated quality scores for ${data?.scored || 0} deals${data?.errors > 0 ? ` (${data.errors} errors)` : ''}${enrichMsg}` });
      }
      refetchListings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleEnrichDeals = async (mode: 'all' | 'unenriched') => {
    setShowEnrichDialog(false);
    if (!listings || listings.length === 0) { toast({ title: "No deals", description: "No deals available to enrich", variant: "destructive" }); return; }
    setIsEnrichingAll(true);
    try {
      const toEnrich = mode === 'all' ? listings : listings.filter(l => !l.enriched_at);
      if (toEnrich.length === 0) { toast({ title: "All deals enriched", description: "All deals have already been enriched" }); setIsEnrichingAll(false); return; }
      const dealIds = toEnrich.map(l => l.id);
      const { queued } = await startOrQueueMajorOp({ operationType: 'deal_enrichment', totalItems: dealIds.length, description: `Enrich ${dealIds.length} deals (${mode})`, userId: user?.id || 'unknown' });
      if (queued) { setIsEnrichingAll(false); return; }
      const { error: resetError } = await supabase.from('listings').update({ enriched_at: null }).in('id', dealIds);
      if (resetError) console.warn('Failed to reset enriched_at:', resetError);
      const nowIso = new Date().toISOString();
      const { error: resetQueueError } = await supabase.from('enrichment_queue').update({ status: 'pending', attempts: 0, started_at: null, completed_at: null, last_error: null, queued_at: nowIso, updated_at: nowIso }).in('listing_id', dealIds);
      if (resetQueueError) throw resetQueueError;
      const { error: insertMissing } = await supabase.from('enrichment_queue').upsert(dealIds.map(id => ({ listing_id: id, status: 'pending', attempts: 0, queued_at: nowIso })), { onConflict: 'listing_id', ignoreDuplicates: true });
      if (insertMissing) throw insertMissing;
      toast({ title: "Enrichment queued", description: `${dealIds.length} deal${dealIds.length > 1 ? 's' : ''} queued for enrichment. Starting processing now...` });
      void supabase.functions.invoke('process-enrichment-queue', { body: { source: 'ui_enrich_deals' } }).catch(e => console.warn('Failed to trigger enrichment worker:', e));
      refetchListings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsEnrichingAll(false);
    }
  };

  return {
    navigate, toast, queryClient, user,
    // Data
    listings, listingsLoading, listingsError, refetchListings,
    sortedListings, localOrder, setLocalOrder, paginatedListings,
    // Filters
    filterState, setFilterState, dynamicOptions, totalCount,
    timeframe, setTimeframe, savedViews, addView, removeView,
    dateFilter, setDateFilter, customDateFrom, setCustomDateFrom,
    customDateTo, setCustomDateTo, showCustomDatePicker, setShowCustomDatePicker,
    universeBuildFilter, setUniverseBuildFilter,
    dealTab, setDealTab, filteredListings,
    // Sort
    sortColumn, sortDirection, handleSort, searchParams,
    // Pagination
    page, setPage, totalPages, PAGE_SIZE,
    // Column widths
    columnWidths, handleColumnResize,
    // Selection
    selectedDeals, setSelectedDeals, handleToggleSelect, handleSelectAll, handleClearSelection,
    // DnD
    sensors, handleDragEnd,
    // Enrichment
    enrichmentProgress, enrichmentSummary, showEnrichmentSummary, dismissSummary,
    pauseEnrichment, resumeEnrichment, cancelEnrichment,
    isEnrichingAll, isCalculating,
    // Stats
    kpiStats, universeCount, scoreStats, pipelineCounts, universeDealMap,
    adminProfiles,
    // Handlers
    handleArchiveDeal, handleDeleteDeal, handleTogglePriority,
    handleToggleUniverseBuild, handleAssignOwner,
    handleBulkArchive, handleBulkDelete,
    handleCalculateScores, handleEnrichDeals,
    handleImportCompleteWithIds, handleRetryFailedEnrichment,
    handleConfirmSingleDelete,
    // Dialog states
    showImportDialog, setShowImportDialog,
    showAddDealDialog, setShowAddDealDialog,
    showArchiveDialog, setShowArchiveDialog,
    showDeleteDialog, setShowDeleteDialog,
    showUniverseDialog, setShowUniverseDialog,
    showCalculateDialog, setShowCalculateDialog,
    showEnrichDialog, setShowEnrichDialog,
    isArchiving, isDeleting,
    singleDeleteTarget, setSingleDeleteTarget,
    // Ref
    sortedListingsRef,
    persistRankChanges,
  };
}
