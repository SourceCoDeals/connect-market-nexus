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
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-sm text-amber-800">
            {completenessPercent}% Complete
          </span>
          <span className="text-xs text-amber-700">
            Missing: {missingFields.slice(0, 3).join(", ")}
            {missingFields.length > 3 && ` (+${missingFields.length - 3})`}
          </span>
        </div>
      </div>
      
      <Button 
        variant="outline" 
        size="sm"
        onClick={onAutoEnrich}
        disabled={isEnriching}
        className="flex-shrink-0 border-amber-300 hover:bg-amber-100 h-8 text-xs"
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        {isEnriching ? "Enriching..." : "Auto-Enrich"}
      </Button>
    </div>
  );
};
