import { useTrafficAnalytics } from "@/hooks/useTrafficAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionVolumeChart } from "./SessionVolumeChart";
import { DeviceBrowserBreakdown } from "./DeviceBrowserBreakdown";
import { TrafficSourcesPanel } from "./TrafficSourcesPanel";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { cn } from "@/lib/utils";

interface TrafficIntelligenceDashboardProps {
  timeRangeDays: number;
}

export function TrafficIntelligenceDashboard({ timeRangeDays }: TrafficIntelligenceDashboardProps) {
  const { data, isLoading, error } = useTrafficAnalytics(timeRangeDays);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load traffic data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          label="Total Sessions" 
          value={data.totalSessions.toLocaleString()} 
        />
        <StatCard 
          label="Unique Users" 
          value={data.totalUniqueUsers.toLocaleString()} 
        />
        <StatCard 
          label="Avg/Day" 
          value={data.avgSessionsPerDay.toLocaleString()} 
        />
        <StatCard 
          label="Peak Hour" 
          value={formatHour(data.peakHour)} 
        />
      </div>

      {/* Session Volume + Device/Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SessionVolumeChart data={data.sessionVolume} />
        </div>
        <div>
          <DeviceBrowserBreakdown 
            deviceData={data.deviceBreakdown}
            browserData={data.browserDistribution}
          />
        </div>
      </div>

      {/* Traffic Sources + Activity Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrafficSourcesPanel data={data.trafficSources} />
        <ActivityHeatmap data={data.activityHeatmap} />
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

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
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
        <Skeleton className="h-[320px] rounded-2xl" />
        <Skeleton className="h-[320px] rounded-2xl" />
      </div>
    </div>
  );
}
