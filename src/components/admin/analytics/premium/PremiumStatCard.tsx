import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface PremiumStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  sparklineData?: number[];
  className?: string;
}

export function PremiumStatCard({
  title,
  value,
  subtitle,
  trend,
  sparklineData = [],
  className,
}: PremiumStatCardProps) {
  const chartData = useMemo(() => 
    sparklineData.map((v, i) => ({ value: v, index: i })),
    [sparklineData]
  );

  const trendColor = trend?.direction === 'up' 
    ? 'text-coral-500' 
    : trend?.direction === 'down' 
      ? 'text-muted-foreground' 
      : 'text-muted-foreground';

  const trendPrefix = trend?.direction === 'up' ? '+' : trend?.direction === 'down' ? '' : '';

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl bg-card border border-border/50",
      "p-6 transition-all duration-300 hover:shadow-lg hover:shadow-coral-500/5",
      "group",
      className
    )}>
      {/* Background sparkline */}
      {chartData.length > 0 && (
        <div className="absolute inset-0 opacity-[0.08] group-hover:opacity-[0.12] transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--coral-400, 0 82% 75%))" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="hsl(var(--coral-400, 0 82% 75%))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="none"
                fill={`url(#gradient-${title.replace(/\s/g, '')})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">
        {/* Label */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-3">
          {title}
        </p>

        {/* Value */}
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-light tracking-tight tabular-nums text-foreground">
            {value}
          </span>
          
          {trend && (
            <span className={cn(
              "text-sm font-medium tabular-nums",
              trendColor
            )}>
              {trendPrefix}{Math.abs(trend.value).toFixed(0)}%
            </span>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-2">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
