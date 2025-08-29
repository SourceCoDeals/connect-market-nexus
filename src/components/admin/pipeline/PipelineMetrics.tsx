import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import { useDeals } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';

interface PipelineMetricsProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const PipelineMetrics: React.FC<PipelineMetricsProps> = ({
  isCollapsed,
  onToggleCollapse
}) => {
  const { data: deals = [] } = useDeals();

  const metrics = React.useMemo(() => {
    const totalValue = deals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0);
    const totalDeals = deals.length;
    const avgDealSize = totalDeals > 0 ? totalValue / totalDeals : 0;
    const highPriorityDeals = deals.filter(deal => deal.deal_priority === 'urgent' || deal.deal_priority === 'high').length;

    return {
      totalValue,
      totalDeals,
      avgDealSize,
      highPriorityDeals
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

  if (isCollapsed) {
    return (
      <div className="h-12 border-b border-border/50 flex items-center justify-between px-6 bg-muted/20">
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span>{metrics.totalDeals} deals</span>
          <span>{formatCurrency(metrics.totalValue)} total</span>
          <span>{metrics.highPriorityDeals} priority</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="h-8 w-8 p-0"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-background border-b border-border/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Pipeline Overview</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="h-8 w-8 p-0"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-muted/20 border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Value</p>
              <p className="text-2xl font-semibold">{formatCurrency(metrics.totalValue)}</p>
            </div>
            <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-muted/20 border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Deals</p>
              <p className="text-2xl font-semibold">{metrics.totalDeals}</p>
            </div>
            <div className="h-8 w-8 bg-info/10 rounded-full flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-info" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-muted/20 border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Avg Deal Size</p>
              <p className="text-2xl font-semibold">{formatCurrency(metrics.avgDealSize)}</p>
            </div>
            <div className="h-8 w-8 bg-success/10 rounded-full flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-muted/20 border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Priority Deals</p>
              <p className="text-2xl font-semibold">{metrics.highPriorityDeals}</p>
            </div>
            <div className="h-8 w-8 bg-warning/10 rounded-full flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-warning" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};