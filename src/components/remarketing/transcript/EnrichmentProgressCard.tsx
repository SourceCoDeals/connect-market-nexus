import { Card as ProgressCard, CardContent as ProgressCardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Zap } from "lucide-react";

interface EnrichmentProgressCardProps {
  enrichmentPhase: 'transcripts' | 'website' | null;
  enrichmentProgress: { current: number; total: number };
  /** If true, shows "font-medium text-primary" for the counter (empty state variant) */
  primaryCounter?: boolean;
}

export function EnrichmentProgressCard({
  enrichmentPhase,
  enrichmentProgress,
  primaryCounter,
}: EnrichmentProgressCardProps) {
  return (
    <ProgressCard className="border-primary/30 bg-primary/5">
      <ProgressCardContent className="py-3">
        <div className="flex items-center gap-3">
          <Zap className="h-4 w-4 text-primary animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="font-medium text-sm">
                {enrichmentPhase === 'transcripts'
                  ? 'Processing transcripts...'
                  : 'Scraping website...'}
              </p>
              {enrichmentProgress.total > 0 && (primaryCounter ? enrichmentPhase === 'transcripts' : true) && (
                <span className={`text-xs ${primaryCounter ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                  {enrichmentProgress.current}/{enrichmentProgress.total}
                </span>
              )}
            </div>
            <Progress
              value={
                enrichmentProgress.total > 0
                  ? (enrichmentProgress.current / enrichmentProgress.total) * 100
                  : undefined
              }
              className="h-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {enrichmentPhase === 'transcripts' && enrichmentProgress.total > 0
                ? `Extracting intelligence from ${enrichmentProgress.total} transcript${enrichmentProgress.total > 1 ? 's' : ''}`
                : enrichmentPhase === 'website' ? 'Scraping website pages...' : 'Extracting deal intelligence'}
            </p>
          </div>
        </div>
      </ProgressCardContent>
    </ProgressCard>
  );
}
