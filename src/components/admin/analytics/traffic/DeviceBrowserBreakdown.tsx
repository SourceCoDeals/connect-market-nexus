import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface DeviceBrowserBreakdownProps {
  deviceData: Array<{
    device: string;
    count: number;
    percentage: number;
  }>;
  browserData: Array<{
    browser: string;
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

export function DeviceBrowserBreakdown({ deviceData, browserData, className }: DeviceBrowserBreakdownProps) {
  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Device Section */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4">
          Device Type
        </p>
        
        <div className="flex items-center gap-4">
          <div className="w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deviceData}
                  dataKey="count"
                  nameKey="device"
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={40}
                  strokeWidth={0}
                >
                  {deviceData.map((_, index) => (
                    <Cell key={`device-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex-1 space-y-2">
            {deviceData.slice(0, 3).map((item, index) => (
              <div key={item.device} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-xs text-muted-foreground">{item.device}</span>
                </div>
                <span className="text-xs font-medium tabular-nums">
                  {item.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Browser Section */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4">
          Browser Distribution
        </p>
        
        <div className="space-y-2.5">
          {browserData.slice(0, 5).map((item, index) => (
            <div key={item.browser}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{item.browser}</span>
                <span className="text-xs font-medium tabular-nums">
                  {item.count.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${item.percentage}%`,
                    backgroundColor: COLORS[index % COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
