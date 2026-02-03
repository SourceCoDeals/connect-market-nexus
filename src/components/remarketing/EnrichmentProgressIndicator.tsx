import { Loader2, Clock, Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

interface EnrichmentProgressIndicatorProps {
  completedCount: number;
  totalCount: number;
  progress: number;
  estimatedTimeRemaining?: string;
  processingRate?: number; // deals per minute
}

export const EnrichmentProgressIndicator = ({
  completedCount,
  totalCount,
  progress,
  estimatedTimeRemaining,
  processingRate,
}: EnrichmentProgressIndicatorProps) => {
  const remainingCount = totalCount - completedCount;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <Zap className="h-5 w-5 text-primary animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">
                  Enriching deals...
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
            {remainingCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {remainingCount} deal{remainingCount !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnrichmentProgressIndicator;
