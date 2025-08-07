import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, Target, AlertTriangle, Shield, TrendingUp as GrowthIcon } from 'lucide-react';
import { generateCustomInvestmentThesis } from '@/lib/financial-parser';

interface InvestmentThesisGeneratorProps {
  revenue: number;
  ebitda: number;
  category: string;
  location: string;
  description: string;
  formatCurrency: (value: number) => string;
}

export const InvestmentThesisGenerator: React.FC<InvestmentThesisGeneratorProps> = ({
  revenue,
  ebitda,
  category,
  location,
  description,
  formatCurrency
}) => {
  // Generate comprehensive investment thesis from business description
  const customThesis = generateCustomInvestmentThesis(description, category, location, revenue, ebitda);
  const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;
  
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low': return 'bg-green-100 text-green-800 border-green-200';
      case 'Low-Medium': return 'bg-green-100 text-green-700 border-green-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Medium-High': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'High': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="border-sourceco-form bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-4 border-b border-sourceco-form/50">
        <CardTitle className="text-lg font-semibold text-sourceco-text flex items-center gap-3 tracking-tight">
          <div className="p-2 bg-sourceco-accent/10 rounded-lg">
            <Target className="h-5 w-5 text-sourceco-accent" />
          </div>
          Investment Analysis
          <Badge variant="outline" className="text-xs bg-sourceco-accent/5 text-sourceco-accent border-sourceco-accent/20">
            {Math.round(customThesis.confidence * 100)}% Confidence
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          AI-generated analysis based on business description and financial metrics
        </p>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Business Overview */}
        <div className="bg-gradient-to-br from-sourceco-background/30 to-sourceco-muted/10 p-4 rounded-xl border border-sourceco-form/50">
          <h4 className="text-sm font-semibold text-sourceco-text mb-2">Business Overview</h4>
          <p className="text-sm text-slate-700 leading-relaxed">{customThesis.overview}</p>
        </div>

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

        {/* Key Strengths */}
        {customThesis.keyStrengths.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-sourceco-text flex items-center gap-2">
              <Shield className="h-4 w-4 text-sourceco-accent" />
              Key Strengths
            </h4>
            <div className="space-y-2">
              {customThesis.keyStrengths.map((strength, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-sourceco-background/50 rounded-lg border border-sourceco-form/50">
                  <div className="w-2 h-2 bg-sourceco-accent rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm text-slate-700 leading-relaxed">{strength}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Investment Highlights */}
        {customThesis.investmentHighlights.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-sourceco-text flex items-center gap-2">
              <GrowthIcon className="h-4 w-4 text-sourceco-accent" />
              Investment Highlights
            </h4>
            <div className="space-y-2">
              {customThesis.investmentHighlights.map((highlight, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-green-50/50 rounded-lg border border-green-100">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm text-slate-700 leading-relaxed">{highlight}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Growth Opportunity */}
        <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 p-4 rounded-xl border border-blue-100">
          <h4 className="text-sm font-semibold text-sourceco-text mb-2">Growth Opportunity</h4>
          <p className="text-sm text-slate-700 leading-relaxed">{customThesis.growthOpportunity}</p>
        </div>

        {/* Risk Assessment */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-sourceco-text flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Risk Assessment
          </h4>
          
          <div className="flex items-center gap-3 mb-3">
            <Badge className={`text-sm px-3 py-1 font-medium border ${getRiskColor(customThesis.riskAssessment.level)}`}>
              {customThesis.riskAssessment.level} Risk
            </Badge>
            <span className="text-xs text-muted-foreground">
              {Math.round(customThesis.riskAssessment.confidence * 100)}% assessment confidence
            </span>
          </div>

          {customThesis.riskAssessment.factors.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Key Risk Factors</h5>
              {customThesis.riskAssessment.factors.map((factor, index) => (
                <div key={index} className="text-sm text-slate-600 p-2 bg-orange-50/50 rounded border border-orange-100">
                  {factor}
                </div>
              ))}
            </div>
          )}

          {customThesis.riskAssessment.mitigationFactors.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Risk Mitigation</h5>
              {customThesis.riskAssessment.mitigationFactors.map((factor, index) => (
                <div key={index} className="text-sm text-slate-600 p-2 bg-green-50/50 rounded border border-green-100">
                  {factor}
                </div>
              ))}
            </div>
          )}
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
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Market Position</span>
              <span className="font-medium text-slate-700">{customThesis.marketPosition}</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground pt-2 border-t border-sourceco-form/30">
            Analysis based on business description and comparable market data
          </div>
        </div>
      </CardContent>
    </Card>
  );
};