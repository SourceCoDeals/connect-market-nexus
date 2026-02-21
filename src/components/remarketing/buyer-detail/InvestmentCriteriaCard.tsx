import { Target, Pencil, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface InvestmentCriteriaCardProps {
  investmentThesis?: string | null;
  thesisConfidence?: string | null;
  targetEbitdaMin?: number | null;
  targetEbitdaMax?: number | null;
  targetRevenueMin?: number | null;
  targetRevenueMax?: number | null;
  onEdit: () => void;
  className?: string;
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

function formatRange(min?: number | null, max?: number | null): string | null {
  if (min && max) return `${formatCurrency(min)} – ${formatCurrency(max)}`;
  if (min) return `${formatCurrency(min)}+`;
  if (max) return `Up to ${formatCurrency(max)}`;
  return null;
}

export const InvestmentCriteriaCard = ({
  investmentThesis,
  thesisConfidence,
  targetEbitdaMin,
  targetEbitdaMax,
  targetRevenueMin,
  targetRevenueMax,
  onEdit,
  className,
}: InvestmentCriteriaCardProps) => {
  const ebitdaRange = formatRange(targetEbitdaMin, targetEbitdaMax);
  const revenueRange = formatRange(targetRevenueMin, targetRevenueMax);
  const hasContent = !!investmentThesis || !!ebitdaRange || !!revenueRange;

  const getConfidenceBadgeClass = (confidence: string | null | undefined) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Target className="h-4 w-4" />
            Add-on Investment Criteria
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasContent ? (
          <p className="text-sm text-muted-foreground italic">No investment criteria available</p>
        ) : (
          <div className="space-y-3">
            {/* Size Criteria */}
            {(ebitdaRange || revenueRange) && (
              <div className="grid grid-cols-2 gap-3">
                {ebitdaRange && (
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <DollarSign className="h-3.5 w-3.5 text-green-700" />
                      <p className="text-xs font-medium text-green-800 uppercase tracking-wide">Target EBITDA</p>
                    </div>
                    <p className="text-sm font-semibold text-green-900">{ebitdaRange}</p>
                  </div>
                )}
                {revenueRange && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-700" />
                      <p className="text-xs font-medium text-blue-800 uppercase tracking-wide">Target Revenue</p>
                    </div>
                    <p className="text-sm font-semibold text-blue-900">{revenueRange}</p>
                  </div>
                )}
              </div>
            )}

            {/* Investment Thesis */}
            {investmentThesis && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 space-y-2">
                <p className="text-xs font-medium text-amber-800 uppercase tracking-wide">
                  Investment Thesis
                </p>
                <p className="text-sm text-amber-900">{investmentThesis}</p>
                {thesisConfidence && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${getConfidenceBadgeClass(thesisConfidence)}`}
                  >
                    {thesisConfidence.charAt(0).toUpperCase() + thesisConfidence.slice(1)} confidence
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
