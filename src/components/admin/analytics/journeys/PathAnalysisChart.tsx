import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PathSequence } from "@/hooks/useJourneyTimeline";
import { ArrowRight, Route } from "lucide-react";

interface PathAnalysisChartProps {
  paths: PathSequence[];
  isLoading: boolean;
}

export function PathAnalysisChart({ paths, isLoading }: PathAnalysisChartProps) {
  const maxCount = paths.length > 0 ? Math.max(...paths.map(p => p.count)) : 1;

  const getPageLabel = (path: string): string => {
    if (path === '/') return 'Home';
    if (path === '/welcome') return 'Welcome';
    if (path === '/explore') return 'Explore';
    if (path === '/marketplace') return 'Marketplace';
    if (path === '/signup') return 'Signup';
    if (path === '/login') return 'Login';
    if (path === '/listing/*') return 'Listing';
    if (path === '/*') return 'Other';
    // Shorten long paths
    if (path.length > 15) {
      return path.slice(0, 12) + '...';
    }
    return path;
  };

  const renderPathSequence = (path: PathSequence, index: number) => {
    const steps = path.path.split(' → ');
    const barWidth = (path.count / maxCount) * 100;

    return (
      <div key={path.path} className="group">
        <div className="flex items-center gap-3 py-2">
          {/* Rank */}
          <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">
            {index + 1}
          </span>

          {/* Path visualization */}
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
            {steps.map((step, stepIndex) => (
              <div key={stepIndex} className="flex items-center">
                <div 
                  className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary whitespace-nowrap"
                  title={step}
                >
                  {getPageLabel(step)}
                </div>
                {stepIndex < steps.length - 1 && (
                  <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-20">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary/70 transition-all duration-300"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-semibold tabular-nums w-8 text-right">
              {path.count}
            </span>
            <span className="text-xs text-muted-foreground w-12 text-right">
              {path.percentage.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Route className="h-4 w-4 text-primary" />
          Common Path Sequences
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Most frequent navigation patterns across all journeys
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : paths.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Not enough data for path analysis yet
          </div>
        ) : (
          <div className="space-y-1">
            {paths.slice(0, 8).map((path, index) => renderPathSequence(path, index))}
          </div>
        )}

        {!isLoading && paths.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
            Showing top {Math.min(8, paths.length)} path sequences
          </div>
        )}
      </CardContent>
    </Card>
  );
}
