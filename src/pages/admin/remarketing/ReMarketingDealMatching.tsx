import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithTimeout } from "@/lib/invoke-with-timeout";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft,
  Sparkles,
  Check,
  X,
  MapPin,
  DollarSign,
  Briefcase,
  ExternalLink,
  Loader2,
  Target,
  AlertCircle,
  CheckCircle2,
  ArrowUpDown,
  Mail,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  PassReasonDialog,
  BuyerMatchCard,
  ScoringInsightsPanel,
  BulkActionsToolbar,
  ScoringProgressIndicator,
  EmailPreviewDialog,
  QuickInsightsWidget,
  EngagementHeatmapInsight,
  StaleScoreWarning,
  WeightSuggestionsPanel,
  type OutreachStatus,
  ReMarketingChat,
} from "@/components/remarketing";
import { AddToUniverseQuickAction } from "@/components/remarketing/AddToUniverseQuickAction";
import { useBackgroundScoringProgress } from "@/hooks/useBackgroundScoringProgress";
import type { ScoreTier, DataCompleteness } from "@/types/remarketing";

type SortOption = 'score' | 'geography' | 'score_geo';
type FilterTab = 'all' | 'approved' | 'passed' | 'outreach';

const ReMarketingDealMatching = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedUniverse, setSelectedUniverse] = useState<string>("");
  const [isScoring, setIsScoring] = useState(false);
  const [scoringProgress, setScoringProgress] = useState(0);
  const [passDialogOpen, setPassDialogOpen] = useState(false);
  const [selectedBuyerForPass, setSelectedBuyerForPass] = useState<{ 
    id: string; 
    name: string;
    scoreData?: any;
  } | null>(null);
  
  // New state for enhanced features
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [sortDesc, setSortDesc] = useState(true);
  const [hideDisqualified, setHideDisqualified] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [highlightedBuyerIds, setHighlightedBuyerIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Custom scoring instructions state
  const [customInstructions, setCustomInstructions] = useState("");

  // Geography mode state (critical/preferred/minimal)
  const [geographyMode, setGeographyMode] = useState<'critical' | 'preferred' | 'minimal'>('critical');
  
  // Background scoring progress hook
  const backgroundScoring = useBackgroundScoringProgress(
    listingId!,
    selectedUniverse !== 'all' ? selectedUniverse : undefined
  );
  
  const queryClient = useQueryClient();

  // Fetch the listing
  const { data: listing, isLoading: listingLoading } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!listingId
  });

  // Fetch universes linked to this deal
  const { data: linkedUniverses, refetch: refetchLinkedUniverses } = useQuery({
    queryKey: ['remarketing', 'linked-universes', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_universe_deals')
        .select(`
          universe_id,
          universe:remarketing_buyer_universes(id, name, geography_weight, size_weight, service_weight, owner_goals_weight)
        `)
        .eq('listing_id', listingId)
        .eq('status', 'active');
      
      if (error) throw error;
      return (data || []).map(d => d.universe).filter(Boolean) as Array<{
        id: string;
        name: string;
        geography_weight: number;
        size_weight: number;
        service_weight: number;
        owner_goals_weight: number;
      }>;
    },
    enabled: !!listingId
  });


  // Load saved custom instructions for this listing
  const { data: savedAdjustments } = useQuery({
    queryKey: ['deal-scoring-adjustments', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_scoring_adjustments')
        .select('*')
        .eq('listing_id', listingId)
        .eq('adjustment_type', 'custom_instructions')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!listingId
  });

  // Initialize custom instructions from saved data
  useEffect(() => {
    if (savedAdjustments?.reason) {
      setCustomInstructions(savedAdjustments.reason);
    }
  }, [savedAdjustments]);

  // Default to "all" if linked universes exist
  useEffect(() => {
    if (linkedUniverses && linkedUniverses.length > 0 && !selectedUniverse) {
      setSelectedUniverse('all');
    }
  }, [linkedUniverses, selectedUniverse]);

  // Fetch ALL existing scores for this listing (from all universes)
  const { data: allScores, isLoading: scoresLoading, refetch: refetchScores } = useQuery({
    queryKey: ['remarketing', 'scores', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_scores')
        .select(`
          *,
          buyer:remarketing_buyers(
            *,
            contacts:remarketing_buyer_contacts(id)
          ),
          universe:remarketing_buyer_universes(id, name)
        `)
        .eq('listing_id', listingId)
        .order('composite_score', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!listingId
  });

  // Fetch marketplace fee agreements to cross-reference with buyers
  const { data: feeAgreements } = useQuery({
    queryKey: ['firm-agreements-signed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('firm_agreements')
        .select('id, primary_company_name, normalized_company_name, website_domain, email_domain, fee_agreement_signed, fee_agreement_signed_at')
        .eq('fee_agreement_signed', true);

      if (error) throw error;
      return data || [];
    },
  });

  // Build a lookup to match remarketing buyers → firm fee agreements
  const feeAgreementLookup = useMemo(() => {
    if (!feeAgreements) return new Map<string, { signed: boolean; signedAt: string | null }>();
    const lookup = new Map<string, { signed: boolean; signedAt: string | null }>();

    // Index by normalized name and domain
    const byName = new Map<string, typeof feeAgreements[0]>();
    const byDomain = new Map<string, typeof feeAgreements[0]>();
    for (const fa of feeAgreements) {
      if (fa.normalized_company_name) byName.set(fa.normalized_company_name.toLowerCase(), fa);
      if (fa.website_domain) byDomain.set(fa.website_domain.toLowerCase(), fa);
      if (fa.email_domain) byDomain.set(fa.email_domain.toLowerCase(), fa);
    }

    // Match each score's buyer against firm agreements
    if (allScores) {
      for (const score of allScores) {
        const buyer = score.buyer;
        if (!buyer) continue;

        let match: typeof feeAgreements[0] | undefined;

        // Match by website domain
        if (buyer.company_website) {
          const domain = buyer.company_website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0].toLowerCase();
          match = byDomain.get(domain);
        }
        // Match by email domain
        if (!match && (buyer as any).email_domain) {
          match = byDomain.get((buyer as any).email_domain.toLowerCase());
        }
        // Match by company name
        if (!match && buyer.company_name) {
          const normalized = buyer.company_name.toLowerCase().replace(/[^a-z0-9]/g, '');
          match = byName.get(normalized);
          // Also try the raw company name
          if (!match) match = byName.get(buyer.company_name.toLowerCase());
        }
        // Match by PE firm name
        if (!match && (buyer as any).pe_firm_name) {
          const peName = (buyer as any).pe_firm_name.toLowerCase().replace(/[^a-z0-9]/g, '');
          match = byName.get(peName);
        }

        if (match) {
          lookup.set(score.id, { signed: true, signedAt: match.fee_agreement_signed_at });
        }
      }
    }

    return lookup;
  }, [feeAgreements, allScores]);

  // Fetch outreach records for this listing
  const { data: outreachRecords, refetch: refetchOutreach } = useQuery({
    queryKey: ['remarketing', 'outreach', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_outreach')
        .select('*')
        .eq('listing_id', listingId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!listingId
  });

  // Filter scores based on selected universe
  const scores = useMemo(() => {
    if (!allScores) return [];
    if (selectedUniverse === 'all' || !selectedUniverse) {
      return allScores;
    }
    return allScores.filter(s => s.universe_id === selectedUniverse);
  }, [allScores, selectedUniverse]);

  // Compute match counts per universe
  const universeMatchCounts = useMemo(() => {
    if (!allScores || !linkedUniverses) return {};
    const counts: Record<string, number> = {};
    for (const u of linkedUniverses) {
      counts[u.id] = allScores.filter(s => s.universe_id === u.id).length;
    }
    return counts;
  }, [allScores, linkedUniverses]);

  // Compute stats including primary disqualification reason (aligned with spec v2 tiers)
  const stats = useMemo(() => {
    if (!scores) return { qualified: 0, disqualified: 0, strong: 0, approved: 0, passed: 0, total: 0, disqualificationReason: '' };

    const qualified = scores.filter(s => !s.is_disqualified && s.composite_score >= 50 && s.status !== 'passed').length;
    const disqualifiedScores = scores.filter(s => s.is_disqualified || s.composite_score < 35);
    const disqualified = disqualifiedScores.length;
    const strong = scores.filter(s => s.composite_score >= 80).length;
    const approved = scores.filter(s => s.status === 'approved').length;
    const passed = scores.filter(s => s.status === 'passed').length;
    
    // Compute most common disqualification reason using score-based detection
    const reasons = disqualifiedScores.map(s => {
      if (s.disqualification_reason) return s.disqualification_reason;
      const r = s.fit_reasoning?.toLowerCase() || '';

      // Check for explicit missing data flag first
      if (r.includes('[missing_data:')) return 'insufficient data';

      // Check for explicit enforcement patterns
      if (r.includes('disqualified: deal revenue') || r.includes('below buyer minimum')) return 'size mismatch';
      if (r.includes('dealbreaker: deal includes excluded')) return 'excluded criteria';
      if (r.includes('geography strict:')) return 'geography mismatch';

      // Use individual scores to find the weakest dimension (more accurate than keywords)
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

  // Get active outreach score IDs
  const activeOutreachScoreIds = useMemo(() => {
    return outreachRecords
      ?.filter(o => !['pending', 'closed_won', 'closed_lost'].includes(o.status))
      .map(o => o.score_id) || [];
  }, [outreachRecords]);

  // Count outreach
  const outreachCount = activeOutreachScoreIds.length;

  // Compute pass reasons for insights
  const passReasons = useMemo(() => {
    const passed = scores?.filter(s => s.status === 'passed' && s.pass_category) || [];
    const counts: Record<string, number> = {};
    for (const s of passed) {
      counts[s.pass_category!] = (counts[s.pass_category!] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [scores]);

  // Calculate average score for insights
  const averageScore = useMemo(() => {
    if (!scores || scores.length === 0) return 0;
    return Math.round(scores.reduce((sum, s) => sum + (s.composite_score || 0), 0) / scores.length);
  }, [scores]);

  // Filter and sort scores
  const filteredScores = useMemo(() => {
    if (!scores) return [];
    
    let filtered = [...scores];
    
    // Apply tab filter
    if (activeTab === 'approved') {
      filtered = filtered.filter(s => s.status === 'approved');
    } else if (activeTab === 'passed') {
      filtered = filtered.filter(s => s.status === 'passed');
    } else if (activeTab === 'outreach') {
      filtered = filtered.filter(s => activeOutreachScoreIds.includes(s.id));
    }
    
    // Hide disqualified (only explicitly disqualified buyers, not just low scores)
    if (hideDisqualified) {
      filtered = filtered.filter(s => !s.is_disqualified);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => {
        const buyer = s.buyer;
        if (!buyer) return false;
        const companyName = (buyer.company_name || '').toLowerCase();
        const peFirm = (buyer.pe_firm_name || '').toLowerCase();
        const thesis = (buyer.thesis_summary || '').toLowerCase();
        const location = (buyer.hq_state || '').toLowerCase();
        const city = (buyer.hq_city || '').toLowerCase();
        return companyName.includes(q) || peFirm.includes(q) || thesis.includes(q) || location.includes(q) || city.includes(q);
      });
    }
    
    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'score':
          comparison = (a.composite_score || 0) - (b.composite_score || 0);
          break;
        case 'geography':
          comparison = (a.geography_score || 0) - (b.geography_score || 0);
          break;
        case 'score_geo': {
          // Use actual geography weight ratio instead of hardcoded 60/40
          const activeUniverse = selectedUniverse !== 'all'
            ? linkedUniverses?.find(u => u.id === selectedUniverse)
            : linkedUniverses?.[0];
          const geoRatio = Math.min(0.5, (activeUniverse?.geography_weight || 20) / 100);
          const scoreRatio = 1 - geoRatio;
          const aWeighted = (a.composite_score || 0) * scoreRatio + (a.geography_score || 0) * geoRatio;
          const bWeighted = (b.composite_score || 0) * scoreRatio + (b.geography_score || 0) * geoRatio;
          comparison = aWeighted - bWeighted;
          break;
        }
      }
      
      return sortDesc ? -comparison : comparison;
    });
    
    return filtered;
  }, [scores, activeTab, hideDisqualified, sortBy, sortDesc, activeOutreachScoreIds, selectedUniverse, linkedUniverses, searchQuery]);

  // Log learning history helper
  const logLearningHistory = async (scoreData: any, action: 'approved' | 'passed', passReason?: string, passCategory?: string) => {
    try {
      await supabase.from('buyer_learning_history').insert({
        buyer_id: scoreData.buyer_id,
        listing_id: listingId,
        universe_id: scoreData.universe_id,
        score_id: scoreData.id,
        action,
        pass_reason: passReason,
        pass_category: passCategory,
        composite_score: scoreData.composite_score,
        geography_score: scoreData.geography_score,
        size_score: scoreData.size_score,
        service_score: scoreData.service_score,
        owner_goals_score: scoreData.owner_goals_score,
        action_by: user?.id,
      });
    } catch (error) {
      console.error('Failed to log learning history:', error);
    }
  };

  // Update score status mutation
  const updateScoreMutation = useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      pass_reason,
      pass_category,
      scoreData
    }: { 
      id: string; 
      status: string; 
      pass_reason?: string;
      pass_category?: string;
      scoreData?: any;
    }) => {
      const { error } = await supabase
        .from('remarketing_scores')
        .update({ status, pass_reason, pass_category })
        .eq('id', id);
      
      if (error) throw error;

      if (scoreData) {
        await logLearningHistory(
          scoreData, 
          status as 'approved' | 'passed', 
          pass_reason, 
          pass_category
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'learning-insights'] });
      toast.success('Match updated');
    },
    onError: () => {
      toast.error('Failed to update match');
    }
  });

  // Bulk approve mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('remarketing_scores')
        .update({ status: 'approved' })
        .in('id', ids);
      
      if (error) throw error;
      
      // Log learning history + create outreach + discover contacts for each
      for (const id of ids) {
        const scoreData = scores?.find(s => s.id === id);
        if (scoreData) {
          await logLearningHistory(scoreData, 'approved');
          
          // Auto-create outreach record
          try {
            await supabase.from('remarketing_outreach').upsert({
              score_id: id,
              listing_id: listingId,
              buyer_id: scoreData.buyer_id,
              status: 'pending',
              created_by: user?.id,
            }, { onConflict: 'score_id' });
          } catch (err) {
            console.error('Failed to create outreach record for score', id, err);
          }
          
          // Fire-and-forget: discover contacts
          if (scoreData.buyer_id) {
            supabase.functions.invoke('find-buyer-contacts', {
              body: { buyerId: scoreData.buyer_id }
            }).catch(err => console.warn('Contact discovery failed (non-blocking):', err));
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
      refetchOutreach();
      setSelectedIds(new Set());
      toast.success(`Approved ${selectedIds.size} buyers — outreach tracking started`);
    },
    onError: () => {
      toast.error('Failed to bulk approve');
    }
  });

  // Bulk score using edge function
  const handleBulkScore = async (instructions?: string) => {
    if (!selectedUniverse) {
      toast.error('Please select a universe first');
      return;
    }

    setIsScoring(true);
    setScoringProgress(10);

    try {
      const { queueDealScoring } = await import("@/lib/remarketing/queueScoring");
      await queueDealScoring({ universeId: selectedUniverse, listingIds: [listingId] });

      setScoringProgress(100);
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
    } catch (error) {
      console.error('Scoring error:', error);
      toast.error('Failed to score buyers');
    } finally {
      setIsScoring(false);
      setScoringProgress(0);
    }
  };

  // Apply custom instructions and rescore
  const handleApplyAndRescore = async (instructions: string) => {
    if (!listingId) return;
    
    // Save custom instructions to database
    try {
      await supabase
        .from('deal_scoring_adjustments')
        .upsert({
          listing_id: listingId,
          adjustment_type: 'custom_instructions',
          adjustment_value: 0,
          reason: instructions,
          created_by: user?.id,
        }, { onConflict: 'listing_id,adjustment_type' });
    } catch (error) {
      console.error('Failed to save custom instructions:', error);
    }
    
    // Trigger rescore with custom instructions
    await handleBulkScore(instructions);
  };

  // Reset scoring (clear custom instructions)
  const handleReset = async () => {
    setCustomInstructions("");
    
    // Clear saved instructions
    try {
      await supabase
        .from('deal_scoring_adjustments')
        .delete()
        .eq('listing_id', listingId)
        .eq('adjustment_type', 'custom_instructions');
    } catch (error) {
      console.error('Failed to clear custom instructions:', error);
    }
    
    queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
    queryClient.invalidateQueries({ queryKey: ['deal-scoring-adjustments', listingId] });
    toast.success('Scoring reset');
  };

  // Handle pass with dialog
  const handleOpenPassDialog = (scoreId: string, buyerName: string, scoreData?: any) => {
    setSelectedBuyerForPass({ id: scoreId, name: buyerName, scoreData });
    setPassDialogOpen(true);
  };

  const handleConfirmPass = (reason: string, category: string) => {
    if (selectedBuyerForPass) {
      updateScoreMutation.mutate({ 
        id: selectedBuyerForPass.id, 
        status: 'passed',
        pass_reason: reason,
        pass_category: category,
        scoreData: selectedBuyerForPass.scoreData
      });
      setPassDialogOpen(false);
      setSelectedBuyerForPass(null);
    }
  };

  // Handle toggle interested (approve/revert to pending)
  const handleToggleInterested = async (scoreId: string, interested: boolean, scoreData?: any) => {
    if (interested) {
      // Toggling ON → approve
      await handleApprove(scoreId, scoreData);
    } else {
      // Toggling OFF → revert to pending
      await updateScoreMutation.mutateAsync({ id: scoreId, status: 'pending', scoreData });
      toast.success('Reverted to pending');
    }
  };

  // Handle approve - auto-creates outreach record + triggers contact discovery
  const handleApprove = async (scoreId: string, scoreData?: any) => {
    // First update the score status
    await updateScoreMutation.mutateAsync({ id: scoreId, status: 'approved', scoreData });

    // Auto-create outreach record for approved buyer
    try {
      const { error } = await supabase.from('remarketing_outreach').upsert({
        score_id: scoreId,
        listing_id: listingId,
        buyer_id: scoreData?.buyer_id,
        status: 'pending',
        created_by: user?.id,
      }, { onConflict: 'score_id' });

      if (error) {
        console.error('Failed to auto-create outreach:', error);
      } else {
        refetchOutreach();
        toast.success('Buyer approved - outreach tracking started');
      }
    } catch (error) {
      console.error('Failed to auto-create outreach:', error);
    }

    // Fire-and-forget: auto-discover buyer contacts for approved buyer
    if (scoreData?.buyer_id) {
      supabase.functions.invoke('find-buyer-contacts', {
        body: { buyerId: scoreData.buyer_id }
      }).catch(err => console.warn('Contact discovery failed (non-blocking):', err));
    }
  };

  // Handle bulk approve
  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    await bulkApproveMutation.mutateAsync(Array.from(selectedIds));
  };

  // Handle bulk pass
  const handleBulkPass = async (reason: string, category: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from('remarketing_scores')
      .update({ status: 'passed', pass_reason: reason, pass_category: category })
      .in('id', ids);
    
    if (error) throw error;
    
    // Log learning history for each
    for (const id of ids) {
      const scoreData = scores?.find(s => s.id === id);
      if (scoreData) {
        await logLearningHistory(scoreData, 'passed', reason, category);
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
    setSelectedIds(new Set());
  };

  // Handle export CSV
  const handleExportCSV = () => {
    const selectedScores = scores?.filter(s => selectedIds.has(s.id)) || [];
    if (selectedScores.length === 0) return;
    
    const csvData = selectedScores.map(s => ({
      buyer_name: s.buyer?.company_name || '',
      website: s.buyer?.company_website || '',
      hq_location: s.buyer?.hq_city && s.buyer?.hq_state ? `${s.buyer.hq_city}, ${s.buyer.hq_state}` : '',
      pe_firm: (s.buyer as any)?.pe_firm_name || '',
      score: s.composite_score,
      tier: s.tier,
      geography_score: s.geography_score,
      size_score: s.size_score,
      service_score: s.service_score,
      owner_goals_score: s.owner_goals_score,
      size_multiplier: s.size_multiplier,
      service_multiplier: s.service_multiplier,
      status: s.status,
      fit_reasoning: s.fit_reasoning || '',
    }));
    
    const headers = Object.keys(csvData[0]);
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${(row as any)[h] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buyer-matches-${listing?.title?.replace(/\s+/g, '-').toLowerCase() || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  // Handle selection toggle
  const handleSelect = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedIds);
    if (selected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // Handle outreach update
  const handleOutreachUpdate = async (scoreId: string, status: OutreachStatus, notes: string) => {
    const score = scores?.find(s => s.id === scoreId);
    if (!score) return;
    
    const { error } = await supabase.from('remarketing_outreach').upsert({
      score_id: scoreId,
      listing_id: listingId,
      buyer_id: score.buyer_id,
      status,
      notes,
      contacted_at: status !== 'pending' ? new Date().toISOString() : null,
      created_by: user?.id,
    }, { onConflict: 'score_id' });
    
    if (error) {
      console.error('Failed to update outreach:', error);
      toast.error('Failed to update outreach status');
      return;
    }
    
    toast.success('Outreach status updated');
    refetchOutreach();
  };

  // Handle view tracking for engagement heatmap
  const handleScoreViewed = async (scoreId: string) => {
    try {
      await supabase
        .from('remarketing_scores')
        .update({ last_viewed_at: new Date().toISOString() })
        .eq('id', scoreId);
    } catch (err) {
      console.error('Failed to track view:', err);
    }
  };

  // Query existing pipeline deals for this listing's buyers (dedup check)
  const { data: pipelineDeals } = useQuery({
    queryKey: ['pipeline-deals-for-listing', listingId],
    queryFn: async () => {
      if (!listingId) return [];
      const { data } = await supabase
        .from('deals')
        .select('id, remarketing_buyer_id')
        .eq('listing_id', listingId)
        .not('remarketing_buyer_id', 'is', null)
        .is('deleted_at', null);
      return data || [];
    },
    enabled: !!listingId,
  });

  // Map buyer_id → pipeline deal_id for quick lookup
  const pipelineDealByBuyer = useMemo(() => {
    const map = new Map<string, string>();
    pipelineDeals?.forEach(d => {
      if (d.remarketing_buyer_id) map.set(d.remarketing_buyer_id, d.id);
    });
    return map;
  }, [pipelineDeals]);

  // Handle "Move to Pipeline" button
  const handleMoveToPipeline = async (scoreId: string, buyerId: string, targetListingId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('convert-to-pipeline-deal', {
        body: { listing_id: targetListingId, buyer_id: buyerId, score_id: scoreId },
      });

      if (error) throw error;

      if (data?.already_exists) {
        toast.info(`Already in pipeline: ${data.deal_title}`);
        return;
      }

      toast.success(`Moved to pipeline: ${data.deal_title}`, {
        action: {
          label: 'View in Pipeline',
          onClick: () => navigate(`/admin/pipeline?deal=${data.deal_id}`),
        },
      });

      // Refresh pipeline deals query
      queryClient.invalidateQueries({ queryKey: ['pipeline-deals-for-listing', listingId] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    } catch (err: any) {
      console.error('Failed to move to pipeline:', err);
      toast.error(err?.message || 'Failed to move buyer to pipeline');
    }
  };

  // Handle rescore trigger (for stale score warning)
  const handleRescore = () => {
    handleBulkScore();
  };

  if (listingLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Listing not found</p>
            <Button variant="link" asChild>
              <Link to="/admin/listings">Back to Listings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Buyer Matches</h1>
          <p className="text-muted-foreground">
            {listing.title} · {stats.total} buyers scored
          </p>
        </div>
        
      </div>

      {/* Listing Summary Card — Top of page */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <span>{listing.title}</span>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/admin/listings/${listing.id}`}>
                <ExternalLink className="h-4 w-4 mr-1" />
                View Listing
              </Link>
            </Button>
          </CardTitle>
          <CardDescription>{listing.hero_description || 'No description'}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Revenue</p>
                <p className="font-medium">{formatCurrency(listing.revenue)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">EBITDA</p>
                <p className="font-medium">{formatCurrency(listing.ebitda)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Location</p>
                <p className="font-medium">{listing.location || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Services</p>
                <p className="font-medium">
                  {listing.services?.length > 0
                    ? listing.services.slice(0, 3).join(', ') + (listing.services.length > 3 ? ` +${listing.services.length - 3}` : '')
                    : listing.category || '—'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkApprove={handleBulkApprove}
        onBulkPass={handleBulkPass}
        onExportCSV={handleExportCSV}
        onGenerateEmails={() => setEmailDialogOpen(true)}
        isProcessing={bulkApproveMutation.isPending}
      />

      {/* Two-Column Stats Row */}
      {scores && scores.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Stats Summary Card */}
          <Card className="lg:col-span-1 bg-amber-50/50 border-amber-100">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="font-medium">{stats.qualified} qualified buyers</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{stats.disqualified} disqualified{stats.disqualificationReason && ` (${stats.disqualificationReason})`}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{stats.strong} strong matches (&gt;80%)</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <Check className="h-4 w-4" />
                <span>{stats.approved} approved</span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-amber-200">
                <Switch
                  id="hide-disqualified"
                  checked={hideDisqualified}
                  onCheckedChange={setHideDisqualified}
                />
                <Label htmlFor="hide-disqualified" className="text-sm">
                  Hide disqualified
                </Label>
              </div>
            </CardContent>
          </Card>
          
          {/* Right: Collapsible Scoring Insights Panel */}
          {linkedUniverses && linkedUniverses.length > 0 && (
            <div className="lg:col-span-2">
              <ScoringInsightsPanel
                universeId={selectedUniverse !== 'all' ? selectedUniverse : linkedUniverses[0]?.id}
                universeName={
                  selectedUniverse === 'all' 
                    ? `${linkedUniverses.length} universes` 
                    : linkedUniverses?.find(u => u.id === selectedUniverse)?.name
                }
                weights={{
                  geography: (selectedUniverse !== 'all'
                    ? linkedUniverses?.find(u => u.id === selectedUniverse)?.geography_weight
                    : linkedUniverses[0]?.geography_weight) || 20,
                  size: (selectedUniverse !== 'all'
                    ? linkedUniverses?.find(u => u.id === selectedUniverse)?.size_weight
                    : linkedUniverses[0]?.size_weight) || 30,
                  service: (selectedUniverse !== 'all'
                    ? linkedUniverses?.find(u => u.id === selectedUniverse)?.service_weight
                    : linkedUniverses[0]?.service_weight) || 45,
                  ownerGoals: (selectedUniverse !== 'all'
                    ? linkedUniverses?.find(u => u.id === selectedUniverse)?.owner_goals_weight
                    : linkedUniverses[0]?.owner_goals_weight) || 5,
                }}
                outcomeStats={{
                  approved: stats.approved,
                  passed: stats.passed,
                  removed: 0,
                }}
                decisionCount={stats.approved + stats.passed}
                isWeightsAdjusted={!!customInstructions}
                customInstructions={customInstructions}
                onInstructionsChange={setCustomInstructions}
                onApplyAndRescore={handleApplyAndRescore}
                onRecalculate={() => handleBulkScore()}
                onReset={handleReset}
                isRecalculating={isScoring}
                geographyMode={geographyMode}
                onGeographyModeChange={setGeographyMode}
              />
            </div>
          )}
        </div>
      )}

      {/* Deal Data Quality Warning */}
      {listing && (() => {
        const missingFields: string[] = [];
        if (!listing.revenue) missingFields.push('Revenue');
        if (!listing.ebitda) missingFields.push('EBITDA');
        if (!listing.location?.trim()) missingFields.push('Location');
        if (!(listing.services?.length > 0 || listing.categories?.length > 0 || listing.category?.trim())) missingFields.push('Services/Category');
        if (!(listing.hero_description?.trim() || listing.description?.trim() || (listing as any).executive_summary?.trim())) missingFields.push('Description');

        if (missingFields.length === 0) return null;

        return (
          <div className={`rounded-lg border p-4 ${missingFields.length >= 3 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-start gap-3">
              <AlertCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${missingFields.length >= 3 ? 'text-red-600' : 'text-amber-600'}`} />
              <div className="flex-1">
                <p className={`font-medium text-sm ${missingFields.length >= 3 ? 'text-red-800' : 'text-amber-800'}`}>
                  {missingFields.length >= 3 ? 'Low Data Quality' : 'Missing Scoring Data'} — {missingFields.length} field{missingFields.length > 1 ? 's' : ''} missing
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Missing: <strong>{missingFields.join(', ')}</strong>.
                  {' '}Scores will use weight redistribution for missing dimensions — consider enriching the deal first for more accurate matching.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Universe Filter & Scoring Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Universe Filter Dropdown */}
            <div className="flex-1 min-w-[250px]">
              <Select value={selectedUniverse} onValueChange={setSelectedUniverse}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a universe" />
                </SelectTrigger>
                <SelectContent>
                  {linkedUniverses?.map((universe) => (
                    <SelectItem key={universe.id} value={universe.id}>
                      {universe.name} ({universeMatchCounts[universe.id] || 0} matches)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={() => handleBulkScore()}
              disabled={!selectedUniverse || selectedUniverse === 'all' || isScoring}
            >
              {isScoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scoring...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Score Buyers
                </>
              )}
            </Button>
          </div>
          
          {(isScoring || backgroundScoring.isScoring) && (
            <div className="mt-4">
              <ScoringProgressIndicator
                currentCount={backgroundScoring.currentCount || Math.round(scoringProgress / 10)}
                expectedCount={backgroundScoring.expectedCount || 10}
                progress={backgroundScoring.progress || scoringProgress}
                universeName={linkedUniverses?.find(u => u.id === selectedUniverse)?.name}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search, Tabs & Sort Controls */}
      {scores && scores.length > 0 && (
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search buyers by name, firm, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
              <TabsList>
                <TabsTrigger value="all">
                  All Buyers ({filteredScores.length !== stats.total ? `${filteredScores.length}/` : ''}{stats.total})
                </TabsTrigger>
                <TabsTrigger value="approved">
                  Approved ({stats.approved})
                </TabsTrigger>
                <TabsTrigger value="passed">
                  Passed ({stats.passed})
                </TabsTrigger>
                <TabsTrigger value="outreach">
                  <Mail className="h-3.5 w-3.5 mr-1" />
                  In Outreach ({outreachCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <div className="flex gap-1">
                <Button
                  variant={sortBy === 'score' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSortBy('score')}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Score
                </Button>
                <Button
                  variant={sortBy === 'geography' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSortBy('geography')}
                >
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  Geography
                </Button>
                <Button
                  variant={sortBy === 'score_geo' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSortBy('score_geo')}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Score + Geo
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSortDesc(!sortDesc)}
                >
                  <ArrowUpDown className={cn("h-4 w-4", !sortDesc && "rotate-180")} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Match Cards - Full Width */}
      <div className="space-y-3">
        {scoresLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : (!linkedUniverses || linkedUniverses.length === 0) && (!allScores || allScores.length === 0) ? (
          // No universes linked - show quick action to add
          <AddToUniverseQuickAction
            listingId={listingId!}
            listingCategory={listing.category}
            onUniverseAdded={() => {
              refetchLinkedUniverses();
              queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
            }}
          />
        ) : filteredScores.length === 0 && allScores && allScores.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-1">No matches yet</h3>
              <p className="text-muted-foreground">
                Select a universe and click "Score Buyers" to find matches
              </p>
            </CardContent>
          </Card>
        ) : filteredScores.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No buyers match the current filters
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredScores.map((score: any) => {
              const outreach = outreachRecords?.find(o => o.score_id === score.id);
              return (
                <BuyerMatchCard
                  key={score.id}
                  score={score}
                  dealLocation={listing.location}
                  isSelected={selectedIds.has(score.id)}
                  isHighlighted={highlightedBuyerIds.includes(score.buyer?.id || '')}
                  onSelect={handleSelect}
                  onApprove={handleApprove}
                  onPass={handleOpenPassDialog}
                  onToggleInterested={handleToggleInterested}
                  onOutreachUpdate={handleOutreachUpdate}
                  onViewed={handleScoreViewed}
                  onMoveToPipeline={handleMoveToPipeline}
                  outreach={outreach ? { status: outreach.status as OutreachStatus, contacted_at: outreach.contacted_at, notes: outreach.notes } : undefined}
                  isPending={updateScoreMutation.isPending}
                  universeName={selectedUniverse === 'all' ? score.universe?.name : undefined}
                  firmFeeAgreement={feeAgreementLookup.get(score.id)}
                  pipelineDealId={pipelineDealByBuyer.get(score.buyer?.id || '') || null}
                  listingId={listingId}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Pass Reason Dialog */}
      <PassReasonDialog
        open={passDialogOpen}
        onOpenChange={setPassDialogOpen}
        buyerName={selectedBuyerForPass?.name || ''}
        onConfirm={handleConfirmPass}
        isLoading={updateScoreMutation.isPending}
      />

      {/* Email Preview Dialog */}
      <EmailPreviewDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        buyers={(scores?.filter(s => selectedIds.has(s.id)) || []).map(s => ({
          buyerId: s.buyer?.id || '',
          buyerName: s.buyer?.company_name || 'Unknown',
          companyWebsite: s.buyer?.company_website || undefined,
          peFirmName: (s.buyer as any)?.pe_firm_name,
          contacts: s.buyer?.contacts?.map((c: any) => ({ name: c.name || '', email: c.email })) || [],
          fitReasoning: s.fit_reasoning || undefined,
          compositeScore: s.composite_score,
        }))}
        deal={{
          id: listing?.id || '',
          title: listing?.title || '',
          location: listing?.location || undefined,
          revenue: listing?.revenue || undefined,
          ebitda: listing?.ebitda || undefined,
          category: listing?.category || undefined,
          description: listing?.hero_description || undefined,
        }}
      />

      {/* AI Chat */}
      <ReMarketingChat
        context={{ type: "deal", dealId: listingId || '', dealName: listing?.title }}
        onHighlightItems={(ids) => {
          setHighlightedBuyerIds(ids);
          // Scroll to first highlighted buyer
          if (ids.length > 0) {
            setTimeout(() => {
              const el = document.getElementById(`buyer-card-${ids[0]}`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }
        }}
      />
    </div>
  );
};

export default ReMarketingDealMatching;
