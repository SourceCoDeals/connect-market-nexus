
import { Badge } from "@/components/ui/badge";

interface ListingCardFinancialsProps {
  revenue: number;
  ebitda: number;
  formatCurrency: (value: number) => string;
}

const ListingCardFinancials = ({ revenue, ebitda, formatCurrency }: ListingCardFinancialsProps) => {
  const ebitdaMargin = revenue > 0 ? ((ebitda / revenue) * 100) : 0;
  
  return (
    <div className="mb-5">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-600 mb-2">
            Annual Revenue
          </p>
          <p className="text-[17px] font-normal text-slate-900 tracking-[-0.01em]">{formatCurrency(revenue)}</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-600">
              Annual EBITDA
            </p>
            <Badge 
              variant={ebitdaMargin > 20 ? "default" : ebitdaMargin > 10 ? "secondary" : "outline"}
              className="text-[11px] font-semibold px-2 py-0.5 h-auto"
            >
              {ebitdaMargin.toFixed(1)}%
            </Badge>
          </div>
          <p className="text-[17px] font-normal text-slate-900 tracking-[-0.01em]">{formatCurrency(ebitda)}</p>
        </div>
      </div>
    </div>
  );
};

export default ListingCardFinancials;
