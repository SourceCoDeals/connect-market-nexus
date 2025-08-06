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
    <div className="space-y-6">
      {/* Financial Overview */}
      <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Financial Overview
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Annual Revenue</span>
                <Badge variant="outline">{formatCurrency(listing.revenue)}</Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Annual EBITDA</span>
                <Badge variant="secondary">{formatCurrency(listing.ebitda)}</Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">EBITDA Margin</span>
                <Badge variant={marginQuality.color as any}>
                  {ebitdaMargin.toFixed(1)}%
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Revenue Multiple</span>
                <Badge variant="outline">{revenueMultiple.toFixed(1)}x</Badge>
              </div>
            </div>
          </div>

          {/* Revenue Model Breakdown */}
          {listing.revenue_model_breakdown && Object.keys(listing.revenue_model_breakdown).length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h5 className="font-medium text-sm">Revenue Mix</h5>
                <div className="space-y-2">
                  {Object.entries(listing.revenue_model_breakdown).map(([type, percentage]) => (
                    <div key={type} className="flex justify-between items-center">
                      <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={percentage} className="w-16 h-2" />
                        <span className="text-xs w-10 text-right">{percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Investment Thesis */}
      {listing.investment_thesis && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Investment Thesis
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            <p className="text-sm leading-relaxed">{listing.investment_thesis}</p>
          </CardContent>
        </Card>
      )}

      {/* Growth & Risk Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Growth Drivers */}
        {listing.growth_drivers && listing.growth_drivers.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Growth Catalysts
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-2">
                {listing.growth_drivers.map((driver, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm">{driver}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Risk Factors */}
        {listing.key_risks && listing.key_risks.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Risk Factors
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-2">
                {listing.key_risks.map((risk, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm">{risk}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quality Metrics */}
      <Card className="bg-gradient-to-br from-background to-muted/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Quality Assessment
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Margin Quality */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Margin Quality</span>
                <Badge variant={marginQuality.color as any}>{marginQuality.label}</Badge>
              </div>
              <Progress value={marginQuality.score} className="h-2" />
              <span className="text-xs text-muted-foreground">
                {ebitdaMargin.toFixed(1)}% EBITDA margin indicates {marginQuality.label.toLowerCase()} profitability
              </span>
            </div>

            {/* Customer Concentration */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Customer Risk</span>
                <Badge variant={customerRisk.color as any}>{customerRisk.label}</Badge>
              </div>
              <Progress value={customerRisk.score} className="h-2" />
              <span className="text-xs text-muted-foreground">
                {listing.customer_concentration 
                  ? `${listing.customer_concentration}% concentration with top customers`
                  : 'Customer concentration data not available'
                }
              </span>
            </div>
          </div>

          {/* Market Position */}
          {listing.market_position && Object.keys(listing.market_position).length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h5 className="font-medium text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Market Position
                </h5>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(listing.market_position).map(([key, value]) => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {key.replace('_', ' ')}: {String(value)}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}