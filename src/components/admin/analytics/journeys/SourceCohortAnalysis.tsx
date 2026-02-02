import { Skeleton } from "@/components/ui/skeleton";
import { SourceCohort } from "@/hooks/useJourneyTimeline";

interface SourceCohortAnalysisProps {
  cohorts: SourceCohort[];
  isLoading: boolean;
}

export function SourceCohortAnalysis({ cohorts, isLoading }: SourceCohortAnalysisProps) {
  // Find best performing source (highest conversion rate with min 3 visitors)
  const significantCohorts = cohorts.filter(c => c.totalVisitors >= 3);
  const bestSource = significantCohorts.length > 0
    ? significantCohorts.reduce((best, c) => 
        c.convertedRate > best.convertedRate ? c : best
      , significantCohorts[0])
    : null;

  // Calculate average conversion rate across all cohorts
  const avgConversionRate = cohorts.length > 0
    ? cohorts.reduce((sum, c) => sum + c.convertedRate, 0) / cohorts.length
    : 0;

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Source Cohort Analysis
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Conversion rates by first-touch attribution
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : cohorts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No cohort data available yet
        </div>
      ) : (
        <>
          {/* Insight callout */}
          {bestSource && bestSource.convertedRate > avgConversionRate * 1.5 && (
            <div className="mb-4 p-3 rounded-lg bg-coral-500/10 border border-coral-500/20">
              <p className="text-xs text-coral-600 dark:text-coral-400">
                <span className="font-semibold capitalize">{bestSource.source}</span> visitors convert at{' '}
                <span className="font-semibold">
                  {(bestSource.convertedRate / (avgConversionRate || 1)).toFixed(1)}x
                </span>{' '}
                the average rate
              </p>
            </div>
          )}

          {/* Cohort table */}
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/50">
                  <th className="text-left pb-3 font-medium">Source</th>
                  <th className="text-right pb-3 font-medium px-2">Visitors</th>
                  <th className="text-right pb-3 font-medium px-2">Registered</th>
                  <th className="text-right pb-3 font-medium px-2">Qualified</th>
                  <th className="text-right pb-3 font-medium px-2">Converted</th>
                  <th className="text-right pb-3 font-medium px-2">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.slice(0, 8).map((cohort) => {
                  const isBest = bestSource?.source === cohort.source && cohort.convertedRate > 0;
                  
                  return (
                    <tr 
                      key={cohort.source} 
                      className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize text-sm">
                            {cohort.source}
                          </span>
                          {isBest && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-coral-500/10 text-coral-500 font-semibold uppercase tracking-wider">
                              Best
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 tabular-nums text-sm">
                        {cohort.totalVisitors}
                      </td>
                      <td className="text-right py-3 px-2">
                        <span className="tabular-nums text-sm">{cohort.registeredRate.toFixed(0)}%</span>
                      </td>
                      <td className="text-right py-3 px-2">
                        <span className="tabular-nums text-sm">{cohort.qualifiedRate.toFixed(0)}%</span>
                      </td>
                      <td className="text-right py-3 px-2">
                        <span className={`tabular-nums text-sm font-medium ${cohort.convertedRate > avgConversionRate ? 'text-coral-500' : ''}`}>
                          {cohort.convertedRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-right py-3 px-2 tabular-nums text-sm text-muted-foreground">
                        {cohort.avgSessions.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing top {Math.min(8, cohorts.length)} sources</span>
            <span className="tabular-nums">Avg conversion: {avgConversionRate.toFixed(1)}%</span>
          </div>
        </>
      )}
    </div>
  );
}
