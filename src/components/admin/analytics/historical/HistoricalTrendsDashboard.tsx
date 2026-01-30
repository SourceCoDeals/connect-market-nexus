import { useHistoricalMetrics } from "@/hooks/useHistoricalMetrics";
import { Skeleton } from "@/components/ui/skeleton";
import { DailyMetricsChart } from "./DailyMetricsChart";
import { WeekOverWeekCards } from "./WeekOverWeekCards";
import { TrendSparklines } from "./TrendSparklines";
import { cn } from "@/lib/utils";

interface HistoricalTrendsDashboardProps {
  timeRangeDays: number;
}

export function HistoricalTrendsDashboard({ timeRangeDays }: HistoricalTrendsDashboardProps) {
  const { data, isLoading, error } = useHistoricalMetrics(timeRangeDays);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load historical data</p>
        <p className="text-xs mt-2">Daily metrics aggregation may need to be triggered</p>
      </div>
    );
  }

  const hasData = data.metrics.length > 0;

  if (!hasData) {
    return (
      <div className="rounded-2xl bg-card border border-border/50 p-12 text-center">
        <p className="text-lg font-medium text-foreground">No Historical Data Yet</p>
        <p className="text-sm text-muted-foreground mt-2">
          Daily metrics will be aggregated automatically at midnight UTC.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Or trigger the aggregate-daily-metrics function manually.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          label="Total Sessions" 
          value={data.totals.totalSessions.toLocaleString()} 
        />
        <StatCard 
          label="Total Page Views" 
          value={data.totals.totalPageViews.toLocaleString()} 
        />
        <StatCard 
          label="Avg Bounce Rate" 
          value={`${data.totals.avgBounceRate.toFixed(1)}%`} 
        />
        <StatCard 
          label="Avg Session Duration" 
          value={formatDuration(data.totals.avgSessionDuration)} 
        />
      </div>

      {/* Week-over-Week Comparison */}
      <WeekOverWeekCards data={data.weekOverWeek} />

      {/* Main Chart */}
      <DailyMetricsChart data={data.metrics} />

      {/* Trend Sparklines */}
      <TrendSparklines data={data.trendData} />
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[400px] rounded-2xl" />
    </div>
  );
}
