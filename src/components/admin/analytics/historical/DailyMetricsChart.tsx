import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";

interface DailyMetric {
  date: string;
  totalUsers: number;
  newSignups: number;
  activeUsers: number;
  totalSessions: number;
  pageViews: number;
  connectionRequests: number;
  successfulConnections: number;
}

interface DailyMetricsChartProps {
  data: DailyMetric[];
}

export function DailyMetricsChart({ data }: DailyMetricsChartProps) {
  // Format data for chart
  const chartData = data.map(d => ({
    ...d,
    date: format(new Date(d.date), 'MMM d'),
  }));

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Daily Trends
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Key metrics over time
        </p>
      </div>

      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }}
            />
            <Line 
              type="monotone" 
              dataKey="totalSessions" 
              name="Sessions"
              stroke="hsl(var(--coral-500))" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="pageViews" 
              name="Page Views"
              stroke="hsl(var(--peach-500))" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="activeUsers" 
              name="Active Users"
              stroke="#6366f1" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="connectionRequests" 
              name="Connections"
              stroke="#22c55e" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
