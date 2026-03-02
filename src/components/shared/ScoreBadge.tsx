import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingUp } from "lucide-react";
import type { ScoreTier } from "@/types/remarketing";

// ─── Shared types ───────────────────────────────────────────────────────────

type Size = "sm" | "md" | "lg";

// ─── Variant: numeric ───────────────────────────────────────────────────────
// Circular badge showing a raw 0-100 score with color coding.

interface NumericProps {
  variant: "numeric";
  score: number;
  size?: Size;
  showLabel?: boolean;
  className?: string;
}

// ─── Variant: tier ──────────────────────────────────────────────────────────
// Letter-grade badge (A-F) with tier configurations.

interface TierProps {
  variant: "tier";
  tier: ScoreTier;
  score?: number;
  showLabel?: boolean;
  showScore?: boolean;
  tierVariant?: "compact" | "full";
  size?: Size;
  className?: string;
}

// ─── Variant: deal ──────────────────────────────────────────────────────────
// Deal-specific scoring badge with trend icon and tooltip.

interface DealProps {
  variant: "deal";
  score: number | null;
  showLabel?: boolean;
  size?: Size;
  className?: string;
}

export type ScoreBadgeProps = NumericProps | TierProps | DealProps;

// ─── Helpers: numeric variant ───────────────────────────────────────────────

const getNumericScoreColor = (score: number) => {
  if (score >= 80) return { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200" };
  if (score >= 70) return { bg: "bg-lime-100", text: "text-lime-700", ring: "ring-lime-200" };
  if (score >= 60) return { bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-200" };
  if (score >= 50) return { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-200" };
  return { bg: "bg-red-100", text: "text-red-700", ring: "ring-red-200" };
};

const numericSizeConfig = {
  sm: { container: "w-10 h-10", text: "text-sm font-semibold" },
  md: { container: "w-14 h-14", text: "text-xl font-bold" },
  lg: { container: "w-20 h-20", text: "text-2xl font-bold" },
};

// ─── Helpers: tier variant ──────────────────────────────────────────────────

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
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    dotColor: 'bg-orange-500'
  },
  'F': {
    label: 'Fail',
    tierLabel: 'Tier F',
    description: 'No Match',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    dotColor: 'bg-red-500'
  },
};

const tierSizeConfig = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2 py-0.5",
  lg: "text-base px-3 py-1",
};

// ─── Helpers: deal variant ──────────────────────────────────────────────────

const getDealScoreColor = (score: number) => {
  if (score >= 70) return "bg-green-500/15 text-green-600 border-green-200";
  if (score >= 40) return "bg-yellow-500/15 text-yellow-600 border-yellow-200";
  return "bg-red-500/15 text-red-600 border-red-200";
};

const getDealScoreLabel = (score: number) => {
  if (score >= 70) return "Strong";
  if (score >= 40) return "Moderate";
  return "Weak";
};

const dealSizeClasses = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2 py-0.5",
  lg: "text-base px-2.5 py-1",
};

const dealIconSizes = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
};

// ─── Utility: getTierFromScore ──────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export const getTierFromScore = (score: number): ScoreTier => {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function NumericScoreBadge({ score, size = "md", showLabel = false, className }: NumericProps) {
  const colors = getNumericScoreColor(score);
  const sizes = numericSizeConfig[size];

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center ring-2",
          colors.bg,
          colors.ring,
          sizes.container
        )}
      >
        <span className={cn(colors.text, sizes.text)}>
          {Math.round(score)}
        </span>
      </div>
      {showLabel && (
        <span className={cn("text-xs", colors.text)}>
          {score >= 80 ? "Excellent" : score >= 70 ? "Good" : score >= 60 ? "Fair" : score >= 50 ? "Moderate" : "Low"}
        </span>
      )}
    </div>
  );
}

function TierScoreBadge({
  tier,
  score,
  showLabel = true,
  showScore = false,
  tierVariant = "compact",
  size = "md",
  className,
}: TierProps) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG['F'];

  // Full variant: "->Strong 77" format
  if (tierVariant === 'full' && score !== undefined) {
    return (
      <Badge
        variant="outline"
        className={cn(
          config.bgColor,
          config.textColor,
          config.borderColor,
          tierSizeConfig[size],
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
        tierSizeConfig[size],
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
}

function DealScoreBadgeInner({ score, showLabel = false, size = "md", className }: DealProps) {
  if (score === null || score === undefined) return null;

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-semibold",
        getDealScoreColor(score),
        dealSizeClasses[size],
        className
      )}
    >
      <TrendingUp className={dealIconSizes[size]} />
      {score}
      {showLabel && <span className="font-normal ml-0.5">({getDealScoreLabel(score)})</span>}
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

// ─── Main unified component ─────────────────────────────────────────────────

export const ScoreBadge = (props: ScoreBadgeProps) => {
  switch (props.variant) {
    case "numeric":
      return <NumericScoreBadge {...props} />;
    case "tier":
      return <TierScoreBadge {...props} />;
    case "deal":
      return <DealScoreBadgeInner {...props} />;
    default:
      return null;
  }
};

export default ScoreBadge;
