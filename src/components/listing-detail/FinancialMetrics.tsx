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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full">
      {metrics.map((metric, index) => (
        <div 
          key={index}
          className="bg-[#F8F6F3] border border-[#EBE8E3] rounded-2xl px-6 py-5 shadow-sm hover:shadow-md hover:bg-[#FDFCFA] hover:border-[#E5E2DC] transition-all duration-200 flex flex-col gap-2"
        >
          {/* VALUE FIRST - Premium hierarchy */}
          <div className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight leading-none tabular-nums">
            {metric.value}
          </div>
          
          {/* LABEL SECOND with info icon */}
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em] flex items-center gap-1.5">
            {metric.label}
            <Info className="w-3.5 h-3.5 text-slate-400 opacity-60 hover:opacity-100 transition-opacity cursor-help" />
          </div>
        </div>
      ))}
    </div>
  );
}
