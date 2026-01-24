import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Building2,
  Target,
  Clock,
  DollarSign
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';

interface WinRateBySegment {
  segment: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  avgDealSize?: number;
  avgDaysToClose?: number;
}

interface WinRateAnalysisProps {
  byTier: WinRateBySegment[];
  byBuyerType: WinRateBySegment[];
  byDealSize: WinRateBySegment[];
  overallStats: {
    totalWins: number;
    totalDeals: number;
    overallWinRate: number;
    avgDealSize: number;
    avgDaysToClose: number;
    totalRevenue: number;
  };
  className?: string;
}

const TIER_COLORS = {
  'Tier A': 'hsl(142, 76%, 36%)',
  'Tier B': 'hsl(217, 91%, 60%)',
  'Tier C': 'hsl(45, 93%, 47%)',
  'Tier D': 'hsl(0, 72%, 51%)'
};

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3">
        <p className="font-semibold">{data.segment}</p>
        <div className="space-y-1 mt-2 text-sm">
          <p>
            <span className="text-muted-foreground">Win Rate:</span>{' '}
            <span className="font-medium">{data.winRate.toFixed(1)}%</span>
          </p>
          <p>
            <span className="text-muted-foreground">Wins:</span>{' '}
            <span className="font-medium text-green-600">{data.wins}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Losses:</span>{' '}
            <span className="font-medium text-red-600">{data.losses}</span>
          </p>
          {data.avgDealSize && (
            <p>
              <span className="text-muted-foreground">Avg Deal:</span>{' '}
              <span className="font-medium">{formatCurrency(data.avgDealSize)}</span>
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export const WinRateAnalysis = ({
  byTier,
  byBuyerType,
  byDealSize,
  overallStats,
  className
}: WinRateAnalysisProps) => {
  const getTrendIcon = (winRate: number, benchmark: number) => {
    if (winRate > benchmark + 5) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (winRate < benchmark - 5) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Trophy className="h-4 w-4" />
              <span className="text-sm">Win Rate</span>
            </div>
            <p className="text-2xl font-bold">{overallStats.overallWinRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">
              {overallStats.totalWins} of {overallStats.totalDeals} deals
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(overallStats.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">
              From closed deals
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-sm">Avg Deal Size</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(overallStats.avgDealSize)}</p>
            <p className="text-xs text-muted-foreground">
              Per won deal
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Avg Days to Close</span>
            </div>
            <p className="text-2xl font-bold">{overallStats.avgDaysToClose}</p>
            <p className="text-xs text-muted-foreground">
              From first contact
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Win Rate by Tier */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Win Rate by Match Tier</CardTitle>
          <CardDescription>
            How initial match quality correlates with deal success
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byTier} layout="vertical">
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="segment" width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                  {byTier.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={TIER_COLORS[entry.segment as keyof typeof TIER_COLORS] || 'hsl(220, 9%, 46%)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Tier detail rows */}
          <div className="mt-4 space-y-2">
            {byTier.map(tier => (
              <div key={tier.segment} className="flex items-center gap-3">
                <div className="w-16">
                  <Badge 
                    variant="outline"
                    style={{ 
                      backgroundColor: `${TIER_COLORS[tier.segment as keyof typeof TIER_COLORS]}20`,
                      borderColor: TIER_COLORS[tier.segment as keyof typeof TIER_COLORS],
                      color: TIER_COLORS[tier.segment as keyof typeof TIER_COLORS]
                    }}
                  >
                    {tier.segment}
                  </Badge>
                </div>
                <Progress value={tier.winRate} className="flex-1 h-2" />
                <div className="w-24 text-right flex items-center justify-end gap-2">
                  <span className="text-sm font-medium">{tier.winRate.toFixed(0)}%</span>
                  {getTrendIcon(tier.winRate, overallStats.overallWinRate)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Win Rate by Buyer Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Win Rate by Buyer Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {byBuyerType.map(type => (
              <div key={type.segment} className="flex items-center gap-3">
                <div className="w-32 truncate text-sm font-medium">
                  {type.segment}
                </div>
                <Progress value={type.winRate} className="flex-1 h-2" />
                <div className="w-20 text-right">
                  <span className="text-sm font-medium">{type.winRate.toFixed(0)}%</span>
                </div>
                <div className="w-16 text-right text-xs text-muted-foreground">
                  {type.wins}/{type.total}
                </div>
              </div>
            ))}
          </div>
          
          {byBuyerType.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No win data available yet</p>
              <p className="text-sm">Close some deals to see buyer type analysis</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Win Rate by Deal Size */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5" />
            Win Rate by Deal Size
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDealSize}>
                <XAxis dataKey="segment" />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="winRate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WinRateAnalysis;
