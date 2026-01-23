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
    label: 'Strong Thesis Data',
    shortLabel: 'Strong',
    description: 'Comprehensive buyer data: thesis, targets, recent activity',
    icon: CheckCircle2,
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  'medium': {
    label: 'Partial Thesis Data',
    shortLabel: 'Partial',
    description: 'Partial buyer data available - consider enrichment',
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
  showTooltip = true,
  size = "sm",
  className,
}: IntelligenceBadgeProps) => {
  if (!completeness) {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "bg-muted text-muted-foreground border-muted",
          sizeConfig[size],
          className
        )}
      >
        <HelpCircle className="h-3 w-3 mr-1" />
        Unknown
      </Badge>
    );
  }

  const { label, shortLabel, description, dotColor, bgColor, textColor, borderColor } = config[completeness];

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        bgColor,
        textColor,
        borderColor,
        "border flex items-center gap-1.5",
        sizeConfig[size],
        className
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", dotColor)} />
      {size === 'sm' ? shortLabel : label}
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
        <TooltipContent>
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default IntelligenceBadge;
