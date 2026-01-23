import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CriteriaCompletenessBannerProps {
  completenessPercent: number;
  missingFields: string[];
  onAutoEnrich: () => void;
  isEnriching?: boolean;
}

export const CriteriaCompletenessBanner = ({
  completenessPercent,
  missingFields,
  onAutoEnrich,
  isEnriching = false,
}: CriteriaCompletenessBannerProps) => {
  if (completenessPercent >= 80 || missingFields.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="font-medium text-amber-800">
            Criteria Completeness: {completenessPercent}%
          </p>
          <p className="text-sm text-amber-700">
            Missing: {missingFields.slice(0, 5).join(", ")}
            {missingFields.length > 5 && ` (+${missingFields.length - 5} more)`}
            . Add more data to improve scoring accuracy.
          </p>
        </div>
      </div>
      
      <Button 
        variant="outline" 
        onClick={onAutoEnrich}
        disabled={isEnriching}
        className="flex-shrink-0 border-amber-300 hover:bg-amber-100"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {isEnriching ? "Enriching..." : "Auto-Enrich"}
      </Button>
    </div>
  );
};
