import { useEngagementAnalytics } from "@/hooks/useEngagementAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingLeaderboard } from "./ListingLeaderboard";
import { EngagementFunnel } from "./EngagementFunnel";
import { CategoryPerformanceChart } from "./CategoryPerformanceChart";
import { UserJourneyFlow } from "./UserJourneyFlow";
import { cn } from "@/lib/utils";

interface EngagementDashboardProps {
  timeRangeDays: number;
}

export function EngagementDashboard({ timeRangeDays }: EngagementDashboardProps) {
  const { data, isLoading, error } = useEngagementAnalytics(timeRangeDays);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load engagement data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          label="Total Views" 
          value={data.funnelMetrics.totalViews.toLocaleString()} 
        />
        <StatCard 
          label="Total Saves" 
          value={data.funnelMetrics.totalSaves.toLocaleString()} 
        />
        <StatCard 
          label="Total Requests" 
          value={data.funnelMetrics.totalRequests.toLocaleString()} 
        />
        <StatCard 
          label="View → Request" 
          value={`${data.funnelMetrics.viewToRequestRate.toFixed(2)}%`} 
        />
      </div>

      {/* Listing Leaderboard */}
      <ListingLeaderboard data={data.listingLeaderboard} />

      {/* Funnel + Category Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EngagementFunnel metrics={data.funnelMetrics} />
        <CategoryPerformanceChart data={data.categoryPerformance} />
      </div>

      {/* User Journey Flow */}
      <UserJourneyFlow data={data.userJourneyPaths} />

      {/* Scroll Depth + Time on Page */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScrollDepthCard data={data.scrollDepthDistribution} />
        <TimeOnPageCard data={data.avgTimeByCategory} />
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

function ScrollDepthCard({ data }: { data: Array<{ depth: string; count: number; percentage: number }> }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Scroll Depth
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          How far users scroll on listings
        </p>
      </div>
      
      <div className="space-y-3">
        {data.map((item, index) => {
          const colors = [
            'bg-coral-100 dark:bg-coral-100/30',
            'bg-coral-200 dark:bg-coral-200/40',
            'bg-coral-400 dark:bg-coral-400/50',
            'bg-coral-500 dark:bg-coral-500/60',
          ];
          
          return (
            <div key={item.depth}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">{item.depth}</span>
                <span className="text-sm font-medium tabular-nums">
                  {item.percentage.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all", colors[index])}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeOnPageCard({ data }: { data: Array<{ category: string; avgSeconds: number }> }) {
  const maxTime = Math.max(...data.map(d => d.avgSeconds), 1);
  
  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Avg Time on Page
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          By category (seconds)
        </p>
      </div>
      
      <div className="space-y-2.5">
        {data.slice(0, 6).map((item) => (
          <div key={item.category}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                {item.category}
              </span>
              <span className="text-sm font-medium tabular-nums">
                {item.avgSeconds}s
              </span>
            </div>
            <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-peach-400 to-coral-500 rounded-full transition-all"
                style={{ width: `${(item.avgSeconds / maxTime) * 100}%` }}
              />
            </div>
          </div>
        ))}
        
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No time data available
          </p>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[400px] rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[280px] rounded-2xl" />
        <Skeleton className="h-[280px] rounded-2xl" />
      </div>
    </div>
  );
}
