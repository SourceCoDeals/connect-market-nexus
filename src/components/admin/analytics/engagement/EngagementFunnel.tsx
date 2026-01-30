import { cn } from "@/lib/utils";

interface EngagementFunnelProps {
  metrics: {
    totalViews: number;
    totalSaves: number;
    totalRequests: number;
    viewToSaveRate: number;
    saveToRequestRate: number;
    viewToRequestRate: number;
  };
  className?: string;
}

export function EngagementFunnel({ metrics, className }: EngagementFunnelProps) {
  const stages = [
    { 
      label: 'Views', 
      value: metrics.totalViews,
      percentage: 100,
      sublabel: 'Listing page visits',
    },
    { 
      label: 'Saves', 
      value: metrics.totalSaves,
      percentage: metrics.viewToSaveRate,
      sublabel: `${metrics.viewToSaveRate.toFixed(2)}% save rate`,
    },
    { 
      label: 'Requests', 
      value: metrics.totalRequests,
      percentage: metrics.viewToRequestRate,
      sublabel: `${metrics.viewToRequestRate.toFixed(2)}% request rate`,
    },
  ];

  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Engagement Funnel
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          User journey from view to request
        </p>
      </div>

      {/* Funnel Visualization */}
      <div className="space-y-4">
        {stages.map((stage, index) => {
          const widthPercent = index === 0 ? 100 : Math.max(stage.percentage * 10, 20);
          const colors = [
            'from-coral-100 to-coral-200',
            'from-coral-300 to-coral-400',
            'from-coral-500 to-coral-600',
          ];
          
          return (
            <div key={stage.label} className="relative">
              {/* Connector */}
              {index > 0 && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-muted-foreground/40">
                  ↓
                </div>
              )}
              
              {/* Stage Bar */}
              <div 
                className="relative mx-auto transition-all duration-500"
                style={{ width: `${widthPercent}%` }}
              >
                <div className={cn(
                  "relative h-16 rounded-xl bg-gradient-to-r flex items-center justify-between px-4",
                  colors[index]
                )}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{stage.label}</p>
                    <p className="text-[10px] text-foreground/70">{stage.sublabel}</p>
                  </div>
                  <p className="text-xl font-light tabular-nums text-foreground">
                    {stage.value.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Conversion Summary */}
      <div className="mt-6 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Save → Request Conversion
          </span>
          <span className="text-sm font-medium text-coral-500 tabular-nums">
            {metrics.saveToRequestRate.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
