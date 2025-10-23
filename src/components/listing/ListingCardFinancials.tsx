
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
    <div className="grid grid-cols-2 gap-6 py-3.5 border-y border-slate-200/60">
      <div className="space-y-1.5">
        <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-slate-500">
          ANNUAL REVENUE
        </p>
        <p className="text-[18px] font-normal text-slate-900 tracking-[-0.02em]">
          {formatCurrency(revenue)}
        </p>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-slate-500">
            EBITDA
          </p>
          <Badge 
            variant="outline"
            className="text-[10px] font-semibold px-2 py-1 h-auto bg-slate-50 text-slate-700 border-slate-200"
          >
            {ebitdaMargin.toFixed(1)}%
          </Badge>
        </div>
        <p className="text-[18px] font-normal text-slate-900 tracking-[-0.02em]">
          {formatCurrency(ebitda)}
        </p>
      </div>
    </div>
  );
};

export default ListingCardFinancials;
