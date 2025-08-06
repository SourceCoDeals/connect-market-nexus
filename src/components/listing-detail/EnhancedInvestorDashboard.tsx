// No UI imports needed - using pure document styling
import { AdminListing } from "@/types/admin";

interface EnhancedInvestorDashboardProps {
  listing: AdminListing;
  formatCurrency: (value: number) => string;
}

export function EnhancedInvestorDashboard({ listing, formatCurrency }: EnhancedInvestorDashboardProps) {
  const ebitdaMargin = listing.revenue > 0 ? ((listing.ebitda / listing.revenue) * 100) : 0;
  const revenueMultiple = listing.ebitda > 0 ? (listing.revenue / listing.ebitda) : 0;

  // Calculate quality scores
  const getMarginQuality = (margin: number) => {
    if (margin >= 20) return { score: 95, label: 'Excellent', color: 'default' };
    if (margin >= 15) return { score: 85, label: 'Strong', color: 'secondary' };
    if (margin >= 10) return { score: 70, label: 'Good', color: 'outline' };
    return { score: 50, label: 'Fair', color: 'destructive' };
  };

  const getCustomerRisk = (concentration?: number) => {
    if (!concentration) return { score: 70, label: 'Unknown', color: 'outline' };
    if (concentration <= 20) return { score: 95, label: 'Low Risk', color: 'default' };
    if (concentration <= 35) return { score: 75, label: 'Moderate', color: 'secondary' };
    if (concentration <= 50) return { score: 60, label: 'Elevated', color: 'outline' };
    return { score: 40, label: 'High Risk', color: 'destructive' };
  };

  const marginQuality = getMarginQuality(ebitdaMargin);
  const customerRisk = getCustomerRisk(listing.customer_concentration);

  return (
    <div className="space-y-8">
      {/* Financial Metrics Table */}
      <div className="space-y-4">
        <span className="document-label">Financial Summary</span>
        <div className="grid grid-cols-2 gap-x-12 gap-y-6">
          <div className="space-y-1">
            <span className="document-label">Annual Revenue</span>
            <div className="document-value-large">{formatCurrency(listing.revenue)}</div>
          </div>
          <div className="space-y-1">
            <span className="document-label">EBITDA Margin</span>
            <div className="document-value-large">{ebitdaMargin.toFixed(1)}%</div>
          </div>
          <div className="space-y-1">
            <span className="document-label">Annual EBITDA</span>
            <div className="document-value-large">{formatCurrency(listing.ebitda)}</div>
          </div>
          <div className="space-y-1">
            <span className="document-label">Revenue Multiple</span>
            <div className="document-value-large">{revenueMultiple.toFixed(1)}x</div>
          </div>
        </div>
      </div>

      {/* Revenue Model Breakdown */}
      {listing.revenue_model_breakdown && Object.keys(listing.revenue_model_breakdown).length > 0 && (
        <div className="space-y-4 pt-6 border-t border-sourceco-form">
          <span className="document-label">Revenue Composition</span>
          <div className="space-y-3">
            {Object.entries(listing.revenue_model_breakdown).map(([type, percentage]) => (
              <div key={type} className="flex justify-between items-center">
                <span className="document-subtitle capitalize">{type.replace('_', ' ')}</span>
                <span className="document-value">{percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investment Thesis */}
      {listing.investment_thesis && (
        <div className="space-y-4 pt-6 border-t border-sourceco-form">
          <span className="document-label">Investment Thesis</span>
          <p className="document-subtitle leading-relaxed">{listing.investment_thesis}</p>
        </div>
      )}

      {/* Growth & Risk Analysis */}
      <div className="grid grid-cols-2 gap-8 pt-6 border-t border-sourceco-form">
        {/* Growth Drivers */}
        {listing.growth_drivers && listing.growth_drivers.length > 0 && (
          <div className="space-y-4">
            <span className="document-label">Growth Catalysts</span>
            <div className="space-y-2">
              {listing.growth_drivers.map((driver, index) => (
                <div key={index} className="document-subtitle">
                  • {driver}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Factors */}
        {listing.key_risks && listing.key_risks.length > 0 && (
          <div className="space-y-4">
            <span className="document-label">Risk Factors</span>
            <div className="space-y-2">
              {listing.key_risks.map((risk, index) => (
                <div key={index} className="document-subtitle">
                  • {risk}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quality Assessment */}
      <div className="space-y-4 pt-6 border-t border-sourceco-form">
        <span className="document-label">Quality Metrics</span>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="document-subtitle">Margin Quality</span>
              <span className="document-value">{marginQuality.label}</span>
            </div>
            <div className="text-xs text-slate-500">
              {ebitdaMargin.toFixed(1)}% EBITDA margin
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="document-subtitle">Customer Risk</span>
              <span className="document-value">{customerRisk.label}</span>
            </div>
            <div className="text-xs text-slate-500">
              {listing.customer_concentration 
                ? `${listing.customer_concentration}% concentration`
                : 'Data not available'
              }
            </div>
          </div>
        </div>

        {/* Market Position */}
        {listing.market_position && Object.keys(listing.market_position).length > 0 && (
          <div className="space-y-3 pt-4">
            <span className="document-label">Market Position</span>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {Object.entries(listing.market_position).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-xs text-slate-500 capitalize">{key.replace('_', ' ')}</span>
                  <span className="text-xs font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}