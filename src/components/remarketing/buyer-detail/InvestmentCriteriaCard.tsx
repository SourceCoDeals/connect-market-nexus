import { Target, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface InvestmentCriteriaCardProps {
  investmentThesis?: string | null;
  thesisConfidence?: string | null;
  strategicPriorities?: string[] | null;
  dealBreakers?: string[] | null;
  onEdit: () => void;
}

export const InvestmentCriteriaCard = ({
  investmentThesis,
  thesisConfidence,
  strategicPriorities,
  dealBreakers,
  onEdit,
}: InvestmentCriteriaCardProps) => {
  const hasContent = investmentThesis || strategicPriorities?.length || dealBreakers?.length;

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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Target className="h-4 w-4" />
            Platform Investment Criteria
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
          <>
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

            {strategicPriorities && strategicPriorities.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Strategic Priorities
                </p>
                <p className="text-sm">{strategicPriorities.join(", ")}</p>
              </div>
            )}

            {dealBreakers && dealBreakers.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Deal Breakers
                </p>
                <div className="flex flex-wrap gap-2">
                  {dealBreakers.map((breaker, index) => (
                    <Badge 
                      key={index} 
                      variant="destructive"
                      className="bg-red-100 text-red-800 hover:bg-red-100"
                    >
                      {breaker}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
