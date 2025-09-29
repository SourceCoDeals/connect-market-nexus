
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calculator, TrendingUp, DollarSign, Target } from "lucide-react";
import { extractFinancialMetrics, generateCustomInvestmentThesis, calculateInvestmentMetrics } from "@/lib/financial-parser";

interface InvestorFinancialDashboardProps {
  revenue: number;
  ebitda: number;
  description: string;
  formatCurrency: (value: number) => string;
}

const InvestorFinancialDashboard = ({ 
  revenue, 
  ebitda, 
  description, 
  formatCurrency 
}: InvestorFinancialDashboardProps) => {
  const extractedMetrics = extractFinancialMetrics(description);
  const investmentThesis = generateCustomInvestmentThesis(description, 'Technology', '', revenue, ebitda);
  const calculatedMetrics = calculateInvestmentMetrics(revenue, ebitda);
  
  const ebitdaMargin = revenue > 0 ? ((ebitda / revenue) * 100) : 0;
  
  return (
    <div className="space-y-6">
      {/* Core Financial Metrics */}
      <Card className="bg-gradient-to-br from-background to-muted/10 border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Financial Overview</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Annual Revenue</span>
                <Badge variant="outline" className="text-xs">
                  {extractedMetrics.revenueModel || 'Mixed Revenue'}
                </Badge>
              </div>
              <div className="text-2xl font-bold">{formatCurrency(revenue)}</div>
              <Progress value={100} className="h-2" />
            </div>
            
            {/* EBITDA */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Annual EBITDA</span>
                <Badge 
                  variant={ebitdaMargin > 20 ? "default" : ebitdaMargin > 10 ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {calculatedMetrics.ebitdaMargin}% Margin
                </Badge>
              </div>
              <div className="text-2xl font-bold">{formatCurrency(ebitda)}</div>
              <Progress 
                value={Math.min((ebitdaMargin / 30) * 100, 100)} 
                className="h-2" 
              />
            </div>
          </div>
          
          {/* Investment Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <div className="text-lg font-semibold">{calculatedMetrics.ebitdaMargin}%</div>
              <div className="text-xs text-muted-foreground">EBITDA Margin</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{calculatedMetrics.revenueMultiple}x</div>
              <div className="text-xs text-muted-foreground">Revenue Multiple</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{calculatedMetrics.roiPotential}</div>
              <div className="text-xs text-muted-foreground">ROI Potential</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{calculatedMetrics.scalabilityScore}</div>
              <div className="text-xs text-muted-foreground">Scale Score</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Investment Thesis */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Investment Thesis</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground/90 leading-relaxed">
            {investmentThesis.overview}
          </p>
          
          {investmentThesis.keyStrengths.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">Key Investment Highlights</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {investmentThesis.keyStrengths.map((strength, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                    <span className="text-foreground/80">{strength}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="pt-3 border-t border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Market Position</span>
            </div>
            <p className="text-xs text-foreground/80">{investmentThesis.marketPosition}</p>
          </div>
        </CardContent>
      </Card>

      {/* Growth Opportunities */}
      {extractedMetrics.growthDrivers?.length && (
        <Card className="bg-gradient-to-br from-background to-muted/10 border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Growth Opportunities</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div>
              <h4 className="font-medium text-sm mb-3 text-primary">Growth Drivers</h4>
              <div className="space-y-2">
                {extractedMetrics.growthDrivers.map((driver, index) => (
                  <Badge key={index} variant="secondary" className="text-xs mr-2 mb-1">
                    {driver.charAt(0).toUpperCase() + driver.slice(1)}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InvestorFinancialDashboard;
