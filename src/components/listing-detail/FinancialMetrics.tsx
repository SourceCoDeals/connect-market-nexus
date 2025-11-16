import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FinancialMetricsProps {
  revenue: number;
  ebitda: number;
  formatCurrency: (value: number) => string;
  fullTimeEmployees?: number;
  partTimeEmployees?: number;
}

export function FinancialMetrics({ 
  revenue, 
  ebitda, 
  formatCurrency,
  fullTimeEmployees,
  partTimeEmployees
}: FinancialMetricsProps) {
  const ebitdaMargin = revenue > 0 ? ((ebitda / revenue) * 100) : 0;
  
  const hasEmployees = (fullTimeEmployees && fullTimeEmployees > 0) || 
                       (partTimeEmployees && partTimeEmployees > 0);
  
  const employeesDisplay = () => {
    const ft = fullTimeEmployees || 0;
    const pt = partTimeEmployees || 0;
    return `${ft + pt}`;
  };

  const financialTooltip = "Off-market deal - financials range from owner estimates to verified documentation. Verification level varies by owner readiness and will be confirmed in your intro call.";

  const metrics = [
    {
      label: "Revenue",
      value: formatCurrency(revenue),
      tooltip: financialTooltip,
    },
    {
      label: "EBITDA",
      value: formatCurrency(ebitda),
      tooltip: financialTooltip,
    },
    {
      label: "Margin",
      value: `${ebitdaMargin.toFixed(1)}%`,
    },
    ...(hasEmployees ? [{
      label: "Team",
      value: employeesDisplay(),
    }] : []),
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2.5 w-full">
        {metrics.map((metric, index) => (
          <div 
            key={index}
            className="bg-white border border-slate-200/50 rounded-lg px-3.5 py-3 hover:border-slate-300/60 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all duration-250 ease-out flex flex-col gap-1.5 min-w-0"
          >
            {/* VALUE FIRST */}
            <div className="text-base md:text-lg font-semibold text-slate-950 tracking-tight leading-none tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
              {metric.value}
            </div>
            
            {/* LABEL SECOND */}
            <div className="text-[9px] font-medium text-slate-500 uppercase tracking-[0.08em] leading-tight flex items-center gap-1">
              <span className="whitespace-nowrap">{metric.label}</span>
              {metric.tooltip ? (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center justify-center rounded-full p-1 hover:bg-gray-100 transition-colors">
                      <Info className="w-4 h-4 text-gray-500 hover:text-gray-700 flex-shrink-0" strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="right" 
                    align="center"
                    sideOffset={8}
                    className="max-w-sm bg-gray-900 text-white border-gray-800 p-4"
                  >
                    <div className="space-y-2.5 text-xs leading-relaxed">
                      <p className="text-gray-200">
                        {metric.tooltip}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Info className="w-4 h-4 text-gray-400 transition-colors flex-shrink-0" strokeWidth={2} />
              )}
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
