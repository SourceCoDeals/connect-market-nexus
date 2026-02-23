import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast as sonnerToast } from 'sonner';
import { FilterBar, TimeframeSelector, VALUATION_LEAD_FIELDS } from '@/components/filters';
import { useTimeframe } from '@/hooks/use-timeframe';
import { useFilterEngine } from '@/hooks/use-filter-engine';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import {
  useGlobalGateCheck,
  useGlobalActivityMutations,
} from '@/hooks/remarketing/useGlobalActivityQueue';
import { useEnrichmentProgress } from '@/hooks/useEnrichmentProgress';
import { EnrichmentProgressIndicator, DealEnrichmentSummaryDialog } from '@/components/remarketing';
import { useAuth } from '@/context/AuthContext';
import { EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

import type { ValuationLead, SortColumn, SortDirection } from './types';
import {
  cleanWebsiteToDomain,
  extractBusinessName,
  inferWebsite,
  buildListingFromLead,
  QUALITY_ORDER,
  DEFAULT_COL_WIDTHS,
  PAGE_SIZE,
} from './helpers';
import { HeaderToolbar } from './HeaderToolbar';
import { CalculatorTypeTabs } from './CalculatorTypeTabs';
import { KpiStatsCards } from './KpiStatsCards';
import { BulkActionsBar } from './BulkActionsBar';
import { LeadsTable } from './LeadsTable';
import { LeadsPagination } from './LeadsPagination';

// Re-export formatAge so existing imports from ValuationLeads still work
export { formatAge } from './helpers';

export default function ValuationLeads() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  const { completeOperation, updateProgress } = useGlobalActivityMutations();

  // Admin profiles for deal owner display
  const { data: adminProfiles } = useAdminProfiles();

  // Enrichment progress tracking (same as CapTarget / GP Partners / All Deals)
  const {
    progress: enrichmentProgress,
    summary: enrichmentSummary,
    showSummary: showEnrichmentSummary,
    dismissSummary,
    pauseEnrichment,
    resumeEnrichment,
    cancelEnrichment,
  } = useEnrichmentProgress();

  // Calculator type tab
  const [activeTab, setActiveTab] = useState<string>('all');

  // Timeframe (standardized hook)
  const { timeframe, setTimeframe, isInRange } = useTimeframe('all_time');

  // Sorting – persisted in URL so navigating back restores the sort
  const [searchParams, setSearchParams] = useSearchParams();
  const sortColumn = (searchParams.get('sort') as SortColumn) ?? 'created_at';
  const sortDirection = (searchParams.get('dir') as SortDirection) ?? 'desc';

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Hide pushed toggle
  const [hidePushed, setHidePushed] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Column resizing
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COL_WIDTHS);

  const startResize = useCallback(
    (col: string, e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = colWidths[col] ?? DEFAULT_COL_WIDTHS[col] ?? 120;
      const onMouseMove = (mv: MouseEvent) => {
        const newW = Math.max(60, startW + mv.clientX - startX);
        setColWidths((prev) => ({ ...prev, [col]: newW }));
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [colWidths],
  );

  // Action states
  const [isPushing, setIsPushing] = useState(false);
  const [isPushEnriching, setIsPushEnriching] = useState(false);
  const [isReEnriching, setIsReEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  // Fetch valuation leads
  const {
    data: leads,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['remarketing', 'valuation-leads'],
    refetchOnMount: 'always',
    staleTime: 30_000,
    queryFn: async () => {
      const allData: ValuationLead[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('valuation_leads')
          .select(
            '*, listings!valuation_leads_pushed_listing_id_fkey(description, executive_summary)',
          )
          .eq('excluded', false)
          .order('created_at', { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          const normalized = data.map((row) => ({
            ...row,
            listing_description:
              row.listings?.description || row.listings?.executive_summary || null,
            listings: undefined, // strip the join object
            revenue: row.revenue != null ? Number(row.revenue) : null,
            ebitda: row.ebitda != null ? Number(row.ebitda) : null,
            valuation_low: row.valuation_low != null ? Number(row.valuation_low) : null,
            valuation_mid: row.valuation_mid != null ? Number(row.valuation_mid) : null,
            valuation_high: row.valuation_high != null ? Number(row.valuation_high) : null,
            lead_score: row.lead_score != null ? Number(row.lead_score) : null,
            readiness_score: row.readiness_score != null ? Number(row.readiness_score) : null,
            locations_count: row.locations_count != null ? Number(row.locations_count) : null,
          }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          allData.push(...(normalized as any[]));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
  });

  // Get distinct calculator types for tabs — always include "general" first
  const calculatorTypes = useMemo(() => {
    if (!leads) return ['general'];
    const types = new Set(leads.map((l) => l.calculator_type));
    types.add('general'); // always show general tab
    // Sort: general first, then rest alphabetically
    return Array.from(types).sort((a, b) => {
      if (a === 'general') return -1;
      if (b === 'general') return 1;
      return a.localeCompare(b);
    });
  }, [leads]);

  // Filter engine for advanced filtering
  const {
    filteredItems: engineFiltered,
    filterState,
    setFilterState,
    dynamicOptions,
    filteredCount,
    totalCount: engineTotal,
  } = useFilterEngine(leads ?? [], VALUATION_LEAD_FIELDS);

  // Default filter: "Website is not empty" — applied on first mount if no filter is already set
  useEffect(() => {
    if (filterState.rules.length === 0) {
      setFilterState((prev) => ({
        ...prev,
        conjunction: 'and',
        rules: [
          { id: 'default-website-filter', field: 'website', operator: 'is_not_empty', value: '' },
        ],
      }));
    }
  }, [filterState.rules.length, setFilterState]);

  // Apply tab + timeframe on top of engine-filtered results, then sort
  const filteredLeads = useMemo(() => {
    let filtered = engineFiltered;

    // Hide archived leads by default
    filtered = filtered.filter((l) => !l.is_archived);

    // Hide pushed if toggle is on
    if (hidePushed) filtered = filtered.filter((l) => !l.pushed_to_all_deals);

    // Tab filter
    if (activeTab !== 'all') {
      filtered = filtered.filter((l) => l.calculator_type === activeTab);
    }

    // Timeframe filter
    filtered = filtered.filter((l) => isInRange(l.created_at));

    // Deduplicate by normalized domain — keep the best record per website
    // (highest lead_score, or most recent if tied)
    const domainMap = new Map<string, ValuationLead>();
    for (const lead of filtered) {
      const domain = cleanWebsiteToDomain(lead.website);
      const key = domain ?? `__no_domain_${lead.id}`;
      const existing = domainMap.get(key);
      if (!existing) {
        domainMap.set(key, lead);
      } else {
        const existingScore = existing.lead_score ?? -1;
        const newScore = lead.lead_score ?? -1;
        const existingDate = existing.created_at ?? '';
        const newDate = lead.created_at ?? '';
        // Prefer higher score; on tie prefer more recent
        if (newScore > existingScore || (newScore === existingScore && newDate > existingDate)) {
          domainMap.set(key, lead);
        }
      }
    }
    filtered = Array.from(domainMap.values());

    // Sort
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let valA: string | number, valB: string | number;
      switch (sortColumn) {
        case 'display_name':
          valA = extractBusinessName(a).toLowerCase();
          valB = extractBusinessName(b).toLowerCase();
          break;
        case 'website':
          valA = (inferWebsite(a) || '').toLowerCase();
          valB = (inferWebsite(b) || '').toLowerCase();
          break;
        case 'industry':
          valA = (a.industry || '').toLowerCase();
          valB = (b.industry || '').toLowerCase();
          break;
        case 'location':
          valA = (a.location || '').toLowerCase();
          valB = (b.location || '').toLowerCase();
          break;
        case 'revenue':
          valA = a.revenue ?? -1;
          valB = b.revenue ?? -1;
          break;
        case 'ebitda':
          valA = a.ebitda ?? -1;
          valB = b.ebitda ?? -1;
          break;
        case 'valuation':
          valA = a.valuation_mid ?? -1;
          valB = b.valuation_mid ?? -1;
          break;
        case 'exit_timing': {
          const timingOrder: Record<string, number> = { now: 3, '1-2years': 2, exploring: 1 };
          valA = timingOrder[a.exit_timing || ''] ?? 0;
          valB = timingOrder[b.exit_timing || ''] ?? 0;
          break;
        }
        case 'intros':
          valA = a.open_to_intros ? 1 : 0;
          valB = b.open_to_intros ? 1 : 0;
          break;
        case 'quality':
          // Sort by quality tier order, not readiness_score
          valA = QUALITY_ORDER[a.quality_label || ''] ?? 0;
          valB = QUALITY_ORDER[b.quality_label || ''] ?? 0;
          break;
        case 'score':
          valA = a.lead_score ?? -1;
          valB = b.lead_score ?? -1;
          break;
        case 'created_at':
          valA = a.created_at || '';
          valB = b.created_at || '';
          break;
        case 'pushed':
          valA = a.pushed_to_all_deals ? 1 : 0;
          valB = b.pushed_to_all_deals ? 1 : 0;
          break;
        case 'priority':
          valA = a.is_priority_target ? 1 : 0;
          valB = b.is_priority_target ? 1 : 0;
          break;
        case 'owner': {
          const ownerA = a.deal_owner_id ? adminProfiles?.[a.deal_owner_id]?.displayName || '' : '';
          const ownerB = b.deal_owner_id ? adminProfiles?.[b.deal_owner_id]?.displayName || '' : '';
          valA = ownerA.toLowerCase();
          valB = ownerB.toLowerCase();
          break;
        }
        default:
          return 0;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [engineFiltered, activeTab, isInRange, sortColumn, sortDirection, adminProfiles, hidePushed]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLeads = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, safePage]);

  // Reset page and clear selection on filter change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [activeTab, timeframe, sortColumn, sortDirection, filterState]);

  const handleSort = (col: SortColumn) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (next.get('sort') === col) {
          next.set('dir', next.get('dir') === 'asc' ? 'desc' : 'asc');
        } else {
          next.set('sort', col);
          next.set('dir', 'asc');
        }
        return next;
      },
      { replace: true },
    );
  };

  // Selection helpers
  const allSelected =
    paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedIds.has(l.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedLeads.map((l) => l.id)));
    }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Row click handler — navigate to deal detail for every lead.
  // Auto-creates a listing (without pushing) if one doesn't exist yet.
  const handleRowClick = useCallback(
    async (lead: ValuationLead) => {
      if (lead.pushed_listing_id) {
        navigate('/admin/deals/' + lead.pushed_listing_id, {
          state: { from: '/admin/remarketing/leads/valuation' },
        });
        return;
      }

      const dealIdentifier = `vlead_${lead.id.slice(0, 8)}`;

      // Check if a listing was already created for this lead (e.g. from a previous click)
      // to avoid hitting the unique constraint on deal_identifier
      const { data: existing, error: existingError } = await supabase
        .from('listings')
        .select('id')
        .eq('deal_identifier', dealIdentifier)
        .maybeSingle();
      if (existingError) throw existingError;

      let listingId: string;

      if (existing?.id) {
        // Reuse the existing listing and heal the missing pushed_listing_id link
        listingId = existing.id;
        await supabase
          .from('valuation_leads')
          .update({ pushed_listing_id: listingId } as never)
          .eq('id', lead.id);
      } else {
        // Auto-create a listing so the detail page works (not pushed to All Deals)
        const { data: listing, error: insertError } = await supabase
          .from('listings')
          .insert(buildListingFromLead(lead, false))
          .select('id')
          .single();

        if (insertError || !listing) {
          console.error('Failed to create listing for lead:', lead.id, insertError);
          sonnerToast.error('Failed to open deal page');
          return;
        }

        listingId = listing.id;

        // Save the listing reference on the valuation lead
        await supabase
          .from('valuation_leads')
          .update({ pushed_listing_id: listingId } as never)
          .eq('id', lead.id);
      }

      // Refresh so the table shows the updated listing_id
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });

      navigate('/admin/deals/' + listingId, {
        state: { from: '/admin/remarketing/leads/valuation' },
      });
    },
    [navigate, queryClient],
  );

  // Push to All Deals — handles leads with or without an existing listing
  const handlePushToAllDeals = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0 || isPushing) return;
      setIsPushing(true);

      const leadsToProcess = (leads || []).filter(
        (l) => leadIds.includes(l.id) && !l.pushed_to_all_deals,
      );

      let successCount = 0;
      let errorCount = 0;
      for (const lead of leadsToProcess) {
        let listingId = lead.pushed_listing_id;

        if (listingId) {
          // Listing already exists (auto-created on row click) — just mark as pushed
          const { error } = await supabase
            .from('listings')
            .update({ pushed_to_all_deals: true, pushed_to_all_deals_at: new Date().toISOString() })
            .eq('id', listingId);
          if (error) {
            console.error('Failed to update listing:', error);
            errorCount++;
            continue;
          }
        } else {
          // No listing yet — create one marked as pushed
          const { data: listing, error: insertError } = await supabase
            .from('listings')
            .insert(buildListingFromLead(lead, true))
            .select('id')
            .single();
          if (insertError || !listing) {
            console.error('Failed to create listing:', insertError);
            errorCount++;
            continue;
          }
          listingId = listing.id;
        }

        const { error: updateError } = await supabase
          .from('valuation_leads')
          .update({
            pushed_to_all_deals: true,
            pushed_to_all_deals_at: new Date().toISOString(),
            pushed_listing_id: listingId,
            status: 'pushed',
          } as never)
          .eq('id', lead.id);

        if (updateError) {
          console.error('Listing created but failed to mark lead as pushed:', lead.id, updateError);
        }

        successCount++;
      }

      setIsPushing(false);
      setSelectedIds(new Set());

      if (successCount > 0) {
        sonnerToast.success(
          `Added ${successCount} lead${successCount !== 1 ? 's' : ''} to All Deals${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
        );
      } else {
        sonnerToast.info('Nothing to add \u2014 selected leads are already in All Deals.');
      }

      queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
    },
    [leads, isPushing, queryClient],
  );

  // Push & Enrich — handles leads with or without an existing listing
  const handlePushAndEnrich = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      setIsPushEnriching(true);

      const leadsToProcess = (leads || []).filter(
        (l) => leadIds.includes(l.id) && !l.pushed_to_all_deals,
      );
      if (!leadsToProcess.length) {
        sonnerToast.info('No unpushed leads selected');
        setIsPushEnriching(false);
        return;
      }

      let pushed = 0;
      let enrichQueued = 0;
      const listingIds: string[] = [];

      for (const lead of leadsToProcess) {
        let listingId = lead.pushed_listing_id;

        if (listingId) {
          // Listing already exists — mark as pushed
          const { error } = await supabase
            .from('listings')
            .update({ pushed_to_all_deals: true, pushed_to_all_deals_at: new Date().toISOString() })
            .eq('id', listingId);
          if (error) {
            console.error('Failed to update listing:', error);
            continue;
          }
        } else {
          const { data: listing, error: insertError } = await supabase
            .from('listings')
            .insert(buildListingFromLead(lead, true))
            .select('id')
            .single();
          if (insertError || !listing) {
            console.error('Failed to create listing:', insertError);
            continue;
          }
          listingId = listing.id;
        }

        listingIds.push(listingId);

        await supabase
          .from('valuation_leads')
          .update({
            pushed_to_all_deals: true,
            pushed_to_all_deals_at: new Date().toISOString(),
            pushed_listing_id: listingId,
            status: 'pushed',
          } as never)
          .eq('id', lead.id);

        pushed++;
      }

      // Queue all pushed listings for enrichment (chunked, matching CapTarget pattern)
      if (listingIds.length > 0) {
        // Register with global activity queue
        let activityItem: { id: string } | null = null;
        try {
          const result = await startOrQueueMajorOp({
            operationType: 'deal_enrichment',
            totalItems: listingIds.length,
            description: `Push & enrich ${listingIds.length} valuation leads`,
            userId: user?.id || '',
            contextJson: { source: 'valuation_leads_push_enrich' },
          });
          activityItem = result.item;
        } catch {
          // Non-blocking
        }

        const now = new Date().toISOString();
        const rows = listingIds.map((id) => ({
          listing_id: id,
          status: 'pending' as const,
          attempts: 0,
          queued_at: now,
        }));

        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const { error } = await supabase
            .from('enrichment_queue')
            .upsert(chunk, { onConflict: 'listing_id' });
          if (!error) enrichQueued += chunk.length;
          else {
            console.error('Queue upsert error:', error);
            if (activityItem)
              completeOperation.mutate({ id: activityItem.id, finalStatus: 'failed' });
          }
        }

        // Trigger the enrichment worker (non-blocking, read results for progress)
        try {
          const { data: result, error: resultError } = await supabase.functions.invoke(
            'process-enrichment-queue',
            {
              body: { source: 'valuation_leads_push_enrich' },
            },
          );
          if (resultError) throw resultError;
          if (result?.synced > 0 || result?.processed > 0) {
            const totalDone = (result?.synced || 0) + (result?.processed || 0);
            if (activityItem)
              updateProgress.mutate({ id: activityItem.id, completedItems: totalDone });
          }
        } catch {
          // Non-blocking — enrichment progress hook will track completion via polling
        }
      }

      setIsPushEnriching(false);
      setSelectedIds(new Set());

      if (pushed > 0) {
        sonnerToast.success(
          `Added ${pushed} lead${pushed !== 1 ? 's' : ''} to All Deals and queued ${enrichQueued} for enrichment`,
        );
      } else {
        sonnerToast.info("Select leads that haven't been added to All Deals yet.");
      }

      queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
    },
    [leads, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient],
  );

  // Re-Enrich selected — re-queues already-pushed leads (matching CapTarget handleEnrichSelected)
  const handleReEnrich = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      setIsReEnriching(true);

      const leadsToProcess = (leads || []).filter(
        (l) => leadIds.includes(l.id) && l.pushed_to_all_deals && l.pushed_listing_id,
      );

      if (!leadsToProcess.length) {
        sonnerToast.info('No pushed leads with listing IDs found');
        setIsReEnriching(false);
        return;
      }

      let activityItem: { id: string } | null = null;
      try {
        const result = await startOrQueueMajorOp({
          operationType: 'deal_enrichment',
          totalItems: leadsToProcess.length,
          description: `Re-enriching ${leadsToProcess.length} valuation leads`,
          userId: user?.id || '',
          contextJson: { source: 'valuation_leads_re_enrich' },
        });
        activityItem = result.item;
      } catch {
        // Non-blocking
      }

      const now = new Date().toISOString();
      const seen = new Set<string>();
      const rows = leadsToProcess
        .filter((l) => {
          if (!l.pushed_listing_id || seen.has(l.pushed_listing_id)) return false;
          seen.add(l.pushed_listing_id!);
          return true;
        })
        .map((l) => ({
          listing_id: l.pushed_listing_id!,
          status: 'pending' as const,
          attempts: 0,
          queued_at: now,
          force: true,
          completed_at: null,
          last_error: null,
          started_at: null,
        }));

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from('enrichment_queue')
          .upsert(chunk, { onConflict: 'listing_id' });
        if (error) {
          console.error('Queue upsert error:', error);
          sonnerToast.error('Failed to queue enrichment');
          if (activityItem)
            completeOperation.mutate({ id: activityItem.id, finalStatus: 'failed' });
          setIsReEnriching(false);
          return;
        }
      }

      if (rows.length > 0) {
        sonnerToast.success(
          `Re-queued ${rows.length} lead${rows.length !== 1 ? 's' : ''} for enrichment`,
        );
      } else {
        sonnerToast.info('No leads in All Deals found to re-enrich');
      }
      setSelectedIds(new Set());

      setIsReEnriching(false);
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
    },
    [leads, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient],
  );

  // Archive selected leads (soft-delete, hidden from default view)
  const handleArchive = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      const { error } = await supabase
        .from('valuation_leads')
        .update({ is_archived: true } as never)
        .in('id', leadIds);
      if (error) {
        sonnerToast.error('Failed to archive leads');
        return;
      }
      sonnerToast.success(`Archived ${leadIds.length} lead${leadIds.length !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
    },
    [queryClient],
  );

  // Enrich All — auto-creates listings for leads that don't have one yet, then queues all for enrichment
  const handleBulkEnrich = useCallback(
    async (mode: 'unenriched' | 'all') => {
      const allLeads = leads || [];

      // All leads that have a website (they can be enriched)
      const leadsWithWebsite = allLeads.filter((l) => !!inferWebsite(l));

      // For "unenriched" mode, only process leads that haven't been enriched yet
      const enrichableLeads =
        mode === 'unenriched'
          ? leadsWithWebsite.filter((l) => !l.pushed_listing_id)
          : leadsWithWebsite;

      if (!enrichableLeads.length) {
        sonnerToast.info(
          mode === 'unenriched'
            ? 'All leads have already been enriched'
            : 'No leads with websites to enrich',
        );
        return;
      }

      setIsEnriching(true);

      // Step 1: Auto-create listings only for leads that don't have one yet
      const leadsNeedingListing = enrichableLeads.filter((l) => !l.pushed_listing_id);
      if (leadsNeedingListing.length > 0) {
        sonnerToast.info(`Creating listings for ${leadsNeedingListing.length} leads...`);
        const LISTING_BATCH = 50;
        for (let i = 0; i < leadsNeedingListing.length; i += LISTING_BATCH) {
          const batch = leadsNeedingListing.slice(i, i + LISTING_BATCH);
          await Promise.all(
            batch.map(async (lead) => {
              try {
                const dealIdentifier = `vlead_${lead.id.slice(0, 8)}`;
                // Check if listing already exists
                const { data: existing, error: existingError } = await supabase
                  .from('listings')
                  .select('id')
                  .eq('deal_identifier', dealIdentifier)
                  .maybeSingle();
                if (existingError) throw existingError;

                let listingId: string;
                if (existing?.id) {
                  listingId = existing.id;
                } else {
                  const { data: listing, error: insertError } = await supabase
                    .from('listings')
                    .insert(buildListingFromLead(lead, false))
                    .select('id')
                    .single();
                  if (insertError || !listing) return;
                  listingId = listing.id;
                }
                // Save the listing reference back to the lead
                await supabase
                  .from('valuation_leads')
                  .update({ pushed_listing_id: listingId } as never)
                  .eq('id', lead.id);
                // Update in-memory so queue step picks it up
                lead.pushed_listing_id = listingId;
              } catch {
                // Non-blocking per-lead
              }
            }),
          );
        }
      }

      // Step 2: Collect all listing IDs (now including newly created ones)
      const targets = enrichableLeads.filter((l) => !!l.pushed_listing_id);

      let activityItem: { id: string } | null = null;
      try {
        const result = await startOrQueueMajorOp({
          operationType: 'deal_enrichment',
          totalItems: targets.length,
          description: `Enriching ${targets.length} valuation lead listings`,
          userId: user?.id || '',
          contextJson: { source: 'valuation_leads_bulk' },
        });
        activityItem = result.item;
      } catch {
        // Non-blocking
      }

      const now = new Date().toISOString();
      const seen = new Set<string>();
      const rows = targets
        .filter((l) => {
          if (!l.pushed_listing_id || seen.has(l.pushed_listing_id)) return false;
          seen.add(l.pushed_listing_id!);
          return true;
        })
        .map((l) => ({
          listing_id: l.pushed_listing_id!,
          status: 'pending' as const,
          attempts: 0,
          queued_at: now,
          force: mode === 'all',
          completed_at: null,
          last_error: null,
          started_at: null,
        }));

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const listingIds = chunk.map((r) => r.listing_id);

        // First: reset any existing rows so force/status/attempts are always overwritten
        const { error: updateError } = await supabase
          .from('enrichment_queue')
          .update({
            status: 'pending',
            force: mode === 'all',
            attempts: 0,
            queued_at: now,
            completed_at: null,
            last_error: null,
            started_at: null,
          })
          .in('listing_id', listingIds);

        if (updateError) console.warn('Queue pre-update error (non-fatal):', updateError);

        // Then: insert rows that don't exist yet (upsert will skip existing due to prior update)
        const { error } = await supabase
          .from('enrichment_queue')
          .upsert(chunk, { onConflict: 'listing_id', ignoreDuplicates: true });

        if (error) {
          console.error('Queue upsert error:', error);
          sonnerToast.error(`Failed to queue enrichment (batch ${Math.floor(i / CHUNK) + 1})`);
          if (activityItem)
            completeOperation.mutate({ id: activityItem.id, finalStatus: 'failed' });
          setIsEnriching(false);
          return;
        }
      }

      sonnerToast.success(
        `Queued ${rows.length} lead${rows.length !== 1 ? 's' : ''} in All Deals for enrichment`,
      );

      // Trigger the enrichment worker and handle results (matching CapTarget pattern)
      try {
        const { data: result, error: resultError } = await supabase.functions.invoke(
          'process-enrichment-queue',
          {
            body: { source: 'valuation_leads_bulk' },
          },
        );
        if (resultError) throw resultError;
        if (result?.synced > 0 || result?.processed > 0) {
          const totalDone = (result?.synced || 0) + (result?.processed || 0);
          if (activityItem)
            updateProgress.mutate({ id: activityItem.id, completedItems: totalDone });
          if (result?.processed === 0) {
            sonnerToast.success(`All ${result.synced} deals were already enriched`);
            if (activityItem)
              completeOperation.mutate({ id: activityItem.id, finalStatus: 'completed' });
          }
        }
      } catch {
        // Non-blocking — enrichment progress hook will track completion via polling
      }

      setIsEnriching(false);
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
    },
    [leads, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient],
  );

  // Retry failed enrichment (matching All Deals pattern)
  const handleRetryFailedEnrichment = useCallback(async () => {
    dismissSummary();
    if (!enrichmentSummary?.errors.length) return;
    const failedIds = enrichmentSummary.errors.map((e) => e.listingId);
    const nowIso = new Date().toISOString();
    await supabase
      .from('enrichment_queue')
      .update({ status: 'pending', attempts: 0, last_error: null, queued_at: nowIso })
      .in('listing_id', failedIds);
    sonnerToast.success(
      `Retrying ${failedIds.length} failed deal${failedIds.length !== 1 ? 's' : ''}`,
    );
    void supabase.functions
      .invoke('process-enrichment-queue', { body: { source: 'valuation_leads_retry' } })
      .catch(console.warn);
  }, [dismissSummary, enrichmentSummary]);

  // Score leads
  const handleScoreLeads = useCallback(
    async (mode: 'unscored' | 'all') => {
      const targets =
        mode === 'unscored' ? filteredLeads.filter((l) => l.lead_score == null) : filteredLeads;

      if (!targets.length) {
        sonnerToast.info('No leads to score');
        return;
      }

      setIsScoring(true);
      sonnerToast.info(`Scoring ${targets.length} leads...`);

      try {
        const { data, error } = await supabase.functions.invoke('calculate-valuation-lead-score', {
          body: { mode },
        });

        if (error) throw error;

        sonnerToast.success(`Scored ${data?.scored ?? targets.length} leads`);
      } catch (err) {
        console.error('Scoring failed:', err);
        sonnerToast.error('Scoring failed');
      }

      setIsScoring(false);
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
    },
    [filteredLeads, queryClient],
  );

  // Assign deal owner to valuation lead (and synced listing if pushed)
  const handleAssignOwner = useCallback(
    async (lead: ValuationLead, ownerId: string | null) => {
      // Always update the valuation_leads row
      const { error } = await supabase
        .from('valuation_leads')
        .update({ deal_owner_id: ownerId })
        .eq('id', lead.id);
      if (error) {
        sonnerToast.error('Failed to update owner');
        return;
      }
      // Also update the pushed listing if one exists
      if (lead.pushed_listing_id) {
        await supabase
          .from('listings')
          .update({ deal_owner_id: ownerId })
          .eq('id', lead.pushed_listing_id);
      }
      sonnerToast.success(ownerId ? 'Owner assigned' : 'Owner removed');
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
    },
    [queryClient],
  );

  // KPI Stats (based on current view: tab + timeframe + filters)
  const kpiStats = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const openToIntros = filteredLeads.filter((l) => l.open_to_intros === true).length;
    const exitNow = filteredLeads.filter((l) => l.exit_timing === 'now').length;
    const pushedCount = filteredLeads.filter((l) => l.pushed_to_all_deals === true).length;
    const avgScore =
      filteredLeads.length > 0
        ? Math.round(
            filteredLeads.reduce((sum, l) => sum + (l.lead_score ?? 0), 0) / filteredLeads.length,
          )
        : 0;

    return { totalLeads, openToIntros, exitNow, pushedCount, avgScore };
  }, [filteredLeads]);

  const totalLeads = leads?.length || 0;
  const unscoredCount = leads?.filter((l) => l.lead_score == null).length || 0;
  const pushedTotal = leads?.filter((l) => l.pushed_to_all_deals).length || 0;

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
      <HeaderToolbar
        totalLeads={totalLeads}
        unscoredCount={unscoredCount}
        pushedTotal={pushedTotal}
        isEnriching={isEnriching}
        isScoring={isScoring}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        onBulkEnrich={handleBulkEnrich}
        onScoreLeads={handleScoreLeads}
      />

      {/* Calculator Type Tabs */}
      <CalculatorTypeTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        calculatorTypes={calculatorTypes}
        leads={leads || []}
      />

      {/* KPI Stats Cards */}
      <KpiStatsCards stats={kpiStats} />

      {/* Filter Bar */}
      <FilterBar
        filterState={filterState}
        onFilterStateChange={setFilterState}
        fieldDefinitions={VALUATION_LEAD_FIELDS}
        dynamicOptions={dynamicOptions}
        totalCount={engineTotal}
        filteredCount={filteredCount}
      />

      {/* Hide Pushed Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setHidePushed((h) => !h)}
          className={cn(
            'flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors',
            hidePushed
              ? 'bg-primary/10 border-primary/30 text-primary font-medium'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
        >
          <EyeOff className="h-3.5 w-3.5" />
          {hidePushed ? 'Showing Un-Pushed Only' : 'Hide Pushed'}
        </button>
      </div>

      {/* Enrichment Progress Bar (matching CapTarget / GP Partners / All Deals) */}
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

      {/* Deal Enrichment Summary Dialog */}
      <DealEnrichmentSummaryDialog
        open={showEnrichmentSummary}
        onOpenChange={(open) => !open && dismissSummary()}
        summary={enrichmentSummary}
        onRetryFailed={handleRetryFailedEnrichment}
      />

      {/* Bulk Actions (selection-based) */}
      <BulkActionsBar
        selectedIds={selectedIds}
        filteredLeads={filteredLeads}
        isPushing={isPushing}
        isPushEnriching={isPushEnriching}
        isReEnriching={isReEnriching}
        onClearSelection={() => setSelectedIds(new Set())}
        onPushToAllDeals={handlePushToAllDeals}
        onPushAndEnrich={handlePushAndEnrich}
        onReEnrich={handleReEnrich}
        onArchive={handleArchive}
      />

      {/* Leads Table */}
      <LeadsTable
        paginatedLeads={paginatedLeads}
        activeTab={activeTab}
        colWidths={colWidths}
        sortColumn={sortColumn}
        safePage={safePage}
        pageSize={PAGE_SIZE}
        selectedIds={selectedIds}
        allSelected={allSelected}
        adminProfiles={adminProfiles}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelect={toggleSelect}
        onSort={handleSort}
        onStartResize={startResize}
        onRowClick={handleRowClick}
        onAssignOwner={handleAssignOwner}
        onPushToAllDeals={handlePushToAllDeals}
        onPushAndEnrich={handlePushAndEnrich}
        onReEnrich={handleReEnrich}
        refetch={refetch}
      />

      {/* Pagination */}
      <LeadsPagination
        filteredCount={filteredLeads.length}
        totalLeads={totalLeads}
        safePage={safePage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
