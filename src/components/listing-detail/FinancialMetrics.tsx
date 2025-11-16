import { Info } from "lucide-react";

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

  const metrics = [
    {
      label: "Revenue",
      value: formatCurrency(revenue),
    },
    {
      label: "EBITDA",
      value: formatCurrency(ebitda),
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3.5 w-full">
      {metrics.map((metric, index) => (
        <div 
          key={index}
          className="bg-white border border-slate-200/40 rounded-lg px-4 py-3.5 hover:border-slate-300/50 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out flex flex-col gap-2 min-w-0 select-none"
        >
          {/* VALUE FIRST - Apple-precision typography */}
          <div className="text-lg md:text-xl lg:text-[22px] font-semibold text-slate-950 tracking-[-0.02em] leading-none tabular-nums truncate">
            {metric.value}
          </div>
          
          {/* LABEL SECOND - Refined minimal */}
          <div className="text-[9px] md:text-[10px] font-medium text-slate-500 uppercase tracking-[0.08em] leading-tight flex items-center gap-1">
            <span className="truncate">{metric.label}</span>
            <Info className="w-3 h-3 text-slate-400/80 opacity-40 hover:opacity-70 transition-opacity cursor-help flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}
