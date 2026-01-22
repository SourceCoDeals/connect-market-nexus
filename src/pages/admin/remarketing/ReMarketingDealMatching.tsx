import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Building2,
  MapPin,
  DollarSign,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ScoreTier } from "@/types/remarketing";

// Score tier configuration
const TIER_CONFIG: Record<ScoreTier, { label: string; color: string; bgColor: string }> = {
  'A': { label: 'Excellent', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  'B': { label: 'Good', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  'C': { label: 'Fair', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  'D': { label: 'Poor', color: 'text-red-700', bgColor: 'bg-red-100' },
};

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 70) return 'text-lime-600';
  if (score >= 60) return 'text-amber-600';
  if (score >= 50) return 'text-orange-600';
  return 'text-red-600';
};

const getTier = (score: number): ScoreTier => {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
};

const ReMarketingDealMatching = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const [selectedUniverse, setSelectedUniverse] = useState<string>("");
  const [expandedBuyer, setExpandedBuyer] = useState<string | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [scoringProgress, setScoringProgress] = useState(0);
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

  // Update score status mutation
  const updateScoreMutation = useMutation({
    mutationFn: async ({ id, status, pass_reason }: { id: string; status: string; pass_reason?: string }) => {
      const { error } = await supabase
        .from('remarketing_scores')
        .update({ status, pass_reason })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
      toast.success('Match updated');
    },
    onError: () => {
      toast.error('Failed to update match');
    }
  });

  // Simulate bulk scoring (will be replaced with edge function)
  const handleBulkScore = async () => {
    if (!selectedUniverse) {
      toast.error('Please select a universe first');
      return;
    }

    setIsScoring(true);
    setScoringProgress(0);

    try {
      // Get buyers in the selected universe
      const { data: buyers, error: buyersError } = await supabase
        .from('remarketing_buyers')
        .select('*')
        .eq('universe_id', selectedUniverse)
        .eq('archived', false);

      if (buyersError) throw buyersError;

      if (!buyers || buyers.length === 0) {
        toast.error('No buyers in this universe');
        return;
      }

      // Get universe weights
      const { data: universe, error: universeError } = await supabase
        .from('remarketing_buyer_universes')
        .select('*')
        .eq('id', selectedUniverse)
        .single();

      if (universeError) throw universeError;

      // Process buyers in batches
      const batchSize = 5;
      const totalBatches = Math.ceil(buyers.length / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const batch = buyers.slice(i * batchSize, (i + 1) * batchSize);
        
        // Generate mock scores (replace with AI call)
        const scoresToInsert = batch.map(buyer => {
          const geoScore = Math.floor(Math.random() * 40) + 60;
          const sizeScore = Math.floor(Math.random() * 40) + 60;
          const serviceScore = Math.floor(Math.random() * 40) + 60;
          const ownerGoalsScore = Math.floor(Math.random() * 40) + 60;
          
          const composite = Math.round(
            (geoScore * universe.geography_weight +
             sizeScore * universe.size_weight +
             serviceScore * universe.service_weight +
             ownerGoalsScore * universe.owner_goals_weight) / 100
          );

          return {
            listing_id: listingId,
            buyer_id: buyer.id,
            universe_id: selectedUniverse,
            geography_score: geoScore,
            size_score: sizeScore,
            service_score: serviceScore,
            owner_goals_score: ownerGoalsScore,
            composite_score: composite,
            tier: getTier(composite),
            data_completeness: buyer.data_completeness || 'low',
            status: 'pending',
            fit_reasoning: `AI-generated match analysis for ${buyer.company_name} against ${listing?.title || 'listing'}.`,
          };
        });

        // Upsert scores
        const { error: insertError } = await supabase
          .from('remarketing_scores')
          .upsert(scoresToInsert, { onConflict: 'listing_id,buyer_id' });

        if (insertError) throw insertError;

        setScoringProgress(((i + 1) / totalBatches) * 100);
        
        // Small delay to simulate AI processing
        await new Promise(r => setTimeout(r, 500));
      }

      toast.success(`Scored ${buyers.length} buyers`);
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'scores', listingId] });
    } catch (error) {
      console.error('Scoring error:', error);
      toast.error('Failed to score buyers');
    } finally {
      setIsScoring(false);
      setScoringProgress(0);
    }
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
          <h1 className="text-2xl font-bold tracking-tight">Match Buyers</h1>
          <p className="text-muted-foreground">
            Find the best buyers for this listing using AI scoring
          </p>
        </div>
      </div>

      {/* Listing Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{listing.title}</CardTitle>
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
                Scoring in progress... {Math.round(scoringProgress)}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scored Buyers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Matched Buyers</h2>
          {scores && scores.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {scores.length} buyers scored
            </p>
          )}
        </div>

        {scoresLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
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
          <div className="space-y-3">
            {scores?.map((score: any) => {
              const tier = score.tier as ScoreTier;
              const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG['D'];
              const isExpanded = expandedBuyer === score.id;

              return (
                <Card key={score.id} className={cn(
                  "transition-all",
                  score.status === 'approved' && "ring-2 ring-emerald-500",
                  score.status === 'passed' && "opacity-60"
                )}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      {/* Score Badge */}
                      <div className={cn(
                        "flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center",
                        tierConfig.bgColor
                      )}>
                        <span className={cn("text-2xl font-bold", tierConfig.color)}>
                          {Math.round(score.composite_score)}
                        </span>
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">
                                {score.buyer?.company_name || 'Unknown Buyer'}
                              </h3>
                              <Badge className={cn(tierConfig.bgColor, tierConfig.color, "border-0")}>
                                Tier {tier}
                              </Badge>
                              {score.status === 'approved' && (
                                <Badge variant="default" className="bg-emerald-500">Approved</Badge>
                              )}
                              {score.status === 'passed' && (
                                <Badge variant="secondary">Passed</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {score.buyer?.buyer_type?.replace('_', ' ') || 'Unknown type'}
                            </p>
                          </div>

                          {/* Actions */}
                          {score.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => updateScoreMutation.mutate({ id: score.id, status: 'approved' })}
                              >
                                <Check className="mr-1 h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => updateScoreMutation.mutate({ id: score.id, status: 'passed', pass_reason: 'Not a fit' })}
                              >
                                <X className="mr-1 h-4 w-4" />
                                Pass
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Score Breakdown */}
                        <div className="grid grid-cols-4 gap-4 mt-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Geography</p>
                            <p className={cn("font-semibold", getScoreColor(score.geography_score || 0))}>
                              {Math.round(score.geography_score || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Size</p>
                            <p className={cn("font-semibold", getScoreColor(score.size_score || 0))}>
                              {Math.round(score.size_score || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Service</p>
                            <p className={cn("font-semibold", getScoreColor(score.service_score || 0))}>
                              {Math.round(score.service_score || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Owner Goals</p>
                            <p className={cn("font-semibold", getScoreColor(score.owner_goals_score || 0))}>
                              {Math.round(score.owner_goals_score || 0)}
                            </p>
                          </div>
                        </div>

                        {/* Expandable Reasoning */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 -ml-2"
                          onClick={() => setExpandedBuyer(isExpanded ? null : score.id)}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="mr-1 h-4 w-4" />
                              Hide Details
                            </>
                          ) : (
                            <>
                              <ChevronDown className="mr-1 h-4 w-4" />
                              Show Details
                            </>
                          )}
                        </Button>

                        {isExpanded && (
                          <div className="mt-3 p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-medium mb-2">AI Reasoning</h4>
                            <p className="text-sm text-muted-foreground">
                              {score.fit_reasoning || 'No reasoning available'}
                            </p>
                            {score.buyer?.thesis_summary && (
                              <div className="mt-3">
                                <h4 className="font-medium mb-1">Investment Thesis</h4>
                                <p className="text-sm text-muted-foreground">
                                  {score.buyer.thesis_summary}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReMarketingDealMatching;
