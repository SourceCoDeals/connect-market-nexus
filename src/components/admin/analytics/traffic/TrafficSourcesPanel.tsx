import { cn } from "@/lib/utils";

interface TrafficSourcesPanelProps {
  data: Array<{
    source: string;
    sessions: number;
    percentage: number;
  }>;
  className?: string;
}

export function TrafficSourcesPanel({ data, className }: TrafficSourcesPanelProps) {
  const maxSessions = Math.max(...data.map(d => d.sessions), 1);

  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Traffic Sources
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Where visitors are coming from
        </p>
      </div>

      {/* Table */}
      <div className="space-y-1">
        {/* Header Row */}
        <div className="flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Source</span>
          <div className="flex items-center gap-8">
            <span className="w-16 text-right">Sessions</span>
            <span className="w-12 text-right">%</span>
          </div>
        </div>

        {/* Data Rows */}
        {data.map((item, index) => {
          const barWidth = (item.sessions / maxSessions) * 100;
          
          return (
            <div 
              key={item.source}
              className="relative group"
            >
              {/* Background bar */}
              <div 
                className="absolute inset-0 rounded-lg bg-coral-500/10 transition-all duration-300"
                style={{ width: `${barWidth}%` }}
              />
              
              {/* Content */}
              <div className="relative flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground/60 tabular-nums w-5">
                    {index + 1}
                  </span>
                  <span className="text-sm text-foreground font-medium truncate max-w-[180px]">
                    {item.source}
                  </span>
                </div>
                <div className="flex items-center gap-8">
                  <span className="text-sm font-medium tabular-nums text-foreground w-16 text-right">
                    {item.sessions.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {data.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No traffic data available
          </p>
        )}
      </div>
    </div>
  );
}
