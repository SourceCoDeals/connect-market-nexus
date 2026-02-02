import { Skeleton } from "@/components/ui/skeleton";
import { JourneyStats } from "@/hooks/useUserJourneys";

interface JourneyStageFunnelProps {
  stats: JourneyStats;
  isLoading: boolean;
}

const STAGES = [
  { key: 'anonymous', label: 'Anonymous', description: 'First-time visitors' },
  { key: 'registered', label: 'Registered', description: 'Signed up' },
  { key: 'engaged', label: 'Engaged', description: 'Active browsing' },
  { key: 'qualified', label: 'Qualified', description: 'NDA signed' },
  { key: 'converted', label: 'Converted', description: 'Connection made' },
] as const;

export function JourneyStageFunnel({ stats, isLoading }: JourneyStageFunnelProps) {
  const getStageValue = (key: string): number => {
    switch (key) {
      case 'anonymous': return stats.anonymous;
      case 'registered': return stats.registered;
      case 'engaged': return stats.engaged;
      case 'qualified': return stats.qualified;
      case 'converted': return stats.converted;
      default: return 0;
    }
  };

  const maxValue = Math.max(
    stats.anonymous,
    stats.registered,
    stats.engaged,
    stats.qualified,
    stats.converted,
    1
  );

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Stage Funnel
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Visitor progression through conversion stages
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {STAGES.map((stage, index) => {
            const value = getStageValue(stage.key);
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const conversionFromPrevious = index > 0 
              ? getStageValue(STAGES[index - 1].key) > 0
                ? ((value / getStageValue(STAGES[index - 1].key)) * 100).toFixed(0)
                : '0'
              : null;

            return (
              <div key={stage.key} className="relative">
                {/* Connecting line */}
                {index > 0 && (
                  <div className="absolute -top-1.5 left-4 w-0.5 h-1.5 bg-border" />
                )}
                
                <div className="flex items-center gap-4">
                  {/* Stage number */}
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                    {index + 1}
                  </div>

                  {/* Bar and labels */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{stage.label}</span>
                        <span className="text-xs text-muted-foreground/70">{stage.description}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {conversionFromPrevious && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {conversionFromPrevious}% from prev
                          </span>
                        )}
                        <span className="text-sm font-semibold tabular-nums">{value}</span>
                      </div>
                    </div>
                    
                    {/* Progress bar with coral gradient */}
                    <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-coral-400 to-coral-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {!isLoading && stats.totalJourneys > 0 && (
        <div className="mt-6 pt-4 border-t border-border/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Conversion Rate</span>
            <span className="font-semibold text-coral-500 tabular-nums">
              {((stats.converted / stats.totalJourneys) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
