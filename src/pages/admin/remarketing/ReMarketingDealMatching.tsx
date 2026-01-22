import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  Users,
  Lightbulb
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  ScoreBadge, 
  ScoreTierBadge, 
  ScoreBreakdown, 
  AIReasoningPanel,
  PassReasonDialog,
  IntelligenceBadge 
} from "@/components/remarketing";
import type { ScoreTier, DataCompleteness } from "@/types/remarketing";

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

  // Auto-suggest universe based on listing category
  useEffect(() => {
    if (listing && universes && universes.length > 0 && !selectedUniverse) {
      const listingCategory = listing.category?.toLowerCase() || '';
      const listingCategories = (listing.categories || []).map((c: string) => c.toLowerCase());
      
      // Try to find a matching universe
      const matchedUniverse = universes.find(u => {
        const universeName = u.name.toLowerCase();
        // Check if universe name contains any of the categories
        return listingCategories.some((cat: string) => 
          universeName.includes(cat) || cat.includes(universeName.split(' ')[0])
        ) || universeName.includes(listingCategory);
      });

      if (matchedUniverse) {
        setSelectedUniverse(matchedUniverse.id);
      }
    }
  }, [listing, universes, selectedUniverse]);

  // Fetch existing scores for this listing
  const { data: scores, isLoading: scoresLoading } = useQuery({
    queryKey: ['remarketing', 'scores', listingId, selectedUniverse],
    queryFn: async () => {
      let query = supabase
        .from('remarketing_scores')
        .select(`
          *,
          buyer:remarketing_buyers(*)
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

      // Log to learning history
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

  // Bulk score using edge function
  const handleBulkScore = async () => {
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
          universeId: selectedUniverse
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

  // Stats for header
  const approvedCount = scores?.filter(s => s.status === 'approved').length || 0;
  const pendingCount = scores?.filter(s => s.status === 'pending').length || 0;
  const tierACounts = scores?.filter(s => s.tier === 'A').length || 0;

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
          <h1 className="text-2xl font-bold tracking-tight">Match Buyers</h1>
          <p className="text-muted-foreground">
            Find the best buyers for this listing using AI scoring
          </p>
        </div>
        {scores && scores.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{approvedCount} approved</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{pendingCount} pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>{tierACounts} Tier A</span>
            </div>
          </div>
        )}
      </div>

      {/* Listing Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
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
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="font-medium">{formatCurrency(listing.revenue)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">EBITDA</p>
                <p className="font-medium">{formatCurrency(listing.ebitda)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium">{listing.location || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
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
              onClick={handleBulkScore}
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

      {/* Scored Buyers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Matched Buyers
          </h2>
          {scores && scores.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {scores.length} buyers scored
            </p>
          )}
        </div>

        {scoresLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : scores?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-1">No matches yet</h3>
              <p className="text-muted-foreground">
                Select a universe and click "Score All Buyers" to find matches
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {scores?.map((score: any) => {
              const tier = (score.tier || 'D') as ScoreTier;
              const dataCompleteness = score.data_completeness as DataCompleteness | null;

              return (
                <Card 
                  key={score.id} 
                  className={cn(
                    "transition-all",
                    score.status === 'approved' && "ring-2 ring-emerald-500/50 bg-emerald-50/30",
                    score.status === 'passed' && "opacity-60"
                  )}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-5">
                      {/* Score Badge */}
                      <ScoreBadge 
                        score={score.composite_score || 0} 
                        size="lg" 
                      />

                      {/* Main Content */}
                      <div className="flex-1 min-w-0 space-y-4">
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link 
                                to={`/admin/remarketing/buyers/${score.buyer?.id}`}
                                className="font-semibold text-lg hover:underline"
                              >
                                {score.buyer?.company_name || 'Unknown Buyer'}
                              </Link>
                              <ScoreTierBadge tier={tier} size="sm" />
                              <IntelligenceBadge completeness={dataCompleteness} />
                              {score.status === 'approved' && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <Check className="h-3 w-3" />
                                  Approved
                                </span>
                              )}
                              {score.status === 'passed' && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                  <X className="h-3 w-3" />
                                  Passed
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {score.buyer?.buyer_type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Unknown type'}
                              {score.buyer?.company_website && (
                                <> • <a 
                                  href={score.buyer.company_website} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  Website
                                </a></>
                              )}
                            </p>
                          </div>

                          {/* Actions */}
                          {score.status === 'pending' && (
                            <div className="flex gap-2 flex-shrink-0">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleApprove(score.id)}
                                disabled={updateScoreMutation.isPending}
                              >
                                <Check className="mr-1 h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => handleOpenPassDialog(score.id, score.buyer?.company_name || 'Unknown')}
                                disabled={updateScoreMutation.isPending}
                              >
                                <X className="mr-1 h-4 w-4" />
                                Pass
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Score Breakdown */}
                        <ScoreBreakdown
                          geography={score.geography_score || 0}
                          size={score.size_score || 0}
                          service={score.service_score || 0}
                          ownerGoals={score.owner_goals_score || 0}
                        />

                        {/* AI Reasoning Panel */}
                        <AIReasoningPanel
                          reasoning={score.fit_reasoning}
                          dataCompleteness={dataCompleteness}
                          thesisSummary={score.buyer?.thesis_summary}
                          targetGeographies={score.buyer?.target_geographies}
                          targetServices={score.buyer?.target_services}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
    </div>
  );
};

export default ReMarketingDealMatching;
