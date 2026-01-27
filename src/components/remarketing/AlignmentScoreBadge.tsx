import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, Loader2 } from "lucide-react";

interface AlignmentScoreBadgeProps {
  score: number | null;
  reasoning?: string | null;
  isScoring?: boolean;
}

export function AlignmentScoreBadge({ score, reasoning, isScoring }: AlignmentScoreBadgeProps) {
  if (isScoring) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-muted-foreground gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Scoring...
        </Badge>
      </div>
    );
  }

  if (score === null || score === undefined) {
    return (
      <Badge variant="outline" className="text-muted-foreground font-mono">
        Not Scored
      </Badge>
    );
  }

  // Color coding based on score ranges
  const getBadgeStyle = (score: number) => {
    if (score >= 85) {
      return {
        bgColor: "bg-green-500/10",
        textColor: "text-green-700 dark:text-green-400",
        borderColor: "border-green-500/30",
        label: "Excellent Fit"
      };
    }
    if (score >= 70) {
      return {
        bgColor: "bg-blue-500/10",
        textColor: "text-blue-700 dark:text-blue-400",
        borderColor: "border-blue-500/30",
        label: "Good Fit"
      };
    }
    if (score >= 55) {
      return {
        bgColor: "bg-yellow-500/10",
        textColor: "text-yellow-700 dark:text-yellow-500",
        borderColor: "border-yellow-500/30",
        label: "Partial Fit"
      };
    }
    if (score >= 40) {
      return {
        bgColor: "bg-orange-500/10",
        textColor: "text-orange-700 dark:text-orange-400",
        borderColor: "border-orange-500/30",
        label: "Weak Fit"
      };
    }
    return {
      bgColor: "bg-red-500/10",
      textColor: "text-red-700 dark:text-red-400",
      borderColor: "border-red-500/30",
      label: "Poor Fit"
    };
  };

  const style = getBadgeStyle(score);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <Badge 
              variant="outline"
              className={`font-mono ${style.bgColor} ${style.textColor} ${style.borderColor}`}
            >
              {score}%
            </Badge>
            <span className="text-xs text-muted-foreground hidden lg:inline">
              {style.label}
            </span>
            {reasoning && (
              <Info className="w-3 h-3 text-muted-foreground" />
            )}
          </div>
        </TooltipTrigger>
        {reasoning && (
          <TooltipContent 
            side="left" 
            className="max-w-md p-4"
            sideOffset={5}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base">
                  Industry Alignment: {score}/100
                </span>
                <Badge 
                  variant="outline"
                  className={`text-xs ${style.bgColor} ${style.textColor} ${style.borderColor}`}
                >
                  {style.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {reasoning}
              </p>
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

export default AlignmentScoreBadge;
