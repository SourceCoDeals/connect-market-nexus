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
  description: string;
  icon: typeof CheckCircle2;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  'high': {
    label: 'High Intelligence',
    description: 'Comprehensive buyer data: thesis, targets, recent activity',
    icon: CheckCircle2,
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  'medium': {
    label: 'Medium Intelligence',
    description: 'Partial buyer data available - consider enrichment',
    icon: Info,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  'low': {
    label: 'Low Intelligence',
    description: 'Limited buyer data - enrichment recommended',
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
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

  const { label, description, icon: Icon, bgColor, textColor, borderColor } = config[completeness];

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        bgColor,
        textColor,
        borderColor,
        "border",
        sizeConfig[size],
        className
      )}
    >
      <Icon className="h-3 w-3 mr-1" />
      {size === 'sm' ? completeness.charAt(0).toUpperCase() + completeness.slice(1) : label}
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
