import { Clock, Zap, CheckCircle2, XCircle, Pause, Play, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EnrichmentProgressIndicatorProps {
  completedCount: number;
  totalCount: number;
  progress: number;
  estimatedTimeRemaining?: string;
  processingRate?: number;
  itemLabel?: string;
  successfulCount?: number;
  failedCount?: number;
  isPaused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}

export const EnrichmentProgressIndicator = ({
  completedCount,
  totalCount,
  progress,
  estimatedTimeRemaining,
  processingRate,
  itemLabel = 'deals',
  successfulCount,
  failedCount,
  isPaused = false,
  onPause,
  onResume,
  onCancel,
}: EnrichmentProgressIndicatorProps) => {
  const remainingCount = totalCount - completedCount;
  const singularLabel = itemLabel.endsWith('s') ? itemLabel.slice(0, -1) : itemLabel;
  
  const successful = successfulCount ?? completedCount;
  const failed = failedCount ?? 0;

  return (
    <TooltipProvider>
      <Card className={`border-primary/30 ${isPaused ? 'bg-amber-500/5 border-amber-500/30' : 'bg-primary/5'}`}>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <Zap className={`h-5 w-5 flex-shrink-0 ${isPaused ? 'text-amber-500' : 'text-primary animate-pulse'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">
                    {isPaused ? `Enrichment paused` : `Enriching ${itemLabel}...`}
                  </p>
                  {!isPaused && processingRate && processingRate > 0 && (
                    <span className="text-xs text-muted-foreground">
                      (~{processingRate.toFixed(1)}/min)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {completedCount} of {totalCount} complete
                  </span>
                  {!isPaused && estimatedTimeRemaining && remainingCount > 0 && (
                    <span className="text-xs text-primary flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      ~{estimatedTimeRemaining} remaining
                    </span>
                  )}
                  
                  {/* Control buttons */}
                  <div className="flex items-center gap-1 ml-2">
                    {isPaused && onResume && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100" onClick={onResume}>
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Resume enrichment</TooltipContent>
                      </Tooltip>
                    )}
                    {!isPaused && onPause && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-100" onClick={onPause}>
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Pause enrichment</TooltipContent>
                      </Tooltip>
                    )}
                    {onCancel && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onCancel}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Cancel remaining enrichment</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {successful} successful
                  </Badge>
                  {failed > 0 && (
                    <Badge variant="secondary" className="gap-1 bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400">
                      <XCircle className="h-3 w-3" />
                      {failed} failed
                    </Badge>
                  )}
                </div>
                {remainingCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {remainingCount} {remainingCount === 1 ? singularLabel : itemLabel} remaining
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default EnrichmentProgressIndicator;
