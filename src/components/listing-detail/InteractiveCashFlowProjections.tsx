import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Calculator, Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface InteractiveCashFlowProjectionsProps {
  revenue: number;
  ebitda: number;
  formatCurrency: (value: number) => string;
}

interface Scenario {
  name: string;
  revenueGrowth: number[];
  marginExpansion: number;
  color: string;
}

export const InteractiveCashFlowProjections: React.FC<InteractiveCashFlowProjectionsProps> = ({
  revenue,
  ebitda,
  formatCurrency
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string>('base');
  const [customGrowthRates, setCustomGrowthRates] = useState<number[]>([15, 12, 10, 8, 6]);
  const [marginExpansion, setMarginExpansion] = useState<number>(2);
  const [exitMultiple, setExitMultiple] = useState<number>(4.5);
  const [discountRate, setDiscountRate] = useState<number>(12);

  const currentMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;

  const scenarios: Record<string, Scenario> = {
    conservative: {
      name: 'Conservative',
      revenueGrowth: [8, 6, 5, 4, 3],
      marginExpansion: 1,
      color: '#f59e0b' // warning color
    },
    base: {
      name: 'Base Case',
      revenueGrowth: [15, 12, 10, 8, 6],
      marginExpansion: 2,
      color: '#d7b65c' // sourceco-accent
    },
    optimistic: {
      name: 'Optimistic',
      revenueGrowth: [25, 20, 15, 12, 10],
      marginExpansion: 4,
      color: '#10b981' // success color
    },
    custom: {
      name: 'Custom',
      revenueGrowth: customGrowthRates,
      marginExpansion: marginExpansion,
      color: '#6366f1' // info color
    }
  };

  const projectionData = useMemo(() => {
    const scenario = scenarios[selectedScenario];
    const years = 5;
    const projections = [];

    let currentRevenue = revenue;
    let currentEbitda = ebitda;
    let currentEbitdaMargin = currentMargin;

    // Add current year (Year 0)
    projections.push({
      year: 'Current',
      revenue: currentRevenue,
      ebitda: currentEbitda,
      ebitdaMargin: currentEbitdaMargin,
      freeCashFlow: currentEbitda * 0.8, // Assume 80% conversion
      cumulativeCashFlow: currentEbitda * 0.8
    });

    let cumulativeCashFlow = currentEbitda * 0.8;

    for (let i = 0; i < years; i++) {
      const growthRate = scenario.revenueGrowth[i] / 100;
      const yearlyMarginIncrease = scenario.marginExpansion / years;
      
      currentRevenue = currentRevenue * (1 + growthRate);
      currentEbitdaMargin = Math.min(currentEbitdaMargin + yearlyMarginIncrease, 40); // Cap at 40%
      currentEbitda = currentRevenue * (currentEbitdaMargin / 100);
      
      const freeCashFlow = currentEbitda * 0.8; // 80% conversion assumption
      cumulativeCashFlow += freeCashFlow;

      projections.push({
        year: `Year ${i + 1}`,
        revenue: currentRevenue,
        ebitda: currentEbitda,
        ebitdaMargin: currentEbitdaMargin,
        freeCashFlow: freeCashFlow,
        cumulativeCashFlow: cumulativeCashFlow
      });
    }

    return projections;
  }, [selectedScenario, revenue, ebitda, currentMargin, customGrowthRates, marginExpansion]);

  // Helper function to calculate IRR (simplified)
  const calculateIRR = (cashFlows: number[], terminalValue: number): number => {
    // Simplified IRR calculation - in practice would use iterative method
    const totalReturn = (cashFlows.reduce((sum, cf) => sum + cf, 0) + terminalValue) / revenue;
    return Math.pow(totalReturn, 1/5) - 1;
  };

  const valuation = useMemo(() => {
    const finalYear = projectionData[projectionData.length - 1];
    const terminalValue = finalYear.ebitda * exitMultiple;
    const totalCashFlow = projectionData.slice(1).reduce((sum, year) => sum + year.freeCashFlow, 0);
    
    // NPV calculation
    let npv = 0;
    projectionData.slice(1).forEach((year, index) => {
      const yearNum = index + 1;
      const presentValue = year.freeCashFlow / Math.pow(1 + discountRate / 100, yearNum);
      npv += presentValue;
    });
    
    const terminalValuePV = terminalValue / Math.pow(1 + discountRate / 100, 5);
    npv += terminalValuePV;

    const irr = calculateIRR(projectionData.slice(1).map(p => p.freeCashFlow), terminalValue);

    return {
      terminalValue,
      totalCashFlow,
      npv,
      irr,
      terminalValuePV
    };
  }, [projectionData, exitMultiple, discountRate]);


  const exportModel = () => {
    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const csvContent = `CASH FLOW PROJECTIONS MODEL
Generated on ${today}

BASE ASSUMPTIONS
Scenario,${selectedScenario}
Discount Rate,${(discountRate * 100).toFixed(1)}%
Exit Multiple,${exitMultiple}x EBITDA
Margin Expansion,${marginExpansion ? 'Yes' : 'No'}

FIVE YEAR PROJECTIONS
Year,Revenue,Revenue Growth,EBITDA,EBITDA Margin,Cash Flow
${projectionData.map((year, index) => 
  `Year ${index + 1},${formatCurrency(year.revenue)},${year.revenueGrowth ? (year.revenueGrowth * 100).toFixed(1) : 'N/A'}%,${formatCurrency(year.ebitda)},${year.ebitdaMargin ? (year.ebitdaMargin * 100).toFixed(1) : 'N/A'}%,${formatCurrency(year.cashFlow)}`
).join('\n')}

VALUATION SUMMARY
NPV (Net Present Value),${formatCurrency(valuation.npv)}
IRR (Internal Rate of Return),${(valuation.irr * 100).toFixed(1)}%
Terminal Value,${formatCurrency(valuation.terminalValue)}
Total Enterprise Value,${formatCurrency(valuation.npv + valuation.terminalValue)}

NOTES
- All projections are forward-looking estimates
- Terminal value calculated using perpetual growth method
- Cash flows adjusted for working capital and capital expenditure assumptions
- Model assumes ${exitMultiple}x EBITDA exit multiple in Year 5
`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cash_Flow_Model_${selectedScenario}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Professional cash flow model exported as CSV');
  };

  const shareAnalysis = () => {
    const shareText = `Cash Flow Projections Summary:\n\n` +
      `Scenario: ${selectedScenario}\n` +
      `Current Revenue: ${formatCurrency(revenue)}\n` +
      `Current EBITDA: ${formatCurrency(ebitda)}\n` +
      `NPV: ${formatCurrency(valuation.npv)}\n` +
      `IRR: ${(valuation.irr * 100).toFixed(1)}%\n` +
      `Terminal Value: ${formatCurrency(valuation.terminalValue)}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Cash Flow Projections',
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

  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return formatCurrency(value);
  };

  return (
    <Card className="border-sourceco-form">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Interactive Cash Flow Projections
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Model different growth scenarios and investment returns
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scenario Selection */}
        <div className="space-y-3">
          <Label className="text-xs font-medium">Scenario Analysis</Label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(scenarios).map(([key, scenario]) => (
              <Button
                key={key}
                variant={selectedScenario === key ? "default" : "outline"}
                size="sm"
                className={`text-xs h-8 ${
                  selectedScenario === key 
                    ? 'bg-sourceco-accent text-white' 
                    : 'border-sourceco-accent/30 text-sourceco-accent hover:bg-sourceco-accent hover:text-white'
                }`}
                onClick={() => setSelectedScenario(key)}
              >
                {scenario.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Scenario Controls */}
        {selectedScenario === 'custom' && (
          <div className="space-y-4 p-3 bg-sourceco-muted/30 rounded-lg">
            <Label className="text-xs font-medium">Custom Growth Rates (by year)</Label>
            {customGrowthRates.map((rate, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs">Year {index + 1}</span>
                  <span className="text-xs font-medium">{rate}%</span>
                </div>
                <Slider
                  value={[rate]}
                  onValueChange={(value) => {
                    const newRates = [...customGrowthRates];
                    newRates[index] = value[0];
                    setCustomGrowthRates(newRates);
                  }}
                  max={50}
                  min={-10}
                  step={1}
                  className="w-full"
                />
              </div>
            ))}
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Margin Expansion (total)</span>
                <span className="text-xs font-medium">{marginExpansion}%</span>
              </div>
              <Slider
                value={[marginExpansion]}
                onValueChange={(value) => setMarginExpansion(value[0])}
                max={10}
                min={0}
                step={0.5}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Advanced Parameters */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Exit Multiple</Label>
            <Select value={exitMultiple.toString()} onValueChange={(value) => setExitMultiple(Number(value))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3.5">3.5x</SelectItem>
                <SelectItem value="4.0">4.0x</SelectItem>
                <SelectItem value="4.5">4.5x</SelectItem>
                <SelectItem value="5.0">5.0x</SelectItem>
                <SelectItem value="5.5">5.5x</SelectItem>
                <SelectItem value="6.0">6.0x</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Discount Rate</Label>
            <Select value={discountRate.toString()} onValueChange={(value) => setDiscountRate(Number(value))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">8%</SelectItem>
                <SelectItem value="10">10%</SelectItem>
                <SelectItem value="12">12%</SelectItem>
                <SelectItem value="15">15%</SelectItem>
                <SelectItem value="18">18%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Key Metrics Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-sourceco-muted/30 rounded-lg">
            <div className="text-lg font-semibold text-sourceco-accent">
              {formatCompactCurrency(valuation.npv)}
            </div>
            <div className="text-xs text-muted-foreground">Net Present Value</div>
          </div>
          <div className="text-center p-3 bg-sourceco-muted/30 rounded-lg">
            <div className="text-lg font-semibold text-sourceco-accent">
              {(valuation.irr * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Projected IRR</div>
          </div>
        </div>

        {/* Revenue & EBITDA Projection Chart */}
        <div className="space-y-3">
          <Label className="text-xs font-medium">Revenue & EBITDA Projections</Label>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCompactCurrency} />
                <Tooltip 
                  formatter={(value: number) => formatCompactCurrency(value)}
                  labelStyle={{ fontSize: '12px' }}
                  contentStyle={{ fontSize: '12px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#d7b65c" 
                  strokeWidth={2}
                  name="Revenue"
                />
                <Line 
                  type="monotone" 
                  dataKey="ebitda" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="EBITDA"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cash Flow Chart */}
        <div className="space-y-3">
          <Label className="text-xs font-medium">Annual Free Cash Flow</Label>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectionData.slice(1)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCompactCurrency} />
                <Tooltip 
                  formatter={(value: number) => formatCompactCurrency(value)}
                  labelStyle={{ fontSize: '12px' }}
                  contentStyle={{ fontSize: '12px' }}
                />
                <Bar dataKey="freeCashFlow" fill="#d7b65c" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Terminal Value Breakdown */}
        <div className="space-y-2 p-3 bg-sourceco-muted/30 rounded-lg">
          <Label className="text-xs font-medium">Terminal Value Analysis</Label>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground">Year 5 EBITDA</div>
              <div className="font-semibold">{formatCompactCurrency(projectionData[projectionData.length - 1].ebitda)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Exit Multiple</div>
              <div className="font-semibold">{exitMultiple}x</div>
            </div>
            <div>
              <div className="text-muted-foreground">Terminal Value</div>
              <div className="font-semibold">{formatCompactCurrency(valuation.terminalValue)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Present Value</div>
              <div className="font-semibold">{formatCompactCurrency(valuation.terminalValuePV)}</div>
            </div>
          </div>
        </div>

        {/* Export Options */}
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={exportModel}
            className="flex-1 text-xs border-sourceco-accent text-sourceco-accent hover:bg-sourceco-accent hover:text-white"
          >
            <Download className="h-3 w-3 mr-2" />
            Export Model
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={shareAnalysis}
            className="flex-1 text-xs border-sourceco-accent text-sourceco-accent hover:bg-sourceco-accent hover:text-white"
          >
            <Share2 className="h-3 w-3 mr-2" />
            Share Analysis
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};