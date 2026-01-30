import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { cn } from "@/lib/utils";

interface CategoryPerformanceChartProps {
  data: Array<{
    category: string;
    views: number;
    saves: number;
    requests: number;
  }>;
  className?: string;
}

export function CategoryPerformanceChart({ data, className }: CategoryPerformanceChartProps) {
  // Shorten category names for display
  const chartData = data.map(item => ({
    ...item,
    name: item.category.length > 12 ? item.category.slice(0, 12) + '...' : item.category,
  }));

  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Category Performance
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Engagement breakdown by business category
        </p>
      </div>

      {/* Chart */}
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData} 
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
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
            <Legend 
              wrapperStyle={{ fontSize: '10px' }}
            />
            <Bar 
              dataKey="views" 
              name="Views"
              fill="hsl(0 65% 67%)" 
              radius={[4, 4, 0, 0]} 
            />
            <Bar 
              dataKey="requests" 
              name="Requests"
              fill="hsl(20 100% 70%)" 
              radius={[4, 4, 0, 0]} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
