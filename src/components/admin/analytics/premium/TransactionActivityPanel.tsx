import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface TransactionData {
  type: string;
  accounts: number;
  connections: number;
}

interface TransactionActivityPanelProps {
  data: TransactionData[];
  className?: string;
}

const COLORS = [
  "hsl(0 65% 67%)",      // coral
  "hsl(20 100% 70%)",    // peach
  "hsl(220 55% 50%)",    // navy-blue
  "hsl(160 60% 50%)",    // teal
  "hsl(280 60% 60%)",    // purple
  "hsl(45 90% 55%)",     // amber
];

export function TransactionActivityPanel({ data, className }: TransactionActivityPanelProps) {
  const totalAccounts = useMemo(() => 
    data.reduce((sum, item) => sum + item.accounts, 0),
    [data]
  );

  const totalConnections = useMemo(() => 
    data.reduce((sum, item) => sum + item.connections, 0),
    [data]
  );

  const chartData = useMemo(() => 
    data.map((item, index) => ({
      name: item.type,
      value: item.accounts,
      color: COLORS[index % COLORS.length],
    })),
    [data]
  );

  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Buyer Composition
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Accounts and connection activity by type
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <div className="relative flex items-center justify-center">
          <div className="w-full aspect-square max-w-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="85%"
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-light tabular-nums text-foreground">
              {totalAccounts}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="flex flex-col justify-center">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/50">
                <th className="text-left pb-3 font-medium">Type</th>
                <th className="text-right pb-3 font-medium">Accounts</th>
                <th className="text-right pb-3 font-medium">Requests</th>
                <th className="text-right pb-3 font-medium">%</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {data.slice(0, 6).map((item, index) => {
                const percentage = totalAccounts > 0 
                  ? ((item.accounts / totalAccounts) * 100).toFixed(0)
                  : '0';
                
                return (
                  <tr 
                    key={item.type}
                    className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="truncate text-foreground">{item.type}</span>
                    </td>
                    <td className="py-3 text-right tabular-nums text-muted-foreground">
                      {item.accounts}
                    </td>
                    <td className="py-3 text-right tabular-nums text-muted-foreground">
                      {item.connections}
                    </td>
                    <td className="py-3 text-right tabular-nums text-muted-foreground">
                      {percentage}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
