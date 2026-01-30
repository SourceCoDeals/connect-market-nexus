import { useExitAnalysis } from "@/hooks/useExitAnalysis";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  LogOut, 
  TrendingDown,
  ArrowRight,
  BarChart3,
  AlertCircle
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
  Cell
} from "recharts";

interface ExitAnalysisPanelProps {
  timeRangeDays: number;
}

export function ExitAnalysisPanel({ timeRangeDays }: ExitAnalysisPanelProps) {
  const { data, isLoading, error } = useExitAnalysis(timeRangeDays);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Unable to load exit analysis data</p>
      </div>
    );
  }

  const COLORS = ['hsl(var(--coral-400))', 'hsl(var(--peach-400))', 'hsl(var(--primary))', 'hsl(var(--muted-foreground))', 'hsl(var(--coral-300))'];

  const conversionData = [
    { name: 'Without Conversion', value: data.exitVsConversion.exitedWithoutConversion, fill: 'hsl(0 84% 60%)' },
    { name: 'After Conversion', value: data.exitVsConversion.exitedAfterConversion, fill: 'hsl(142 76% 36%)' },
    { name: 'No Exit Tracked', value: data.exitVsConversion.noExitTracked, fill: 'hsl(var(--muted-foreground))' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <LogOut className="h-5 w-5 text-coral-500" />
        <div>
          <h3 className="text-lg font-medium">Exit Analysis</h3>
          <p className="text-xs text-muted-foreground">Understanding where and why users leave</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard 
          label="Total Exits" 
          value={data.totalExits.toLocaleString()}
          icon={<LogOut className="h-4 w-4" />}
        />
        <StatCard 
          label="Avg Pages Before Exit" 
          value={`${data.avgPagesBeforeExit}`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <StatCard 
          label="Bounce Rate" 
          value={`${data.bounceRate.toFixed(1)}%`}
          icon={<TrendingDown className="h-4 w-4" />}
          warning={data.bounceRate > 50}
        />
      </div>

      {/* Exit by Stage + Exit vs Conversion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exit by Stage */}
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Exit by Journey Stage
            </p>
          </div>
          
          <div className="space-y-3">
            {data.exitByStage.slice(0, 6).map((stage, index) => (
              <div key={stage.stage}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{stage.stage}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {stage.exitCount.toLocaleString()}
                    </span>
                    <span className="text-sm tabular-nums font-medium">
                      {stage.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${stage.percentage}%`,
                      backgroundColor: COLORS[index % COLORS.length]
                    }}
                  />
                </div>
              </div>
            ))}
            
            {data.exitByStage.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No exit data available yet
              </p>
            )}
          </div>
        </div>

        {/* Exit vs Conversion */}
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Exit vs Conversion
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="h-[160px] w-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={conversionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {conversionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Exited without converting: {data.exitVsConversion.exitedWithoutConversion}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Exited after converting: {data.exitVsConversion.exitedAfterConversion}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                <span>No exit tracked: {data.exitVsConversion.noExitTracked}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Exit Pages */}
      <div className="rounded-2xl bg-card border border-border/50 p-6">
        <div className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Top Exit Pages
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Pages where users most frequently leave
          </p>
        </div>
        
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.exitPageRanking.slice(0, 8)} layout="vertical">
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis 
                type="category" 
                dataKey="pageLabel" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                width={120}
              />
              <Tooltip 
                formatter={(value: number, name: string, props: any) => [
                  `${value} exits (${props.payload.exitPercentage.toFixed(1)}%)`,
                  'Exits'
                ]}
              />
              <Bar dataKey="exitCount" fill="hsl(var(--coral-400))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* High Bounce Warning */}
      {data.bounceRate > 40 && (
        <div className="rounded-2xl bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                High Bounce Rate Detected
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">
                {data.bounceRate.toFixed(1)}% of sessions exit after viewing only one page. 
                Consider improving landing page engagement or targeting.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, warning }: { 
  label: string; 
  value: string; 
  icon?: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-card border border-border/50 p-4 ${warning ? 'border-yellow-500/50' : ''}`}>
      <div className="flex items-center gap-1.5">
        {icon && <span className={warning ? 'text-yellow-500' : 'text-muted-foreground'}>{icon}</span>}
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className={`text-2xl font-light tracking-tight mt-2 tabular-nums ${warning ? 'text-yellow-600' : 'text-foreground'}`}>
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
      <Skeleton className="h-[260px] rounded-2xl" />
    </div>
  );
}
