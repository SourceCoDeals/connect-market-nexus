import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FinancialGridMetric {
  label: string;
  value: string;
  subtitle?: string;
  tooltip?: string;
}

interface EnhancedFinancialGridProps {
  metrics: FinancialGridMetric[];
}

export function EnhancedFinancialGrid({ metrics }: EnhancedFinancialGridProps) {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 py-8 border-y border-slate-200/60">
        {metrics.map((metric, index) => (
          <div 
            key={index}
            className="flex flex-col gap-2"
          >
            {/* Label with tooltip */}
            <div className="flex items-center gap-1.5">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">
                {metric.label}
              </div>
              {metric.tooltip && (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-gray-100 transition-colors">
                      <Info className="w-3 h-3 text-gray-400 hover:text-gray-600 flex-shrink-0" strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top" 
                    align="center"
                    sideOffset={8}
                    className="max-w-sm bg-gray-900 text-white border-gray-800 p-4"
                  >
                    <div className="space-y-2.5 text-xs leading-relaxed">
                      <p className="font-semibold text-white">
                        Off-Market Deal
                      </p>
                      <p className="text-gray-200">
                        {metric.tooltip}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            
            {/* Value */}
            <div className="text-3xl lg:text-4xl font-normal text-slate-950 tracking-tight leading-none tabular-nums">
              {metric.value}
            </div>
            
            {/* Subtitle */}
            {metric.subtitle && (
              <div className="text-sm text-slate-600 leading-snug">
                {metric.subtitle}
              </div>
            )}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
