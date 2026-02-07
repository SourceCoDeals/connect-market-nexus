import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DataCompleteness } from "@/types/remarketing";

interface IntelligenceBadgeProps {
  completeness: DataCompleteness | null;
  /** Whether the buyer has at least one transcript. Without a transcript, max intel is "Some Intel" (medium). */
  hasTranscript?: boolean;
  missingFields?: string[];
  showTooltip?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const config: Record<DataCompleteness, {
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof CheckCircle2;
  dotColor: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  'high': {
    label: 'Strong Intel',
    shortLabel: 'Strong',
    description: 'High-fidelity data from call transcripts - investment thesis and preferences are well understood',
    icon: CheckCircle2,
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  'medium': {
    label: 'Some Intel',
    shortLabel: 'Some Intel',
    description: 'Website data available. Add call transcripts to unlock investment thesis insights.',
    icon: Info,
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  'low': {
    label: 'Needs Research',
    shortLabel: 'Needs Research',
    description: 'Limited buyer data - enrichment recommended',
    icon: AlertCircle,
    dotColor: 'bg-gray-400',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-200',
  },
};

const sizeConfig = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2 py-0.5",
};

export const IntelligenceBadge = ({
  completeness,
  hasTranscript = false,
  missingFields = [],
  showTooltip = true,
  size = "sm",
  className,
}: IntelligenceBadgeProps) => {
  // Strong Intel requires transcript data — websites alone don't provide enough depth
  // (thesis, investment preferences, deal terms). BuyerMatchCard now passes hasTranscript
  // from extraction_sources.
  let effectiveCompleteness = completeness;
  if (effectiveCompleteness === 'high' && !hasTranscript) {
    effectiveCompleteness = 'medium';
  }

  if (!effectiveCompleteness) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-muted/50 text-muted-foreground border-border",
          sizeConfig[size],
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mr-1.5" />
        Needs Research
      </Badge>
    );
  }

  const { label, shortLabel, description, icon: Icon, dotColor, bgColor, textColor, borderColor } = config[effectiveCompleteness];
  const displayLabel = size === "sm" ? shortLabel : label;
  
  // Limit missing fields shown to first 5 with "+N more" indicator
  const displayedMissingFields = missingFields.slice(0, 5);
  const remainingCount = missingFields.length - displayedMissingFields.length;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        bgColor,
        textColor,
        borderColor,
        sizeConfig[size],
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", dotColor)} />
      {displayLabel}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="left" align="start" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", textColor)} />
              <span className="font-medium">{label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
            
            {/* Missing data list - Whispers parity */}
            {missingFields.length > 0 && (
              <div className="pt-1 border-t">
                <p className="text-xs font-medium mb-1">Missing data:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {displayedMissingFields.map((field, i) => (
                    <li key={i}>• {field}</li>
                  ))}
                  {remainingCount > 0 && (
                    <li className="text-muted-foreground/70">+{remainingCount} more...</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default IntelligenceBadge;
