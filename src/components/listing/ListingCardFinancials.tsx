
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
    <div className="space-y-3 mb-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Annual Revenue</p>
            {extractedMetrics.revenueModel && (
              <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-auto">
                {extractedMetrics.revenueModel.includes('Recurring') ? 'Recurring' : 
                 extractedMetrics.revenueModel.includes('Project') ? 'Project' : 'Contract'}
              </Badge>
            )}
          </div>
          <p className="font-semibold text-sm">{formatCurrency(revenue)}</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Annual EBITDA</p>
            <Badge 
              variant={ebitdaMargin > 20 ? "default" : ebitdaMargin > 10 ? "secondary" : "outline"}
              className="text-xs px-1.5 py-0.5 h-auto"
            >
              {ebitdaMargin.toFixed(1)}%
            </Badge>
          </div>
          <p className="font-semibold text-sm">{formatCurrency(ebitda)}</p>
        </div>
      </div>
      
      {/* Strategic indicators */}
      {(extractedMetrics.marketPosition || extractedMetrics.strategicAssets?.length) && (
        <div className="flex flex-wrap gap-1 pt-2 border-t border-border/30">
          {extractedMetrics.marketPosition && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 h-auto">
              {extractedMetrics.marketPosition.split(' ')[0]}
            </Badge>
          )}
          {extractedMetrics.strategicAssets?.slice(0, 2).map((asset, index) => (
            <Badge key={index} variant="outline" className="text-xs px-2 py-0.5 h-auto">
              {asset.charAt(0).toUpperCase() + asset.slice(1)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default ListingCardFinancials;
