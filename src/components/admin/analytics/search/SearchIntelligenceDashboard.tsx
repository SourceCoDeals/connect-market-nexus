import { useSearchAnalytics } from "@/hooks/useSearchAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { TopSearchQueries } from "./TopSearchQueries";
import { ZeroResultsAlert } from "./ZeroResultsAlert";
import { FilterUsageChart } from "./FilterUsageChart";
import { cn } from "@/lib/utils";

interface SearchIntelligenceDashboardProps {
  timeRangeDays: number;
}

export function SearchIntelligenceDashboard({ timeRangeDays }: SearchIntelligenceDashboardProps) {
  const { data, isLoading, error } = useSearchAnalytics(timeRangeDays);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load search data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          label="Total Searches" 
          value={data.totalSearches.toLocaleString()} 
        />
        <StatCard 
          label="Avg Results" 
          value={data.avgResultsPerSearch.toString()} 
        />
        <StatCard 
          label="Zero Result Rate" 
          value={`${data.zeroResultRate.toFixed(1)}%`} 
          alert={data.zeroResultRate > 10}
        />
        <StatCard 
          label="Avg Time to Click" 
          value={`${data.avgTimeToClick}s`} 
        />
      </div>

      {/* Top Queries */}
      <TopSearchQueries data={data.topQueries} />

      {/* Zero Results + Filter Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ZeroResultsAlert data={data.zeroResultSearches} />
        <FilterUsageChart data={data.filterUsage} />
      </div>
    </div>
  );
}

function StatCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={cn(
      "rounded-2xl bg-card border p-5",
      alert ? "border-coral-500/50 bg-coral-500/5" : "border-border/50"
    )}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      <p className={cn(
        "text-2xl md:text-3xl font-light tracking-tight mt-2 tabular-nums",
        alert ? "text-coral-500" : "text-foreground"
      )}>
        {value}
      </p>
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
      <Skeleton className="h-[360px] rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[280px] rounded-2xl" />
        <Skeleton className="h-[280px] rounded-2xl" />
      </div>
    </div>
  );
}
