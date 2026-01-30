import { cn } from "@/lib/utils";

interface FunnelData {
  totalSignups: number;
  approvedBuyers: number;
  connectionRequests: number;
  introductionsMade: number;
}

interface DealFlowFunnelProps {
  data: FunnelData;
  className?: string;
}

export function DealFlowFunnel({ data, className }: DealFlowFunnelProps) {
  const stages = [
    { 
      label: 'Total Signups', 
      value: data.totalSignups,
      percentage: 100,
    },
    { 
      label: 'Approved Buyers', 
      value: data.approvedBuyers,
      percentage: data.totalSignups > 0 ? (data.approvedBuyers / data.totalSignups) * 100 : 0,
    },
    { 
      label: 'Connection Requests', 
      value: data.connectionRequests,
      percentage: data.totalSignups > 0 ? (data.connectionRequests / data.totalSignups) * 100 : 0,
    },
    { 
      label: 'Introductions Made', 
      value: data.introductionsMade,
      percentage: data.totalSignups > 0 ? (data.introductionsMade / data.totalSignups) * 100 : 0,
    },
  ];

  const getBarColor = (index: number) => {
    const colors = [
      'bg-coral-100 dark:bg-coral-100/20',
      'bg-coral-200 dark:bg-coral-200/30',
      'bg-coral-300 dark:bg-coral-300/40',
      'bg-coral-500 dark:bg-coral-500/60',
    ];
    return colors[index] || colors[0];
  };

  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Deal Flow Funnel
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Conversion through pipeline stages
        </p>
      </div>

      {/* Funnel Stages */}
      <div className="space-y-3">
        {stages.map((stage, index) => (
          <div key={stage.label} className="group">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">{stage.label}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {stage.value.toLocaleString()}
                </span>
                {index > 0 && (
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                    ({stage.percentage.toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  getBarColor(index)
                )}
                style={{ width: `${Math.max(stage.percentage, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Conversion summary */}
      <div className="mt-6 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Overall Conversion</span>
          <span className="text-sm font-medium text-coral-500 tabular-nums">
            {data.totalSignups > 0 
              ? ((data.introductionsMade / data.totalSignups) * 100).toFixed(1)
              : 0}%
          </span>
        </div>
      </div>
    </div>
  );
}
