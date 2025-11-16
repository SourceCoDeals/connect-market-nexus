import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface FinancialMetricsProps {
  revenue: number;
  ebitda: number;
  formatCurrency: (value: number) => string;
  fullTimeEmployees?: number;
  partTimeEmployees?: number;
  verificationLevel?: 'verified' | 'owner-provided' | 'early-stage';
}

export function FinancialMetrics({ 
  revenue, 
  ebitda, 
  formatCurrency,
  fullTimeEmployees,
  partTimeEmployees,
  verificationLevel = 'owner-provided'
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
  
  const verificationBadge = {
    'verified': { label: 'Verified', variant: 'success' as const, icon: '🟢' },
    'owner-provided': { label: 'Owner-Provided', variant: 'secondary' as const, icon: '🟡' },
    'early-stage': { label: 'Early Stage', variant: 'outline' as const, icon: '⚪' }
  }[verificationLevel];

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
      <div className="space-y-2.5">
        <Badge variant={verificationBadge.variant} className="text-[10px] px-2 py-0.5">
          <span className="mr-1">{verificationBadge.icon}</span>
          {verificationBadge.label}
        </Badge>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2.5 w-full">
          {metrics.map((metric, index) => (
            <div 
              key={index}
              className="bg-white border border-slate-200/50 rounded-lg px-3.5 py-3 hover:border-slate-300/60 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all duration-250 ease-out flex flex-col gap-1.5 min-w-0"
            >
              {/* VALUE FIRST - Tight minimal hierarchy */}
              <div className="text-base md:text-lg font-semibold text-slate-950 tracking-tight leading-none tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                {metric.value}
              </div>
              
              {/* LABEL SECOND - Ultra minimal */}
              <div className="text-[9px] font-medium text-slate-500 uppercase tracking-[0.08em] leading-tight flex items-center gap-1">
                <span className="whitespace-nowrap">{metric.label}</span>
                {metric.tooltip ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-slate-400 opacity-40 hover:opacity-70 transition-opacity cursor-help flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px] text-xs">
                      <p>{metric.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Info className="w-3 h-3 text-slate-400 opacity-40 hover:opacity-70 transition-opacity cursor-help flex-shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
