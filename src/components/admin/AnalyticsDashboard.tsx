import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDeals, useDealStages } from '@/hooks/admin/use-deals';
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Users, 
  Target,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { format, subDays, differenceInDays } from 'date-fns';

interface StageAnalytics {
  stage: any;
  dealCount: number;
  totalValue: number;
  avgProbability: number;
  avgTimeInStage: number;
  conversionRate: number;
  deals: any[];
}

export function AnalyticsDashboard() {
  const { data: deals = [] } = useDeals();
  const { data: stages = [] } = useDealStages();

  // Calculate stage analytics
  const stageAnalytics = useMemo(() => {
    const analytics: StageAnalytics[] = stages.map((stage, index) => {
      const stageDeals = deals.filter(deal => deal.stage_id === stage.id);
      const totalValue = stageDeals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0);
      const avgProbability = stageDeals.length > 0 
        ? stageDeals.reduce((sum, deal) => sum + deal.deal_probability, 0) / stageDeals.length 
        : 0;
      
      // Calculate average time in stage
      const avgTimeInStage = stageDeals.length > 0
        ? stageDeals.reduce((sum, deal) => {
            const timeInStage = differenceInDays(new Date(), new Date(deal.deal_stage_entered_at));
            return sum + timeInStage;
          }, 0) / stageDeals.length
        : 0;

      // Calculate conversion rate (deals that moved to next stage)
      const nextStage = stages[index + 1];
      const dealsMovedToNext = nextStage 
        ? deals.filter(deal => deal.stage_id === nextStage.id && 
            new Date(deal.deal_stage_entered_at) > subDays(new Date(), 30)).length
        : 0;
      const conversionRate = stageDeals.length > 0 ? (dealsMovedToNext / stageDeals.length) * 100 : 0;

      return {
        stage,
        dealCount: stageDeals.length,
        totalValue,
        avgProbability,
        avgTimeInStage,
        conversionRate,
        deals: stageDeals
      };
    });

    return analytics;
  }, [deals, stages]);

  // Calculate overall metrics
  const overallMetrics = useMemo(() => {
    const totalDeals = deals.length;
    const totalPipelineValue = deals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0);
    const weightedPipelineValue = deals.reduce((sum, deal) => 
      sum + ((deal.deal_value || 0) * (deal.deal_probability / 100)), 0);
    const avgDealSize = totalDeals > 0 ? totalPipelineValue / totalDeals : 0;
    
    // Calculate deals by priority
    const priorityBreakdown = deals.reduce((acc, deal) => {
      acc[deal.deal_priority] = (acc[deal.deal_priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate deals by source
    const sourceBreakdown = deals.reduce((acc, deal) => {
      acc[deal.deal_source] = (acc[deal.deal_source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Recent activity (deals created in last 30 days)
    const recentDeals = deals.filter(deal => 
      new Date(deal.deal_created_at) > subDays(new Date(), 30)
    ).length;

    return {
      totalDeals,
      totalPipelineValue,
      weightedPipelineValue,
      avgDealSize,
      priorityBreakdown,
      sourceBreakdown,
      recentDeals
    };
  }, [deals]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Overall Pipeline Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pipeline Value</p>
                <p className="text-2xl font-bold">{formatCurrency(overallMetrics.totalPipelineValue)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Weighted Pipeline</p>
                <p className="text-2xl font-bold">{formatCurrency(overallMetrics.weightedPipelineValue)}</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold">{overallMetrics.totalDeals}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Deal Size</p>
                <p className="text-2xl font-bold">{formatCurrency(overallMetrics.avgDealSize)}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Stage Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stageAnalytics.map((analytics) => (
              <div key={analytics.stage.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: analytics.stage.color }}
                    />
                    <h4 className="font-medium">{analytics.stage.name}</h4>
                    <Badge variant="outline">{analytics.dealCount} deals</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(analytics.totalValue)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Avg Probability</p>
                    <p className="font-medium">{Math.round(analytics.avgProbability)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Time in Stage</p>
                    <p className="font-medium">{Math.round(analytics.avgTimeInStage)} days</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Conversion Rate</p>
                    <p className="font-medium">{Math.round(analytics.conversionRate)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stage Health</p>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={Math.min(analytics.conversionRate, 100)} 
                        className="h-2 flex-1" 
                      />
                      <span className="text-xs">
                        {analytics.conversionRate > 70 ? 'Good' : 
                         analytics.conversionRate > 40 ? 'Fair' : 'Poor'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Deal Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(overallMetrics.priorityBreakdown).map(([priority, count]) => (
                <div key={priority} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={
                        priority === 'urgent' ? 'bg-destructive' :
                        priority === 'high' ? 'bg-warning' :
                        priority === 'medium' ? 'bg-secondary' : 'bg-muted'
                      }
                    >
                      {priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={(count / overallMetrics.totalDeals) * 100} 
                      className="h-2 w-24" 
                    />
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Source Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Deal Source Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(overallMetrics.sourceBreakdown).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{source}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={(count / overallMetrics.totalDeals) * 100} 
                      className="h-2 w-24" 
                    />
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{overallMetrics.recentDeals}</p>
              <p className="text-sm text-muted-foreground">New Deals Created</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {deals.filter(deal => deal.nda_status === 'signed' && 
                  new Date(deal.deal_stage_entered_at) > subDays(new Date(), 30)).length}
              </p>
              <p className="text-sm text-muted-foreground">NDAs Signed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {deals.filter(deal => deal.fee_agreement_status === 'signed' && 
                  new Date(deal.deal_stage_entered_at) > subDays(new Date(), 30)).length}
              </p>
              <p className="text-sm text-muted-foreground">Fee Agreements Signed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}