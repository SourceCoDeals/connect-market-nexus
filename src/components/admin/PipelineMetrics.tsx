import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, DollarSign, Target, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';

interface PipelineMetricsProps {
  deals: Deal[];
}

export function PipelineMetrics({ deals }: PipelineMetricsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatShortCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return formatCurrency(value);
  };

  // Calculate metrics
  const totalDeals = deals.length;
  const totalValue = deals.reduce((sum, deal) => sum + deal.deal_value, 0);
  const weightedValue = deals.reduce((sum, deal) => sum + (deal.deal_value * deal.deal_probability / 100), 0);
  // Since there's no deal_status field, we'll use fee_agreement_status as proxy for closed deals
  const closedWonValue = deals
    .filter(deal => deal.fee_agreement_status === 'signed')
    .reduce((sum, deal) => sum + deal.deal_value, 0);
  const avgDealSize = totalDeals > 0 ? totalValue / totalDeals : 0;
  const avgProbability = totalDeals > 0 
    ? deals.reduce((sum, deal) => sum + deal.deal_probability, 0) / totalDeals 
    : 0;

  const metrics = [
    {
      title: 'Total deals',
      value: totalDeals.toString(),
      icon: Target,
      colorClass: 'text-blue-600',
    },
    {
      title: 'Total deal amount',
      value: formatShortCurrency(totalValue),
      icon: TrendingUp,
      colorClass: 'text-green-600',
    },
    {
      title: 'Weighted deal amount',
      value: formatShortCurrency(weightedValue),
      icon: DollarSign,
      colorClass: 'text-emerald-600',
    },
    {
      title: 'Closed won',
      value: formatShortCurrency(closedWonValue),
      icon: CheckCircle2,
      colorClass: 'text-blue-600',
    },
    {
      title: 'Average deal size',
      value: formatShortCurrency(avgDealSize),
      icon: TrendingUp,
      colorClass: 'text-purple-600',
    },
    {
      title: 'Average probability',
      value: `${Math.round(avgProbability)}%`,
      icon: Target,
      colorClass: 'text-orange-600',
    },
  ];

  return (
    <div className="bg-background border-b border-border/30 px-6 py-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index} className="border border-border/20 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-md bg-muted/40 ${metric.colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {metric.title}
                    </p>
                    <p className="text-lg font-semibold text-foreground">
                      {metric.value}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}