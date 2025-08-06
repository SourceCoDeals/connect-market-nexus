import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, Shield, AlertTriangle, Target, DollarSign, Users } from "lucide-react";
import { AdminListing } from "@/types/admin";

interface EnhancedInvestorDashboardProps {
  listing: AdminListing;
  formatCurrency: (value: number) => string;
}

export function EnhancedInvestorDashboard({ listing, formatCurrency }: EnhancedInvestorDashboardProps) {
  const ebitdaMargin = listing.revenue > 0 ? ((listing.ebitda / listing.revenue) * 100) : 0;
  const revenueMultiple = listing.ebitda > 0 ? (listing.revenue / listing.ebitda) : 0;

  // Calculate quality indicators
  const getMarginQuality = (margin: number) => {
    if (margin >= 20) return { label: 'Excellent', indicator: 'success' };
    if (margin >= 15) return { label: 'Strong', indicator: 'default' };
    if (margin >= 10) return { label: 'Good', indicator: 'secondary' };
    return { label: 'Fair', indicator: 'outline' };
  };

  const marginQuality = getMarginQuality(ebitdaMargin);

  return (
    <div className="space-y-8">
      
      {/* Core Financial Metrics */}
      <div className="space-y-4">
        <h2 className="document-title">Financial Performance</h2>
        
        <div className="grid grid-cols-4 gap-6">
          <div className="space-y-2">
            <span className="document-label">Annual Revenue</span>
            <div className="text-lg font-light">{formatCurrency(listing.revenue)}</div>
          </div>
          
          <div className="space-y-2">
            <span className="document-label">Annual EBITDA</span>
            <div className="text-lg font-light">{formatCurrency(listing.ebitda)}</div>
          </div>
          
          <div className="space-y-2">
            <span className="document-label">EBITDA Margin</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-light">{ebitdaMargin.toFixed(1)}%</span>
              <span className="document-subtitle">({marginQuality.label})</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <span className="document-label">Revenue Multiple</span>
            <div className="text-lg font-light">{revenueMultiple.toFixed(1)}x</div>
          </div>
        </div>
      </div>

      {/* Revenue Composition */}
      {listing.revenue_model_breakdown && Object.keys(listing.revenue_model_breakdown).length > 0 && (
        <div className="space-y-4">
          <h3 className="document-title">Revenue Composition</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(listing.revenue_model_breakdown).map(([type, percentage]) => (
              <div key={type} className="flex justify-between items-center py-2 border-b border-section-border">
                <span className="document-subtitle capitalize">{type.replace('_', ' ')}</span>
                <span className="text-sm font-medium">{percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investment Thesis */}
      {listing.investment_thesis && (
        <div className="space-y-4">
          <h3 className="document-title">Investment Rationale</h3>
          <p className="text-sm leading-relaxed font-light text-foreground/90">{listing.investment_thesis}</p>
        </div>
      )}

      {/* Growth & Risk Factors Grid */}
      <div className="grid grid-cols-2 gap-8">
        {/* Growth Drivers */}
        {listing.growth_drivers && listing.growth_drivers.length > 0 && (
          <div className="space-y-4">
            <h3 className="document-title">Growth Catalysts</h3>
            <div className="space-y-3">
              {listing.growth_drivers.map((driver, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-1 h-1 bg-foreground rounded-full mt-2 flex-shrink-0" />
                  <span className="document-subtitle leading-relaxed">{driver}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Factors */}
        {listing.key_risks && listing.key_risks.length > 0 && (
          <div className="space-y-4">
            <h3 className="document-title">Risk Considerations</h3>
            <div className="space-y-3">
              {listing.key_risks.map((risk, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-1 h-1 bg-muted-foreground rounded-full mt-2 flex-shrink-0" />
                  <span className="document-subtitle leading-relaxed">{risk}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quality Indicators */}
      <div className="space-y-4">
        <h3 className="document-title">Quality Indicators</h3>
        
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <span className="document-label">Profitability</span>
            <div className="flex items-center gap-2">
              <span className="text-sm">{marginQuality.label}</span>
              <span className="document-subtitle">({ebitdaMargin.toFixed(1)}% margin)</span>
            </div>
          </div>
          
          {listing.customer_concentration && (
            <div className="space-y-2">
              <span className="document-label">Customer Risk</span>
              <div className="text-sm">{listing.customer_concentration}% concentration</div>
            </div>
          )}

          {listing.market_position && Object.keys(listing.market_position).length > 0 && (
            <div className="space-y-2">
              <span className="document-label">Market Position</span>
              <div className="space-y-1">
                {Object.entries(listing.market_position).slice(0, 2).map(([key, value]) => (
                  <div key={key} className="text-xs text-muted-foreground">
                    {key.replace('_', ' ')}: {String(value)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}