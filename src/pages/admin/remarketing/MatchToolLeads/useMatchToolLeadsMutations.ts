/**
 * Mutation hooks for MatchToolLeads — push, enrich, score, find-contacts,
 * archive, mark-not-fit, assign-owner, delete.
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast as sonnerToast } from 'sonner';
import type { MatchToolLead } from './types';
import { buildListingFromMatchToolLead, inferWebsite } from './helpers';

interface MutationDeps {
  leads: MatchToolLead[] | undefined;
  filteredLeads: MatchToolLead[];
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  setHideNotFit?: (v: boolean) => void;
}

export function useMatchToolLeadsMutations(deps: MutationDeps) {
  const { leads, filteredLeads, setSelectedIds, setHideNotFit } = deps;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Action states
  const [isPushing, setIsPushing] = useState(false);
  const [isReEnriching, setIsReEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isMarkingNotFit, setIsMarkingNotFit] = useState(false);
  const [isFindingContacts, setIsFindingContacts] = useState(false);
  const [isDeleting] = useState(false);
  const [contactPollingUntil, setContactPollingUntil] = useState<number | null>(null);

  // Drawer state
  const [selectedLead, setSelectedLead] = useState<MatchToolLead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Keep drawer in sync with refreshed leads
  useEffect(() => {
    if (!selectedLead?.id || !leads) return;
    const fresh = leads.find((l) => l.id === selectedLead.id);
    if (fresh && fresh !== selectedLead) {
      setSelectedLead(fresh);
    }
  }, [leads, selectedLead]);

  const handleRowClick = useCallback((lead: MatchToolLead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  }, []);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['remarketing', 'match-tool-leads'] });
  }, [queryClient]);

  const handleOpenDeal = useCallback(
    async (lead: MatchToolLead) => {
      try {
        if (lead.pushed_listing_id) {
          navigate('/admin/deals/' + lead.pushed_listing_id, {
            state: { from: '/admin/remarketing/leads/match-tool' },
          });
          return;
        }
        const dealIdentifier = `mtlead_${lead.id.slice(0, 8)}`;
        const { data: existing } = await supabase
          .from('listings')
          .select('id')
          .eq('deal_identifier', dealIdentifier)
          .maybeSingle();

        let listingId: string;
        if (existing?.id) {
          listingId = existing.id;
        } else {
          const { data: listing, error } = await supabase
            .from('listings')
            .insert(buildListingFromMatchToolLead(lead, false))
            .select('id')
            .single();
          if (error || !listing) {
            sonnerToast.error(error?.message || 'Failed to create deal listing');
            return;
          }
          listingId = listing.id;
        }
        await supabase
          .from('match_tool_leads' as any)
          .update({ pushed_listing_id: listingId } as any)
          .eq('id', lead.id);
        invalidate();
        navigate('/admin/deals/' + listingId, {
          state: { from: '/admin/remarketing/leads/match-tool' },
        });
      } catch (err) {
        sonnerToast.error(err instanceof Error ? err.message : 'Failed to open deal page');
      }
    },
    [navigate, invalidate],
  );

  const handlePushToAllDeals = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0 || isPushing) return;
      setIsPushing(true);
      const targets = (leads || []).filter((l) => leadIds.includes(l.id) && !l.pushed_to_all_deals);
      let successCount = 0;
      let errorCount = 0;
      for (const lead of targets) {
        let listingId = lead.pushed_listing_id;
        if (listingId) {
          const { error } = await supabase
            .from('listings')
            .update({
              remarketing_status: 'active',
              pushed_to_all_deals: true,
              pushed_to_all_deals_at: new Date().toISOString(),
            })
            .eq('id', listingId);
          if (error) {
            errorCount++;
            continue;
          }
        } else {
          const { data: listing, error } = await supabase
            .from('listings')
            .insert(buildListingFromMatchToolLead(lead, true))
            .select('id')
            .single();
          if (error || !listing) {
            errorCount++;
            continue;
          }
          listingId = listing.id;
        }
        await supabase
          .from('match_tool_leads' as any)
          .update({
            pushed_to_all_deals: true,
            pushed_to_all_deals_at: new Date().toISOString(),
            pushed_listing_id: listingId,
            status: 'pushed',
          } as any)
          .eq('id', lead.id);
        successCount++;
      }
      setIsPushing(false);
      setSelectedIds(new Set());
      if (successCount > 0) {
        sonnerToast.success(
          `Added ${successCount} lead${successCount !== 1 ? 's' : ''} to Active Deals${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
        );
      } else {
        sonnerToast.info('Nothing to add — selected leads are already in Active Deals.');
      }
      invalidate();
    },
    [leads, isPushing, invalidate, setSelectedIds],
  );

  const handlePushAndEnrich = handlePushToAllDeals; // identical contract for now

  const handleReEnrich = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      setIsReEnriching(true);
      const targets = (leads || []).filter((l) => leadIds.includes(l.id));
      try {
        for (const lead of targets) {
          if (!lead.website) continue;
          await supabase.functions.invoke('enrich-match-tool-lead', {
            body: { lead_id: lead.id, website: lead.website, force: true },
          });
          await supabase
            .from('match_tool_leads' as any)
            .update({ last_enriched_at: new Date().toISOString() } as any)
            .eq('id', lead.id);
        }
        sonnerToast.success(`Re-enriched ${targets.length} lead${targets.length !== 1 ? 's' : ''}`);
      } catch (err) {
        sonnerToast.error(err instanceof Error ? err.message : 'Re-enrichment failed');
      } finally {
        setIsReEnriching(false);
        setSelectedIds(new Set());
        invalidate();
      }
    },
    [leads, invalidate, setSelectedIds],
  );

  const handleEnrichSelected = useCallback(
    async (leadIds: string[], _mode?: 'all' | 'unenriched') => {
      if (leadIds.length === 0) return;
      setIsEnriching(true);
      const targets = (leads || []).filter((l) => leadIds.includes(l.id) && !!inferWebsite(l));
      try {
        let done = 0;
        for (const lead of targets) {
          await supabase.functions.invoke('enrich-match-tool-lead', {
            body: { lead_id: lead.id, website: lead.website },
          });
          await supabase
            .from('match_tool_leads' as any)
            .update({ last_enriched_at: new Date().toISOString() } as any)
            .eq('id', lead.id);
          done++;
        }
        sonnerToast.success(`Enriched ${done} lead${done !== 1 ? 's' : ''}`);
      } catch (err) {
        sonnerToast.error(err instanceof Error ? err.message : 'Enrichment failed');
      } finally {
        setIsEnriching(false);
        setSelectedIds(new Set());
        invalidate();
      }
    },
    [leads, invalidate, setSelectedIds],
  );

  const handleBulkEnrich = useCallback(
    async (mode: 'unenriched' | 'all') => {
      const allLeads = (leads || []).filter((l) => !!inferWebsite(l));
      const targets = mode === 'unenriched' ? allLeads.filter((l) => !l.enrichment_data) : allLeads;
      if (!targets.length) {
        sonnerToast.info(
          mode === 'unenriched' ? 'All leads already enriched' : 'No leads with websites',
        );
        return;
      }
      await handleEnrichSelected(
        targets.map((l) => l.id),
        mode === 'all' ? 'all' : 'unenriched',
      );
    },
    [leads, handleEnrichSelected],
  );

  const handleScoreLeads = useCallback(
    async (mode: 'unscored' | 'all') => {
      const targets =
        mode === 'unscored' ? filteredLeads.filter((l) => l.lead_score == null) : filteredLeads;
      if (!targets.length) {
        sonnerToast.info('No leads to score');
        return;
      }
      setIsScoring(true);
      try {
        const { data, error } = await supabase.functions.invoke('score-match-tool-lead', {
          body: { lead_ids: targets.map((l) => l.id), mode },
        });
        if (error) throw error;
        const scored = (data as { scored?: number } | null)?.scored ?? targets.length;
        sonnerToast.success(`Scored ${scored} lead${scored !== 1 ? 's' : ''}`);
      } catch (err) {
        sonnerToast.error(err instanceof Error ? err.message : 'Scoring failed');
      } finally {
        setIsScoring(false);
        invalidate();
      }
    },
    [filteredLeads, invalidate],
  );

  const handleAssignOwner = useCallback(
    async (lead: MatchToolLead, ownerId: string | null) => {
      const { error } = await supabase
        .from('match_tool_leads' as any)
        .update({ deal_owner_id: ownerId } as any)
        .eq('id', lead.id);
      if (error) {
        sonnerToast.error('Failed to update owner');
        return;
      }
      if (lead.pushed_listing_id) {
        await supabase
          .from('listings')
          .update({ deal_owner_id: ownerId })
          .eq('id', lead.pushed_listing_id);
      }
      sonnerToast.success(ownerId ? 'Owner assigned' : 'Owner removed');
      invalidate();
    },
    [invalidate],
  );

  const handleArchive = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      const { error } = await supabase
        .from('match_tool_leads' as any)
        .update({ is_archived: true } as any)
        .in('id', leadIds);
      if (error) {
        sonnerToast.error('Failed to archive leads');
        return;
      }
      sonnerToast.success(`Archived ${leadIds.length} lead${leadIds.length !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      invalidate();
    },
    [invalidate, setSelectedIds],
  );

  const handleMarkNotFit = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      setIsMarkingNotFit(true);
      try {
        const { error } = await supabase
          .from('match_tool_leads' as any)
          .update({ not_a_fit: true } as any)
          .in('id', leadIds);
        if (error) {
          sonnerToast.error('Failed to mark as not a fit');
          return;
        }
        sonnerToast.success(
          `Marked ${leadIds.length} lead${leadIds.length !== 1 ? 's' : ''} as not a fit`,
        );
        setSelectedIds(new Set());
        if (setHideNotFit) setHideNotFit(false);
        invalidate();
      } finally {
        setIsMarkingNotFit(false);
      }
    },
    [invalidate, setSelectedIds, setHideNotFit],
  );

  const handleDelete = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      const { error } = await supabase
        .from('match_tool_leads' as any)
        .delete()
        .in('id', leadIds);
      if (error) {
        sonnerToast.error('Failed to delete leads');
        return;
      }
      sonnerToast.success(`Deleted ${leadIds.length} lead${leadIds.length !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      invalidate();
    },
    [invalidate, setSelectedIds],
  );

  const handleFindContacts = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0 || isFindingContacts) return;
      const allLeads = leads || [];
      const targets = allLeads.filter(
        (l) => leadIds.includes(l.id) && (!l.linkedin_url || !l.phone) && l.full_name && l.email,
      );
      if (targets.length === 0) {
        sonnerToast.info('Selected leads already have phone & LinkedIn — nothing to find');
        return;
      }
      setIsFindingContacts(true);
      const { findMatchToolLeadContactsBulk } =
        await import('@/lib/remarketing/findMatchToolLeadContacts');
      const promise = findMatchToolLeadContactsBulk(
        targets.map((l) => l.id),
        { concurrency: 3 },
      );
      sonnerToast.promise(promise, {
        loading: `Searching Serper + Blitz for ${targets.length} lead${targets.length !== 1 ? 's' : ''}…`,
        success: (r) => {
          const parts: string[] = [];
          if (r.found) parts.push(`${r.found} found`);
          if (r.queued) parts.push(`${r.queued} async`);
          if (r.cached) parts.push(`${r.cached} cached`);
          if (r.skipped) parts.push(`${r.skipped} skipped`);
          if (r.errors) parts.push(`${r.errors} errors`);
          return `Contact search complete — ${parts.join(', ') || 'no changes'}`;
        },
        error: 'Contact search failed',
      });
      try {
        const result = await promise;
        if (result.queued > 0) {
          setContactPollingUntil(Date.now() + 5 * 60 * 1000);
        }
      } finally {
        setIsFindingContacts(false);
        setSelectedIds(new Set());
        invalidate();
      }
    },
    [leads, isFindingContacts, invalidate, setSelectedIds],
  );

  return {
    handleRowClick,
    handleOpenDeal,
    handlePushToAllDeals,
    handlePushAndEnrich,
    handleReEnrich,
    handleArchive,
    handleMarkNotFit,
    handleBulkEnrich,
    handleScoreLeads,
    handleAssignOwner,
    handleEnrichSelected,
    handleDelete,
    handleFindContacts,
    selectedLead,
    setSelectedLead,
    drawerOpen,
    setDrawerOpen,
    isPushing,
    isReEnriching,
    isScoring,
    isEnriching,
    isMarkingNotFit,
    isFindingContacts,
    isDeleting,
    contactPollingUntil,
    setContactPollingUntil,
  };
}
