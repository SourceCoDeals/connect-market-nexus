import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Listing } from "@/types";
import { formatCompactCurrency } from "@/lib/utils";

interface EnhancedFinancialGridProps {
  listing: Listing;
}

export function EnhancedFinancialGrid({ listing }: EnhancedFinancialGridProps) {
  // Calculate EBITDA margin
  const ebitdaMargin = listing.revenue > 0 
    ? ((listing.ebitda / listing.revenue) * 100).toFixed(0)
    : '0';

  const metrics = [
    {
      label: "2024 REVENUE",
      value: `~${formatCompactCurrency(listing.revenue)}+`,
      subtitle: listing.category || "Diversified services",
      tooltip: "Estimated annual revenue based on most recent financials"
    },
    {
      label: "EBITDA",
      value: formatCompactCurrency(listing.ebitda),
      subtitle: `~${ebitdaMargin}% margin profile`,
      tooltip: "Earnings before interest, taxes, depreciation, and amortization"
    },
    {
      label: "BUSINESS MODEL",
      value: listing.acquisition_type || "Asset",
      subtitle: "Contract-based revenue",
      tooltip: "Primary business model and revenue structure"
    },
    {
      label: "MARKET COVERAGE",
      value: listing.location,
      subtitle: "Regional specialization",
      tooltip: "Primary geographic market and coverage area"
    }
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 py-8 border-y border-slate-200/60">
        {metrics.map((metric, index) => (
          <div 
            key={index}
            className="flex flex-col gap-2"
          >
            {/* Label with tooltip */}
            <div className="flex items-center gap-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">
                {metric.label}
              </div>
              {metric.tooltip && (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-100 transition-colors">
                      <Info className="w-3 h-3 text-slate-400 hover:text-slate-600 flex-shrink-0" strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top" 
                    align="center"
                    sideOffset={8}
                    className="max-w-sm bg-slate-900 text-white border-slate-800 p-4"
                  >
                    <div className="space-y-2.5 text-xs leading-relaxed">
                      <p className="font-semibold text-white">
                        {metric.label}
                      </p>
                      <p className="text-slate-200">
                        {metric.tooltip}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            
            {/* Value */}
            <div className="text-3xl lg:text-4xl font-semibold text-slate-950 tracking-tight leading-none tabular-nums">
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
