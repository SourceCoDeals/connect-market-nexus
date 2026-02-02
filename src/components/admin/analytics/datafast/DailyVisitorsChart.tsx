import { useMemo } from "react";
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  TooltipProps
} from "recharts";
import { format, parseISO } from "date-fns";
import { ChartTooltipContent } from "./AnalyticsTooltip";

interface DailyMetric {
  date: string;
  visitors: number;
  sessions: number;
  connections: number;
  bounceRate: number;
}

interface DailyVisitorsChartProps {
  data: DailyMetric[];
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0].payload as DailyMetric;
  
  return (
    <ChartTooltipContent 
      data={{
        date: data.date,
        visitors: data.visitors,
        sessions: data.sessions,
        connections: data.connections,
      }}
    />
  );
}

export function DailyVisitorsChart({ data }: DailyVisitorsChartProps) {
  const formattedData = useMemo(() => {
    return data.map(d => ({
      ...d,
      displayDate: format(parseISO(d.date), 'd'),
      fullDate: format(parseISO(d.date), 'MMM d'),
    }));
  }, [data]);

  const maxVisitors = Math.max(...data.map(d => d.visitors), 1);
  const maxConnections = Math.max(...data.map(d => d.connections), 1);

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[hsl(12_95%_77%)]" />
            <span className="text-xs text-muted-foreground">Visitors (unique people)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1.5 rounded bg-[hsl(220_70%_55%)]" />
            <span className="text-xs text-muted-foreground">Connections</span>
          </div>
        </div>
      </div>
      
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))" 
              strokeOpacity={0.5}
              vertical={false}
            />
            <XAxis 
              dataKey="displayDate" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              yAxisId="visitors"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
            />
            <YAxis 
              yAxisId="connections"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              domain={[0, Math.max(maxConnections * 2, 10)]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
            <Bar 
              yAxisId="visitors"
              dataKey="visitors" 
              fill="hsl(12 95% 77%)" 
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Line 
              yAxisId="connections"
              type="monotone" 
              dataKey="connections" 
              stroke="hsl(220 70% 55%)" 
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: "hsl(220 70% 55%)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
