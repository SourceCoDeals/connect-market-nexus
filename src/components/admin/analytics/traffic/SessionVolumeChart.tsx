import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface SessionVolumeChartProps {
  data: Array<{
    date: string;
    sessions: number;
    uniqueUsers: number;
  }>;
  className?: string;
}

export function SessionVolumeChart({ data, className }: SessionVolumeChartProps) {
  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Session Volume
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Daily sessions and unique users over time
        </p>
      </div>

      {/* Chart */}
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="sessionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0 65% 67%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0 65% 67%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(20 100% 70%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(20 100% 70%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}
            />
            <Area
              type="monotone"
              dataKey="sessions"
              name="Sessions"
              stroke="hsl(0 65% 67%)"
              strokeWidth={2}
              fill="url(#sessionGradient)"
            />
            <Area
              type="monotone"
              dataKey="uniqueUsers"
              name="Unique Users"
              stroke="hsl(20 100% 70%)"
              strokeWidth={2}
              fill="url(#userGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-coral-500" />
          <span className="text-xs text-muted-foreground">Sessions</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-peach-500" />
          <span className="text-xs text-muted-foreground">Unique Users</span>
        </div>
      </div>
    </div>
  );
}
