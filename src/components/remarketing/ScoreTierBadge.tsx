import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScoreTier } from "@/types/remarketing";

interface ScoreTierBadgeProps {
  tier: ScoreTier;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const TIER_CONFIG: Record<ScoreTier, { 
  label: string; 
  description: string;
  bgColor: string; 
  textColor: string;
  borderColor: string;
}> = {
  'A': { 
    label: 'Tier A', 
    description: 'Excellent Match',
    bgColor: 'bg-emerald-100', 
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200'
  },
  'B': { 
    label: 'Tier B', 
    description: 'Good Match',
    bgColor: 'bg-blue-100', 
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200'
  },
  'C': { 
    label: 'Tier C', 
    description: 'Fair Match',
    bgColor: 'bg-amber-100', 
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200'
  },
  'D': { 
    label: 'Tier D', 
    description: 'Poor Match',
    bgColor: 'bg-red-100', 
    textColor: 'text-red-700',
    borderColor: 'border-red-200'
  },
};

const sizeConfig = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2 py-0.5",
  lg: "text-base px-3 py-1",
};

export const ScoreTierBadge = ({ 
  tier, 
  showLabel = true, 
  size = "md",
  className 
}: ScoreTierBadgeProps) => {
  const config = TIER_CONFIG[tier] || TIER_CONFIG['D'];

  return (
    <Badge 
      variant="outline"
      className={cn(
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeConfig[size],
        "font-semibold border",
        className
      )}
    >
      {showLabel ? config.label : tier}
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
