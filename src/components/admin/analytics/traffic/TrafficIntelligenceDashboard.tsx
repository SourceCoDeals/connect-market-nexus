import { useTrafficAnalytics } from "@/hooks/useTrafficAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionVolumeChart } from "./SessionVolumeChart";
import { DeviceBrowserBreakdown } from "./DeviceBrowserBreakdown";
import { TrafficSourcesPanel } from "./TrafficSourcesPanel";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { SessionDurationCard } from "../session/SessionDurationCard";
import { cn } from "@/lib/utils";
import { Clock, Globe } from "lucide-react";

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
        <StatCard 
          label="Avg Duration" 
          value={formatDuration(data.avgSessionDuration)}
          icon={<Clock className="h-3 w-3" />}
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

      {/* Session Duration + Geography */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SessionDurationCard 
          avgDuration={data.avgSessionDuration}
          distribution={data.durationDistribution}
        />
        <GeographyCard data={data.sessionGeography} />
      </div>

      {/* Traffic Sources + Activity Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrafficSourcesPanel data={data.trafficSources} />
        <ActivityHeatmap data={data.activityHeatmap} />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 p-5">
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="text-2xl md:text-3xl font-light tracking-tight text-foreground mt-2 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function GeographyCard({ data }: { data: Array<{ country: string; sessions: number; percentage: number }> }) {
  const maxSessions = Math.max(...data.map(d => d.sessions), 1);
  
  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="flex items-center gap-2 mb-5">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Top Countries (Sessions)
        </p>
      </div>
      
      <div className="space-y-2.5">
        {data.slice(0, 6).map((country) => (
          <div key={country.country}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate max-w-[150px]">
                {country.country}
              </span>
              <span className="text-sm tabular-nums">
                {country.sessions.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-coral-400 to-coral-500 rounded-full transition-all"
                style={{ width: `${(country.sessions / maxSessions) * 100}%` }}
              />
            </div>
          </div>
        ))}
        
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No geographic data available yet
          </p>
        )}
      </div>
    </div>
  );
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[320px] rounded-2xl" />
        <Skeleton className="h-[320px] rounded-2xl" />
      </div>
    </div>
  );
}
