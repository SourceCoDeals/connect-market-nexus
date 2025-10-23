
import { Badge } from "@/components/ui/badge";
import { extractFinancialMetrics } from "@/lib/financial-parser";

interface ListingCardFinancialsProps {
  revenue: number;
  ebitda: number;
  description?: string;
  formatCurrency: (value: number) => string;
}

const ListingCardFinancials = ({ revenue, ebitda, description = "", formatCurrency }: ListingCardFinancialsProps) => {
  const extractedMetrics = extractFinancialMetrics(description);
  const ebitdaMargin = revenue > 0 ? ((ebitda / revenue) * 100) : 0;
  
  return (
    <div className="grid grid-cols-2 gap-8 px-5 py-4 bg-slate-50/30 border-y border-slate-200/40">
      <div className="flex flex-col justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          ANNUAL REVENUE
        </p>
        <p className="text-[20px] font-normal text-slate-900 tracking-[-0.025em] mt-auto">
          {formatCurrency(revenue)}
        </p>
      </div>
      <div className="flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            EBITDA
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-slate-400">Margin</span>
            <Badge 
              variant="outline"
              className="text-[11px] font-semibold px-2.5 py-1 h-auto bg-white text-slate-700 border-slate-300 shadow-sm"
            >
              {ebitdaMargin.toFixed(1)}%
            </Badge>
          </div>
        </div>
        <p className="text-[20px] font-normal text-slate-900 tracking-[-0.025em] mt-auto">
          {formatCurrency(ebitda)}
        </p>
      </div>
    </div>
  );
};

export default ListingCardFinancials;
