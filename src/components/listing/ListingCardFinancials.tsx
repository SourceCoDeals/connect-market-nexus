
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
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Revenue</p>
            {extractedMetrics.revenueModel && (
              <Badge variant="subtle" className="text-[10px] px-2 py-0.5 h-auto font-medium border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                {extractedMetrics.revenueModel.includes('Recurring') ? 'Recurring' : 
                 extractedMetrics.revenueModel.includes('Project') ? 'Project' : 'Contract'}
              </Badge>
            )}
          </div>
          <p className="font-normal text-[17px] text-slate-900 dark:text-slate-100 tracking-tight">{formatCurrency(revenue)}</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">EBITDA</p>
            <Badge 
              variant="subtle"
              className="text-[11px] px-2 py-0.5 h-auto font-semibold border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wide"
            >
              {ebitdaMargin.toFixed(1)}%
            </Badge>
          </div>
          <p className="font-normal text-[17px] text-slate-900 dark:text-slate-100 tracking-tight">{formatCurrency(ebitda)}</p>
        </div>
      </div>
      
    </div>
  );
};

export default ListingCardFinancials;
