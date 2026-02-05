import { Clock, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface EnrichmentProgressIndicatorProps {
  completedCount: number;
  totalCount: number;
  progress: number;
  estimatedTimeRemaining?: string;
  processingRate?: number; // items per minute
  itemLabel?: string; // "deals", "buyers", etc. - defaults to "deals"
  successfulCount?: number;
  failedCount?: number;
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
}: EnrichmentProgressIndicatorProps) => {
  const remainingCount = totalCount - completedCount;
  const singularLabel = itemLabel.endsWith('s') ? itemLabel.slice(0, -1) : itemLabel;
  
  // Use passed values or fallback to computed values
  const successful = successfulCount ?? completedCount;
  const failed = failedCount ?? 0;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <Zap className="h-5 w-5 text-primary animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">
                  Enriching {itemLabel}...
                </p>
                {processingRate && processingRate > 0 && (
                  <span className="text-xs text-muted-foreground">
                    (~{processingRate.toFixed(1)}/min)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {completedCount} of {totalCount} complete
                </span>
                {estimatedTimeRemaining && remainingCount > 0 && (
                  <span className="text-xs text-primary flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    ~{estimatedTimeRemaining} remaining
                  </span>
                )}
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
  );
};

export default EnrichmentProgressIndicator;
