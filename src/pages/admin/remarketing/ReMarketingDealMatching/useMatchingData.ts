import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBackgroundScoringProgress } from "@/hooks/useBackgroundScoringProgress";
import type { SortOption, FilterTab } from "./types";

export function useMatchingData(listingId: string | undefined) {
  const queryClient = useQueryClient();
  const [selectedUniverse, setSelectedUniverse] = useState<string>("");
  const [isScoring, setIsScoring] = useState(false);
  const [scoringProgress, setScoringProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [sortDesc, setSortDesc] = useState(true);
  const [hideDisqualified, setHideDisqualified] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [geographyMode, setGeographyMode] = useState<'critical' | 'preferred' | 'minimal'>('critical');

  const backgroundScoring = useBackgroundScoringProgress(listingId!, selectedUniverse !== 'all' ? selectedUniverse : undefined);

  // Fetch the listing
  const { data: listing, isLoading: listingLoading } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: async () => {
      const { data, error } = await supabase.from('listings').select('*').eq('id', listingId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!listingId
  });

  // Fetch universes
  const { data: linkedUniverses, refetch: refetchLinkedUniverses } = useQuery({
    queryKey: ['remarketing', 'linked-universes', listingId],
    queryFn: async () => {
      const { data, error } = await supabase.from('remarketing_universe_deals')
        .select(`universe_id, universe:remarketing_buyer_universes(id, name, geography_weight, size_weight, service_weight, owner_goals_weight)`)
        .eq('listing_id', listingId!).eq('status', 'active');
      if (error) throw error;
      return (data || []).map(d => d.universe).filter(Boolean) as Array<{ id: string; name: string; geography_weight: number; size_weight: number; service_weight: number; owner_goals_weight: number; }>;
    },
    enabled: !!listingId
  });

  // Saved adjustments
  const { data: savedAdjustments } = useQuery({
    queryKey: ['deal-scoring-adjustments', listingId],
    queryFn: async () => {
      const { data, error } = await supabase.from('deal_scoring_adjustments').select('*').eq('listing_id', listingId!).eq('adjustment_type', 'custom_instructions').single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!listingId
  });

  useEffect(() => { if (savedAdjustments?.reason) setCustomInstructions(savedAdjustments.reason); }, [savedAdjustments]);
  useEffect(() => { if (linkedUniverses && linkedUniverses.length > 0 && !selectedUniverse) setSelectedUniverse('all'); }, [linkedUniverses, selectedUniverse]);

  // Fetch scores
  const { data: allScores, isLoading: scoresLoading } = useQuery({
    queryKey: ['remarketing', 'scores', listingId],
    queryFn: async () => {
      const { data, error } = await supabase.from('remarketing_scores')
        .select(`*, buyer:remarketing_buyers(*, contacts:remarketing_buyer_contacts(id)), universe:remarketing_buyer_universes(id, name)`)
        .eq('listing_id', listingId!).order('composite_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!listingId
  });

  // Fee agreements
  const { data: feeAgreements } = useQuery({
    queryKey: ['firm-agreements-signed'],
    queryFn: async () => {
      const { data, error } = await supabase.from('firm_agreements')
        .select('id, primary_company_name, normalized_company_name, website_domain, email_domain, fee_agreement_signed, fee_agreement_signed_at')
        .eq('fee_agreement_signed', true);
      if (error) throw error;
      return data || [];
    },
  });

  const feeAgreementLookup = useMemo(() => {
    if (!feeAgreements) return new Map<string, { signed: boolean; signedAt: string | null }>();
    const lookup = new Map<string, { signed: boolean; signedAt: string | null }>();
    const byName = new Map<string, typeof feeAgreements[0]>();
    const byDomain = new Map<string, typeof feeAgreements[0]>();
    for (const fa of feeAgreements) {
      if (fa.normalized_company_name) byName.set(fa.normalized_company_name.toLowerCase(), fa);
      if (fa.website_domain) byDomain.set(fa.website_domain.toLowerCase(), fa);
      if (fa.email_domain) byDomain.set(fa.email_domain.toLowerCase(), fa);
    }
    if (allScores) {
      for (const score of allScores) {
        const buyer = score.buyer;
        if (!buyer) continue;
        let match: typeof feeAgreements[0] | undefined;
        if (buyer.company_website) { const domain = buyer.company_website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0].toLowerCase(); match = byDomain.get(domain); }
        if (!match && buyer.email_domain) match = byDomain.get(buyer.email_domain.toLowerCase());
        if (!match && buyer.company_name) { const normalized = buyer.company_name.toLowerCase().replace(/[^a-z0-9]/g, ''); match = byName.get(normalized); if (!match) match = byName.get(buyer.company_name.toLowerCase()); }
        if (!match && buyer.pe_firm_name) { const peName = buyer.pe_firm_name.toLowerCase().replace(/[^a-z0-9]/g, ''); match = byName.get(peName); }
        if (match) lookup.set(score.id, { signed: true, signedAt: match.fee_agreement_signed_at });
      }
    }
    return lookup;
  }, [feeAgreements, allScores]);

  // Outreach
  const { data: outreachRecords, refetch: refetchOutreach } = useQuery({
    queryKey: ['remarketing', 'outreach', listingId],
    queryFn: async () => { const { data, error } = await supabase.from('remarketing_outreach').select('*').eq('listing_id', listingId!); if (error) throw error; return data || []; },
    enabled: !!listingId
  });

  // Filter scores by universe
  const scores = useMemo(() => {
    if (!allScores) return [];
    if (selectedUniverse === 'all' || !selectedUniverse) return allScores;
    return allScores.filter(s => s.universe_id === selectedUniverse);
  }, [allScores, selectedUniverse]);

  const universeMatchCounts = useMemo(() => {
    if (!allScores || !linkedUniverses) return {};
    const counts: Record<string, number> = {};
    for (const u of linkedUniverses) counts[u.id] = allScores.filter(s => s.universe_id === u.id).length;
    return counts;
  }, [allScores, linkedUniverses]);

  // Stats
  const stats = useMemo(() => {
    if (!scores) return { qualified: 0, disqualified: 0, strong: 0, approved: 0, passed: 0, total: 0, disqualificationReason: '' };
    const qualified = scores.filter(s => !s.is_disqualified && s.composite_score >= 50 && s.status !== 'passed').length;
    const disqualifiedScores = scores.filter(s => s.is_disqualified || s.composite_score < 35);
    const disqualified = disqualifiedScores.length;
    const strong = scores.filter(s => s.composite_score >= 80).length;
    const approved = scores.filter(s => s.status === 'approved').length;
    const passed = scores.filter(s => s.status === 'passed').length;
    const reasons = disqualifiedScores.map(s => {
      if (s.disqualification_reason) return s.disqualification_reason;
      const r = s.fit_reasoning?.toLowerCase() || '';
      if (r.includes('[missing_data:')) return 'insufficient data';
      if (r.includes('disqualified: deal revenue') || r.includes('below buyer minimum')) return 'size mismatch';
      if (r.includes('dealbreaker: deal includes excluded')) return 'excluded criteria';
      if (r.includes('geography strict:')) return 'geography mismatch';
      const dimensions = [
        { name: 'size mismatch', score: s.size_score ?? 100 },
        { name: 'no nearby presence', score: s.geography_score ?? 100 },
        { name: 'service mismatch', score: s.service_score ?? 100 },
        { name: 'owner goals mismatch', score: s.owner_goals_score ?? 100 },
      ];
      const weakest = dimensions.reduce((min, d) => d.score < min.score ? d : min, dimensions[0]);
      if (weakest.score < 40) return weakest.name;
      return 'criteria mismatch';
    });
    const reasonCounts = reasons.reduce((acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }), {} as Record<string, number>);
    const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    return { qualified, disqualified, strong, approved, passed, total: scores.length, disqualificationReason: topReason };
  }, [scores]);

  const activeOutreachScoreIds = useMemo(() => {
    return outreachRecords?.filter(o => !['pending', 'closed_won', 'closed_lost'].includes(o.status ?? '')).map(o => o.score_id) || [];
  }, [outreachRecords]);

  const outreachCount = activeOutreachScoreIds.length;

  // Filter and sort
  const filteredScores = useMemo(() => {
    if (!scores) return [];
    let filtered = [...scores];
    if (activeTab === 'approved') filtered = filtered.filter(s => s.status === 'approved');
    else if (activeTab === 'passed') filtered = filtered.filter(s => s.status === 'passed');
    else if (activeTab === 'outreach') filtered = filtered.filter(s => activeOutreachScoreIds.includes(s.id));
    if (hideDisqualified) filtered = filtered.filter(s => !s.is_disqualified);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => {
        const buyer = s.buyer;
        if (!buyer) return false;
        return (buyer.company_name || '').toLowerCase().includes(q) || (buyer.pe_firm_name || '').toLowerCase().includes(q) || (buyer.thesis_summary || '').toLowerCase().includes(q) || (buyer.hq_state || '').toLowerCase().includes(q) || (buyer.hq_city || '').toLowerCase().includes(q);
      });
    }
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'score': comparison = (a.composite_score || 0) - (b.composite_score || 0); break;
        case 'geography': comparison = (a.geography_score || 0) - (b.geography_score || 0); break;
        case 'score_geo': {
          const activeUniverse = selectedUniverse !== 'all' ? linkedUniverses?.find(u => u.id === selectedUniverse) : linkedUniverses?.[0];
          const geoRatio = Math.min(0.5, (activeUniverse?.geography_weight || 20) / 100);
          const scoreRatio = 1 - geoRatio;
          comparison = ((a.composite_score || 0) * scoreRatio + (a.geography_score || 0) * geoRatio) - ((b.composite_score || 0) * scoreRatio + (b.geography_score || 0) * geoRatio);
          break;
        }
      }
      return sortDesc ? -comparison : comparison;
    });
    return filtered;
  }, [scores, activeTab, hideDisqualified, sortBy, sortDesc, activeOutreachScoreIds, selectedUniverse, linkedUniverses, searchQuery]);

  // Pipeline deals
  const { data: pipelineDeals } = useQuery({
    queryKey: ['pipeline-deals-for-listing', listingId],
    queryFn: async () => {
      if (!listingId) return [];
      const { data, error } = await supabase.from('deals').select('id, remarketing_buyer_id').eq('listing_id', listingId!).not('remarketing_buyer_id', 'is', null).is('deleted_at', null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!listingId,
  });

  const pipelineDealByBuyer = useMemo(() => {
    const map = new Map<string, string>();
    pipelineDeals?.forEach(d => { if (d.remarketing_buyer_id) map.set(d.remarketing_buyer_id, d.id); });
    return map;
  }, [pipelineDeals]);

  return {
    listing, listingLoading,
    linkedUniverses, refetchLinkedUniverses,
    allScores, scores, scoresLoading, filteredScores,
    feeAgreementLookup, outreachRecords, refetchOutreach,
    stats, outreachCount, universeMatchCounts,
    pipelineDealByBuyer,
    // State
    selectedUniverse, setSelectedUniverse,
    isScoring, setIsScoring,
    scoringProgress, setScoringProgress,
    activeTab, setActiveTab,
    sortBy, setSortBy,
    sortDesc, setSortDesc,
    hideDisqualified, setHideDisqualified,
    searchQuery, setSearchQuery,
    customInstructions, setCustomInstructions,
    geographyMode, setGeographyMode,
    backgroundScoring,
  };
}
