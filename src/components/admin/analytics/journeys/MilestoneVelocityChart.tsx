import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MilestoneTimings } from "@/hooks/useJourneyTimeline";
import { Timer, TrendingUp, Zap } from "lucide-react";

interface MilestoneVelocityChartProps {
  timings: MilestoneTimings[];
  isLoading: boolean;
}

const formatHours = (hours: number): string => {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  if (remainingHours === 0) return `${days}d`;
  return `${days}d ${remainingHours}h`;
};

const getMilestoneIcon = (milestone: string) => {
  if (milestone.includes('Signup')) return '🎉';
  if (milestone.includes('NDA')) return '📝';
  if (milestone.includes('Fee')) return '✅';
  if (milestone.includes('Connection')) return '🤝';
  return '⭐';
};

export function MilestoneVelocityChart({ timings, isLoading }: MilestoneVelocityChartProps) {
  // Calculate max time for scaling
  const maxTime = timings.length > 0 
    ? Math.max(...timings.map(t => t.avgHours)) 
    : 24;

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          Conversion Velocity
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Average time from first visit to each milestone
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : timings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No milestone timing data yet
          </div>
        ) : (
          <div className="space-y-4">
            {timings.map((timing) => {
              const barWidth = (timing.avgHours / maxTime) * 100;
              
              return (
                <div key={timing.milestone} className="space-y-2">
                  {/* Milestone header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getMilestoneIcon(timing.milestone)}</span>
                      <span className="text-sm font-medium">{timing.milestone}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {timing.count} user{timing.count !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Timeline visualization */}
                  <div className="relative">
                    {/* Background track */}
                    <div className="h-8 bg-muted/30 rounded-lg overflow-hidden">
                      {/* Average bar */}
                      <div 
                        className="h-full bg-gradient-to-r from-primary/60 to-primary/40 flex items-center justify-end pr-2 transition-all duration-500"
                        style={{ width: `${Math.max(barWidth, 10)}%` }}
                      >
                        <span className="text-xs font-semibold text-primary-foreground">
                          {formatHours(timing.avgHours)}
                        </span>
                      </div>
                    </div>

                    {/* Min/Median markers */}
                    {timing.count > 1 && (
                      <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-emerald-500" />
                          <span>Fastest: {formatHours(timing.minHours)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-amber-500" />
                          <span>Median: {formatHours(timing.medianHours)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        {!isLoading && timings.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Bars show average time to reach each milestone from first visit
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
