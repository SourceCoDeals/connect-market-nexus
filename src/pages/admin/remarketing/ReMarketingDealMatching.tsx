import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
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
  type OutreachStatus,
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
  
  // Custom scoring instructions state
  const [customInstructions, setCustomInstructions] = useState("");
  
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

  // Fetch all universes for scoring new
  const { data: allUniverses } = useQuery({
    queryKey: ['remarketing', 'universes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_buyer_universes')
        .select('*')
        .eq('archived', false)
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
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

  // Compute stats including primary disqualification reason
  const stats = useMemo(() => {
    if (!scores) return { qualified: 0, disqualified: 0, strong: 0, approved: 0, passed: 0, total: 0, disqualificationReason: '' };
    
    const qualified = scores.filter(s => s.composite_score >= 55 && s.status !== 'passed').length;
    const disqualifiedScores = scores.filter(s => s.composite_score < 55 || s.fit_reasoning?.toLowerCase().includes('disqualified'));
    const disqualified = disqualifiedScores.length;
    const strong = scores.filter(s => s.composite_score >= 70).length;
    const approved = scores.filter(s => s.status === 'approved').length;
    const passed = scores.filter(s => s.status === 'passed').length;
    
    // Compute most common disqualification reason
    const reasons = disqualifiedScores.map(s => {
      const r = s.fit_reasoning?.toLowerCase() || '';
      if (r.includes('geography') || r.includes('location') || r.includes('state')) return 'no nearby presence';
      if (r.includes('size') || r.includes('revenue')) return 'size mismatch';
      if (r.includes('service')) return 'service mismatch';
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
    
    // Hide disqualified
    if (hideDisqualified) {
      filtered = filtered.filter(s => 
        s.composite_score >= 55 && !s.fit_reasoning?.toLowerCase().includes('disqualified')
      );
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
        case 'score_geo':
          const aWeighted = (a.composite_score || 0) * 0.6 + (a.geography_score || 0) * 0.4;
          const bWeighted = (b.composite_score || 0) * 0.6 + (b.geography_score || 0) * 0.4;
          comparison = aWeighted - bWeighted;
          break;
      }
      
      return sortDesc ? -comparison : comparison;
    });
    
    return filtered;
  }, [scores, activeTab, hideDisqualified, sortBy, sortDesc, activeOutreachScoreIds]);

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
      
      // Log learning history for each
      for (const id of ids) {
        const scoreData = scores?.find(s => s.id === id);
        if (scoreData) {
          await logLearningHistory(scoreData, 'approved');
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
      setSelectedIds(new Set());
      toast.success(`Approved ${selectedIds.size} buyers`);
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
      const { data, error } = await supabase.functions.invoke('score-buyer-deal', {
        body: {
          bulk: true,
          listingId,
          universeId: selectedUniverse,
          customInstructions: instructions || customInstructions || undefined,
          options: { rescoreExisting: !!instructions } // Force rescore when using custom instructions
        }
      });

      if (error) {
        console.error('Scoring error:', error);
        toast.error('Failed to score buyers');
        return;
      }

      setScoringProgress(100);
      
      if (data.errors && data.errors.length > 0) {
        toast.warning(`Scored ${data.totalProcessed} buyers with ${data.errors.length} errors`);
      } else {
        toast.success(`Scored ${data.totalProcessed} buyers`);
      }
      
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

  // Handle approve
  const handleApprove = (scoreId: string, scoreData?: any) => {
    updateScoreMutation.mutate({ id: scoreId, status: 'approved', scoreData });
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

      {/* Bulk Actions Toolbar - replaces old floating button */}
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
                <span className="font-medium">{stats.strong} strong matches (&gt;70%)</span>
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
          
          {/* Right: Collapsible Scoring Insights Panel - now shows for all views */}
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
                    : linkedUniverses[0]?.geography_weight) || 35,
                  size: (selectedUniverse !== 'all' 
                    ? linkedUniverses?.find(u => u.id === selectedUniverse)?.size_weight 
                    : linkedUniverses[0]?.size_weight) || 25,
                  service: (selectedUniverse !== 'all' 
                    ? linkedUniverses?.find(u => u.id === selectedUniverse)?.service_weight 
                    : linkedUniverses[0]?.service_weight) || 25,
                  ownerGoals: (selectedUniverse !== 'all' 
                    ? linkedUniverses?.find(u => u.id === selectedUniverse)?.owner_goals_weight 
                    : linkedUniverses[0]?.owner_goals_weight) || 15,
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
              />
            </div>
          )}
        </div>
      )}

      {/* Quick Insights Widget - Shows when there are enough decisions */}
      {(stats.approved + stats.passed) >= 3 && (
        <QuickInsightsWidget
          passReasons={passReasons}
          approvalRate={stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}
          totalDecisions={stats.approved + stats.passed}
          averageScore={averageScore}
        />
      )}

      {/* Listing Summary Card */}
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
                <p className="text-muted-foreground">Category</p>
                <p className="font-medium">{listing.category || '—'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Universe Filter & Scoring Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Universe Filter Dropdown */}
            <div className="flex-1 min-w-[250px]">
              <Select value={selectedUniverse} onValueChange={setSelectedUniverse}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by universe" />
                </SelectTrigger>
                <SelectContent>
                  {linkedUniverses && linkedUniverses.length > 0 && (
                    <SelectItem value="all">
                      All Universes ({allScores?.length || 0} matches)
                    </SelectItem>
                  )}
                  {linkedUniverses?.map((universe) => (
                    <SelectItem key={universe.id} value={universe.id}>
                      {universe.name} ({universeMatchCounts[universe.id] || 0} matches)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Score with New Universe */}
            <div className="flex items-center gap-2">
              <Select 
                value="" 
                onValueChange={(id) => {
                  setSelectedUniverse(id);
                  // Will trigger scoring in next step
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Score new universe" />
                </SelectTrigger>
                <SelectContent>
                  {allUniverses?.filter(u => !linkedUniverses?.some(l => l.id === u.id)).map((universe) => (
                    <SelectItem key={universe.id} value={universe.id}>
                      {universe.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
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
          </div>
          
          {/* Universe Summary Row */}
          {linkedUniverses && linkedUniverses.length > 1 && selectedUniverse === 'all' && (
            <div className="mt-4 pt-4 border-t flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              {linkedUniverses.map((u, i) => (
                <span key={u.id} className="flex items-center gap-1">
                  {i > 0 && <span className="mx-1">•</span>}
                  <span className="font-medium text-foreground">{u.name}:</span>
                  <span>{universeMatchCounts[u.id] || 0} matches</span>
                </span>
              ))}
            </div>
          )}
          
          {isScoring && (
            <div className="mt-4">
              <Progress value={scoringProgress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-1">
                AI is analyzing buyer-deal fit... {Math.round(scoringProgress)}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs & Sort Controls */}
      {scores && scores.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
            <TabsList>
              <TabsTrigger value="all">
                All Buyers ({stats.total})
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
                  onSelect={handleSelect}
                  onApprove={handleApprove}
                  onPass={handleOpenPassDialog}
                  onOutreachUpdate={handleOutreachUpdate}
                  outreach={outreach ? { status: outreach.status as OutreachStatus, contacted_at: outreach.contacted_at, notes: outreach.notes } : undefined}
                  isPending={updateScoreMutation.isPending}
                  universeName={selectedUniverse === 'all' ? score.universe?.name : undefined}
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
    </div>
  );
};

export default ReMarketingDealMatching;
