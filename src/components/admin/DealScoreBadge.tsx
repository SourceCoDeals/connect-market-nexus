import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingUp } from "lucide-react";

interface DealScoreBadgeProps {
  score: number | null;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function DealScoreBadge({
  score,
  showLabel = false,
  size = "md",
  className
}: DealScoreBadgeProps) {
  if (score === null || score === undefined) return null;

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-green-500/15 text-green-600 border-green-200";
    if (score >= 40) return "bg-yellow-500/15 text-yellow-600 border-yellow-200";
    return "bg-red-500/15 text-red-600 border-red-200";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return "Strong";
    if (score >= 40) return "Moderate";
    return "Weak";
  };

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-0.5",
    lg: "text-base px-2.5 py-1"
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4"
  };

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-semibold",
        getScoreColor(score),
        sizeClasses[size],
        className
      )}
    >
      <TrendingUp className={iconSizes[size]} />
      {score}
      {showLabel && <span className="font-normal ml-0.5">({getScoreLabel(score)})</span>}
    </span>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm">
            <p className="font-semibold mb-1">Deal Score: {score}/100</p>
            <p className="text-muted-foreground text-xs">
              {score >= 70 && "Strong deal with good size and motivated seller"}
              {score >= 40 && score < 70 && "Moderate deal - may need more info or smaller size"}
              {score < 40 && "Weak deal - limited data or small size"}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
