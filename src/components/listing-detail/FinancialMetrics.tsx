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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map((metric, index) => (
        <div 
          key={index} 
          className="bg-slate-50/50 border border-slate-200/60 rounded-xl px-5 py-4 transition-all hover:bg-slate-50 hover:border-slate-300/60"
        >
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              {metric.label}
            </div>
            <div className="text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {metric.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
