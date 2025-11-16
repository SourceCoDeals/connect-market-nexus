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
      label: "Gross Revenue",
      value: formatCurrency(revenue),
    },
    {
      label: "Adj. Cash Flow",
      value: formatCurrency(ebitda),
    },
    {
      label: "EBITDA Margin",
      value: `${ebitdaMargin.toFixed(1)}%`,
    },
    ...(hasEmployees ? [{
      label: "Team Size",
      value: employeesDisplay(),
    }] : []),
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
      {metrics.map((metric, index) => (
        <div 
          key={index}
          className="bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-xl px-4 py-3 hover:bg-white/80 hover:border-slate-300/60 transition-all duration-150 flex flex-col gap-1.5 min-w-0"
        >
          {/* VALUE FIRST - Refined minimal hierarchy */}
          <div className="text-base md:text-lg font-semibold text-slate-900 tracking-tight leading-tight tabular-nums truncate">
            {metric.value}
          </div>
          
          {/* LABEL SECOND - Ultra minimal */}
          <div className="text-[9px] md:text-[10px] font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1 opacity-70">
            <span className="truncate">{metric.label}</span>
            <Info className="w-3 h-3 text-slate-400 opacity-50 hover:opacity-100 transition-opacity cursor-help flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}
