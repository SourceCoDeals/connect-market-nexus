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
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg border-border/50">
      <CardContent className="p-card">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </p>
            <p className={cn(
              'text-hero-md font-semibold tabular-nums tracking-tight',
              variantClasses[variant]
            )}>
              {value}
            </p>
            {trend && (
              <div className="flex items-center gap-2 pt-1">
                <div className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold',
                  trend.isPositive 
                    ? 'bg-success/10 text-success' 
                    : 'bg-destructive/10 text-destructive'
                )}>
                  {trend.isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span className="tabular-nums">
                    {trend.isPositive ? '+' : ''}{trend.value}%
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn(
            'shrink-0 rounded-xl p-3 shadow-sm transition-all duration-300 group-hover:shadow-md',
            variant === 'success' ? 'bg-success/10 shadow-success/5' :
            variant === 'warning' ? 'bg-warning/10 shadow-warning/5' :
            variant === 'info' ? 'bg-info/10 shadow-info/5' :
            'bg-muted shadow-muted/10'
          )}>
            <div className={cn('transition-transform duration-300 group-hover:scale-110', variantClasses[variant])}>
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
    <div className="grid grid-cols-1 gap-element sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}
