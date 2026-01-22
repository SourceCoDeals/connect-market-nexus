import React, { useState } from 'react';
import { useReMarketingAnalytics } from '@/hooks/useReMarketingAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MatchingFunnel, 
  TierDistributionChart, 
  ScoringTrendsChart,
  CategoryPerformanceChart,
  UniversePerformanceTable 
} from '@/components/remarketing';
import { 
  BarChart3, 
  Users, 
  Target, 
  TrendingUp, 
  Activity,
  RefreshCw,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const timeRanges = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 }
];

const ReMarketingAnalytics = () => {
  const [daysBack, setDaysBack] = useState(30);
  const { data, isLoading, error, refetch } = useReMarketingAnalytics(daysBack);

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-destructive mb-4">Failed to load analytics data</p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/remarketing">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Remarketing Analytics</h1>
            <p className="text-muted-foreground text-sm">
              Performance metrics and funnel analysis
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            {timeRanges.map(({ label, days }) => (
              <Button
                key={days}
                variant={daysBack === days ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none first:rounded-l-md last:rounded-r-md"
                onClick={() => setDaysBack(days)}
              >
                {label}
              </Button>
            ))}
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Target className="h-4 w-4" />
                  <span className="text-sm">Total Scores</span>
                </div>
                <p className="text-2xl font-bold">{data?.summary.totalScores.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  +{data?.summary.scoresLast7Days} this week
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm">Avg Score</span>
                </div>
                <p className="text-2xl font-bold">{data?.summary.avgCompositeScore}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data?.summary.tierAPercentage.toFixed(1)}% Tier A
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Buyers</span>
                </div>
                <p className="text-2xl font-bold">{data?.summary.totalBuyers}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data?.summary.totalUniverses} universes
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Activity className="h-4 w-4" />
                  <span className="text-sm">Active Outreach</span>
                </div>
                <p className="text-2xl font-bold">{data?.summary.activeOutreach}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  In progress
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <>
            <Card><CardContent className="p-6"><Skeleton className="h-[350px]" /></CardContent></Card>
            <Card><CardContent className="p-6"><Skeleton className="h-[350px]" /></CardContent></Card>
          </>
        ) : (
          <>
            <MatchingFunnel data={data?.funnel || []} />
            <ScoringTrendsChart data={data?.scoringTrends || []} />
          </>
        )}
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            <Card><CardContent className="p-6"><Skeleton className="h-[300px]" /></CardContent></Card>
            <Card><CardContent className="p-6"><Skeleton className="h-[300px]" /></CardContent></Card>
          </>
        ) : (
          <>
            <TierDistributionChart data={data?.tierDistribution || []} />
            <CategoryPerformanceChart 
              data={data?.categoryAverages || { geography: 0, size: 0, service: 0, ownerGoals: 0 }} 
              className="md:col-span-2 lg:col-span-2"
            />
          </>
        )}
      </div>

      {/* Universe Performance Table */}
      {isLoading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-[300px]" /></CardContent></Card>
      ) : (
        <UniversePerformanceTable data={data?.universePerformance || []} />
      )}
    </div>
  );
};

export default ReMarketingAnalytics;
