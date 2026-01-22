import { cn } from "@/lib/utils";

interface IntelligenceCoverageBarProps {
  current: number;
  total: number;
  className?: string;
  showLabel?: boolean;
}

export function IntelligenceCoverageBar({ 
  current, 
  total, 
  className,
  showLabel = true 
}: IntelligenceCoverageBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  // Color based on percentage
  const getColor = () => {
    if (percentage >= 75) return "bg-green-500";
    if (percentage >= 50) return "bg-yellow-500";
    if (percentage >= 25) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs">
        {showLabel && (
          <>
            <span className="text-muted-foreground">
              {current} of {total} buyers
            </span>
            <span className="font-medium">{percentage}% intel</span>
          </>
        )}
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-300", getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
