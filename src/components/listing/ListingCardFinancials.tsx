
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
    <div className="space-y-3 mb-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">Revenue</p>
            {extractedMetrics.revenueModel && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-auto font-medium border-border/50 bg-muted/30">
                {extractedMetrics.revenueModel.includes('Recurring') ? 'Recurring' : 
                 extractedMetrics.revenueModel.includes('Project') ? 'Project' : 'Contract'}
              </Badge>
            )}
          </div>
          <p className="font-semibold text-[15px] text-foreground tracking-tight">{formatCurrency(revenue)}</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">EBITDA</p>
            <Badge 
              variant={ebitdaMargin > 20 ? "default" : ebitdaMargin > 10 ? "secondary" : "outline"}
              className="text-[10px] px-1.5 py-0 h-auto font-semibold"
            >
              {ebitdaMargin.toFixed(1)}%
            </Badge>
          </div>
          <p className="font-semibold text-[15px] text-foreground tracking-tight">{formatCurrency(ebitda)}</p>
        </div>
      </div>
      
    </div>
  );
};

export default ListingCardFinancials;
