import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  Target, 
  TrendingUp, 
  Clock, 
  Users, 
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';

interface PipelineMetricsProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineMetrics({ pipeline }: PipelineMetricsProps) {
  const { metrics } = pipeline;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: value >= 1000000 ? 'compact' : 'standard',
    }).format(value);
  };
  
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };
  
  const formatDays = (value: number) => {
    return `${Math.round(value)} days`;
  };
  
  const metricCards = [
    {
      title: 'Total Value',
      value: formatCurrency(metrics.totalValue),
      icon: DollarSign,
      trend: 'up' as const,
      trendValue: '+12.5%',
      bgColor: 'bg-primary/5',
      iconColor: 'text-primary',
      borderColor: 'border-primary/20',
    },
    {
      title: 'Active Deals',
      value: metrics.totalDeals.toString(),
      icon: Target,
      trend: 'up' as const,
      trendValue: '+8',
      bgColor: 'bg-blue-500/5',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-500/20',
    },
    {
      title: 'Conversion Rate',
      value: formatPercentage(metrics.conversionRate),
      icon: TrendingUp,
      trend: 'neutral' as const,
      trendValue: '0.2%',
      bgColor: 'bg-green-500/5',
      iconColor: 'text-green-600',
      borderColor: 'border-green-500/20',
    },
    {
      title: 'Avg. Stage Time',
      value: formatDays(metrics.avgDaysInStage),
      icon: Clock,
      trend: 'down' as const,
      trendValue: '-2.1 days',
      bgColor: 'bg-orange-500/5',
      iconColor: 'text-orange-600',
      borderColor: 'border-orange-500/20',
    },
    {
      title: 'Avg. Probability',
      value: formatPercentage(metrics.avgProbability),
      icon: CheckCircle2,
      trend: 'up' as const,
      trendValue: '+3.2%',
      bgColor: 'bg-purple-500/5',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-500/20',
    },
    {
      title: 'Pending Tasks',
      value: metrics.pendingTasks.toString(),
      icon: Users,
      trend: 'down' as const,
      trendValue: '-5',
      bgColor: 'bg-red-500/5',
      iconColor: 'text-red-600',
      borderColor: 'border-red-500/20',
    },
  ];
  
  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <ArrowUp className="h-3 w-3 text-green-600" />;
      case 'down':
        return <ArrowDown className="h-3 w-3 text-red-600" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };
  
  const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };
  
  return (
    <div className="border-b border-border/50 bg-background/50">
      <div className="px-4 lg:px-6 py-4">
        {/* Mobile: Horizontal Scroll */}
        <div className="lg:hidden">
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {metricCards.slice(0, 4).map((metric, index) => {
              const Icon = metric.icon;
              return (
                <Card 
                  key={index} 
                  className={`flex-shrink-0 w-32 border ${metric.borderColor} ${metric.bgColor} transition-all duration-200 hover:shadow-sm`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`h-4 w-4 ${metric.iconColor}`} />
                      <div className="flex items-center gap-1">
                        {getTrendIcon(metric.trend)}
                      </div>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground mb-1">
                        {metric.value}
                      </p>
                      <p className="text-xs text-muted-foreground leading-tight">
                        {metric.title}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        
        {/* Desktop: Grid Layout */}
        <div className="hidden lg:grid lg:grid-cols-6 gap-4">
          {metricCards.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <Card 
                key={index} 
                className={`border ${metric.borderColor} ${metric.bgColor} transition-all duration-200 hover:shadow-sm cursor-pointer group`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg ${metric.bgColor} group-hover:scale-105 transition-transform duration-200`}>
                      <Icon className={`h-4 w-4 ${metric.iconColor}`} />
                    </div>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(metric.trend)}
                      <span className={`text-xs font-medium ${getTrendColor(metric.trend)}`}>
                        {metric.trendValue}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors duration-200">
                      {metric.value}
                    </p>
                    <p className="text-sm text-muted-foreground font-medium">
                      {metric.title}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Quick Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => pipeline.setStatusFilter('all')}
            className="h-7 px-3 text-xs bg-background/50 border-border/50"
          >
            Hot Deals
            <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-xs">
              {pipeline.deals.filter(d => d.deal_priority === 'high' || d.deal_priority === 'urgent').length}
            </Badge>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pipeline.setDocumentStatusFilter('all')}
            className="h-7 px-3 text-xs bg-background/50 border-border/50"
          >
            Overdue Tasks
            <Badge variant="destructive" className="ml-2 h-4 px-1.5 text-xs">
              {metrics.pendingTasks}
            </Badge>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const oneWeekAgo = new Date();
              oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
              // This would need a date filter implementation
            }}
            className="h-7 px-3 text-xs bg-background/50 border-border/50"
          >
            Closing Soon
            <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-xs">
              {pipeline.deals.filter(d => {
                if (!d.deal_expected_close_date) return false;
                const closeDate = new Date(d.deal_expected_close_date);
                const oneWeekFromNow = new Date();
                oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
                return closeDate <= oneWeekFromNow;
              }).length}
            </Badge>
          </Button>
        </div>
      </div>
    </div>
  );
}