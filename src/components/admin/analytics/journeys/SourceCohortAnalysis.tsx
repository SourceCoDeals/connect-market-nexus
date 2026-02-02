import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SourceCohort } from "@/hooks/useJourneyTimeline";
import { 
  Users, 
  TrendingUp, 
  Award,
  Globe,
  Search,
  Mail,
  Link2,
  MousePointerClick,
  Lightbulb
} from "lucide-react";

interface SourceCohortAnalysisProps {
  cohorts: SourceCohort[];
  isLoading: boolean;
}

const sourceIcons: Record<string, React.ReactNode> = {
  google: <Search className="h-3.5 w-3.5" />,
  bing: <Search className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  newsletter: <Mail className="h-3.5 w-3.5" />,
  linkedin: <Link2 className="h-3.5 w-3.5" />,
  referral: <Globe className="h-3.5 w-3.5" />,
  direct: <MousePointerClick className="h-3.5 w-3.5" />,
};

const getIcon = (source: string) => {
  const lowerSource = source.toLowerCase();
  for (const [key, icon] of Object.entries(sourceIcons)) {
    if (lowerSource.includes(key)) return icon;
  }
  return <Globe className="h-3.5 w-3.5" />;
};

export function SourceCohortAnalysis({ cohorts, isLoading }: SourceCohortAnalysisProps) {
  // Find best performing source (highest conversion rate with min 5 visitors)
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
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Source Cohort Analysis
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Conversion rates by first-touch attribution source
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
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
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <span className="font-semibold capitalize">{bestSource.source}</span> visitors convert at{' '}
                  <span className="font-semibold">
                    {(bestSource.convertedRate / (avgConversionRate || 1)).toFixed(1)}x
                  </span>{' '}
                  the average rate
                </p>
              </div>
            )}

            {/* Cohort table */}
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left py-2 font-medium">Source</th>
                    <th className="text-right py-2 font-medium px-2">Visitors</th>
                    <th className="text-right py-2 font-medium px-2">Registered</th>
                    <th className="text-right py-2 font-medium px-2">Qualified</th>
                    <th className="text-right py-2 font-medium px-2">Converted</th>
                    <th className="text-right py-2 font-medium px-2">Avg Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.slice(0, 8).map((cohort) => {
                    const isBest = bestSource?.source === cohort.source && cohort.convertedRate > 0;
                    
                    return (
                      <tr 
                        key={cohort.source} 
                        className="border-b border-border/30 hover:bg-muted/20"
                      >
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                              {getIcon(cohort.source)}
                            </div>
                            <span className="font-medium capitalize">
                              {cohort.source}
                            </span>
                            {isBest && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                                <Award className="h-2.5 w-2.5 mr-0.5" />
                                Best
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="text-right py-2.5 px-2 tabular-nums">
                          {cohort.totalVisitors}
                        </td>
                        <td className="text-right py-2.5 px-2">
                          <div className="flex items-center justify-end gap-1">
                            <span className="tabular-nums">{cohort.registeredRate.toFixed(0)}%</span>
                            <span className="text-xs text-muted-foreground">({cohort.registered})</span>
                          </div>
                        </td>
                        <td className="text-right py-2.5 px-2">
                          <div className="flex items-center justify-end gap-1">
                            <span className="tabular-nums">{cohort.qualifiedRate.toFixed(0)}%</span>
                            <span className="text-xs text-muted-foreground">({cohort.qualified})</span>
                          </div>
                        </td>
                        <td className="text-right py-2.5 px-2">
                          <div className="flex items-center justify-end gap-1">
                            <span className={`tabular-nums font-medium ${cohort.convertedRate > avgConversionRate ? 'text-emerald-600' : ''}`}>
                              {cohort.convertedRate.toFixed(1)}%
                            </span>
                            <span className="text-xs text-muted-foreground">({cohort.converted})</span>
                          </div>
                        </td>
                        <td className="text-right py-2.5 px-2 tabular-nums">
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
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>Avg conversion: {avgConversionRate.toFixed(1)}%</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
