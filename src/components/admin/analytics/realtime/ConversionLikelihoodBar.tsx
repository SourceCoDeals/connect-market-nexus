import { cn } from "@/lib/utils";

interface ConversionLikelihoodBarProps {
  score: number; // 0-100
  vsAvg: number; // percentage vs average (can be negative)
}

export function ConversionLikelihoodBar({ score, vsAvg }: ConversionLikelihoodBarProps) {
  const isPositive = vsAvg >= 0;
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Conversion likelihood
        </span>
        <span className={cn(
          "text-xs font-semibold tabular-nums",
          isPositive ? "text-emerald-500" : "text-rose-400"
        )}>
          {isPositive ? '+' : ''}{vsAvg}%
        </span>
      </div>
      
      <div className="relative h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
        <div 
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            isPositive 
              ? "bg-gradient-to-r from-cyan-400 to-emerald-400"
              : "bg-gradient-to-r from-rose-500 to-orange-400"
          )}
          style={{ width: `${Math.min(Math.max(score, 5), 100)}%` }}
        />
        {/* Average marker at 50% */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-muted-foreground/30" />
      </div>
      
      <p className="text-[9px] text-muted-foreground/70">
        vs. marketplace average
      </p>
    </div>
  );
}
