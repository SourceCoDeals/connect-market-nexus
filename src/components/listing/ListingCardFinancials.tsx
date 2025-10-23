
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
    <div className="grid grid-cols-2 gap-5 py-3 border-y border-border/40">
      <div className="space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.8px] text-muted-foreground/60">
          Revenue
        </p>
        <p className="text-[20px] font-semibold text-foreground tracking-tight">
          {formatCurrency(revenue)}
        </p>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.8px] text-muted-foreground/60">
            EBITDA
          </p>
          <Badge 
            variant={ebitdaMargin > 20 ? "default" : ebitdaMargin > 10 ? "secondary" : "outline"}
            className="text-[10px] font-semibold px-2 py-0.5 h-auto tracking-wide"
          >
            {ebitdaMargin.toFixed(0)}%
          </Badge>
        </div>
        <p className="text-[20px] font-semibold text-foreground tracking-tight">
          {formatCurrency(ebitda)}
        </p>
      </div>
    </div>
  );
};

export default ListingCardFinancials;
