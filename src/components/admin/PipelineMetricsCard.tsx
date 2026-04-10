import { Card } from '@/components/ui/card';
import { DollarSign, Gauge, ListChecks, Percent, Target, Clock } from 'lucide-react';
import type { PipelineMetrics } from '@/hooks/admin/use-pipeline-core';

interface PipelineMetricsCardProps {
  metrics: PipelineMetrics;
}

const formatCurrency = (val: number) => {
  if (!val) return '$0';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
};

/**
 * PipelineMetricsCard — compact KPI strip surfaced above the pipeline workspace.
 * Renders six metrics already computed in usePipelineCore.
 */
export function PipelineMetricsCard({ metrics }: PipelineMetricsCardProps) {
  const weightedValue = Math.round(metrics.totalValue * (metrics.avgProbability / 100));

  const items = [
    {
      label: 'Deals',
      value: metrics.totalDeals.toLocaleString(),
      icon: Target,
    },
    {
      label: 'Total Value',
      value: formatCurrency(metrics.totalValue),
      icon: DollarSign,
    },
    {
      label: 'Weighted',
      value: formatCurrency(weightedValue),
      icon: Gauge,
      title: 'Total value × average probability',
    },
    {
      label: 'Avg Prob.',
      value: `${Math.round(metrics.avgProbability)}%`,
      icon: Percent,
    },
    {
      label: 'Conversion',
      value: `${Math.round(metrics.conversionRate)}%`,
      icon: Percent,
      title: 'Share of deals in a closed stage',
    },
    {
      label: 'Open Tasks',
      value: metrics.pendingTasks.toLocaleString(),
      icon: ListChecks,
    },
    {
      label: 'Avg Days in Stage',
      value: `${Math.round(metrics.avgDaysInStage)}d`,
      icon: Clock,
    },
  ];

  return (
    <Card className="mx-4 my-3 px-4 py-3 border-border/60 bg-muted/10">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {items.map(({ label, value, icon: Icon, title }) => (
          <div key={label} className="flex items-center gap-2.5" title={title}>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {label}
              </div>
              <div className="text-sm font-semibold text-foreground tabular-nums">{value}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
