import { useRealTimeAnalytics } from "@/hooks/useRealTimeAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { ActiveUsersCounter } from "./ActiveUsersCounter";
import { LiveActivityMap } from "./LiveActivityMap";
import { CurrentPagesPanel } from "./CurrentPagesPanel";
import { ActiveSessionsList } from "./ActiveSessionsList";
import { cn } from "@/lib/utils";

export function RealTimeTab() {
  const { data, isLoading, error } = useRealTimeAnalytics();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load real-time data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ActiveUsersCounter count={data.activeUsers} />
        <DurationCard 
          label="Avg Duration"
          value={formatDuration(getAvgDuration(data.activeUsersList))}
        />
        <StatCard 
          label="Countries Active"
          value={data.activeByCountry.length.toString()}
        />
        <StatCard 
          label="Pages Viewed (5m)"
          value={data.currentPages.reduce((sum, p) => sum + p.viewCount, 0).toString()}
        />
      </div>

      {/* Live Map + Current Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LiveActivityMap data={data.activeByCountry} />
        </div>
        <div>
          <CurrentPagesPanel data={data.currentPages} />
        </div>
      </div>

      {/* Duration Distribution + Active Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DurationDistributionCard data={data.durationDistribution} />
        <ActiveSessionsList sessions={data.activeUsersList.slice(0, 10)} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl md:text-3xl font-light tracking-tight text-foreground mt-2 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function DurationCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl md:text-3xl font-light tracking-tight text-foreground mt-2 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function DurationDistributionCard({ data }: { 
  data: { under1min: number; oneToFive: number; fiveToFifteen: number; over15min: number } 
}) {
  const total = data.under1min + data.oneToFive + data.fiveToFifteen + data.over15min;
  
  const bars = [
    { label: '< 1 min', value: data.under1min, color: 'bg-coral-200' },
    { label: '1-5 min', value: data.oneToFive, color: 'bg-coral-300' },
    { label: '5-15 min', value: data.fiveToFifteen, color: 'bg-coral-400' },
    { label: '15+ min', value: data.over15min, color: 'bg-coral-500' },
  ];

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Session Duration Distribution
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Active sessions by time spent
        </p>
      </div>
      
      <div className="space-y-3">
        {bars.map(bar => (
          <div key={bar.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">{bar.label}</span>
              <span className="text-sm font-medium tabular-nums">
                {bar.value} ({total > 0 ? Math.round((bar.value / total) * 100) : 0}%)
              </span>
            </div>
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
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

function getAvgDuration(sessions: Array<{ durationSeconds: number }>): number {
  if (sessions.length === 0) return 0;
  return sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / sessions.length;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[360px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-[360px] rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[280px] rounded-2xl" />
        <Skeleton className="h-[280px] rounded-2xl" />
      </div>
    </div>
  );
}
