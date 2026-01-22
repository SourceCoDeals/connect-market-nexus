import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200" };
  if (score >= 70) return { bg: "bg-lime-100", text: "text-lime-700", ring: "ring-lime-200" };
  if (score >= 60) return { bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-200" };
  if (score >= 50) return { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-200" };
  return { bg: "bg-red-100", text: "text-red-700", ring: "ring-red-200" };
};

const sizeConfig = {
  sm: { container: "w-10 h-10", text: "text-sm font-semibold" },
  md: { container: "w-14 h-14", text: "text-xl font-bold" },
  lg: { container: "w-20 h-20", text: "text-2xl font-bold" },
};

export const ScoreBadge = ({ 
  score, 
  size = "md", 
  showLabel = false,
  className 
}: ScoreBadgeProps) => {
  const colors = getScoreColor(score);
  const sizes = sizeConfig[size];

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
};

export default ScoreBadge;
