import { useBuyerIntentAnalytics } from "@/hooks/useBuyerIntentAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Target, 
  DollarSign, 
  TrendingUp,
  Users,
  Zap,
  Search
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid
} from "recharts";

interface BuyerIntentDashboardProps {
  timeRangeDays: number;
}

export function BuyerIntentDashboard({ timeRangeDays }: BuyerIntentDashboardProps) {
  const { data, isLoading, error } = useBuyerIntentAnalytics(timeRangeDays);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load buyer intent data</p>
      </div>
    );
  }

  const COLORS = ['hsl(var(--coral-400))', 'hsl(var(--peach-400))', 'hsl(var(--primary))', 'hsl(var(--muted-foreground))'];

  const capitalData = [
    { name: 'Deploying Now', value: data.capitalReadiness.deployingNow },
    { name: 'Raising Capital', value: data.capitalReadiness.raisingCapital },
    { name: 'Exploring', value: data.capitalReadiness.exploring },
    { name: 'Not Specified', value: data.capitalReadiness.notSpecified },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-coral-500" />
        <div>
          <h2 className="text-2xl font-light tracking-tight">Buyer Intent Intelligence</h2>
          <p className="text-sm text-muted-foreground">Understanding buyer sentiment and readiness</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          label="Total Buyers" 
          value={data.totalBuyers.toLocaleString()}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard 
          label="Ready to Buy" 
          value={data.readyToBuyCount.toLocaleString()}
          icon={<Zap className="h-4 w-4" />}
          highlight
        />
        <StatCard 
          label="Deploying Capital" 
          value={data.capitalReadiness.deployingNow.toLocaleString()}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard 
          label="Avg Engagement" 
          value={`${data.avgEngagementScore}`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Intent Distribution + Capital Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Intent Distribution */}
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Intent Distribution
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Why buyers are on the platform
            </p>
          </div>
          
          <div className="space-y-3">
            {data.intentDistribution.slice(0, 6).map((item, index) => {
              const colors = [
                'bg-coral-500',
                'bg-peach-400',
                'bg-primary',
                'bg-muted-foreground/50',
                'bg-coral-300',
                'bg-peach-300',
              ];
              
              return (
                <div key={item.intent}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium truncate max-w-[200px]">{item.intent}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{item.count}</span>
                      <span className="text-sm font-medium tabular-nums">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${colors[index % colors.length]}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Capital Readiness Pie */}
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Capital Readiness
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Buyer capital deployment status
            </p>
          </div>
          
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={capitalData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {capitalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Intent Trend Over Time */}
      {data.intentTrend.length > 0 && (
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Intent Trend
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              New buyer intent over time
            </p>
          </div>
          
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.intentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="activelyBuying" 
                  stroke="hsl(var(--coral-500))" 
                  strokeWidth={2}
                  name="Actively Buying"
                />
                <Line 
                  type="monotone" 
                  dataKey="exploring" 
                  stroke="hsl(var(--peach-400))" 
                  strokeWidth={2}
                  name="Exploring"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Mandate Keywords */}
      {data.mandateKeywords.length > 0 && (
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Mandate Keywords
            </p>
          </div>
          <p className="text-xs text-muted-foreground/70 mb-4">
            Most common terms in buyer investment theses
          </p>
          
          <div className="flex flex-wrap gap-2">
            {data.mandateKeywords.slice(0, 25).map((kw, index) => {
              const size = index < 5 ? 'text-base font-medium' : 
                          index < 10 ? 'text-sm' : 'text-xs';
              const opacity = Math.max(0.4, 1 - (index * 0.025));
              
              return (
                <span 
                  key={kw.keyword}
                  className={`px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors ${size}`}
                  style={{ opacity }}
                >
                  {kw.keyword}
                  <span className="ml-1.5 text-xs text-muted-foreground">({kw.count})</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Buyer Type × Intent Heatmap */}
      <div className="rounded-2xl bg-card border border-border/50 p-6">
        <div className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Buyer Type × Intent
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Which buyer types are most active
          </p>
        </div>
        
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={aggregateBuyerTypeData(data.buyerTypeIntent)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis 
                type="category" 
                dataKey="buyerType" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                width={120}
              />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--coral-400))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function aggregateBuyerTypeData(data: Array<{ buyerType: string; intent: string; count: number }>) {
  const aggregated: Record<string, number> = {};
  data.forEach(d => {
    aggregated[d.buyerType] = (aggregated[d.buyerType] || 0) + d.count;
  });
  
  return Object.entries(aggregated)
    .map(([buyerType, count]) => ({ buyerType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function StatCard({ label, value, icon, highlight }: { 
  label: string; 
  value: string; 
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-card border border-border/50 p-5 ${highlight ? 'ring-2 ring-coral-500/20' : ''}`}>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className={`text-2xl md:text-3xl font-light tracking-tight mt-2 tabular-nums ${highlight ? 'text-coral-500' : 'text-foreground'}`}>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[320px] rounded-2xl" />
        <Skeleton className="h-[320px] rounded-2xl" />
      </div>
      <Skeleton className="h-[240px] rounded-2xl" />
      <Skeleton className="h-[160px] rounded-2xl" />
    </div>
  );
}
