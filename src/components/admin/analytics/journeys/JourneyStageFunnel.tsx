import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JourneyStats } from "@/hooks/useUserJourneys";

interface JourneyStageFunnelProps {
  stats: JourneyStats;
  isLoading: boolean;
}

const STAGES = [
  { key: 'anonymous', label: 'Anonymous', color: 'bg-slate-500', description: 'First-time visitors' },
  { key: 'registered', label: 'Registered', color: 'bg-blue-500', description: 'Signed up' },
  { key: 'engaged', label: 'Engaged', color: 'bg-purple-500', description: 'Active browsing' },
  { key: 'qualified', label: 'Qualified', color: 'bg-amber-500', description: 'NDA signed' },
  { key: 'converted', label: 'Converted', color: 'bg-emerald-500', description: 'Connection made' },
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
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Journey Stage Funnel</CardTitle>
        <p className="text-xs text-muted-foreground">
          Visitor progression through conversion stages
        </p>
      </CardHeader>
      <CardContent>
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
                    {/* Stage indicator */}
                    <div className={`w-8 h-8 rounded-full ${stage.color} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
                      {index + 1}
                    </div>

                    {/* Bar and labels */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{stage.label}</span>
                          <span className="text-xs text-muted-foreground">{stage.description}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {conversionFromPrevious && (
                            <span className="text-xs text-muted-foreground">
                              {conversionFromPrevious}% from prev
                            </span>
                          )}
                          <span className="text-sm font-semibold tabular-nums">{value}</span>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${stage.color} transition-all duration-500`}
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
              <span className="font-semibold text-emerald-500">
                {((stats.converted / stats.totalJourneys) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
