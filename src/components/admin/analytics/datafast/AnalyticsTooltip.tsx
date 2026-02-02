import { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TooltipRow {
  label: string;
  value: string | number;
  badge?: string;
  highlight?: boolean;
}

interface TopBreakdown {
  name: string;
  percentage: number;
}

interface AnalyticsTooltipProps {
  children: ReactNode;
  title?: string;
  rows: TooltipRow[];
  topSources?: TopBreakdown[];
  topCountries?: TopBreakdown[];
  side?: "top" | "right" | "bottom" | "left";
}

export function AnalyticsTooltip({ 
  children, 
  title, 
  rows,
  topSources,
  topCountries,
  side = "top" 
}: AnalyticsTooltipProps) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent 
          side={side}
          className="bg-[hsl(0_0%_15%)] border-[hsl(0_0%_25%)] p-0 rounded-lg shadow-xl"
        >
          <div className="min-w-[200px]">
            {title && (
              <div className="px-3 py-2 border-b border-[hsl(0_0%_25%)]">
                <span className="text-xs font-medium text-white">{title}</span>
              </div>
            )}
            <div className="px-3 py-2 space-y-1.5">
              {rows.map((row, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-[11px] text-[hsl(0_0%_65%)]">
                    {row.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-xs font-medium tabular-nums",
                      row.highlight ? "text-[hsl(12_95%_77%)]" : "text-white"
                    )}>
                      {row.value}
                    </span>
                    {row.badge && (
                      <span className="px-1.5 py-0.5 text-[9px] font-medium bg-[hsl(12_95%_77%)] text-[hsl(0_0%_15%)] rounded">
                        {row.badge}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Top Sources Section */}
            {topSources && topSources.length > 0 && (
              <div className="px-3 py-2 border-t border-[hsl(0_0%_25%)]">
                <div className="text-[9px] uppercase tracking-[0.1em] text-[hsl(0_0%_50%)] mb-1.5">
                  Top Sources
                </div>
                <div className="space-y-1">
                  {topSources.slice(0, 3).map((source, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-[11px] text-[hsl(0_0%_75%)]">{source.name}</span>
                      <span className="text-[11px] text-white tabular-nums">{source.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Top Countries Section */}
            {topCountries && topCountries.length > 0 && (
              <div className="px-3 py-2 border-t border-[hsl(0_0%_25%)]">
                <div className="text-[9px] uppercase tracking-[0.1em] text-[hsl(0_0%_50%)] mb-1.5">
                  Top Countries
                </div>
                <div className="space-y-1">
                  {topCountries.slice(0, 3).map((country, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-[11px] text-[hsl(0_0%_75%)]">{country.name}</span>
                      <span className="text-[11px] text-white tabular-nums">{country.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Simple chart tooltip for recharts
interface ChartTooltipData {
  date: string;
  visitors: number;
  connections: number;
  conversionRate?: number;
}

export function ChartTooltipContent({ data }: { data: ChartTooltipData }) {
  const formattedDate = new Date(data.date).toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  
  const convRate = data.visitors > 0 
    ? ((data.connections / data.visitors) * 100).toFixed(1) 
    : '0.0';
  
  return (
    <div className="bg-[hsl(0_0%_15%)] border border-[hsl(0_0%_25%)] rounded-lg p-3 shadow-xl min-w-[200px]">
      <div className="text-xs font-medium text-white mb-2">{formattedDate}</div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[hsl(12_95%_77%)]" />
            <span className="text-[11px] text-[hsl(0_0%_65%)]">Visitors</span>
          </div>
          <span className="text-xs font-medium text-white tabular-nums">{data.visitors.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[hsl(220_70%_55%)]" />
            <span className="text-[11px] text-[hsl(0_0%_65%)]">Connections</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-white tabular-nums">{data.connections}</span>
            {data.connections > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium bg-[hsl(12_95%_77%)] text-[hsl(0_0%_15%)] rounded">
                New
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-[hsl(0_0%_25%)] mt-1.5">
          <span className="text-[11px] text-[hsl(0_0%_65%)]">Conv. Rate</span>
          <span className="text-xs font-medium text-[hsl(12_95%_77%)] tabular-nums">{convRate}%</span>
        </div>
      </div>
    </div>
  );
}

// Dual-bar progress indicator for source/geography rows
interface DualBarProps {
  visitorsPercent: number;
  connectionsPercent: number;
  className?: string;
}

export function DualBar({ visitorsPercent, connectionsPercent, className }: DualBarProps) {
  return (
    <div className={cn("relative h-1 bg-muted/30 rounded-full overflow-hidden", className)}>
      {/* Visitors bar (blue) */}
      <div 
        className="absolute inset-y-0 left-0 bg-[hsl(220_70%_75%)] rounded-full"
        style={{ width: `${Math.min(visitorsPercent, 100)}%` }}
      />
      {/* Connections bar overlay (coral) */}
      <div 
        className="absolute inset-y-0 left-0 bg-[hsl(12_95%_65%)] rounded-full"
        style={{ width: `${Math.min(connectionsPercent, 100)}%` }}
      />
    </div>
  );
}
