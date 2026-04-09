import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MatchToolLead } from './types';

export const PAGE_SIZE = 50;

type FilterTab = 'all' | 'has_contact' | 'has_financials' | 'website_only' | 'pushed' | 'archived';

function buildListingFromMatchLead(lead: MatchToolLead, forPush = true) {
  const enrichment = lead.enrichment_data as Record<string, any> | null;
  const raw = lead.raw_inputs as Record<string, any> | null;

  const companyName = enrichment?.company_name || lead.business_name || cleanDomain(lead.website);
  const title = companyName;

  const REVENUE_LABELS: Record<string, string> = {
    under_500k: '<$500K', '500k_1m': '$500K–1M', '1m_5m': '$1M–5M',
    '5m_10m': '$5M–10M', '10m_25m': '$10M–25M', '25m_50m': '$25M–50M', '50m_plus': '$50M+',
  };
  const PROFIT_LABELS: Record<string, string> = {
    under_100k: '<$100K', '100k_500k': '$100K–500K', '500k_1m': '$500K–1M',
    '1m_3m': '$1M–3M', '3m_5m': '$3M–5M', '5m_plus': '$5M+',
  };

  const noteLines: string[] = [
    `--- Match Tool Lead Intelligence ---`,
    `Source: Deal Match AI (${lead.source || 'deal-match-ai'})`,
    `Submitted: ${new Date(lead.created_at).toLocaleDateString()}`,
    `Submission Stage: ${lead.submission_stage}`,
  ];

  if (lead.full_name) noteLines.push(`Name: ${lead.full_name}`);
  if (lead.email) noteLines.push(`Email: ${lead.email}`);
  if (lead.phone) noteLines.push(`Phone: ${lead.phone}`);
  if (lead.business_name) noteLines.push(`Business Name: ${lead.business_name}`);
  if (lead.website) noteLines.push(`Website: ${lead.website}`);
  if (lead.linkedin_url) noteLines.push(`LinkedIn: ${lead.linkedin_url}`);
  if (lead.revenue) noteLines.push(`Revenue: ${REVENUE_LABELS[lead.revenue] || lead.revenue}`);
  if (lead.profit) noteLines.push(`Profit: ${PROFIT_LABELS[lead.profit] || lead.profit}`);
  if (lead.timeline) noteLines.push(`Exit Timeline: ${lead.timeline}`);
  if (lead.industry) noteLines.push(`Industry: ${lead.industry}`);

  if (enrichment) {
    noteLines.push(`\n--- Company Intelligence ---`);
    if (enrichment.one_liner) noteLines.push(`Summary: ${enrichment.one_liner}`);
    if (enrichment.industry) noteLines.push(`Industry: ${enrichment.industry}`);
    if (enrichment.geography) noteLines.push(`Geography: ${enrichment.geography}`);
    if (enrichment.employee_estimate) noteLines.push(`Employees: ~${enrichment.employee_estimate}`);
    if (enrichment.year_founded) noteLines.push(`Founded: ${enrichment.year_founded}`);
    if (enrichment.revenue_estimate) noteLines.push(`Est. Revenue: ${enrichment.revenue_estimate}`);
    if (enrichment.services?.length) noteLines.push(`Services: ${enrichment.services.join(', ')}`);
    if (enrichment.notable_signals?.length) noteLines.push(`Signals: ${enrichment.notable_signals.join('; ')}`);
  }

  if (lead.lead_score != null) noteLines.push(`Lead Score: ${lead.lead_score}/100`);
  if (lead.quality_tier) noteLines.push(`Quality Tier: ${lead.quality_tier}`);
  if (lead.scoring_notes) noteLines.push(`Scoring Notes: ${lead.scoring_notes}`);
  if (lead.submission_count && lead.submission_count > 1) noteLines.push(`Visits: ${lead.submission_count}`);

  const city = raw?.city;
  const region = raw?.region;
  const locationStr = city && region ? `${city}, ${region}` : city || region || enrichment?.geography || lead.location || null;

  const websiteClean = lead.website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

  const motivationParts: string[] = [];
  if (lead.timeline) motivationParts.push(`Exit timeline: ${lead.timeline}`);
  if (lead.submission_stage === 'full_form') motivationParts.push('Submitted full form — wants buyer list');

  return {
    title,
    internal_company_name: title,
    deal_source: 'match_tool',
    deal_identifier: `mtlead_${lead.id.slice(0, 8)}`,
    status: 'active',
    is_internal_deal: true,
    pushed_to_all_deals: forPush,
    ...(forPush ? { pushed_to_all_deals_at: new Date().toISOString() } : {}),
    main_contact_name: lead.full_name || null,
    main_contact_email: lead.email || null,
    main_contact_phone: lead.phone || null,
    website: `https://${websiteClean}`,
    linkedin_url: lead.linkedin_url || enrichment?.linkedin_url || null,
    industry: enrichment?.industry || lead.industry || null,
    category: enrichment?.industry || null,
    location: locationStr,
    seller_motivation: motivationParts.join('. ') || null,
    internal_notes: noteLines.join('\n'),
    deal_owner_id: lead.deal_owner_id || null,
  } as never;
}

function cleanDomain(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

export function useMatchToolLeadsData() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPushing, setIsPushing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isMarkingNotFit, setIsMarkingNotFit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedLead, setSelectedLead] = useState<MatchToolLead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ['match-tool-leads', activeTab, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('match_tool_leads' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      // Tab filters
      switch (activeTab) {
        case 'has_contact':
          query = query.not('email', 'is', null);
          break;
        case 'has_financials':
          query = query.eq('submission_stage', 'financials');
          break;
        case 'website_only':
          query = query.is('email', null).eq('submission_stage', 'browse');
          break;
        case 'pushed':
          query = query.eq('pushed_to_all_deals', true);
          break;
        case 'archived':
          query = query.or('excluded.eq.true,not_a_fit.eq.true');
          break;
        default:
          query = query.or('excluded.is.null,excluded.eq.false')
            .or('not_a_fit.is.null,not_a_fit.eq.false');
          break;
      }

      if (searchQuery) {
        query = query.or(
          `website.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,business_name.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as MatchToolLead[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['match-tool-leads'] });
    queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
  };

  const markNotAFit = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('match_tool_leads' as any)
        .update({ not_a_fit: true } as any)
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setSelectedIds(new Set());
      toast.success('Marked as not a fit');
    },
  });

  const deleteLeads = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('match_tool_leads' as any)
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setSelectedIds(new Set());
      toast.success('Leads deleted');
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('match_tool_leads' as any)
        .update({ status } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Status updated');
    },
  });

  const enrichLead = useMutation({
    mutationFn: async ({ lead_id, website }: { lead_id: string; website: string }) => {
      const { data, error } = await supabase.functions.invoke('enrich-match-tool-lead', {
        body: { lead_id, website },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (error: Error) => {
      toast.error(`Enrichment failed: ${error.message}`);
    },
  });

  // --- Bulk Actions ---

  const handlePushToAllDeals = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0 || isPushing) return;
      setIsPushing(true);

      const leadsToProcess = leads.filter(
        (l) => leadIds.includes(l.id) && !l.pushed_to_all_deals,
      );
      let successCount = 0;
      let errorCount = 0;

      for (const lead of leadsToProcess) {
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
          if (error) { errorCount++; continue; }
        } else {
          const { data: listing, error: insertError } = await supabase
            .from('listings')
            .insert(buildListingFromMatchLead(lead, true))
            .select('id')
            .single();
          if (insertError || !listing) { errorCount++; continue; }
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
        toast.success(
          `Added ${successCount} lead${successCount !== 1 ? 's' : ''} to Active Deals${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
        );
      } else {
        toast.info('Nothing to add — selected leads are already in Active Deals.');
      }
      invalidateAll();
    },
    [leads, isPushing, queryClient, setSelectedIds],
  );

  const handleEnrichSelected = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0 || isEnriching) return;
      setIsEnriching(true);
      let success = 0;
      let failed = 0;

      for (const id of leadIds) {
        const lead = leads.find((l) => l.id === id);
        if (!lead) continue;
        try {
          const { error } = await supabase.functions.invoke('enrich-match-tool-lead', {
            body: { lead_id: lead.id, website: lead.website },
          });
          if (error) { failed++; } else { success++; }
        } catch {
          failed++;
        }
      }

      setIsEnriching(false);
      setSelectedIds(new Set());
      if (success > 0) toast.success(`Enriched ${success} lead${success !== 1 ? 's' : ''}${failed > 0 ? ` (${failed} failed)` : ''}`);
      else if (failed > 0) toast.error(`Enrichment failed for ${failed} lead${failed !== 1 ? 's' : ''}`);
      invalidateAll();
    },
    [leads, isEnriching],
  );

  const handleMarkNotFit = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setIsMarkingNotFit(true);
      const { error } = await supabase
        .from('match_tool_leads' as any)
        .update({ not_a_fit: true } as any)
        .in('id', ids);
      setIsMarkingNotFit(false);
      if (error) { toast.error('Failed to mark as not a fit'); return; }
      toast.success(`Marked ${ids.length} lead${ids.length !== 1 ? 's' : ''} as not a fit`);
      setSelectedIds(new Set());
      invalidateAll();
    },
    [],
  );

  const handleArchive = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from('match_tool_leads' as any)
        .update({ excluded: true } as any)
        .in('id', ids);
      if (error) { toast.error('Failed to archive'); return; }
      toast.success(`Archived ${ids.length} lead${ids.length !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      invalidateAll();
    },
    [],
  );

  const handleDelete = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setIsDeleting(true);
      const { error } = await supabase
        .from('match_tool_leads' as any)
        .delete()
        .in('id', ids);
      setIsDeleting(false);
      if (error) { toast.error('Failed to delete'); return; }
      toast.success(`Deleted ${ids.length} lead${ids.length !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      invalidateAll();
    },
    [],
  );

  const handleRowClick = useCallback((lead: MatchToolLead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  }, []);

  const handleOpenDeal = useCallback(
    async (lead: MatchToolLead) => {
      if (lead.pushed_listing_id) {
        navigate('/admin/deals/' + lead.pushed_listing_id, {
          state: { from: '/admin/remarketing/leads/match-tool' },
        });
      }
    },
    [navigate],
  );

  return {
    leads,
    isLoading,
    refetch,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    selectedIds,
    setSelectedIds,
    markNotAFit,
    deleteLeads,
    updateStatus,
    enrichLead,
    // Bulk actions
    handlePushToAllDeals,
    handleEnrichSelected,
    handleMarkNotFit,
    handleArchive,
    handleDelete,
    handleRowClick,
    handleOpenDeal,
    isPushing,
    isEnriching,
    isMarkingNotFit,
    isDeleting,
    // Drawer
    selectedLead,
    setSelectedLead,
    drawerOpen,
    setDrawerOpen,
  };
}
