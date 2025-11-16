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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <div 
          key={index} 
          className="bg-white border-2 border-slate-100 rounded-2xl px-6 py-5 transition-all duration-200 hover:bg-slate-50/30 hover:border-slate-200 hover:shadow-md shadow-sm h-full"
        >
          <div className="space-y-3 h-full flex flex-col">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              {metric.label}
            </div>
            <div className="text-2xl md:text-3xl lg:text-[32px] font-bold text-slate-900 tracking-tight leading-none tabular-nums">
              {metric.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
