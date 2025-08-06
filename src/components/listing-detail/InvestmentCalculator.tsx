
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, TrendingUp } from "lucide-react";

interface InvestmentCalculatorProps {
  revenue: number;
  ebitda: number;
  formatCurrency: (value: number) => string;
}

const InvestmentCalculator = ({ revenue, ebitda, formatCurrency }: InvestmentCalculatorProps) => {
  const [multiple, setMultiple] = useState("5");
  const [growthRate, setGrowthRate] = useState("15");
  const [timeHorizon, setTimeHorizon] = useState("5");
  
  const currentMultiple = parseFloat(multiple);
  const annualGrowth = parseFloat(growthRate) / 100;
  const years = parseInt(timeHorizon);
  
  // Calculate enterprise value
  const enterpriseValue = ebitda * currentMultiple;
  
  // Calculate future EBITDA
  const futureEbitda = ebitda * Math.pow(1 + annualGrowth, years);
  const futureValue = futureEbitda * currentMultiple;
  
  // Calculate returns
  const totalReturn = ((futureValue - enterpriseValue) / enterpriseValue) * 100;
  const annualizedReturn = (Math.pow(futureValue / enterpriseValue, 1 / years) - 1) * 100;
  
  return (
    <Card className="bg-gradient-to-br from-background to-muted/10 border-border/50 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Investment Calculator</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="multiple" className="text-xs font-medium">
              EBITDA Multiple
            </Label>
            <Select value={multiple} onValueChange={setMultiple}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3.0x</SelectItem>
                <SelectItem value="4">4.0x</SelectItem>
                <SelectItem value="5">5.0x</SelectItem>
                <SelectItem value="6">6.0x</SelectItem>
                <SelectItem value="7">7.0x</SelectItem>
                <SelectItem value="8">8.0x</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="growth" className="text-xs font-medium">
              Annual Growth Rate
            </Label>
            <Select value={growthRate} onValueChange={setGrowthRate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5%</SelectItem>
                <SelectItem value="10">10%</SelectItem>
                <SelectItem value="15">15%</SelectItem>
                <SelectItem value="20">20%</SelectItem>
                <SelectItem value="25">25%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="horizon" className="text-xs font-medium">
              Time Horizon
            </Label>
            <Select value={timeHorizon} onValueChange={setTimeHorizon}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Years</SelectItem>
                <SelectItem value="5">5 Years</SelectItem>
                <SelectItem value="7">7 Years</SelectItem>
                <SelectItem value="10">10 Years</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Results */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-lg font-bold text-primary">
              {formatCurrency(enterpriseValue)}
            </div>
            <div className="text-xs text-muted-foreground">Current Valuation</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold">
              {formatCurrency(futureValue)}
            </div>
            <div className="text-xs text-muted-foreground">Future Value</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              {totalReturn.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Total Return</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              {annualizedReturn.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">IRR</div>
          </div>
        </div>
        
        {/* Key Assumptions */}
        <div className="bg-muted/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Key Assumptions</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• Current EBITDA: {formatCurrency(ebitda)}</div>
            <div>• Exit Multiple: {currentMultiple}x EBITDA</div>
            <div>• Projected EBITDA ({years}Y): {formatCurrency(futureEbitda)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvestmentCalculator;
