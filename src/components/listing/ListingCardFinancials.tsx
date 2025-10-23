
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
    <div className="space-y-4 mb-5">
      <div className="grid grid-cols-2 gap-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-[0.05em]">Revenue</p>
            {extractedMetrics.revenueModel && (
              <Badge variant="subtle" className="text-[9px] px-1.5 py-0 h-auto font-medium border-border/30 bg-transparent uppercase tracking-wider">
                {extractedMetrics.revenueModel.includes('Recurring') ? 'Recurring' : 
                 extractedMetrics.revenueModel.includes('Project') ? 'Project' : 'Contract'}
              </Badge>
            )}
          </div>
          <p className="font-normal text-[18px] text-slate-900 dark:text-slate-100 tracking-[-0.01em]">{formatCurrency(revenue)}</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-[0.05em]">EBITDA</p>
            <Badge 
              variant="subtle"
              className="text-[9px] px-1.5 py-0 h-auto font-medium border-border/30 bg-transparent uppercase tracking-wider"
            >
              {ebitdaMargin.toFixed(1)}%
            </Badge>
          </div>
          <p className="font-normal text-[18px] text-slate-900 dark:text-slate-100 tracking-[-0.01em]">{formatCurrency(ebitda)}</p>
        </div>
      </div>
      
    </div>
  );
};

export default ListingCardFinancials;
