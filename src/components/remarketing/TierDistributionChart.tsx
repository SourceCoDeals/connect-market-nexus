import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TierDistribution } from '@/hooks/useReMarketingAnalytics';
import { BarChart3 } from 'lucide-react';

interface TierDistributionChartProps {
  data: TierDistribution[];
  className?: string;
}

const TIER_COLORS: Record<string, string> = {
  'A': 'hsl(142, 76%, 36%)', // emerald-600
  'B': 'hsl(217, 91%, 60%)', // blue-500
  'C': 'hsl(45, 93%, 47%)',  // amber-500
  'D': 'hsl(0, 72%, 51%)'    // red-500
};

const TIER_LABELS: Record<string, string> = {
  'A': 'Excellent Fit',
  'B': 'Good Fit',
  'C': 'Moderate Fit',
  'D': 'Low Fit'
};

export function TierDistributionChart({ data, className }: TierDistributionChartProps) {
  const chartData = data.map(d => ({
    ...d,
    name: `Tier ${d.tier}`,
    label: TIER_LABELS[d.tier] || d.tier,
    fill: TIER_COLORS[d.tier] || 'hsl(220, 9%, 46%)'
  }));

  const total = data.reduce((sum, d) => sum + d.count, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm text-muted-foreground">{data.label}</p>
          <div className="mt-2 space-y-1">
            <p className="text-sm">
              <span className="font-medium">{data.count}</span> matches
            </p>
            <p className="text-sm">
              <span className="font-medium">{data.percentage.toFixed(1)}%</span> of total
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ tier, percentage }: any) => {
    if (percentage < 5) return null;
    return `${tier}: ${percentage.toFixed(0)}%`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Tier Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No scoring data yet
          </div>
        ) : (
          <>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    label={renderCustomLabel}
                    labelLine={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {chartData.map((tier) => (
                <div 
                  key={tier.tier} 
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                >
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: tier.fill }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tier.name}</p>
                    <p className="text-xs text-muted-foreground">{tier.count} matches</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
