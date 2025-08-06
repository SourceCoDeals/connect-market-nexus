import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calculator, Download, BarChart3 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface PremiumInvestmentCalculatorProps {
  revenue: number;
  ebitda: number;
  formatCurrency: (value: number) => string;
}

export function PremiumInvestmentCalculator({ 
  revenue, 
  ebitda, 
  formatCurrency 
}: PremiumInvestmentCalculatorProps) {
  // Scenario inputs
  const [scenario, setScenario] = useState<'base' | 'bull' | 'bear'>('base');
  const [exitMultiple, setExitMultiple] = useState([5.5]);
  const [growthRate, setGrowthRate] = useState([15]);
  const [timeHorizon, setTimeHorizon] = useState([5]);
  const [leverageRatio, setLeverageRatio] = useState([3.0]);

  // Scenario adjustments
  const scenarioAdjustments = {
    base: { multiple: 1.0, growth: 1.0 },
    bull: { multiple: 1.2, growth: 1.3 },
    bear: { multiple: 0.8, growth: 0.7 }
  };

  const currentAdjustment = scenarioAdjustments[scenario];
  const adjustedEbitda = ebitda * currentAdjustment.multiple;
  const adjustedGrowth = growthRate[0] * currentAdjustment.growth;

  // Calculations
  const currentValuation = adjustedEbitda * exitMultiple[0];
  const futureEbitda = adjustedEbitda * Math.pow(1 + adjustedGrowth / 100, timeHorizon[0]);
  const futureValuation = futureEbitda * exitMultiple[0];
  const totalReturn = ((futureValuation - currentValuation) / currentValuation) * 100;
  const annualizedReturn = (Math.pow(futureValuation / currentValuation, 1 / timeHorizon[0]) - 1) * 100;

  // Leverage calculations
  const equityInvestment = currentValuation / (1 + leverageRatio[0]);
  const debtFinancing = currentValuation - equityInvestment;
  const leveragedReturn = ((futureValuation - debtFinancing) / equityInvestment - 1) * 100;
  const leveragedAnnualizedReturn = (Math.pow((futureValuation - debtFinancing) / equityInvestment, 1 / timeHorizon[0]) - 1) * 100;

  // Industry benchmarks (mock data for demonstration)
  const industryBenchmarks = {
    medianMultiple: 4.8,
    medianGrowth: 12,
    medianMargin: (ebitda / revenue) * 100
  };

  const exportCalculations = () => {
    const data = {
      scenario,
      assumptions: {
        exitMultiple: exitMultiple[0],
        growthRate: adjustedGrowth,
        timeHorizon: timeHorizon[0],
        leverageRatio: leverageRatio[0]
      },
      currentMetrics: {
        revenue: formatCurrency(revenue),
        ebitda: formatCurrency(adjustedEbitda),
        valuation: formatCurrency(currentValuation)
      },
      projectedMetrics: {
        futureEbitda: formatCurrency(futureEbitda),
        futureValuation: formatCurrency(futureValuation),
        totalReturn: `${totalReturn.toFixed(1)}%`,
        annualizedReturn: `${annualizedReturn.toFixed(1)}%`
      },
      leverageAnalysis: {
        equityRequired: formatCurrency(equityInvestment),
        debtFinancing: formatCurrency(debtFinancing),
        leveragedReturn: `${leveragedReturn.toFixed(1)}%`,
        leveragedIRR: `${leveragedAnnualizedReturn.toFixed(1)}%`
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'investment-analysis.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="document-title">Investment Analysis</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={exportCalculations}
          className="text-xs font-normal"
        >
          Export Analysis
        </Button>
      </div>
      
      {/* Scenario Selection */}
      <div className="space-y-3">
        <span className="document-label">Analysis Scenario</span>
        <div className="grid grid-cols-3 gap-1">
          {(['base', 'bull', 'bear'] as const).map((scenarioType) => (
            <Button
              key={scenarioType}
              variant={scenario === scenarioType ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScenario(scenarioType)}
              className="text-xs font-normal capitalize"
            >
              {scenarioType}
            </Button>
          ))}
        </div>
      </div>

      {/* Key Assumptions Grid */}
      <div className="space-y-4">
        <span className="document-label">Investment Assumptions</span>
        
        <div className="space-y-4">
          {/* Exit Multiple */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="document-subtitle">Exit Multiple</span>
              <span className="text-sm font-medium">{exitMultiple[0]}x</span>
            </div>
            <Slider
              value={exitMultiple}
              onValueChange={setExitMultiple}
              min={3}
              max={10}
              step={0.1}
              className="w-full"
            />
          </div>

          {/* Growth Rate */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="document-subtitle">Annual Growth Rate</span>
              <span className="text-sm font-medium">{adjustedGrowth.toFixed(1)}%</span>
            </div>
            <Slider
              value={growthRate}
              onValueChange={setGrowthRate}
              min={0}
              max={30}
              step={1}
              className="w-full"
            />
          </div>

          {/* Time Horizon */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="document-subtitle">Investment Period</span>
              <span className="text-sm font-medium">{timeHorizon[0]} years</span>
            </div>
            <Slider
              value={timeHorizon}
              onValueChange={setTimeHorizon}
              min={3}
              max={10}
              step={1}
              className="w-full"
            />
          </div>

          {/* Leverage */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="document-subtitle">Debt-to-Equity Ratio</span>
              <span className="text-sm font-medium">{leverageRatio[0]}x</span>
            </div>
            <Slider
              value={leverageRatio}
              onValueChange={setLeverageRatio}
              min={0}
              max={5}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <div className="space-y-4 border-t border-section-border pt-4">
        <span className="document-label">Investment Returns</span>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="document-subtitle">Current Valuation</span>
              <span className="text-sm font-medium">{formatCurrency(currentValuation)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="document-subtitle">Equity Required</span>
              <span className="text-sm font-medium">{formatCurrency(equityInvestment)}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="document-subtitle">Exit Valuation</span>
              <span className="text-sm font-medium">{formatCurrency(futureValuation)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="document-subtitle">Leveraged IRR</span>
              <span className="text-sm font-medium">{leveragedAnnualizedReturn.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Summary */}
      <div className="space-y-3 border-t border-section-border pt-4">
        <span className="document-label">Risk Metrics</span>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Revenue Multiple</span>
            <span>{(currentValuation / revenue).toFixed(1)}x</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">EBITDA Margin</span>
            <span>{((adjustedEbitda / revenue) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}