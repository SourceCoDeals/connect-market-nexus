import { cn } from "@/lib/utils";

interface SessionDurationCardProps {
  avgDuration: number;
  distribution: {
    under30s: number;
    thirtyToTwo: number;
    twoToFive: number;
    fiveToFifteen: number;
    over15min: number;
  };
}

export function SessionDurationCard({ avgDuration, distribution }: SessionDurationCardProps) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  
  const bars = [
    { label: '< 30s', value: distribution.under30s, color: 'bg-coral-100' },
    { label: '30s-2m', value: distribution.thirtyToTwo, color: 'bg-coral-200' },
    { label: '2-5m', value: distribution.twoToFive, color: 'bg-coral-300' },
    { label: '5-15m', value: distribution.fiveToFifteen, color: 'bg-coral-400' },
    { label: '15m+', value: distribution.over15min, color: 'bg-coral-500' },
  ];

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Session Duration
        </p>
        <p className="text-4xl font-light tracking-tight mt-2 tabular-nums">
          {formatDuration(avgDuration)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Average session length
        </p>
      </div>
      
      <div className="space-y-2.5">
        {bars.map(bar => (
          <div key={bar.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{bar.label}</span>
              <span className="text-xs font-medium tabular-nums">
                {total > 0 ? Math.round((bar.value / total) * 100) : 0}%
              </span>
            </div>
            <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all", bar.color)}
                style={{ width: `${total > 0 ? (bar.value / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
