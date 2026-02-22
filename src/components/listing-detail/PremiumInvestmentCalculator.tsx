import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

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
  const annualizedReturn = (Math.pow(futureValuation / currentValuation, 1 / timeHorizon[0]) - 1) * 100;

  // Leverage calculations
  const equityInvestment = currentValuation / (1 + leverageRatio[0]);
  const debtFinancing = currentValuation - equityInvestment;
  const leveragedAnnualizedReturn = (Math.pow((futureValuation - debtFinancing) / equityInvestment, 1 / timeHorizon[0]) - 1) * 100;

  // Industry benchmarks (mock data for demonstration)


  return (
    <div className="border border-sourceco-form bg-sourceco-background p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <span className="document-label">Investment Calculator</span>
      </div>

      {/* Scenario Selection */}
      <div className="space-y-3">
        <span className="document-label">Scenario</span>
        <div className="flex gap-1">
          {(['base', 'bull', 'bear'] as const).map((scenarioType) => (
            <Button
              key={scenarioType}
              variant={scenario === scenarioType ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScenario(scenarioType)}
              className="flex-1 capitalize text-xs h-8 border-sourceco-form"
            >
              {scenarioType}
            </Button>
          ))}
        </div>
      </div>

      {/* Key Assumptions */}
      <div className="space-y-4">
        <span className="document-label">Assumptions</span>
        
        {/* Exit Multiple */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-xs text-slate-500">Exit Multiple</span>
            <span className="text-xs font-medium">{exitMultiple[0]}x</span>
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
          <div className="flex justify-between">
            <span className="text-xs text-slate-500">Annual Growth</span>
            <span className="text-xs font-medium">{adjustedGrowth.toFixed(1)}%</span>
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
          <div className="flex justify-between">
            <span className="text-xs text-slate-500">Hold Period</span>
            <span className="text-xs font-medium">{timeHorizon[0]} years</span>
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

        {/* Leverage Ratio */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-xs text-slate-500">Debt-to-Equity</span>
            <span className="text-xs font-medium">{leverageRatio[0]}x</span>
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

      {/* Results */}
      <div className="space-y-4 pt-4 border-t border-sourceco-form">
        <span className="document-label">Projected Returns</span>
        
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-xs text-slate-500">Current Valuation</span>
            <span className="text-xs font-medium">{formatCurrency(currentValuation)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-slate-500">Exit Valuation</span>
            <span className="text-xs font-medium">{formatCurrency(futureValuation)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-slate-500">Unleveraged IRR</span>
            <span className="text-xs font-semibold text-slate-900">{annualizedReturn.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-slate-500">Leveraged IRR</span>
            <span className="text-xs font-semibold text-slate-900">{leveragedAnnualizedReturn.toFixed(1)}%</span>
          </div>
        </div>
      </div>

        {/* Risk Metrics */}
      <div className="bg-sourceco-form p-4 space-y-2">
        <span className="document-label">Risk Metrics</span>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-slate-500">Revenue Multiple</span>
            <div className="text-xs font-medium">{(currentValuation / revenue).toFixed(1)}x</div>
          </div>
          <div>
            <span className="text-xs text-slate-500">EBITDA Margin</span>
            <div className="text-xs font-medium">{((adjustedEbitda / revenue) * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}