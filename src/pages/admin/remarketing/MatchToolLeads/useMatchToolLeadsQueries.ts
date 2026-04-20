/**
 * Query hooks for MatchToolLeads — data fetching, filtering, sorting,
 * pagination, and selection state. Mirrors useValuationLeadsQueries.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTimeframe } from '@/hooks/use-timeframe';
import { useFilterEngine } from '@/hooks/use-filter-engine';
import { MATCH_TOOL_LEAD_FIELDS } from '@/components/filters';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import type { MatchToolLead, MatchToolSortColumn, MatchToolSortDirection } from './types';
import { cleanWebsiteToDomain, extractBusinessName, inferWebsite, QUALITY_ORDER } from './helpers';

const PAGE_SIZE = 50;
export { PAGE_SIZE };

type FilterTab = 'all' | 'full_form' | 'financials' | 'browse' | 'pushed' | 'archived';

export function useMatchToolLeadsQueries(options: { contactPollingUntil?: number | null } = {}) {
  const { contactPollingUntil = null } = options;
  const { data: adminProfiles } = useAdminProfiles();

  const { timeframe, setTimeframe, isInRange } = useTimeframe('all_time');

  // URL-persisted state
  const [searchParams, setSearchParams] = useSearchParams();
  const sortColumn = (searchParams.get('sort') as MatchToolSortColumn) ?? 'created_at';
  const sortDirection = (searchParams.get('dir') as MatchToolSortDirection) ?? 'desc';
  const activeTab = (searchParams.get('tab') as FilterTab) ?? 'all';
  const setActiveTab = useCallback(
    (v: FilterTab) => {
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (v !== 'all') n.set('tab', v);
          else n.delete('tab');
          n.delete('cp');
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const hidePushed = searchParams.get('hidePushed') === '1';
  const setHidePushed = useCallback(
    (v: boolean) => {
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (v) n.set('hidePushed', '1');
          else n.delete('hidePushed');
          n.delete('cp');
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const hideNotFit = searchParams.get('hideNotFit') !== '0';
  const setHideNotFit = useCallback(
    (v: boolean) => {
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (!v) n.set('hideNotFit', '0');
          else n.delete('hideNotFit');
          n.delete('cp');
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const showQuarantined = searchParams.get('quarantined') === '1';
  const setShowQuarantined = useCallback(
    (v: boolean) => {
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (v) n.set('quarantined', '1');
          else n.delete('quarantined');
          n.delete('cp');
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const currentPage = Number(searchParams.get('cp')) || 1;
  const setCurrentPage = useCallback(
    (v: number | ((prev: number) => number)) => {
      setSearchParams(
        (p) => {
          const cur = Number(p.get('cp')) || 1;
          const resolved = typeof v === 'function' ? v(cur) : v;
          const n = new URLSearchParams(p);
          if (resolved > 1) n.set('cp', String(resolved));
          else n.delete('cp');
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const pollingActive = contactPollingUntil !== null && Date.now() < contactPollingUntil;

  // Fetch all match tool leads (paged through 1k batches)
  const {
    data: leads,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['remarketing', 'match-tool-leads', showQuarantined ? 'quarantined' : 'active'],
    refetchOnMount: 'always',
    staleTime: 30_000,
    refetchInterval: pollingActive ? 20_000 : false,
    queryFn: async () => {
      const allData: MatchToolLead[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        // Cast to `any` to bypass the deeply-nested generic typing on the
        // dynamic table name — match_tool_leads isn't in the auto-generated
        // Supabase types, so the eq().select() chain blows up TS depth.
        const sb = supabase as any;
        const { data, error } = await sb
          .from('match_tool_leads')
          .select('*')
          .eq('excluded', showQuarantined)
          .order('created_at', { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...(data as unknown as MatchToolLead[]));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }
      return allData;
    },
  });

  // Quarantine count badge (last 7 days)
  const { data: recentQuarantinedCount = 0 } = useQuery({
    queryKey: ['remarketing', 'match-tool-leads', 'quarantined-recent-count'],
    staleTime: 60_000,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const sb = supabase as any;
      const { count, error } = await sb
        .from('match_tool_leads')
        .select('id', { count: 'exact', head: true })
        .eq('excluded', true)
        .gte('created_at', sevenDaysAgo);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const {
    filteredItems: engineFiltered,
    filterState,
    setFilterState,
    dynamicOptions,
    filteredCount,
    totalCount: engineTotal,
  } = useFilterEngine(leads ?? [], MATCH_TOOL_LEAD_FIELDS);

  // Apply tab + timeframe + dedup + sort
  const filteredLeads = useMemo(() => {
    let filtered = engineFiltered as MatchToolLead[];

    if (activeTab === 'archived') {
      filtered = filtered.filter((l) => l.is_archived || l.not_a_fit);
    } else {
      filtered = filtered.filter((l) => !l.is_archived);
      if (hideNotFit) filtered = filtered.filter((l) => !l.not_a_fit);
      if (hidePushed) filtered = filtered.filter((l) => !l.pushed_to_all_deals);
      if (activeTab === 'full_form')
        filtered = filtered.filter((l) => l.submission_stage === 'full_form');
      else if (activeTab === 'financials')
        filtered = filtered.filter((l) => l.submission_stage === 'financials');
      else if (activeTab === 'browse')
        filtered = filtered.filter((l) => l.submission_stage === 'browse');
      else if (activeTab === 'pushed') filtered = filtered.filter((l) => l.pushed_to_all_deals);
    }

    filtered = filtered.filter((l) => isInRange(l.created_at));

    // Domain dedup — keep highest-stage / most-recent record per domain
    const STAGE_RANK: Record<string, number> = { full_form: 3, financials: 2, browse: 1 };
    const domainMap = new Map<string, MatchToolLead>();
    for (const lead of filtered) {
      const domain = cleanWebsiteToDomain(lead.website);
      const key = domain ?? `__no_domain_${lead.id}`;
      const existing = domainMap.get(key);
      if (!existing) {
        domainMap.set(key, lead);
      } else {
        const existingRank = STAGE_RANK[existing.submission_stage] ?? 0;
        const newRank = STAGE_RANK[lead.submission_stage] ?? 0;
        const existingDate = existing.created_at ?? '';
        const newDate = lead.created_at ?? '';
        if (newRank > existingRank || (newRank === existingRank && newDate > existingDate)) {
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
        case 'website':
          valA = (inferWebsite(a) || '').toLowerCase();
          valB = (inferWebsite(b) || '').toLowerCase();
          break;
        case 'business_name':
          valA = extractBusinessName(a).toLowerCase();
          valB = extractBusinessName(b).toLowerCase();
          break;
        case 'full_name':
          valA = (a.full_name || '').toLowerCase();
          valB = (b.full_name || '').toLowerCase();
          break;
        case 'revenue':
          valA = a.revenue || '';
          valB = b.revenue || '';
          break;
        case 'profit':
          valA = a.profit || '';
          valB = b.profit || '';
          break;
        case 'submission_stage': {
          valA = STAGE_RANK[a.submission_stage] ?? 0;
          valB = STAGE_RANK[b.submission_stage] ?? 0;
          break;
        }
        case 'status':
          valA = (a.status || '').toLowerCase();
          valB = (b.status || '').toLowerCase();
          break;
        case 'quality':
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
  }, [
    engineFiltered,
    activeTab,
    isInRange,
    sortColumn,
    sortDirection,
    adminProfiles,
    hidePushed,
    hideNotFit,
  ]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLeads = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, safePage]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, timeframe, sortColumn, sortDirection, filterState]);

  const handleSort = (col: MatchToolSortColumn) => {
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

  // Stage tab counts (computed from RAW leads, ignoring active tab)
  const stageCounts = useMemo(() => {
    const all = (leads ?? []).filter((l) => !l.is_archived && !l.excluded);
    return {
      all: all.length,
      full_form: all.filter((l) => l.submission_stage === 'full_form').length,
      financials: all.filter((l) => l.submission_stage === 'financials').length,
      browse: all.filter((l) => l.submission_stage === 'browse').length,
      pushed: all.filter((l) => l.pushed_to_all_deals).length,
      archived: (leads ?? []).filter((l) => l.is_archived || l.not_a_fit).length,
    };
  }, [leads]);

  // KPI stats — stage-based
  const kpiStats = useMemo(() => {
    const visible = filteredLeads;
    const wantsBuyers = visible.filter((l) => l.submission_stage === 'full_form').length;
    const hasFinancials = visible.filter(
      (l) => l.submission_stage === 'financials' || l.submission_stage === 'full_form',
    ).length;
    const pushedCount = visible.filter((l) => l.pushed_to_all_deals).length;

    const rawLeads = leads ?? [];
    const eligibleForContact = rawLeads.filter((l) => !l.excluded && l.full_name && l.email);
    const withContact = eligibleForContact.filter((l) => !!l.phone && !!l.linkedin_url).length;
    const missingContact = eligibleForContact.filter((l) => !l.phone || !l.linkedin_url).length;
    const contactCoveragePct =
      eligibleForContact.length > 0
        ? Math.round((withContact / eligibleForContact.length) * 100)
        : 0;

    return {
      totalLeads: visible.length,
      wantsBuyers,
      hasFinancials,
      pushedCount,
      contactCoverage: {
        withContact,
        missingContact,
        eligible: eligibleForContact.length,
        pct: contactCoveragePct,
      },
    };
  }, [filteredLeads, leads]);

  return {
    leads,
    isLoading,
    refetch,
    filteredLeads,
    paginatedLeads,
    adminProfiles,
    stageCounts,
    kpiStats,
    filterState,
    setFilterState,
    dynamicOptions,
    filteredCount,
    engineTotal,
    sortColumn,
    sortDirection,
    handleSort,
    activeTab,
    setActiveTab,
    timeframe,
    setTimeframe,
    currentPage,
    setCurrentPage,
    totalPages,
    safePage,
    PAGE_SIZE,
    selectedIds,
    setSelectedIds,
    allSelected,
    toggleSelectAll,
    toggleSelect,
    hidePushed,
    setHidePushed,
    hideNotFit,
    setHideNotFit,
    showQuarantined,
    setShowQuarantined,
    recentQuarantinedCount,
  };
}
