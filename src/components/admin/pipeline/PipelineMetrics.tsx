
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Target,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';

interface PipelineMetricsProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineMetrics({ pipeline }: PipelineMetricsProps) {
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
    return `${Math.round(value)}%`;
  };

  const metrics = [
    {
      title: 'Total Pipeline Value',
      value: formatCurrency(pipeline.metrics.totalValue),
      icon: DollarSign,
      change: '+12%',
      changeType: 'positive' as const,
    },
    {
      title: 'Active Deals',
      value: pipeline.metrics.totalDeals.toString(),
      icon: Target,
      change: '+3',
      changeType: 'positive' as const,
    },
    {
      title: 'Avg Probability',
      value: formatPercentage(pipeline.metrics.avgProbability),
      icon: TrendingUp,
      change: '+5%',
      changeType: 'positive' as const,
    },
    {
      title: 'Conversion Rate',
      value: formatPercentage(pipeline.metrics.conversionRate),
      icon: CheckCircle,
      change: '-2%',
      changeType: 'negative' as const,
    },
    {
      title: 'Avg Days in Stage',
      value: Math.round(pipeline.metrics.avgDaysInStage).toString(),
      icon: Clock,
      change: '+1.2 days',
      changeType: 'neutral' as const,
    },
    {
      title: 'Pending Tasks',
      value: pipeline.metrics.pendingTasks.toString(),
      icon: AlertCircle,
      change: '+5',
      changeType: 'negative' as const,
    },
  ];

  return (
    <div className="border-b bg-muted/30">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Pipeline Metrics</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={pipeline.toggleMetrics}
            className="h-8 w-8 p-0"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.title} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <Badge
                    variant={
                      metric.changeType === 'positive'
                        ? 'default'
                        : metric.changeType === 'negative'
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="text-xs"
                  >
                    {metric.change}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">{metric.title}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
