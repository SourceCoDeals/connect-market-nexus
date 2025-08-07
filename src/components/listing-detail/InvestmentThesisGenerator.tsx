import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, DollarSign, Target, Share2, Download } from 'lucide-react';
import { toast } from 'sonner';

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

  const handleExportAnalysis = () => {
    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const reportContent = `INVESTMENT ANALYSIS REPORT
Generated on ${today}

BUSINESS OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Annual Revenue: ${formatCurrency(revenue)}
EBITDA: ${formatCurrency(ebitda)}
EBITDA Margin: ${ebitdaMargin.toFixed(1)}%
Industry Sector: ${category}
Geographic Location: ${location}

RISK ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Risk Profile: ${riskProfile.level}

INVESTMENT HIGHLIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${thesisPoints.map((point, index) => `${index + 1}. ${point}`).join('\n\n')}

VALUATION FRAMEWORK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current EBITDA: ${formatCurrency(ebitda)}
Estimated Valuation Range (4-6x EBITDA): ${formatCurrency(ebitda * 4)} - ${formatCurrency(ebitda * 6)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This analysis is based on the financial metrics and business characteristics provided. 
All valuations are estimates and should be validated through comprehensive due diligence.

Report generated by SourceCo Investment Analysis Engine
`;
    
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Investment_Analysis_${category.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Professional investment analysis exported successfully');
  };

  const handleShareAnalysis = () => {
    const shareText = `Investment Analysis Summary:\n\n` +
      `Revenue: ${formatCurrency(revenue)}\n` +
      `EBITDA: ${formatCurrency(ebitda)} (${ebitdaMargin.toFixed(1)}% margin)\n` +
      `Risk Profile: ${riskProfile.level}\n` +
      `Location: ${location}\n` +
      `Category: ${category}\n\n` +
      `Key Highlights:\n${thesisPoints.map(point => `• ${point}`).join('\n')}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Investment Analysis',
        text: shareText
      }).catch(() => {
        navigator.clipboard.writeText(shareText);
        toast.success('Analysis copied to clipboard');
      });
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Analysis copied to clipboard');
    }
  };

  return (
    <Card className="border-sourceco-form bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-sourceco-text flex items-center gap-2">
            <Target className="h-4 w-4" />
            Investment Analysis
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleShareAnalysis}
              className="h-7 px-2 text-xs"
            >
              <Share2 className="h-3 w-3 mr-1" />
              Share
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportAnalysis}
              className="h-7 px-2 text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics Overview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-sourceco-background/30 p-3 rounded-lg border border-sourceco-form">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-3 w-3 text-sourceco-text/60" />
              <span className="text-xs font-medium text-sourceco-text/60">Revenue</span>
            </div>
            <div className="text-sm font-semibold text-sourceco-text">{formatCurrency(revenue)}</div>
          </div>
          <div className="bg-sourceco-background/30 p-3 rounded-lg border border-sourceco-form">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3 w-3 text-sourceco-text/60" />
              <span className="text-xs font-medium text-sourceco-text/60">EBITDA Margin</span>
            </div>
            <div className="text-sm font-semibold text-sourceco-text">{ebitdaMargin.toFixed(1)}%</div>
          </div>
        </div>

        {/* Risk Profile */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-sourceco-text/60">Risk Profile:</span>
          <Badge variant="secondary" className="text-xs bg-sourceco-accent/10 text-sourceco-accent">
            {riskProfile.level}
          </Badge>
        </div>

        {/* Investment Thesis Points */}
        <div>
          <h4 className="text-xs font-medium text-sourceco-text mb-2">Key Investment Highlights</h4>
          <ul className="space-y-1">
            {thesisPoints.map((point, index) => (
              <li key={index} className="text-xs text-sourceco-text/70 pl-2 border-l-2 border-sourceco-accent/30">
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Valuation Framework */}
        <div className="bg-sourceco-accent/5 p-3 rounded-lg border border-sourceco-accent/20">
          <h4 className="text-xs font-medium text-sourceco-text mb-2">Valuation Framework</h4>
          <div className="text-xs text-sourceco-text/70 space-y-1">
            <div>Current EBITDA: {formatCurrency(ebitda)}</div>
            <div>Estimated Range (4-6x): {formatCurrency(ebitda * 4)} - {formatCurrency(ebitda * 6)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};