import { TrendingUp, TrendingDown, Users, Link2, Percent, Timer, ArrowDownUp, Wifi } from "lucide-react";
import { Sparkline } from "./Sparkline";
import { cn } from "@/lib/utils";
import type { UnifiedAnalyticsData } from "@/hooks/useUnifiedAnalytics";

interface KPIStripProps {
  data: UnifiedAnalyticsData['kpis'];
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toLocaleString();
}

interface KPIItemProps {
  label: string;
  value: string;
  trend?: number;
  sparkline?: number[];
  icon: React.ReactNode;
  isLive?: boolean;
}

function KPIItem({ label, value, trend, sparkline, icon, isLive }: KPIItemProps) {
  const trendIsPositive = trend !== undefined && trend > 0;
  const trendIsNegative = trend !== undefined && trend < 0;
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
          {label}
        </span>
        {isLive && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        )}
      </div>
      
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-light tabular-nums tracking-tight text-foreground">
            {value}
          </span>
          {trend !== undefined && (
            <div className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              trendIsPositive && "text-emerald-600",
              trendIsNegative && "text-red-500",
              !trendIsPositive && !trendIsNegative && "text-muted-foreground"
            )}>
              {trendIsPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : trendIsNegative ? (
                <TrendingDown className="h-3 w-3" />
              ) : null}
              <span className="tabular-nums">
                {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        
        {sparkline && sparkline.length > 0 && (
          <Sparkline 
            data={sparkline} 
            color={trendIsNegative ? "hsl(0 65% 55%)" : "hsl(12 95% 77%)"} 
          />
        )}
      </div>
    </div>
  );
}

export function KPIStrip({ data }: KPIStripProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 p-6 bg-card rounded-2xl border border-border/50">
      <KPIItem
        label="Visitors"
        value={formatNumber(data.visitors.value)}
        trend={data.visitors.trend}
        sparkline={data.visitors.sparkline}
        icon={<Users className="h-3.5 w-3.5" />}
      />
      
      <KPIItem
        label="Connections"
        value={formatNumber(data.connections.value)}
        trend={data.connections.trend}
        sparkline={data.connections.sparkline}
        icon={<Link2 className="h-3.5 w-3.5" />}
      />
      
      <KPIItem
        label="Conv. Rate"
        value={`${data.conversionRate.value.toFixed(2)}%`}
        trend={data.conversionRate.trend}
        icon={<Percent className="h-3.5 w-3.5" />}
      />
      
      <KPIItem
        label="Bounce Rate"
        value={`${data.bounceRate.value.toFixed(0)}%`}
        trend={data.bounceRate.trend}
        icon={<ArrowDownUp className="h-3.5 w-3.5" />}
      />
      
      <KPIItem
        label="Avg. Session"
        value={formatDuration(data.avgSessionTime.value)}
        trend={data.avgSessionTime.trend}
        icon={<Timer className="h-3.5 w-3.5" />}
      />
      
      <KPIItem
        label="Online Now"
        value={data.onlineNow.toString()}
        icon={<Wifi className="h-3.5 w-3.5" />}
        isLive
      />
    </div>
  );
}
