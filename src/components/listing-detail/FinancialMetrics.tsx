import { Info } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

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

  const financialTooltip = "Off-market financials vary by deal stage. Figures shown are owner-provided and subject to verification during diligence.";

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
              <HoverCard openDelay={200}>
                <HoverCardTrigger asChild>
                  <Info className="w-3 h-3 text-slate-400 opacity-40 hover:opacity-70 transition-opacity cursor-help flex-shrink-0" />
                </HoverCardTrigger>
                <HoverCardContent 
                  side="top" 
                  align="center"
                  className="w-[280px] p-3 text-xs text-slate-700 leading-relaxed"
                >
                  {metric.tooltip}
                </HoverCardContent>
              </HoverCard>
            ) : (
              <Info className="w-3 h-3 text-slate-400 opacity-40 transition-opacity flex-shrink-0" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
