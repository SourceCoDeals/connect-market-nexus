import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, Target } from 'lucide-react';

interface InvestmentThesisGeneratorProps {
  revenue: number;
  ebitda: number;
  category: string;
  location: string;
  formatCurrency: (value: number) => string;
}

export const InvestmentThesisGenerator: React.FC<InvestmentThesisGeneratorProps> = ({
  revenue,
  ebitda,
  category,
  location,
  formatCurrency
}) => {
  // Calculate key metrics
  const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;
  const impliedMultiple = ebitda > 0 ? Math.round((ebitda * 4.5) / ebitda * 10) / 10 : 0;
  
  // Generate investment highlights based on actual data
  const getThesisPoints = () => {
    const points = [];
    
    // Revenue scale analysis
    if (revenue >= 10000000) {
      points.push("Established revenue scale demonstrating market validation and operational maturity");
    } else if (revenue >= 1000000) {
      points.push("Growing business with proven revenue model and market traction");
    } else {
      points.push("Early-stage opportunity with foundational revenue streams");
    }
    
    // Profitability analysis
    if (ebitdaMargin >= 20) {
      points.push("Strong profitability profile with excellent EBITDA margins indicating operational efficiency");
    } else if (ebitdaMargin >= 10) {
      points.push("Healthy profit margins demonstrating sustainable business fundamentals");
    } else if (ebitdaMargin > 0) {
      points.push("Positive cash generation with potential for margin improvement");
    } else {
      points.push("Growth-stage business focused on market capture and scale");
    }
    
    // Geographic market analysis
    const locationInsights = {
      'United States': 'Access to the world\'s largest consumer market',
      'Canada': 'Stable regulatory environment and growing domestic market',
      'United Kingdom': 'Gateway to European markets with strong business infrastructure',
      'Australia': 'Growing Asia-Pacific market exposure',
      'Germany': 'Central European market access with industrial strength',
    };
    
    if (locationInsights[location as keyof typeof locationInsights]) {
      points.push(locationInsights[location as keyof typeof locationInsights]);
    }
    
    // Category-specific insights
    const categoryInsights = {
      'Technology': 'High-growth sector with scalability potential and innovation opportunities',
      'Healthcare': 'Defensive sector with consistent demand and regulatory barriers to entry',
      'Manufacturing': 'Asset-backed business with tangible value and industrial expertise',
      'Services': 'Scalable business model with recurring revenue potential',
      'Retail': 'Consumer-facing business with brand development opportunities',
      'Food & Beverage': 'Essential consumer goods with brand loyalty potential',
    };
    
    if (categoryInsights[category as keyof typeof categoryInsights]) {
      points.push(categoryInsights[category as keyof typeof categoryInsights]);
    }
    
    return points;
  };
  
  const thesisPoints = getThesisPoints();
  
  // Risk level assessment
  const getRiskProfile = () => {
    if (ebitdaMargin >= 15 && revenue >= 5000000) return { level: 'Low-Medium', color: 'bg-green-100 text-green-800' };
    if (ebitdaMargin >= 10 && revenue >= 1000000) return { level: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
    return { level: 'Medium-High', color: 'bg-orange-100 text-orange-800' };
  };
  
  const riskProfile = getRiskProfile();

  return (
    <Card className="border-sourceco-form bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-4 border-b border-sourceco-form/50">
        <CardTitle className="text-lg font-semibold text-sourceco-text flex items-center gap-3 tracking-tight">
          <div className="p-2 bg-sourceco-accent/10 rounded-lg">
            <Target className="h-5 w-5 text-sourceco-accent" />
          </div>
          Investment Analysis
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          AI-generated insights based on financial metrics and business characteristics
        </p>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Key Metrics Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-sourceco-accent/5 to-sourceco-accent/10 rounded-xl border border-sourceco-accent/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-sourceco-accent" />
              <span className="text-sm font-medium text-muted-foreground">Annual Revenue</span>
            </div>
            <div className="text-xl font-bold text-sourceco-accent">{formatCurrency(revenue)}</div>
          </div>
          <div className="bg-gradient-to-br from-sourceco-accent/5 to-sourceco-accent/10 rounded-xl border border-sourceco-accent/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-sourceco-accent" />
              <span className="text-sm font-medium text-muted-foreground">EBITDA Margin</span>
            </div>
            <div className="text-xl font-bold text-sourceco-accent">{ebitdaMargin.toFixed(1)}%</div>
          </div>
        </div>

        {/* Risk Profile */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-sourceco-text">Risk Assessment</h4>
          <div className="flex items-center gap-3">
            <Badge className={`text-sm px-3 py-1 font-medium ${riskProfile.color}`}>
              {riskProfile.level}
            </Badge>
            <span className="text-sm text-muted-foreground">Investment grade classification</span>
          </div>
        </div>

        {/* Investment Thesis Points */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-sourceco-text">Investment Highlights</h4>
          <div className="space-y-3">
            {thesisPoints.map((point, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-sourceco-background/50 rounded-lg border border-sourceco-form/50">
                <div className="w-2 h-2 bg-sourceco-accent rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-sm text-slate-700 leading-relaxed">{point}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Valuation Framework */}
        <div className="space-y-3 bg-gradient-to-r from-sourceco-background to-sourceco-muted/20 p-4 rounded-xl border border-sourceco-form/50">
          <h4 className="text-sm font-semibold text-sourceco-text">Valuation Framework</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Current EBITDA</span>
              <span className="font-semibold text-sourceco-accent">{formatCurrency(ebitda)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Estimated Range (4-6x)</span>
              <span className="font-semibold text-sourceco-accent">{formatCurrency(ebitda * 4)} - {formatCurrency(ebitda * 6)}</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground pt-2 border-t border-sourceco-form/30">
            Market-based valuation methodology
          </div>
        </div>
      </CardContent>
    </Card>
  );
};