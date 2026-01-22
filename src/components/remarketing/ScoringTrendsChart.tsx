import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { ScoringTrend } from '@/hooks/useReMarketingAnalytics';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoringTrendsChartProps {
  data: ScoringTrend[];
  className?: string;
}

type ViewMode = 'volume' | 'tiers' | 'quality';

export function ScoringTrendsChart({ data, className }: ScoringTrendsChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('volume');
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="font-semibold mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.name}:</span>
                <span className="font-medium">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const hasData = data.some(d => d.scores > 0);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Scoring Trends
          </CardTitle>
          <div className="flex gap-1">
            <Button 
              variant={viewMode === 'volume' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('volume')}
            >
              Volume
            </Button>
            <Button 
              variant={viewMode === 'tiers' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('tiers')}
            >
              Tiers
            </Button>
            <Button 
              variant={viewMode === 'quality' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('quality')}
            >
              Quality
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No scoring activity in this period
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {viewMode === 'volume' ? (
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorScores" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="scores"
                    name="Scores Generated"
                    stroke="hsl(217, 91%, 60%)"
                    fillOpacity={1}
                    fill="url(#colorScores)"
                    strokeWidth={2}
                  />
                </AreaChart>
              ) : viewMode === 'tiers' ? (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="tierA" name="Tier A" stackId="a" fill="hsl(142, 76%, 36%)" />
                  <Bar dataKey="tierB" name="Tier B" stackId="a" fill="hsl(217, 91%, 60%)" />
                  <Bar dataKey="tierC" name="Tier C" stackId="a" fill="hsl(45, 93%, 47%)" />
                  <Bar dataKey="tierD" name="Tier D" stackId="a" fill="hsl(0, 72%, 51%)" />
                </BarChart>
              ) : (
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="avgScore"
                    name="Avg. Score"
                    stroke="hsl(142, 76%, 36%)"
                    fillOpacity={1}
                    fill="url(#colorAvg)"
                    strokeWidth={2}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
