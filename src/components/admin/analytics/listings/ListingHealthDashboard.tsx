import { useListingHealth } from "@/hooks/useListingHealth";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp
} from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from "recharts";

export function ListingHealthDashboard() {
  const { data, isLoading, error } = useListingHealth();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Unable to load listing health data</p>
      </div>
    );
  }

  const healthData = [
    { name: 'Healthy', value: data.healthDistribution.healthy, fill: 'hsl(142 76% 36%)' },
    { name: 'Warning', value: data.healthDistribution.warning, fill: 'hsl(38 92% 50%)' },
    { name: 'Critical', value: data.healthDistribution.critical, fill: 'hsl(0 84% 60%)' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Activity className="h-5 w-5 text-coral-500" />
        <div>
          <h3 className="text-lg font-medium">Listing Health</h3>
          <p className="text-xs text-muted-foreground">Performance and engagement health scores</p>
        </div>
      </div>

      {/* Time to Engagement Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard 
          label="Avg Days to First View" 
          value={`${data.timeToFirstEngagement.avgDaysToFirstView}`}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard 
          label="Avg Days to First Save" 
          value={`${data.timeToFirstEngagement.avgDaysToFirstSave}`}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard 
          label="Avg Days to First Request" 
          value={`${data.timeToFirstEngagement.avgDaysToFirstRequest}`}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Health Distribution + Category Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Distribution Pie */}
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Health Distribution
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="h-[160px] w-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={healthData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {healthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Healthy: {data.healthDistribution.healthy}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">Warning: {data.healthDistribution.warning}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">Critical: {data.healthDistribution.critical}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Category Health */}
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Health by Category
            </p>
          </div>
          
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categoryHealth.slice(0, 6)} layout="vertical">
                <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis 
                  type="category" 
                  dataKey="category" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10}
                  width={100}
                  tickFormatter={(value) => value.length > 12 ? value.substring(0, 12) + '...' : value}
                />
                <Tooltip formatter={(value: number) => [`${value}`, 'Avg Health Score']} />
                <Bar 
                  dataKey="avgHealthScore" 
                  radius={[0, 4, 4, 0]}
                  fill="hsl(var(--coral-400))"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stale Listings Alert */}
      {data.staleListings.length > 0 && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Stale Listings Requiring Attention
            </p>
          </div>
          
          <div className="space-y-2">
            {data.staleListings.slice(0, 5).map(listing => (
              <div 
                key={listing.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-card"
              >
                <div>
                  <div className="text-sm font-medium truncate max-w-[250px]">
                    {listing.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {listing.views} views, 0 saves, {listing.daysActive} days active
                  </div>
                </div>
                <span className="text-xs text-red-600 font-medium">
                  Needs attention
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Critical Listings Table */}
      {data.healthScores.filter(l => l.healthStatus === 'critical').length > 0 && (
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Critical Listings
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Listing</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Score</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Views</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Days</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Issue</th>
                </tr>
              </thead>
              <tbody>
                {data.healthScores
                  .filter(l => l.healthStatus === 'critical')
                  .slice(0, 8)
                  .map((listing, index) => (
                    <tr 
                      key={listing.id} 
                      className={index % 2 === 0 ? 'bg-muted/20' : ''}
                    >
                      <td className="py-2 px-3 font-medium truncate max-w-[180px]">
                        {listing.title}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-red-500">
                        {listing.healthScore}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {listing.views}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {listing.daysActive}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {listing.issues[0] || 'Low engagement'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 p-4">
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="text-2xl font-light tracking-tight text-foreground mt-2 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[220px] rounded-2xl" />
        <Skeleton className="h-[220px] rounded-2xl" />
      </div>
      <Skeleton className="h-[200px] rounded-2xl" />
    </div>
  );
}
