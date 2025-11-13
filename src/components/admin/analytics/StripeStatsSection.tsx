import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  description?: string;
}

function StatCard({ label, value, icon, trend, description }: StatCardProps) {
  return (
    <div className="group relative">
      <div className="flex flex-col gap-3 p-6 border border-border/50 rounded-lg bg-card hover:border-border transition-colors">
        {/* Header with icon and label */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          <div className="text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
            {icon}
          </div>
        </div>

        {/* Main value */}
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </span>
          {trend && trend.value !== 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span
                className={cn(
                  'font-medium',
                  trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                )}
              >
                {trend.isPositive ? '+' : '-'}
                {trend.value}%
              </span>
              <span className="text-muted-foreground/60 text-xs">{trend.label}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-muted-foreground/60 mt-1">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

interface StripeStatsSectionProps {
  stats: Array<{
    label: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: {
      value: number;
      isPositive: boolean;
      label: string;
    };
    description?: string;
  }>;
}

export function StripeStatsSection({ stats }: StripeStatsSectionProps) {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>
    </div>
  );
}
