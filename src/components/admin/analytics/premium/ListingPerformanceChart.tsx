import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";

interface ListingPerformanceChartProps {
  data: Array<{
    category: string;
    connectionCount: number;
    listingCount: number;
  }>;
}

const categoryColors = [
  'hsl(var(--primary))',
  'hsl(262, 83%, 58%)', // violet
  'hsl(221, 83%, 53%)', // blue
  'hsl(160, 84%, 39%)', // emerald
  'hsl(43, 96%, 56%)',  // amber
  'hsl(346, 77%, 49%)', // rose
  'hsl(192, 91%, 36%)', // cyan
  'hsl(25, 95%, 53%)',  // orange
];

export function ListingPerformanceChart({ data }: ListingPerformanceChartProps) {
  const totalConnections = data.reduce((sum, d) => sum + d.connectionCount, 0);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-lg font-semibold">Listing Performance</CardTitle>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{totalConnections}</span> total connections
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Connection requests by category
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data} 
              layout="vertical" 
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                horizontal={false}
              />
              <XAxis 
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickMargin={8}
              />
              <YAxis 
                type="category"
                dataKey="category"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                width={120}
                tickMargin={8}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                formatter={(value: number, name: string, props: any) => [
                  `${value} connections (${props.payload.listingCount} listings)`,
                  'Performance'
                ]}
              />
              <Bar 
                dataKey="connectionCount" 
                radius={[0, 6, 6, 0]}
                maxBarSize={32}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={categoryColors[index % categoryColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
