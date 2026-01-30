import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface HeroStatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  trend: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  sparklineData: number[];
  icon: LucideIcon;
  accentColor?: 'emerald' | 'blue' | 'violet' | 'amber';
}

export function HeroStatCard({
  title,
  value,
  subtitle,
  trend,
  sparklineData,
  icon: Icon,
  accentColor = 'blue',
}: HeroStatCardProps) {
  const colorClasses = {
    emerald: {
      gradient: 'from-emerald-500/20 to-transparent',
      sparkline: 'hsl(var(--success))',
      icon: 'text-emerald-500',
      iconBg: 'bg-emerald-500/10',
    },
    blue: {
      gradient: 'from-blue-500/20 to-transparent',
      sparkline: 'hsl(var(--info))',
      icon: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
    },
    violet: {
      gradient: 'from-violet-500/20 to-transparent',
      sparkline: 'hsl(var(--primary))',
      icon: 'text-violet-500',
      iconBg: 'bg-violet-500/10',
    },
    amber: {
      gradient: 'from-amber-500/20 to-transparent',
      sparkline: 'hsl(var(--warning))',
      icon: 'text-amber-500',
      iconBg: 'bg-amber-500/10',
    },
  };

  const colors = colorClasses[accentColor];
  
  const chartData = sparklineData.map((value, index) => ({ value, index }));

  const TrendIcon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;

  return (
    <Card className="relative overflow-hidden border-border/50 bg-card hover:shadow-lg transition-all duration-300 group">
      {/* Background sparkline */}
      <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 40, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${accentColor}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.sparkline} stopOpacity={0.3} />
                <stop offset="100%" stopColor={colors.sparkline} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={colors.sparkline}
              strokeWidth={2}
              fill={`url(#gradient-${accentColor})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <CardContent className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            {/* Title */}
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {title}
              </p>
            </div>

            {/* Value */}
            <p className="text-4xl font-bold tabular-nums tracking-tight">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>

            {/* Subtitle & Trend */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{subtitle}</span>
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
                trend.direction === 'up' && "bg-success/10 text-success",
                trend.direction === 'down' && "bg-destructive/10 text-destructive",
                trend.direction === 'neutral' && "bg-muted text-muted-foreground",
              )}>
                <TrendIcon className="h-3 w-3" />
                <span className="tabular-nums">
                  {trend.direction === 'up' ? '+' : ''}{trend.value.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Icon */}
          <div className={cn(
            "rounded-xl p-3 transition-transform duration-300 group-hover:scale-110",
            colors.iconBg
          )}>
            <Icon className={cn("h-6 w-6", colors.icon)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
