import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface FilterUsageChartProps {
  data: Array<{
    filter: string;
    count: number;
    percentage: number;
  }>;
  className?: string;
}

const COLORS = [
  'hsl(0 65% 67%)',    // coral-500
  'hsl(20 100% 70%)',  // peach-500
  'hsl(220 55% 45%)',  // navy-600
  'hsl(160 60% 50%)',  // teal
  'hsl(280 60% 60%)',  // purple
  'hsl(40 80% 60%)',   // amber
];

export function FilterUsageChart({ data, className }: FilterUsageChartProps) {
  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Filter Usage
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Which filters users apply most
        </p>
      </div>

      {/* Chart + Legend */}
      <div className="flex items-center gap-6">
        {/* Donut Chart */}
        <div className="w-32 h-32 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="filter"
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                strokeWidth={0}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2.5">
          {data.slice(0, 6).map((item, index) => (
            <div key={item.filter} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-xs text-muted-foreground">{item.filter}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium tabular-nums">
                  {item.count}
                </span>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums w-10 text-right">
                  {item.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {data.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No filter usage data available
        </p>
      )}
    </div>
  );
}
