import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
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
  variant?: 'default' | 'success' | 'warning' | 'info';
}

function StatCard({ label, value, icon, trend, variant = 'default' }: StatCardProps) {
  const variantClasses = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    info: 'text-info',
  };

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className={cn('text-3xl font-semibold tabular-nums', variantClasses[variant])}>
              {value}
            </p>
            {trend && (
              <div className="flex items-center gap-1.5 pt-1">
                {trend.isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                )}
                <span className={cn(
                  'text-xs font-medium',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}>
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </span>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn(
            'rounded-full p-3',
            variant === 'success' ? 'bg-success/10' :
            variant === 'warning' ? 'bg-warning/10' :
            variant === 'info' ? 'bg-info/10' :
            'bg-muted'
          )}>
            <div className={variantClasses[variant]}>
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface HeroStatsSectionProps {
  stats: Array<{
    label: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: {
      value: number;
      isPositive: boolean;
      label: string;
    };
    variant?: 'default' | 'success' | 'warning' | 'info';
  }>;
}

export function HeroStatsSection({ stats }: HeroStatsSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}
