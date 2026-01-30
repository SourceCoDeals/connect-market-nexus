import { useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from "recharts";
import { cn } from "@/lib/utils";

interface VelocityDataPoint {
  date: string;
  [key: string]: string | number;
}

interface MultiSeriesVelocityChartProps {
  data: VelocityDataPoint[];
  series: Array<{ key: string; name: string; color: string }>;
  className?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;

  return (
    <div className="bg-navy-900 text-white px-4 py-3 rounded-xl shadow-xl border border-navy-700">
      <p className="text-xs text-white/60 mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div 
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-white/80">{entry.name}:</span>
          <span className="font-medium tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export function MultiSeriesVelocityChart({ data, series, className }: MultiSeriesVelocityChartProps) {
  const maxValue = useMemo(() => {
    let max = 0;
    data.forEach(point => {
      series.forEach(s => {
        const val = point[s.key];
        if (typeof val === 'number' && val > max) max = val;
      });
    });
    return max || 10;
  }, [data, series]);

  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Connection Velocity
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Requests over time by buyer type
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <div 
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-[10px] text-muted-foreground">{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            barCategoryGap="20%"
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))" 
              vertical={false}
              opacity={0.5}
            />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ 
                fill: 'hsl(var(--muted-foreground))', 
                fontSize: 10,
              }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ 
                fill: 'hsl(var(--muted-foreground))', 
                fontSize: 10,
              }}
              domain={[0, maxValue + Math.ceil(maxValue * 0.1)]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
            {series.map((s, index) => (
              <Bar 
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
