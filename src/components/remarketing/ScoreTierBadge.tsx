import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import type { ScoreTier } from "@/types/remarketing";

interface ScoreTierBadgeProps {
  tier: ScoreTier;
  score?: number; // Numeric score to display
  showLabel?: boolean;
  showScore?: boolean; // Whether to show numeric value
  variant?: 'compact' | 'full'; // 'full' shows "→Strong 77"
  size?: "sm" | "md" | "lg";
  className?: string;
}

const TIER_CONFIG: Record<ScoreTier, { 
  label: string; 
  tierLabel: string;
  description: string;
  bgColor: string; 
  textColor: string;
  borderColor: string;
  dotColor: string;
}> = {
  'A': { 
    label: 'Strong', 
    tierLabel: 'Tier A',
    description: 'Excellent Match',
    bgColor: 'bg-emerald-100', 
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    dotColor: 'bg-emerald-500'
  },
  'B': { 
    label: 'Moderate', 
    tierLabel: 'Tier B',
    description: 'Good Match',
    bgColor: 'bg-blue-100', 
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    dotColor: 'bg-blue-500'
  },
  'C': { 
    label: 'Fair', 
    tierLabel: 'Tier C',
    description: 'Fair Match',
    bgColor: 'bg-amber-100', 
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    dotColor: 'bg-amber-500'
  },
  'D': { 
    label: 'Poor', 
    tierLabel: 'Tier D',
    description: 'Poor Match',
    bgColor: 'bg-red-100', 
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    dotColor: 'bg-red-500'
  },
};

const sizeConfig = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2 py-0.5",
  lg: "text-base px-3 py-1",
};

export const ScoreTierBadge = ({ 
  tier, 
  score,
  showLabel = true, 
  showScore = false,
  variant = 'compact',
  size = "md",
  className 
}: ScoreTierBadgeProps) => {
  const config = TIER_CONFIG[tier] || TIER_CONFIG['D'];

  // Full variant: "→Strong 77" format like Whispers
  if (variant === 'full' && score !== undefined) {
    return (
      <Badge 
        variant="outline"
        className={cn(
          config.bgColor,
          config.textColor,
          config.borderColor,
          sizeConfig[size],
          "font-semibold border flex items-center gap-1",
          className
        )}
      >
        <TrendingUp className="h-3 w-3" />
        <span>{config.label}</span>
        <span className="font-bold">{Math.round(score)}</span>
      </Badge>
    );
  }

  // Compact variant with optional score
  return (
    <Badge 
      variant="outline"
      className={cn(
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeConfig[size],
        "font-semibold border flex items-center gap-1",
        className
      )}
    >
      {showScore && score !== undefined && (
        <span className={cn("w-1.5 h-1.5 rounded-full", config.dotColor)} />
      )}
      {showLabel ? config.tierLabel : tier}
      {showScore && score !== undefined && (
        <span className="font-bold ml-0.5">{Math.round(score)}</span>
      )}
      {showLabel && size === 'lg' && (
        <span className="ml-1 font-normal opacity-75">• {config.description}</span>
      )}
    </Badge>
  );
};

export const getTierFromScore = (score: number): ScoreTier => {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
};

export default ScoreTierBadge;
