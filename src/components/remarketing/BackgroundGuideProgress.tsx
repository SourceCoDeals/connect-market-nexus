import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useBackgroundGuideGeneration } from "@/hooks/useBackgroundGuideGeneration";

interface BackgroundGuideProgressProps {
  universeId: string;
  onComplete?: (content: string, criteria: any) => void;
  onError?: (error: string) => void;
}

export function BackgroundGuideProgress({
  universeId,
  onComplete,
  onError
}: BackgroundGuideProgressProps) {
  const {
    isGenerating,
    currentGeneration,
    progress,
    startGeneration,
    cancelGeneration,
    phaseName,
    phasesCompleted,
    totalPhases
  } = useBackgroundGuideGeneration({
    universeId,
    onComplete,
    onError
  });

  const getStatusBadge = () => {
    if (!currentGeneration) return null;

    switch (currentGeneration.status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">M&A Guide Generation</CardTitle>
            <CardDescription>
              {isGenerating
                ? "Generation in progress - you can navigate away"
                : "Generate a comprehensive M&A guide for this universe"}
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGenerating && currentGeneration && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{phaseName}</span>
                <span className="font-medium">
                  {phasesCompleted} / {totalPhases} phases
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progress}% complete</span>
                <span>
                  Started {new Date(currentGeneration.started_at).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {currentGeneration.status === 'processing' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  This may take 10-15 minutes. You can leave this page and come back later.
                </span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={cancelGeneration}
              className="w-full"
            >
              Stop Monitoring (Generation continues in background)
            </Button>
          </>
        )}

        {currentGeneration?.status === 'failed' && (
          <div className="space-y-2">
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">Generation Failed</p>
              <p className="mt-1 text-xs">{currentGeneration.error}</p>
            </div>
            <Button onClick={startGeneration} variant="outline" size="sm" className="w-full">
              Retry Generation
            </Button>
          </div>
        )}

        {!isGenerating && currentGeneration?.status !== 'failed' && (
          <Button onClick={startGeneration} className="w-full">
            <Loader2 className="mr-2 h-4 w-4" />
            Start Guide Generation
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
