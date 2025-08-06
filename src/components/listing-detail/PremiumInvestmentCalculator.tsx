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
    <Card className="bg-gradient-to-br from-background to-muted/30 border-primary/20 shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Premium Investment Calculator</CardTitle>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportCalculations}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Scenario Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Investment Scenario</Label>
          <div className="flex gap-2">
            {(['base', 'bull', 'bear'] as const).map((scenarioType) => (
              <Button
                key={scenarioType}
                variant={scenario === scenarioType ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScenario(scenarioType)}
                className="flex-1 capitalize"
              >
                {scenarioType}
              </Button>
            ))}
          </div>
        </div>

        {/* Key Assumptions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Exit Multiple */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Exit Multiple</Label>
              <Badge variant="outline">{exitMultiple[0]}x</Badge>
            </div>
            <Slider
              value={exitMultiple}
              onValueChange={setExitMultiple}
              min={3}
              max={10}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>3x</span>
              <span className="font-medium">Industry: {industryBenchmarks.medianMultiple}x</span>
              <span>10x</span>
            </div>
          </div>

          {/* Growth Rate */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Annual Growth</Label>
              <Badge variant="outline">{adjustedGrowth.toFixed(1)}%</Badge>
            </div>
            <Slider
              value={growthRate}
              onValueChange={setGrowthRate}
              min={0}
              max={30}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span className="font-medium">Industry: {industryBenchmarks.medianGrowth}%</span>
              <span>30%</span>
            </div>
          </div>

          {/* Time Horizon */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Hold Period</Label>
              <Badge variant="outline">{timeHorizon[0]} years</Badge>
            </div>
            <Slider
              value={timeHorizon}
              onValueChange={setTimeHorizon}
              min={3}
              max={10}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>3 years</span>
              <span>10 years</span>
            </div>
          </div>

          {/* Leverage Ratio */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Debt-to-Equity</Label>
              <Badge variant="outline">{leverageRatio[0]}x</Badge>
            </div>
            <Slider
              value={leverageRatio}
              onValueChange={setLeverageRatio}
              min={0}
              max={5}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>No Debt</span>
              <span>5x Leverage</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Investment Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Valuation */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Current Analysis
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Current EBITDA</span>
                <span className="font-medium">{formatCurrency(adjustedEbitda)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Enterprise Value</span>
                <span className="font-medium">{formatCurrency(currentValuation)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Equity Investment</span>
                <span className="font-medium">{formatCurrency(equityInvestment)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Debt Financing</span>
                <span className="font-medium">{formatCurrency(debtFinancing)}</span>
              </div>
            </div>
          </div>

          {/* Future Projections */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Exit Projections
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Future EBITDA</span>
                <span className="font-medium">{formatCurrency(futureEbitda)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Exit Valuation</span>
                <span className="font-medium">{formatCurrency(futureValuation)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Unleveraged IRR</span>
                <Badge variant={annualizedReturn > 20 ? "default" : annualizedReturn > 15 ? "secondary" : "outline"}>
                  {annualizedReturn.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Leveraged IRR</span>
                <Badge variant={leveragedAnnualizedReturn > 25 ? "default" : leveragedAnnualizedReturn > 20 ? "secondary" : "outline"}>
                  {leveragedAnnualizedReturn.toFixed(1)}%
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Metrics */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <h5 className="font-medium text-sm">Key Risk Metrics</h5>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Revenue Multiple: </span>
              <span className="font-medium">{(currentValuation / revenue).toFixed(1)}x</span>
            </div>
            <div>
              <span className="text-muted-foreground">EBITDA Margin: </span>
              <span className="font-medium">{((adjustedEbitda / revenue) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}