import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calculator, TrendingUp, AlertTriangle, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EnhancedInvestmentCalculatorProps {
  revenue: number;
  ebitda: number;
  formatCurrency: (value: number) => string;
}

interface Scenario {
  name: string;
  multiple: number;
  growthRate: number;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export const EnhancedInvestmentCalculator: React.FC<EnhancedInvestmentCalculatorProps> = ({
  revenue,
  ebitda,
  formatCurrency,
}) => {
  const [selectedScenario, setSelectedScenario] = useState('base');
  const [timeHorizon, setTimeHorizon] = useState(5);
  const [leverageRatio, setLeverageRatio] = useState(0);

  const scenarios: Record<string, Scenario> = {
    conservative: {
      name: 'Conservative',
      multiple: 4.5,
      growthRate: 0.05,
      description: 'Lower growth, stable market conditions',
      riskLevel: 'low'
    },
    base: {
      name: 'Base Case',
      multiple: 6.0,
      growthRate: 0.12,
      description: 'Expected performance under normal conditions',
      riskLevel: 'medium'
    },
    optimistic: {
      name: 'Optimistic',
      multiple: 8.0,
      growthRate: 0.20,
      description: 'Strong growth, favorable market conditions',
      riskLevel: 'high'
    }
  };

  const calculateMetrics = (scenario: Scenario) => {
    const currentValue = ebitda * scenario.multiple;
    const futureEbitda = ebitda * Math.pow(1 + scenario.growthRate, timeHorizon);
    const futureValue = futureEbitda * scenario.multiple;
    const totalReturn = (futureValue - currentValue) / currentValue;
    const annualizedReturn = Math.pow(1 + totalReturn, 1 / timeHorizon) - 1;
    
    // Leverage calculations
    const debtAmount = currentValue * leverageRatio;
    const equityInvestment = currentValue - debtAmount;
    const leveragedReturn = leverageRatio > 0 
      ? ((futureValue - debtAmount) - equityInvestment) / equityInvestment / timeHorizon
      : annualizedReturn;

    return {
      currentValue,
      futureEbitda,
      futureValue,
      totalReturn,
      annualizedReturn,
      debtAmount,
      equityInvestment,
      leveragedReturn
    };
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const exportAnalysis = () => {
    const analysis = Object.entries(scenarios).map(([key, scenario]) => ({
      scenario: scenario.name,
      ...calculateMetrics(scenario)
    }));
    
    const dataStr = JSON.stringify({
      listing: { revenue, ebitda },
      assumptions: { timeHorizon, leverageRatio },
      scenarios: analysis,
      generatedAt: new Date().toISOString()
    }, null, 2);
    
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'investment-analysis.json';
    link.click();
  };

  const currentScenario = scenarios[selectedScenario];
  const metrics = calculateMetrics(currentScenario);

  return (
    <Card className="border-sourceco-form bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-sourceco-text flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Investment Scenario Analysis
          </CardTitle>
          <Button
            onClick={exportAnalysis}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={selectedScenario} onValueChange={setSelectedScenario}>
          <TabsList className="grid w-full grid-cols-3">
            {Object.entries(scenarios).map(([key, scenario]) => (
              <TabsTrigger key={key} value={key} className="text-xs">
                {scenario.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(scenarios).map(([key, scenario]) => (
            <TabsContent key={key} value={key} className="mt-4 space-y-4">
              {/* Scenario Info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{scenario.name}</h4>
                  <Badge className={getRiskColor(scenario.riskLevel)}>
                    {scenario.riskLevel} risk
                  </Badge>
                </div>
                <p className="text-xs text-gray-600">{scenario.description}</p>
              </div>

              {/* Key Assumptions */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    Time Horizon
                  </label>
                  <Select value={timeHorizon.toString()} onValueChange={(v) => setTimeHorizon(Number(v))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[3, 4, 5, 6, 7].map(years => (
                        <SelectItem key={years} value={years.toString()}>
                          {years} years
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    Leverage Ratio
                  </label>
                  <Select value={leverageRatio.toString()} onValueChange={(v) => setLeverageRatio(Number(v))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No Leverage</SelectItem>
                      <SelectItem value="0.3">30% Debt</SelectItem>
                      <SelectItem value="0.5">50% Debt</SelectItem>
                      <SelectItem value="0.7">70% Debt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Projected Returns */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-800">Projected Returns</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Current Valuation</div>
                    <div className="text-sm font-semibold text-blue-900">
                      {formatCurrency(metrics.currentValue)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {scenario.multiple}x EBITDA
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Future Value</div>
                    <div className="text-sm font-semibold text-green-900">
                      {formatCurrency(metrics.futureValue)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Year {timeHorizon}
                    </div>
                  </div>
                </div>

                {/* Returns Matrix */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Total Return</div>
                    <div className="text-sm font-semibold flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      {(metrics.totalReturn * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Annualized IRR</div>
                    <div className="text-sm font-semibold">
                      {(metrics.annualizedReturn * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {leverageRatio > 0 && (
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Leveraged Returns
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">Equity Investment:</span>
                        <div className="font-medium">{formatCurrency(metrics.equityInvestment)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Leveraged IRR:</span>
                        <div className="font-medium">{(metrics.leveragedReturn * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Risk Factors */}
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Key Assumptions
                </div>
                <ul className="text-xs text-gray-700 space-y-1">
                  <li>• Exit multiple: {scenario.multiple}x EBITDA</li>
                  <li>• Annual growth: {(scenario.growthRate * 100).toFixed(0)}%</li>
                  <li>• Current EBITDA: {formatCurrency(ebitda)}</li>
                  <li>• Projected EBITDA: {formatCurrency(metrics.futureEbitda)}</li>
                </ul>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};