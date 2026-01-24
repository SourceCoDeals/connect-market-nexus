import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Brain, 
  ChevronDown, 
  Lightbulb, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WeightSuggestion {
  dimension: 'geography' | 'size' | 'service' | 'owner_goals';
  currentWeight: number;
  suggestedWeight: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  dataPoints: number;
}

interface PatternAnalysis {
  suggestions: WeightSuggestion[];
  insights: string[];
  approvalRateByTier: Record<string, number>;
  topPassReasons: Array<{ category: string; count: number; percentage: number }>;
  totalDecisions: number;
  analysisDate: string;
}

interface WeightSuggestionsPanelProps {
  universeId: string;
  currentWeights: {
    geography: number;
    size: number;
    service: number;
    owner_goals: number;
  };
  onApplySuggestions?: (newWeights: Record<string, number>) => void;
  className?: string;
}

const dimensionLabels: Record<string, string> = {
  geography: 'Geography',
  size: 'Size',
  service: 'Service',
  owner_goals: 'Owner Goals',
};

const confidenceConfig = {
  high: { label: 'High Confidence', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  low: { label: 'Low', color: 'bg-slate-100 text-slate-600', icon: AlertCircle },
};

export const WeightSuggestionsPanel = ({
  universeId,
  currentWeights,
  onApplySuggestions,
  className,
}: WeightSuggestionsPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const { data: analysis, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['remarketing', 'weight-analysis', universeId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('analyze-scoring-patterns', {
        body: { universeId },
      });
      
      if (error) throw error;
      return data as PatternAnalysis;
    },
    enabled: !!universeId && isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleApplyAll = () => {
    if (!analysis?.suggestions || !onApplySuggestions) return;
    
    const newWeights = { ...currentWeights };
    for (const suggestion of analysis.suggestions) {
      newWeights[suggestion.dimension] = suggestion.suggestedWeight;
    }
    
    onApplySuggestions(newWeights);
    toast.success('Weight suggestions applied');
  };

  const handleApplySingle = (suggestion: WeightSuggestion) => {
    if (!onApplySuggestions) return;
    
    onApplySuggestions({
      ...currentWeights,
      [suggestion.dimension]: suggestion.suggestedWeight,
    });
    toast.success(`${dimensionLabels[suggestion.dimension]} weight updated`);
  };

  const hasSuggestions = analysis?.suggestions && analysis.suggestions.length > 0;
  const hasInsights = analysis?.insights && analysis.insights.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn('border-dashed', className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">
                  AI Weight Optimization
                </CardTitle>
                {hasSuggestions && (
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                    {analysis.suggestions.length} suggestion{analysis.suggestions.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">
            {isLoading || isRefetching ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm">Analyzing decision patterns...</span>
              </div>
            ) : !analysis ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Failed to load analysis
              </div>
            ) : (
              <>
                {/* Stats Header */}
                <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
                  <span>Based on {analysis.totalDecisions} decisions</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetch()}
                    className="h-6 px-2"
                  >
                    <RefreshCw className={cn('h-3 w-3 mr-1', isRefetching && 'animate-spin')} />
                    Refresh
                  </Button>
                </div>

                {/* Suggestions */}
                {hasSuggestions ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Suggested Adjustments
                      </h4>
                      {onApplySuggestions && analysis.suggestions.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleApplyAll}
                          className="h-7 text-xs"
                        >
                          Apply All
                        </Button>
                      )}
                    </div>
                    
                    {analysis.suggestions.map((suggestion, index) => {
                      const conf = confidenceConfig[suggestion.confidence];
                      const ConfIcon = conf.icon;
                      const isIncrease = suggestion.suggestedWeight > suggestion.currentWeight;
                      
                      return (
                        <div
                          key={index}
                          className="p-3 rounded-lg bg-muted/50 border space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isIncrease ? (
                                <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-amber-600 shrink-0" />
                              )}
                              <span className="font-medium text-sm">
                                {dimensionLabels[suggestion.dimension]}
                              </span>
                            </div>
                            <Badge className={cn('text-xs', conf.color)}>
                              <ConfIcon className="h-3 w-3 mr-1" />
                              {conf.label}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">
                              {suggestion.currentWeight}%
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className={cn(
                              'font-medium',
                              isIncrease ? 'text-green-600' : 'text-amber-600'
                            )}>
                              {suggestion.suggestedWeight}%
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({isIncrease ? '+' : ''}{suggestion.suggestedWeight - suggestion.currentWeight}%)
                            </span>
                          </div>
                          
                          <p className="text-xs text-muted-foreground">
                            {suggestion.reason}
                          </p>
                          
                          {onApplySuggestions && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApplySingle(suggestion)}
                              className="h-7 text-xs mt-1"
                            >
                              Apply This Change
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500/50" />
                    <p>Weights look well-balanced based on current decisions.</p>
                  </div>
                )}

                {/* Insights */}
                {hasInsights && (
                  <div className="space-y-2 pt-2 border-t">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" />
                      Insights
                    </h4>
                    {analysis.insights.map((insight, index) => (
                      <p key={index} className="text-xs text-muted-foreground pl-4">
                        • {insight}
                      </p>
                    ))}
                  </div>
                )}

                {/* Approval by Tier */}
                {Object.keys(analysis.approvalRateByTier).length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Approval Rate by Tier
                    </h4>
                    <div className="flex gap-2">
                      {['A', 'B', 'C', 'D'].map(tier => {
                        const rate = analysis.approvalRateByTier[tier];
                        if (rate === undefined) return null;
                        return (
                          <div
                            key={tier}
                            className="flex-1 text-center p-2 rounded bg-muted/50"
                          >
                            <div className="text-xs text-muted-foreground">Tier {tier}</div>
                            <div className="font-medium text-sm">{rate}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default WeightSuggestionsPanel;
