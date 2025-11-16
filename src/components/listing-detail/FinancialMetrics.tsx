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
    <div className="bg-sourceco-background/40 border border-sourceco-muted/40 rounded-xl px-4 py-3.5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <div 
            key={index} 
            className="space-y-1"
          >
            <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.08em]">
              {metric.label}
            </div>
            <div className="text-lg md:text-xl font-semibold text-slate-900 tracking-tight leading-none tabular-nums">
              {metric.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
