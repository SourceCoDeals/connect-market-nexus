import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { 
  Sparkles, 
  Loader2, 
  Users,
  RefreshCw,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

interface BulkScoringPanelProps {
  listingId: string;
  universes: Array<{ id: string; name: string }>;
  selectedUniverse: string;
  onUniverseChange: (universeId: string) => void;
  onScoringComplete: () => void;
  existingScoresCount: number;
}

interface ScoringResult {
  success: boolean;
  totalProcessed: number;
  totalBuyers: number;
  errors?: string[];
  scores?: Array<{
    id: string;
    tier: string;
    composite_score: number;
  }>;
}

export const BulkScoringPanel = ({
  listingId,
  universes,
  selectedUniverse,
  onUniverseChange,
  onScoringComplete,
  existingScoresCount
}: BulkScoringPanelProps) => {
  const [isScoring, setIsScoring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [lastResult, setLastResult] = useState<ScoringResult | null>(null);
  
  // Scoring options
  const [rescoreExisting, setRescoreExisting] = useState(false);
  const [minDataCompleteness, setMinDataCompleteness] = useState<string>("all");

  const handleBulkScore = async () => {
    if (!selectedUniverse) {
      toast.error('Please select a universe first');
      return;
    }

    setIsScoring(true);
    setProgress(5);
    setProgressMessage("Initializing scoring engine...");
    setLastResult(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);

      setProgressMessage("AI analyzing buyer-deal fit...");

      const { data, error } = await supabase.functions.invoke('score-buyer-deal', {
        body: {
          bulk: true,
          listingId,
          universeId: selectedUniverse,
          options: {
            rescoreExisting,
            minDataCompleteness: minDataCompleteness === 'all' ? undefined : minDataCompleteness
          }
        }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) {
        console.error('Scoring error:', error);
        toast.error('Failed to score buyers');
        setProgressMessage("Scoring failed");
        return;
      }

      setLastResult(data as ScoringResult);

      if (data.errors && data.errors.length > 0) {
        toast.warning(`Scored ${data.totalProcessed} buyers with ${data.errors.length} errors`);
        setProgressMessage(`Completed with warnings`);
      } else {
        toast.success(`Successfully scored ${data.totalProcessed} buyers`);
        setProgressMessage(`Completed successfully`);
      }
      
      onScoringComplete();
    } catch (error) {
      console.error('Scoring error:', error);
      toast.error('Failed to score buyers');
      setProgressMessage("Scoring failed");
    } finally {
      setTimeout(() => {
        setIsScoring(false);
        setProgress(0);
        setProgressMessage("");
      }, 2000);
    }
  };

  const tierDistribution = lastResult?.scores?.reduce((acc, score) => {
    acc[score.tier] = (acc[score.tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Scoring Engine
        </CardTitle>
        <CardDescription>
          Score buyers against this listing using AI-powered matching
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Universe Selection */}
        <div className="space-y-2">
          <Label className="text-sm">Buyer Universe</Label>
          <Select value={selectedUniverse} onValueChange={onUniverseChange}>
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

        {/* Scoring Options */}
        <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Re-score existing matches</Label>
              <p className="text-xs text-muted-foreground">
                Update scores for {existingScoresCount} already-scored buyers
              </p>
            </div>
            <Switch
              checked={rescoreExisting}
              onCheckedChange={setRescoreExisting}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Minimum Data Quality
            </Label>
            <Select value={minDataCompleteness} onValueChange={setMinDataCompleteness}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All buyers</SelectItem>
                <SelectItem value="low">Low+ completeness</SelectItem>
                <SelectItem value="medium">Medium+ completeness</SelectItem>
                <SelectItem value="high">High completeness only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Score Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button 
                  onClick={handleBulkScore}
                  disabled={!selectedUniverse || isScoring}
                  className="w-full"
                  size="lg"
                >
                  {isScoring ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scoring in progress...
                    </>
                  ) : existingScoresCount > 0 && !rescoreExisting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Score New Buyers Only
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Score All Buyers
                    </>
                  )}
                </Button>
              </div>
            </TooltipTrigger>
            {!selectedUniverse && (
              <TooltipContent>
                <p>Select a buyer universe first</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Progress */}
        {isScoring && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 animate-pulse" />
                {progressMessage}
              </span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
          </div>
        )}

        {/* Results Summary */}
        {lastResult && !isScoring && (
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center gap-2">
              {lastResult.errors && lastResult.errors.length > 0 ? (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              <span className="font-medium text-sm">
                Scored {lastResult.totalProcessed} of {lastResult.totalBuyers} buyers
              </span>
            </div>
            
            {Object.keys(tierDistribution).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {['A', 'B', 'C', 'D'].map(tier => (
                  tierDistribution[tier] ? (
                    <Badge 
                      key={tier} 
                      variant={tier === 'A' ? 'default' : 'secondary'}
                      className="gap-1"
                    >
                      <Users className="h-3 w-3" />
                      {tierDistribution[tier]} Tier {tier}
                    </Badge>
                  ) : null
                ))}
              </div>
            )}

            {lastResult.errors && lastResult.errors.length > 0 && (
              <div className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                {lastResult.errors.slice(0, 3).map((err, i) => (
                  <p key={i}>• {err}</p>
                ))}
                {lastResult.errors.length > 3 && (
                  <p>... and {lastResult.errors.length - 3} more</p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
