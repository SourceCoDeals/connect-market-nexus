import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Building2 } from 'lucide-react';
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
  // Generate business overview from description
  const customThesis = generateCustomInvestmentThesis(description, category, location, revenue, ebitda);
  const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;
  const ebitdaMultiple = ebitda > 0 ? revenue / ebitda : 0;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-lg font-medium text-foreground flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          Investment Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Business Overview - Enhanced to show AI analysis */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">AI Business Analysis</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {customThesis.overview}
            </p>
            {customThesis.keyStrengths.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-foreground">Key Business Strengths:</div>
                <ul className="space-y-1">
                  {customThesis.keyStrengths.slice(0, 3).map((strength, index) => (
                    <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="w-1 h-1 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Key Financial Metrics */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Key Metrics</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Revenue</span>
                </div>
                <div className="text-lg font-medium text-foreground">
                  {formatCurrency(revenue)}
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">EBITDA</span>
                </div>
                <div className="text-lg font-medium text-foreground">
                  {formatCurrency(ebitda)}
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Margin</span>
                </div>
                <div className="text-lg font-medium text-foreground">
                  {ebitdaMargin.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Valuation Framework */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-foreground">Valuation Framework</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">EBITDA Multiple Range</span>
                <span className="font-medium text-foreground">4.0x - 6.0x</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Indicative Range</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(ebitda * 4)} - {formatCurrency(ebitda * 6)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-foreground">{location}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Sector</span>
                <span className="font-medium text-foreground">{category}</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground pt-3 border-t border-border">
            <strong>AI-Generated Analysis:</strong> Based on detailed parsing of business description, 
            extracting market position, competitive advantages, and growth drivers. 
            Multiples are indicative and subject to due diligence.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};