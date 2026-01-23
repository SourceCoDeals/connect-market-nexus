import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  PassReasonDialog,
  BuyerMatchCard,
  ScoringInsightsPanel,
} from "@/components/remarketing";
import type { ScoreTier, DataCompleteness } from "@/types/remarketing";

type SortOption = 'score' | 'geography' | 'score_geo';
type FilterTab = 'all' | 'approved' | 'passed';

const ReMarketingDealMatching = () => {
  const { listingId } = useParams<{ listingId: string }>();
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
  
  // Custom scoring instructions state
  const [customInstructions, setCustomInstructions] = useState("");
  
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

  // Fetch universes
  const { data: universes } = useQuery({
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

  // Auto-suggest universe based on listing category
  useEffect(() => {
    if (listing && universes && universes.length > 0 && !selectedUniverse) {
      const listingCategory = listing.category?.toLowerCase() || '';
      const listingCategories = (listing.categories || []).map((c: string) => c.toLowerCase());
      
      const matchedUniverse = universes.find(u => {
        const universeName = u.name.toLowerCase();
        return listingCategories.some((cat: string) => 
          universeName.includes(cat) || cat.includes(universeName.split(' ')[0])
        ) || universeName.includes(listingCategory);
      });

      if (matchedUniverse) {
        setSelectedUniverse(matchedUniverse.id);
      }
    }
  }, [listing, universes, selectedUniverse]);

  // Fetch existing scores for this listing with buyer contacts count
  const { data: scores, isLoading: scoresLoading } = useQuery({
    queryKey: ['remarketing', 'scores', listingId, selectedUniverse],
    queryFn: async () => {
      let query = supabase
        .from('remarketing_scores')
        .select(`
          *,
          buyer:remarketing_buyers(
            *,
            contacts:remarketing_buyer_contacts(id)
          )
        `)
        .eq('listing_id', listingId)
        .order('composite_score', { ascending: false });
      
      if (selectedUniverse) {
        query = query.eq('universe_id', selectedUniverse);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!listingId
  });

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

  // Filter and sort scores
  const filteredScores = useMemo(() => {
    if (!scores) return [];
    
    let filtered = [...scores];
    
    // Apply tab filter
    if (activeTab === 'approved') {
      filtered = filtered.filter(s => s.status === 'approved');
    } else if (activeTab === 'passed') {
      filtered = filtered.filter(s => s.status === 'passed');
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
  }, [scores, activeTab, hideDisqualified, sortBy, sortDesc]);

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
  const handleBulkApprove = () => {
    if (selectedIds.size === 0) return;
    bulkApproveMutation.mutate(Array.from(selectedIds));
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
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin/listings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Buyer Matches</h1>
          <p className="text-muted-foreground">
            {listing.title} · {stats.total} buyers scored
          </p>
        </div>
        
        {/* Bulk Approve Button */}
        {selectedIds.size > 0 && (
          <Button
            onClick={handleBulkApprove}
            disabled={bulkApproveMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {bulkApproveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Approve Buyers as Fit ({selectedIds.size})
          </Button>
        )}
      </div>

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
          
          {/* Right: Collapsible Scoring Insights Panel */}
          {selectedUniverse && (
            <div className="lg:col-span-2">
              <ScoringInsightsPanel
                universeId={selectedUniverse}
                universeName={universes?.find(u => u.id === selectedUniverse)?.name}
                weights={{
                  geography: universes?.find(u => u.id === selectedUniverse)?.geography_weight || 35,
                  size: universes?.find(u => u.id === selectedUniverse)?.size_weight || 25,
                  service: universes?.find(u => u.id === selectedUniverse)?.service_weight || 25,
                  ownerGoals: universes?.find(u => u.id === selectedUniverse)?.owner_goals_weight || 15,
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

      {/* Scoring Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedUniverse} onValueChange={setSelectedUniverse}>
                <SelectTrigger>
                  <SelectValue placeholder="Select buyer universe" />
                </SelectTrigger>
                <SelectContent>
                  {universes?.map((universe) => (
                    <SelectItem key={universe.id} value={universe.id}>
                      {universe.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={() => handleBulkScore()}
              disabled={!selectedUniverse || isScoring}
            >
              {isScoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scoring...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Score All Buyers
                </>
              )}
            </Button>
          </div>
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
        ) : filteredScores.length === 0 && scores?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-1">No matches yet</h3>
              <p className="text-muted-foreground">
                Select a universe and click "Score All Buyers" to find matches
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
            {filteredScores.map((score: any) => (
              <BuyerMatchCard
                key={score.id}
                score={score}
                dealLocation={listing.location}
                isSelected={selectedIds.has(score.id)}
                onSelect={handleSelect}
                onApprove={handleApprove}
                onPass={handleOpenPassDialog}
                isPending={updateScoreMutation.isPending}
              />
            ))}
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
    </div>
  );
};

export default ReMarketingDealMatching;
