import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

/**
 * Intelligence Coverage Scoring System:
 * 
 * - Website data (data_completeness) can contribute up to 50% intel
 * - Transcript data is required to go above 50%
 * - 100% intel requires all buyers to have transcripts
 * 
 * Formula:
 *   baseIntel = (enrichedCount / total) * 50   // Website contribution (0-50%)
 *   transcriptIntel = (transcriptCount / total) * 50  // Transcript contribution (0-50%)
 *   totalIntel = baseIntel + transcriptIntel
 */

interface IntelligenceCoverageBarProps {
  /** Number of buyers with transcripts (contributes to 51-100% intel) */
  current: number;
  /** Total number of buyers */
  total: number;
  /** Number of buyers with website enrichment (contributes to 0-50% intel) */
  enrichedCount?: number;
  className?: string;
  showLabel?: boolean;
}

export function IntelligenceCoverageBar({ 
  current: transcriptCount, 
  total, 
  enrichedCount = 0,
  className,
  showLabel = true 
}: IntelligenceCoverageBarProps) {
  // Calculate two-tier intelligence score
  // Website enrichment can provide up to 50%
  const websiteIntel = total > 0 ? Math.round((enrichedCount / total) * 50) : 0;
  // Transcripts provide the other 50%
  const transcriptIntel = total > 0 ? Math.round((transcriptCount / total) * 50) : 0;
  // Total percentage
  const percentage = websiteIntel + transcriptIntel;
  
  // Color based on percentage (accounting for the new scale)
  const getColor = () => {
    if (percentage >= 75) return "bg-emerald-500";
    if (percentage >= 50) return "bg-amber-500";
    if (percentage >= 25) return "bg-orange-500";
    if (percentage > 0) return "bg-orange-400";
    return "bg-slate-400";
  };

  // Determine help message based on state
  const getHelpMessage = () => {
    if (total === 0) return "No buyers in this universe yet";
    if (percentage === 0) return "Add website data or call transcripts to start building intel";
    if (websiteIntel > 0 && transcriptCount === 0) {
      return `Website data provides ${websiteIntel}% intel. Add call transcripts to unlock the remaining 50%+`;
    }
    if (transcriptCount > 0 && transcriptCount < total) {
      return `${transcriptCount} of ${total} buyers have transcripts. Add more to reach 100%`;
    }
    if (transcriptCount === total) {
      return "Full intelligence coverage - all buyers have call transcripts!";
    }
    return "Add call transcripts for full intel";
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs">
        {showLabel && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground flex items-center gap-1 cursor-help">
                    {transcriptCount} of {total} buyers
                    <HelpCircle className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  <p className="font-medium mb-1">Intelligence Coverage Breakdown:</p>
                  <ul className="space-y-0.5">
                    <li>• Website intel: {websiteIntel}% (max 50%)</li>
                    <li>• Transcript intel: {transcriptIntel}% (max 50%)</li>
                  </ul>
                  <p className="mt-1 text-muted-foreground">{getHelpMessage()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="font-medium">{percentage}% intel</span>
          </>
        )}
      </div>
      {/* Progress bar with two segments */}
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
        {/* Website intel segment (blue/slate) */}
        {websiteIntel > 0 && (
          <div 
            className="h-full bg-blue-400 transition-all duration-300"
            style={{ width: `${websiteIntel}%` }}
          />
        )}
        {/* Transcript intel segment (green/amber based on coverage) */}
        {transcriptIntel > 0 && (
          <div 
            className={cn("h-full transition-all duration-300", getColor())}
            style={{ width: `${transcriptIntel}%` }}
          />
        )}
      </div>
      {showLabel && percentage === 0 && total > 0 && (
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          Add call transcripts for full intel
        </p>
      )}
    </div>
  );
}
