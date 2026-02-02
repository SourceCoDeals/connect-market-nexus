import { Skeleton } from "@/components/ui/skeleton";
import { MilestoneTimings } from "@/hooks/useJourneyTimeline";

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

export function MilestoneVelocityChart({ timings, isLoading }: MilestoneVelocityChartProps) {
  // Calculate max time for scaling
  const maxTime = timings.length > 0 
    ? Math.max(...timings.map(t => t.avgHours)) 
    : 24;

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Conversion Velocity
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Average time from first visit to each milestone
        </p>
      </div>

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
          {timings.map((timing, index) => {
            const barWidth = (timing.avgHours / maxTime) * 100;
            
            return (
              <div key={timing.milestone} className="space-y-2">
                {/* Milestone header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium">{timing.milestone}</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {timing.count} user{timing.count !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Timeline visualization */}
                <div className="relative pl-9">
                  {/* Background track */}
                  <div className="h-8 bg-muted/30 rounded-lg overflow-hidden">
                    {/* Average bar */}
                    <div 
                      className="h-full bg-gradient-to-r from-coral-400/60 to-coral-500/60 flex items-center justify-end pr-3 transition-all duration-500"
                      style={{ width: `${Math.max(barWidth, 15)}%` }}
                    >
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        {formatHours(timing.avgHours)}
                      </span>
                    </div>
                  </div>

                  {/* Min/Median markers */}
                  {timing.count > 1 && (
                    <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                      <span className="tabular-nums">Fastest: {formatHours(timing.minHours)}</span>
                      <span className="tabular-nums">Median: {formatHours(timing.medianHours)}</span>
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
    </div>
  );
}
