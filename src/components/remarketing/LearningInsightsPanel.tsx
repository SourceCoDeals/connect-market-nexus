import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LearningInsightsPanelProps {
  universeId?: string;
  onApplySuggestion?: (category: string, newWeight: number) => void;
  className?: string;
}

interface AnalysisResult {
  analysis: {
    totalDecisions: number;
    approved: number;
    passed: number;
    approvalRate: string;
    avgApprovedScores: Record<string, number>;
    avgPassedScores: Record<string, number>;
    topPassCategories: Array<{ category: string; count: number; percentage: string }>;
    topPassReasons: Array<{ reason: string; count: number }>;
  };
  suggestions: Array<{
    category: string;
    currentWeight: number;
    suggestedWeight: number;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  currentWeights: Record<string, number>;
}

const confidenceColors = {
  high: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const LearningInsightsPanel = ({ 
  universeId, 
  onApplySuggestion,
  className 
}: LearningInsightsPanelProps) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['remarketing', 'learning-insights', universeId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('recalculate-deal-weights', {
        body: { universeId },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as AnalysisResult;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const hasEnoughData = data?.analysis?.totalDecisions >= 10;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-sm text-muted-foreground">Failed to load insights</p>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Learning Insights</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Analysis based on {data?.analysis?.totalDecisions || 0} approve/pass decisions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasEnoughData ? (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Need at least 10 decisions for insights</p>
            <p className="text-xs mt-1">
              Current: {data?.analysis?.totalDecisions || 0} decisions
            </p>
          </div>
        ) : (
          <>
            {/* Approval Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Approval Rate</span>
                <span className="font-semibold">{data?.analysis?.approvalRate}%</span>
              </div>
              <Progress 
                value={parseFloat(data?.analysis?.approvalRate || '0')} 
                className="h-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{data?.analysis?.approved} approved</span>
                <span>{data?.analysis?.passed} passed</span>
              </div>
            </div>

            {/* Top Pass Reasons */}
            {data?.analysis?.topPassCategories?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Why Buyers Are Passed</h4>
                <div className="space-y-1">
                  {data.analysis.topPassCategories.slice(0, 5).map((cat, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{cat.category}</span>
                      <Badge variant="outline" className="text-xs">
                        {cat.count} ({cat.percentage}%)
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weight Suggestions */}
            {data?.suggestions?.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Suggested Weight Adjustments</h4>
                {data.suggestions.map((suggestion, i) => (
                  <div 
                    key={i} 
                    className="p-3 rounded-lg border bg-muted/30 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{suggestion.category}</span>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", confidenceColors[suggestion.confidence])}
                        >
                          {suggestion.confidence}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{suggestion.currentWeight}%</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className={cn(
                          "font-medium",
                          suggestion.suggestedWeight > suggestion.currentWeight 
                            ? "text-emerald-600" 
                            : "text-amber-600"
                        )}>
                          {suggestion.suggestedWeight}%
                        </span>
                        {suggestion.suggestedWeight > suggestion.currentWeight ? (
                          <TrendingUp className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-amber-600" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                    {onApplySuggestion && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full mt-2"
                        onClick={() => onApplySuggestion(suggestion.category, suggestion.suggestedWeight)}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-2" />
                        Apply Suggestion
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {data?.suggestions?.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
                <p>Current weights are well-optimized</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default LearningInsightsPanel;
